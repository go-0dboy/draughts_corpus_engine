import { positionKey } from '../core/position';
import type { Position } from '../core/types';
import type { PdnGame } from './pdn';
import { classifyResult } from './result';

export interface PositionOccurrence {
  gameId: string;
  ply: number;
  moveAfter: string | null;
  result: string;
  white: string;
  black: string;
  date: string;
}

export interface ContinuationStat {
  move: string;
  games: number;
  whiteWins: number;
  draws: number;
  blackWins: number;
}

export interface PositionReport {
  key: string;
  occurrences: PositionOccurrence[];
  continuations: ContinuationStat[];
  whiteWins: number;
  draws: number;
  blackWins: number;
}

/**
 * Transitional in-memory index.
 *
 * Only games whose current replay layer completed are indexed. Importing game
 * metadata is allowed even when a legacy shortened capture cannot yet be
 * resolved, but such a game must not pollute position statistics.
 */
export class CorpusIndex {
  readonly games: PdnGame[];
  private readonly byPosition = new Map<string, PositionOccurrence[]>();
  private indexedGames = 0;

  constructor(games: PdnGame[]) {
    this.games = games;
    for (const game of games) {
      if (game.replay.status !== 'complete') continue;
      this.indexedGames += 1;

      game.positions.forEach((position, ply) => {
        const key = positionKey(position);
        const list = this.byPosition.get(key) ?? [];
        list.push({
          gameId: game.id,
          ply,
          moveAfter: game.moves[ply] ?? null,
          result: game.result,
          white: game.headers.White ?? '—',
          black: game.headers.Black ?? '—',
          date: game.headers.Date ?? '—',
        });
        this.byPosition.set(key, list);
      });
    }
  }

  report(position: Position): PositionReport {
    const key = positionKey(position);
    const occurrences = this.byPosition.get(key) ?? [];
    const continuations = new Map<string, ContinuationStat>();
    let whiteWins = 0;
    let draws = 0;
    let blackWins = 0;

    for (const occurrence of occurrences) {
      const outcome = classifyResult(occurrence.result);
      if (outcome === 'white-win') whiteWins += 1;
      else if (outcome === 'black-win') blackWins += 1;
      else if (outcome === 'draw') draws += 1;

      if (!occurrence.moveAfter) continue;
      const stat = continuations.get(occurrence.moveAfter) ?? {
        move: occurrence.moveAfter,
        games: 0,
        whiteWins: 0,
        draws: 0,
        blackWins: 0,
      };
      stat.games += 1;
      if (outcome === 'white-win') stat.whiteWins += 1;
      else if (outcome === 'black-win') stat.blackWins += 1;
      else if (outcome === 'draw') stat.draws += 1;
      continuations.set(occurrence.moveAfter, stat);
    }

    return {
      key,
      occurrences,
      continuations: [...continuations.values()].sort((a, b) => b.games - a.games || a.move.localeCompare(b.move)),
      whiteWins,
      draws,
      blackWins,
    };
  }

  uniquePositionCount(): number {
    return this.byPosition.size;
  }

  indexedGameCount(): number {
    return this.indexedGames;
  }

  pendingReplayGameCount(): number {
    return this.games.length - this.indexedGames;
  }
}
