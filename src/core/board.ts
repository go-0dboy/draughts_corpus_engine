const FILES = 'abcdefgh';

export function isPlayable(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8 && (row + col) % 2 === 1;
}

/** PDN squares: 1..4 on rank 8, through 29..32 on rank 1. */
export function rowColToSquare(row: number, col: number): number | null {
  if (!isPlayable(row, col)) return null;
  return row * 4 + Math.floor(col / 2) + 1;
}

export function squareToRowCol(square: number): { row: number; col: number } {
  if (!Number.isInteger(square) || square < 1 || square > 32) {
    throw new RangeError(`Square must be an integer from 1 to 32, got ${square}`);
  }
  const zeroBased = square - 1;
  const row = Math.floor(zeroBased / 4);
  const indexInRow = zeroBased % 4;
  const col = indexInRow * 2 + (row % 2 === 0 ? 1 : 0);
  return { row, col };
}

export function squareToAlgebraic(square: number): string {
  const { row, col } = squareToRowCol(square);
  return `${FILES[col]}${8 - row}`;
}

export function algebraicToSquare(value: string): number {
  const match = /^([a-h])([1-8])$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid square: ${value}`);
  const col = FILES.indexOf(match[1].toLowerCase());
  const row = 8 - Number(match[2]);
  const square = rowColToSquare(row, col);
  if (square === null) throw new Error(`${value} is not a playable dark square`);
  return square;
}

