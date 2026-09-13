import { positionKey } from '../core/position';
import type { Position } from '../core/types';
import type { PdnGame } from './pdn';

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

export class CorpusIndex {
  readonly games: PdnGame[];
  private readonly byPosition = new Map<string, PositionOccurrence[]>();

  constructor(games: PdnGame[]) {
    this.games = games;
    for (const game of games) {
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
      if (occurrence.result === '1-0') whiteWins += 1;
      else if (occurrence.result === '0-1') blackWins += 1;
      else if (occurrence.result === '1/2-1/2') draws += 1;

      if (!occurrence.moveAfter) continue;
      const stat = continuations.get(occurrence.moveAfter) ?? {
        move: occurrence.moveAfter,
        games: 0,
        whiteWins: 0,
        draws: 0,
        blackWins: 0,
      };
      stat.games += 1;
      if (occurrence.result === '1-0') stat.whiteWins += 1;
      else if (occurrence.result === '0-1') stat.blackWins += 1;
      else if (occurrence.result === '1/2-1/2') stat.draws += 1;
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
}
