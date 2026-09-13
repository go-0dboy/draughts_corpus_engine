import { algebraicToSquare, rowColToSquare, squareToAlgebraic, squareToRowCol } from './board';
import { pieceAt, setPiece } from './position';
import type { Piece, Position, Side } from './types';

export interface RussianMove {
  /** Canonical application notation. Captures are normalized to ':' internally. */
  notation: string;
  /** Original notation after trimming annotations. */
  sourceNotation: string;
  path: number[];
  isCapture: boolean;
}

/**
 * Reads Russian draughts move notation.
 *
 * Strict PDN 3.0 uses ':' for GameType 25 captures, while historical corpora
 * commonly contain 'x'. The reader accepts both; the domain model normalizes
 * captures to ':' without losing sourceNotation.
 */
export function parseRussianMove(raw: string): RussianMove {
  const sourceNotation = raw.trim().replace(/[!?]+$/g, '');
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

export function applyRussianMove(position: Position, move: RussianMove): Position {
  if (!move.isCapture && move.path.length !== 2) throw new Error('Тихий ход должен содержать два поля.');

  let next = { ...position };
  let current = move.path[0];
  let movingPiece = pieceAt(next, current);
  if (!movingPiece) throw new Error(`На ${squareToAlgebraic(current)} нет шашки.`);
  if (pieceSide(movingPiece) !== position.sideToMove) throw new Error('Ходит шашка другой стороны.');

  next = setPiece(next, current, null);
  const captured = new Set<number>();

  for (let index = 1; index < move.path.length; index += 1) {
    const target = move.path[index];
    if (pieceAt(next, target)) throw new Error(`Поле ${squareToAlgebraic(target)} занято.`);
    const between = diagonalBetween(current, target);
    if (!between) {
      throw new Error(
        'Сокращённое взятие нельзя восстановить геометрически; требуется полный генератор легальных взятий.',
      );
    }
    const occupied = between.filter((square) => pieceAt(next, square));

    if (move.isCapture) {
      if (!isKing(movingPiece) && diagonalDistance(current, target) !== 2) {
        throw new Error(
          'Сокращённое многошаговое взятие простой шашки требует разрешения через генератор легальных ходов.',
        );
      }
      if (occupied.length !== 1) {
        throw new Error(
          'Сокращённое взятие требует разрешения через генератор легальных ходов.',
        );
      }
      const capturedSquare = occupied[0];
      if (captured.has(capturedSquare)) throw new Error('Одну шашку нельзя брать дважды.');
      const victim = pieceAt(next, capturedSquare);
      if (!victim || pieceSide(victim) === pieceSide(movingPiece)) throw new Error('Нельзя брать свою шашку.');
      captured.add(capturedSquare);
    } else {
      if (occupied.length) throw new Error('Путь занят.');
      validateQuietMove(movingPiece, current, target);
    }

    movingPiece = promote(movingPiece, target);
    current = target;
  }

  // In Russian draughts captured pieces are removed after the whole capture sequence.
  for (const square of captured) next = setPiece(next, square, null);
  next = setPiece(next, current, movingPiece);
  return { ...next, sideToMove: position.sideToMove === 'W' ? 'B' : 'W' };
}

function validateQuietMove(piece: Piece, from: number, to: number): void {
  if (isKing(piece)) return;
  if (diagonalDistance(from, to) !== 1) throw new Error('Простая шашка ходит на соседнее поле.');
  const delta = squareToRowCol(to).row - squareToRowCol(from).row;
  if (delta !== (pieceSide(piece) === 'W' ? -1 : 1)) throw new Error('Простая шашка не ходит назад без взятия.');
}

function diagonalBetween(from: number, to: number): number[] | null {
  const a = squareToRowCol(from);
  const b = squareToRowCol(to);
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  if (dr === 0 || Math.abs(dr) !== Math.abs(dc)) return null;
  const result: number[] = [];
  for (let step = 1; step < Math.abs(dr); step += 1) {
    const square = rowColToSquare(a.row + Math.sign(dr) * step, a.col + Math.sign(dc) * step);
    if (square !== null) result.push(square);
  }
  return result;
}

function diagonalDistance(from: number, to: number): number {
  return Math.abs(squareToRowCol(from).row - squareToRowCol(to).row);
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

function isKing(piece: Piece): boolean {
  return piece.endsWith('king');
}
