import { CorpusIndex, type PositionReport } from '../corpus';
import type { PdnGame } from '../corpus/pdn';
import { classifyResult } from '../corpus/result';
import type { Position } from '../core/types';
import type { CorpusReadApi, CorpusStats, GameSearchQuery, GameSummary } from './contracts';

/**
 * Development adapter for the stable CorpusReadApi.
 *
 * Production storage will replace this implementation without changing tools.
 */
export class MemoryCorpus implements CorpusReadApi {
  private readonly index: CorpusIndex;

  constructor(private readonly sourceGames: readonly PdnGame[]) {
    this.index = new CorpusIndex([...sourceGames]);
  }

  async stats(): Promise<CorpusStats> {
    return {
      games: this.sourceGames.length,
      indexedGames: this.index.indexedGameCount(),
      pendingReplayGames: this.index.pendingReplayGameCount(),
      uniquePositions: this.index.uniquePositionCount(),
    };
  }

  async searchGames(query: GameSearchQuery = {}): Promise<GameSummary[]> {
    const text = query.text?.trim().toLocaleLowerCase('ru') ?? '';
    const limit = Math.max(1, query.limit ?? 100);
    const offset = Math.max(0, query.offset ?? 0);

    const result: GameSummary[] = [];
    let skipped = 0;

    for (const game of this.sourceGames) {
      const outcome = classifyResult(game.result);
      const white = game.headers.White ?? '—';
      const black = game.headers.Black ?? '—';
      const event = game.headers.Event;
      const site = game.headers.Site;
      const date = game.headers.Date;

      if (query.white && !white.toLocaleLowerCase('ru').includes(query.white.toLocaleLowerCase('ru'))) continue;
      if (query.black && !black.toLocaleLowerCase('ru').includes(query.black.toLocaleLowerCase('ru'))) continue;
      if (query.event && !(event ?? '').toLocaleLowerCase('ru').includes(query.event.toLocaleLowerCase('ru'))) continue;
      if (query.dateFrom && date && date < query.dateFrom) continue;
      if (query.dateTo && date && date > query.dateTo) continue;
      if (query.outcome && outcome !== query.outcome) continue;

      if (text) {
        const haystack = [white, black, event, site, date, game.result]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('ru');
        if (!haystack.includes(text)) continue;
      }

      if (skipped < offset) {
        skipped += 1;
        continue;
      }

      result.push({
        id: game.id,
        white,
        black,
        event,
        site,
        date,
        round: game.headers.Round,
        resultText: game.result,
        outcome,
        plyCount: game.moves.length,
        indexed: game.replay.status === 'complete',
      });

      if (result.length >= limit) break;
    }

    return result;
  }

  async positionReport(position: Position): Promise<PositionReport> {
    return this.index.report(position);
  }
}
