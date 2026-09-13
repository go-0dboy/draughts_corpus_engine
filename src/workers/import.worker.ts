/// <reference lib="webworker" />

import { iterateGameSources, parsePdnGameSource, type PdnGame } from '../corpus/pdn';
import { getCorpusStats, storeGamesBatch } from '../storage/corpusDb';

const BATCH_SIZE = 100;

interface ImportRequest {
  type: 'import';
  text: string;
}

export type ImportWorkerMessage =
  | { type: 'progress'; parsed: number; imported: number; skipped: number; errors: number; lastError?: string }
  | { type: 'done'; parsed: number; imported: number; skipped: number; errors: number; games: number; positions: number }
  | { type: 'fatal'; message: string };

self.onmessage = (event: MessageEvent<ImportRequest>) => {
  if (event.data.type !== 'import') return;
  void importText(event.data.text);
};

async function importText(text: string): Promise<void> {
  let parsed = 0;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let batch: PdnGame[] = [];

  try {
    for (const source of iterateGameSources(text)) {
      parsed += 1;
      try {
        batch.push(parsePdnGameSource(source, parsed));
      } catch (error) {
        errors += 1;
        postProgress(error instanceof Error ? error.message : String(error));
      }

      if (batch.length >= BATCH_SIZE) {
        const result = await storeGamesBatch(batch);
        imported += result.insertedGames;
        skipped += result.skippedGames;
        batch = [];
        postProgress();
        // Yield so IndexedDB events and UI progress messages are delivered promptly.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    if (batch.length > 0) {
      const result = await storeGamesBatch(batch);
      imported += result.insertedGames;
      skipped += result.skippedGames;
    }

    const stats = await getCorpusStats();
    postMessage({
      type: 'done',
      parsed,
      imported,
      skipped,
      errors,
      games: stats.games,
      positions: stats.positions,
    } satisfies ImportWorkerMessage);
  } catch (error) {
    postMessage({
      type: 'fatal',
      message: error instanceof Error ? error.message : String(error),
    } satisfies ImportWorkerMessage);
  }

  function postProgress(lastError?: string): void {
    postMessage({ type: 'progress', parsed, imported, skipped, errors, lastError } satisfies ImportWorkerMessage);
  }
}

export {};
