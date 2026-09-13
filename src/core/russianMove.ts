import { algebraicToSquare, squareToAlgebraic } from './board';
import { applyLegalMove, resolveLegalMove } from './rules';
import type { Position } from './types';

export interface RussianMove {
  /** Canonical application notation. Captures are normalized to ':' internally. */
  notation: string;
  /** Compact source notation after trimming annotations and normalizing × to x. */
  sourceNotation: string;
  path: number[];
  isCapture: boolean;
}

/**
 * Reads Russian draughts move notation.
 *
 * Strict PDN 3.0 uses ':' for GameType 25 captures, while historical corpora
 * commonly contain `x` and sometimes the typographic multiplication sign `×`.
 * Whitespace around separators is also tolerated by the reader. The domain
 * model normalizes captures to ':' without losing the original PDN in the AST.
 */
export function parseRussianMove(raw: string): RussianMove {
  const sourceNotation = raw
    .trim()
    .replace(/[!?]+$/g, '')
    .replace(/\s+/g, '')
    .replace(/×/g, 'x');
  const hasMove = sourceNotation.includes('-');
  const hasCapture = /[x:]/i.test(sourceNotation);
  if (hasMove === hasCapture) throw new Error(`Некорректная запись хода: ${raw}`);

  const parts = hasCapture ? sourceNotation.split(/[x:]/i) : sourceNotation.split('-');
  const path = parts.map(algebraicToSquare);
  if (path.length < 2) throw new Error(`Неполная запись хода: ${raw}`);

  const separator = hasCapture ? ':' : '-';
  return {
    notation: path.map(squareToAlgebraic).join(separator),
    sourceNotation,
    path,
    isCapture: hasCapture,
  };
}

/**
 * Applies notation only after resolving it against all legal moves.
 * This is what makes historical shortened captures such as `a3xe3` possible:
 * the rules engine reconstructs the full capture sequence instead of treating
 * start/end as one geometric jump.
 */
export function applyRussianMove(position: Position, move: RussianMove): Position {
  return applyLegalMove(position, resolveLegalMove(position, move));
}
