import { rowColToSquare, squareToAlgebraic, squareToRowCol } from './board';
import { pieceAt, positionKey, setPiece } from './position';
import type { Piece, Position, Side } from './types';

const DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

export interface LegalMove {
  from: number;
  to: number;
  /** Landing squares, including the start square at index 0. */
  path: number[];
  /** Captured squares in capture order. */
  captured: number[];
  isCapture: boolean;
  pieceBefore: Piece;
  pieceAfter: Piece;
}

export interface MoveSelector {
  path: number[];
  isCapture: boolean;
}

/**
 * Generates every legal move for the side to move under Russian draughts rules.
 * If at least one capture exists, quiet moves are not returned.
 */
export function generateLegalMoves(position: Position): LegalMove[] {
  const captures: LegalMove[] = [];

  forEachSidePiece(position, position.sideToMove, (square, piece) => {
    captures.push(...generateCaptureSequences(position, square, piece));
  });

  if (captures.length > 0) return captures;

  const quietMoves: LegalMove[] = [];
  forEachSidePiece(position, position.sideToMove, (square, piece) => {
    quietMoves.push(...generateQuietMoves(position, square, piece));
  });
  return quietMoves;
}

/**
 * Resolves a textual move selector against the actual legal moves.
 *
 * Historical corpora often store a multi-capture only as start/end, e.g.
 * `a3xe3`. If exactly one legal sequence matches those endpoints it can be
 * reconstructed. If several sequences lead to the same resulting position the
 * position is still unambiguous and is safe to accept. Otherwise the reader
 * must report ambiguity instead of guessing.
 */
export function resolveLegalMove(position: Position, selector: MoveSelector): LegalMove {
  if (selector.path.length < 2) throw new Error('Ход должен содержать начальное и конечное поле.');

  const from = selector.path[0];
  const to = selector.path[selector.path.length - 1];
  let candidates = generateLegalMoves(position).filter(
    (move) => move.isCapture === selector.isCapture && move.from === from && move.to === to,
  );

  if (selector.path.length > 2) {
    candidates = candidates.filter((move) => samePath(move.path, selector.path));
  }

  if (candidates.length === 0) {
    throw new Error(
      `Ход ${squareToAlgebraic(from)}${selector.isCapture ? ':' : '-'}${squareToAlgebraic(to)} не является легальным в текущей позиции.`,
    );
  }

  if (candidates.length === 1) return candidates[0];

  const byResult = new Map<string, LegalMove>();
  for (const candidate of candidates) {
    byResult.set(positionKey(applyLegalMove(position, candidate)), candidate);
  }
  if (byResult.size === 1) return candidates[0];

  throw new Error(
    `Сокращённая запись неоднозначна: найдено ${candidates.length} легальных последовательностей с теми же началом и концом.`,
  );
}

export function applyLegalMove(position: Position, move: LegalMove): Position {
  const piece = pieceAt(position, move.from);
  if (!piece || pieceSide(piece) !== position.sideToMove) {
    throw new Error(`На ${squareToAlgebraic(move.from)} нет шашки ходящей стороны.`);
  }

  let next = setPiece(position, move.from, null);
  for (const square of move.captured) next = setPiece(next, square, null);
  next = setPiece(next, move.to, move.pieceAfter);
  return { ...next, sideToMove: opposite(position.sideToMove) };
}

export function formatLegalMove(move: LegalMove): string {
  const separator = move.isCapture ? ':' : '-';
  return move.path.map(squareToAlgebraic).join(separator);
}

function generateCaptureSequences(position: Position, start: number, piece: Piece): LegalMove[] {
  const moves: LegalMove[] = [];
  searchCaptures(position, start, piece, piece, [start], [], new Set<number>(), moves);
  return moves;
}

function searchCaptures(
  position: Position,
  current: number,
  currentPiece: Piece,
  originalPiece: Piece,
  path: number[],
  capturedOrder: number[],
  capturedSet: Set<number>,
  output: LegalMove[],
): void {
  const options = isKing(currentPiece)
    ? kingCaptureOptions(position, current, currentPiece, capturedSet)
    : manCaptureOptions(position, current, currentPiece, capturedSet);

  if (options.length === 0) {
    if (capturedOrder.length > 0) {
      output.push({
        from: path[0],
        to: current,
        path: [...path],
        captured: [...capturedOrder],
        isCapture: true,
        pieceBefore: originalPiece,
        pieceAfter: currentPiece,
      });
    }
    return;
  }

  for (const option of options) {
    const promotedPiece = promote(currentPiece, option.to);
    let next = setPiece(position, current, null);
    next = setPiece(next, option.to, promotedPiece);

    const nextCapturedSet = new Set(capturedSet);
    nextCapturedSet.add(option.captured);

    searchCaptures(
      next,
      option.to,
      promotedPiece,
      originalPiece,
      [...path, option.to],
      [...capturedOrder, option.captured],
      nextCapturedSet,
      output,
    );
  }
}

interface CaptureOption {
  to: number;
  captured: number;
}

function manCaptureOptions(position: Position, from: number, piece: Piece, captured: Set<number>): CaptureOption[] {
  const { row, col } = squareToRowCol(from);
  const result: CaptureOption[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    const middle = rowColToSquare(row + dr, col + dc);
    const landing = rowColToSquare(row + dr * 2, col + dc * 2);
    if (middle === null || landing === null) continue;
    if (pieceAt(position, landing)) continue;

    const victim = pieceAt(position, middle);
    if (!victim || pieceSide(victim) === pieceSide(piece) || captured.has(middle)) continue;
    result.push({ to: landing, captured: middle });
  }

  return result;
}

function kingCaptureOptions(position: Position, from: number, piece: Piece, captured: Set<number>): CaptureOption[] {
  const { row, col } = squareToRowCol(from);
  const result: CaptureOption[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    let step = 1;
    let victimSquare: number | null = null;

    while (true) {
      const square = rowColToSquare(row + dr * step, col + dc * step);
      if (square === null) break;
      const occupant = pieceAt(position, square);

      if (victimSquare === null) {
        if (!occupant) {
          step += 1;
          continue;
        }

        if (pieceSide(occupant) === pieceSide(piece) || captured.has(square)) break;
        victimSquare = square;
        step += 1;
        continue;
      }

      if (occupant) break;
      result.push({ to: square, captured: victimSquare });
      step += 1;
    }
  }

  return result;
}

function generateQuietMoves(position: Position, from: number, piece: Piece): LegalMove[] {
  return isKing(piece) ? generateKingQuietMoves(position, from, piece) : generateManQuietMoves(position, from, piece);
}

function generateManQuietMoves(position: Position, from: number, piece: Piece): LegalMove[] {
  const { row, col } = squareToRowCol(from);
  const dr = pieceSide(piece) === 'W' ? -1 : 1;
  const result: LegalMove[] = [];

  for (const dc of [-1, 1] as const) {
    const to = rowColToSquare(row + dr, col + dc);
    if (to === null || pieceAt(position, to)) continue;
    result.push({
      from,
      to,
      path: [from, to],
      captured: [],
      isCapture: false,
      pieceBefore: piece,
      pieceAfter: promote(piece, to),
    });
  }

  return result;
}

function generateKingQuietMoves(position: Position, from: number, piece: Piece): LegalMove[] {
  const { row, col } = squareToRowCol(from);
  const result: LegalMove[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    for (let step = 1; ; step += 1) {
      const to = rowColToSquare(row + dr * step, col + dc * step);
      if (to === null || pieceAt(position, to)) break;
      result.push({
        from,
        to,
        path: [from, to],
        captured: [],
        isCapture: false,
        pieceBefore: piece,
        pieceAfter: piece,
      });
    }
  }

  return result;
}

function forEachSidePiece(position: Position, side: Side, callback: (square: number, piece: Piece) => void): void {
  for (let square = 1; square <= 32; square += 1) {
    const piece = pieceAt(position, square);
    if (piece && pieceSide(piece) === side) callback(square, piece);
  }
}

function promote(piece: Piece, square: number): Piece {
  if (isKing(piece)) return piece;
  const row = squareToRowCol(square).row;
  if (piece === 'white-man' && row === 0) return 'white-king';
  if (piece === 'black-man' && row === 7) return 'black-king';
  return piece;
}

function pieceSide(piece: Piece): Side {
  return piece.startsWith('white') ? 'W' : 'B';
}

function opposite(side: Side): Side {
  return side === 'W' ? 'B' : 'W';
}

function isKing(piece: Piece): boolean {
  return piece.endsWith('king');
}

function samePath(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((square, index) => square === right[index]);
}
