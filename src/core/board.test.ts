import { describe, expect, it } from 'vitest';
import { algebraicToSquare, rowColToSquare, squareToAlgebraic, squareToRowCol } from './board';

describe('board mapping', () => {
  it('maps PDN endpoints to Russian-board coordinates', () => {
    expect(squareToAlgebraic(1)).toBe('b8');
    expect(squareToAlgebraic(32)).toBe('g1');
    expect(algebraicToSquare('a1')).toBe(29);
    expect(algebraicToSquare('h8')).toBe(4);
  });

  it('round-trips all playable squares', () => {
    for (let square = 1; square <= 32; square += 1) {
      const { row, col } = squareToRowCol(square);
      expect(rowColToSquare(row, col)).toBe(square);
    }
  });

  it('rejects a light square', () => {
    expect(() => algebraicToSquare('a8')).toThrow(/not a playable/);
  });
});

