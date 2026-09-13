import type { PackedPosition, Piece, Position, Side } from './types';

export const EMPTY_POSITION: Position = {
  whiteMen: 0,
  whiteKings: 0,
  blackMen: 0,
  blackKings: 0,
  sideToMove: 'W',
};

export const INITIAL_POSITION: Position = {
  whiteMen: 0xfff00000,
  whiteKings: 0,
  blackMen: 0x00000fff,
  blackKings: 0,
  sideToMove: 'W',
};

export function bit(square: number): number {
  if (!Number.isInteger(square) || square < 1 || square > 32) {
    throw new RangeError(`Square must be an integer from 1 to 32, got ${square}`);
  }
  return (2 ** (square - 1)) >>> 0;
}

export function hasBit(board: number, square: number): boolean {
  return ((board >>> 0) & bit(square)) !== 0;
}

export function pieceAt(position: Position, square: number): Piece | null {
  if (hasBit(position.whiteMen, square)) return 'white-man';
  if (hasBit(position.whiteKings, square)) return 'white-king';
  if (hasBit(position.blackMen, square)) return 'black-man';
  if (hasBit(position.blackKings, square)) return 'black-king';
  return null;
}

export function setPiece(position: Position, square: number, piece: Piece | null): Position {
  const mask = (~bit(square)) >>> 0;
  const next: Position = {
    ...position,
    whiteMen: (position.whiteMen & mask) >>> 0,
    whiteKings: (position.whiteKings & mask) >>> 0,
    blackMen: (position.blackMen & mask) >>> 0,
    blackKings: (position.blackKings & mask) >>> 0,
  };
  if (piece) next[pieceToField(piece)] = (next[pieceToField(piece)] | bit(square)) >>> 0;
  return next;
}

function pieceToField(piece: Piece): 'whiteMen' | 'whiteKings' | 'blackMen' | 'blackKings' {
  return {
    'white-man': 'whiteMen',
    'white-king': 'whiteKings',
    'black-man': 'blackMen',
    'black-king': 'blackKings',
  }[piece] as 'whiteMen' | 'whiteKings' | 'blackMen' | 'blackKings';
}

export function occupied(position: Position): number {
  return (position.whiteMen | position.whiteKings | position.blackMen | position.blackKings) >>> 0;
}

export function validatePosition(position: Position): string[] {
  const boards = [position.whiteMen, position.whiteKings, position.blackMen, position.blackKings].map(
    (value) => value >>> 0,
  );
  const errors: string[] = [];
  for (let left = 0; left < boards.length; left += 1) {
    for (let right = left + 1; right < boards.length; right += 1) {
      if ((boards[left] & boards[right]) !== 0) {
        errors.push('Несколько шашек занимают одно поле.');
        return errors;
      }
    }
  }
  return errors;
}

export function packPosition(position: Position): PackedPosition {
  return {
    white: BigInt(position.whiteMen >>> 0) | (BigInt(position.whiteKings >>> 0) << 32n),
    black: BigInt(position.blackMen >>> 0) | (BigInt(position.blackKings >>> 0) << 32n),
  };
}

export function unpackPosition(packed: PackedPosition, sideToMove: Side): Position {
  const mask32 = 0xffff_ffffn;
  return {
    whiteMen: Number(packed.white & mask32) >>> 0,
    whiteKings: Number((packed.white >> 32n) & mask32) >>> 0,
    blackMen: Number(packed.black & mask32) >>> 0,
    blackKings: Number((packed.black >> 32n) & mask32) >>> 0,
    sideToMove,
  };
}

export function positionKey(position: Position): string {
  const packed = packPosition(position);
  return `${position.sideToMove}:${toHex64(packed.white)}:${toHex64(packed.black)}`;
}

export function toHex64(value: bigint): string {
  return value.toString(16).padStart(16, '0').toUpperCase();
}

export function countPieces(position: Position): { white: number; black: number; kings: number } {
  const popcount = (value: number): number => {
    let n = value >>> 0;
    let count = 0;
    while (n !== 0) {
      n = (n & (n - 1)) >>> 0;
      count += 1;
    }
    return count;
  };
  return {
    white: popcount(position.whiteMen) + popcount(position.whiteKings),
    black: popcount(position.blackMen) + popcount(position.blackKings),
    kings: popcount(position.whiteKings) + popcount(position.blackKings),
  };
}

