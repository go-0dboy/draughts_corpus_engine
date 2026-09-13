import type { PdnGame } from '../corpus/pdn';
import { classifyResult } from '../corpus/result';
import { parseRussianMove } from '../core/russianMove';
import type { Game } from './game';

const PROMOTED_TAGS = new Set(['White', 'Black', 'Event', 'Site', 'Date', 'Round', 'Result', 'GameType', 'FEN']);

/** Converts the external PDN representation into the storage-independent domain model. */
export function gameFromPdn(source: PdnGame): Game {
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(source.headers)) {
    if (!PROMOTED_TAGS.has(key)) extra[key] = value;
  }

  return {
    id: source.id,
    metadata: {
      white: source.headers.White ?? '—',
      black: source.headers.Black ?? '—',
      event: emptyToUndefined(source.headers.Event),
      site: emptyToUndefined(source.headers.Site),
      date: emptyToUndefined(source.headers.Date),
      round: emptyToUndefined(source.headers.Round),
      extra,
    },
    result: {
      text: source.result,
      outcome: classifyResult(source.result),
    },
    moves: source.moves.map((sourceNotation, index) => {
      let canonicalNotation: string | undefined;
      if (index < source.replay.appliedMoves) {
        try {
          canonicalNotation = parseRussianMove(sourceNotation).notation;
        } catch {
          canonicalNotation = undefined;
        }
      }
      return { sourceNotation, canonicalNotation };
    }),
    initialPosition: source.positions[0],
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
