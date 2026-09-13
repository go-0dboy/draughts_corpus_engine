import { algebraicToSquare, rowColToSquare, squareToAlgebraic, squareToRowCol } from './board';
import { pieceAt, setPiece } from './position';
import type { Piece, Position, Side } from './types';

export interface Move {
  notation: string;
  path: number[];
  isCapture: boolean;
}

export function parseMoveNotation(raw: string): Move {
  const notation = raw.trim().replace(/[!?]+$/g, '');
  const hasMove = notation.includes('-');
  const hasCapture = notation.includes(':');
  if (hasMove === hasCapture) {
    throw new Error(`Ход должен содержать один тип разделителя (- или :): ${raw}`);
  }

  const separator = hasCapture ? ':' : '-';
  const parts = notation.split(separator);
  if (parts.length < 2) throw new Error(`Неполная запись хода: ${raw}`);

  const path = parts.map((value) => algebraicToSquare(value));
  return {
    notation: path.map(squareToAlgebraic).join(separator),
    path,
    isCapture: hasCapture,
  };
}

export function applyMove(position: Position, move: Move): Position {
  if (move.path.length < 2) throw new Error('Ход должен содержать начальное и конечное поле.');
  if (!move.isCapture && move.path.length !== 2) throw new Error('Тихий ход должен содержать ровно два поля.');

  let next: Position = { ...position };
  let currentSquare = move.path[0];
  let movingPiece = pieceAt(next, currentSquare);
  if (!movingPiece) throw new Error(`На ${squareToAlgebraic(currentSquare)} нет шашки.`);
  if (pieceSide(movingPiece) !== position.sideToMove) {
    throw new Error(`На ${squareToAlgebraic(currentSquare)} стоит шашка другой стороны.`);
  }

  next = setPiece(next, currentSquare, null);

  for (let index = 1; index < move.path.length; index += 1) {
    const target = move.path[index];
    if (pieceAt(next, target)) throw new Error(`Поле ${squareToAlgebraic(target)} занято.`);

    const between = diagonalBetween(currentSquare, target);
    if (between === null) throw new Error('Ход должен идти по диагонали.');

    const occupied = between.filter((square) => pieceAt(next, square));

    if (move.isCapture) {
      if (!isKing(movingPiece) && diagonalDistance(currentSquare, target) !== 2) {
        throw new Error('Простая шашка при взятии должна перепрыгнуть через соседнюю шашку.');
      }
      if (occupied.length !== 1) {
        throw new Error(`На участке ${squareToAlgebraic(currentSquare)}:${squareToAlgebraic(target)} должна быть ровно одна снимаемая шашка.`);
      }
      const capturedSquare = occupied[0];
      const capturedPiece = pieceAt(next, capturedSquare);
      if (!capturedPiece || pieceSide(capturedPiece) === pieceSide(movingPiece)) {
        throw new Error('Нельзя брать свою шашку.');
      }
      next = setPiece(next, capturedSquare, null);
    } else {
      if (occupied.length > 0) throw new Error('Нельзя проходить через занятую клетку.');
      validateQuietSegment(movingPiece, currentSquare, target);
    }

    movingPiece = promoteIfNeeded(movingPiece, target);
    currentSquare = target;

    if (index < move.path.length - 1) {
      next = setPiece(next, currentSquare, movingPiece);
      next = setPiece(next, currentSquare, null);
    }
  }

  next = setPiece(next, currentSquare, movingPiece);
  return { ...next, sideToMove: position.sideToMove === 'W' ? 'B' : 'W' };
}

function validateQuietSegment(piece: Piece, from: number, to: number): void {
  const distance = diagonalDistance(from, to);
  if (isKing(piece)) return;
  if (distance !== 1) throw new Error('Простая шашка ходит без взятия только на соседнее поле.');

  const fromRow = squareToRowCol(from).row;
  const toRow = squareToRowCol(to).row;
  const expected = pieceSide(piece) === 'W' ? -1 : 1;
  if (toRow - fromRow !== expected) throw new Error('Простая шашка не может ходить назад без взятия.');
}

function diagonalDistance(from: number, to: number): number {
  const a = squareToRowCol(from);
  const b = squareToRowCol(to);
  return Math.abs(a.row - b.row);
}

function diagonalBetween(from: number, to: number): number[] | null {
  const a = squareToRowCol(from);
  const b = squareToRowCol(to);
  const rowDelta = b.row - a.row;
  const colDelta = b.col - a.col;
  if (Math.abs(rowDelta) !== Math.abs(colDelta) || rowDelta === 0) return null;

  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  const squares: number[] = [];
  for (let step = 1; step < Math.abs(rowDelta); step += 1) {
    const square = rowColToSquare(a.row + rowStep * step, a.col + colStep * step);
    if (square !== null) squares.push(square);
  }
  return squares;
}

function promoteIfNeeded(piece: Piece, square: number): Piece {
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
