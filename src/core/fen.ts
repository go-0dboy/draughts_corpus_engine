import { algebraicToSquare, squareToAlgebraic } from './board';
import { bit, validatePosition } from './position';
import type { Position, Side } from './types';

interface ParsedSide {
  men: number;
  kings: number;
}

/**
 * Reads PDN FEN for Russian draughts. Algebraic coordinates are native here.
 * Numeric square lists are accepted only for compatibility with external archives.
 */
export function parseFen(fen: string): Position {
  const parts = fen.trim().split(':');
  if (parts.length !== 3) throw new Error('FEN должен состоять из трёх частей: ход:белые:чёрные.');

  const sideToMove = parts[0].trim().toUpperCase();
  if (sideToMove !== 'W' && sideToMove !== 'B') throw new Error('Первая часть FEN должна быть W или B.');

  const white = parsePieceList(parts[1], 'W');
  const black = parsePieceList(parts[2], 'B');
  const position: Position = {
    whiteMen: white.men,
    whiteKings: white.kings,
    blackMen: black.men,
    blackKings: black.kings,
    sideToMove: sideToMove as Side,
  };
  const errors = validatePosition(position);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return position;
}

function parsePieceList(raw: string, expectedSide: Side): ParsedSide {
  const value = raw.trim();
  if (value.length === 0 || value[0].toUpperCase() !== expectedSide) {
    throw new Error(`Ожидался список ${expectedSide}.`);
  }
  let men = 0;
  let kings = 0;
  const list = value.slice(1).trim();
  if (!list) return { men, kings };

  for (const token of list.split(',').map((item) => item.trim()).filter(Boolean)) {
    const isKing = token[0].toUpperCase() === 'K';
    const squareToken = isKing ? token.slice(1) : token;
    const squares = expandSquareToken(squareToken);
    for (const square of squares) {
      if (isKing) kings = (kings | bit(square)) >>> 0;
      else men = (men | bit(square)) >>> 0;
    }
  }
  return { men, kings };
}

function expandSquareToken(token: string): number[] {
  const range = /^(\d{1,2})-(\d{1,2})$/.exec(token);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start < 1 || end > 32 || start > end) throw new Error(`Недопустимый диапазон: ${token}`);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  if (/^\d{1,2}$/.test(token)) {
    const square = Number(token);
    bit(square);
    return [square];
  }
  return [algebraicToSquare(token)];
}

export function toFen(position: Position, notation: 'algebraic' | 'numeric' = 'algebraic'): string {
  const white = formatPieces(position.whiteMen, position.whiteKings, notation);
  const black = formatPieces(position.blackMen, position.blackKings, notation);
  return `${position.sideToMove}:W${white}:B${black}`;
}

function formatPieces(men: number, kings: number, notation: 'algebraic' | 'numeric'): string {
  const values: string[] = [];
  for (let square = 1; square <= 32; square += 1) {
    const mask = bit(square);
    const label = notation === 'numeric' ? String(square) : squareToAlgebraic(square);
    if (((men >>> 0) & mask) !== 0) values.push(label);
    if (((kings >>> 0) & mask) !== 0) values.push(`K${label}`);
  }
  return values.join(',');
}
