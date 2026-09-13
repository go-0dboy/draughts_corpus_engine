/// <reference lib="webworker" />

import { iterateGameSources, parsePdnGameSource, type PdnGame } from '../corpus/pdn';
import { getCorpusStats, storeGamesBatch } from '../storage/corpusDb';

const BATCH_SIZE = 100;

type ImportRequest =
  | { type: 'import-text'; text: string }
  | { type: 'import-file'; file: File };

export type ImportWorkerMessage =
  | { type: 'progress'; parsed: number; imported: number; skipped: number; errors: number; lastError?: string }
  | { type: 'done'; parsed: number; imported: number; skipped: number; errors: number; games: number; positions: number }
  | { type: 'fatal'; message: string };

self.onmessage = (event: MessageEvent<ImportRequest>) => {
  const request = event.data;
  if (request.type === 'import-text') {
    void importText(request.text);
  } else if (request.type === 'import-file') {
    void request.file.text().then(importText).catch(reportFatal);
  }
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
    reportFatal(error);
  }

  function postProgress(lastError?: string): void {
    postMessage({ type: 'progress', parsed, imported, skipped, errors, lastError } satisfies ImportWorkerMessage);
  }
}

function reportFatal(error: unknown): void {
  postMessage({
    type: 'fatal',
    message: error instanceof Error ? error.message : String(error),
  } satisfies ImportWorkerMessage);
}

export {};
