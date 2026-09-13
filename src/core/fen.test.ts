import { describe, expect, it } from 'vitest';
import { parseFen, toFen } from './fen';
import { INITIAL_POSITION } from './position';

describe('PDN FEN', () => {
  it('reads the initial position including ranges', () => {
    expect(parseFen('W:W21-32:B1-12')).toEqual(INITIAL_POSITION);
  });

  it('round-trips men and kings', () => {
    const fen = 'B:W21,K29:B4,K12';
    expect(toFen(parseFen(fen))).toBe(fen);
  });

  it('accepts algebraic dark squares', () => {
    expect(toFen(parseFen('W:WKa1:BKh8'), 'algebraic')).toBe('W:WKa1:BKh8');
  });

  it('rejects overlapping pieces', () => {
    expect(() => parseFen('W:W21:B21')).toThrow(/одно поле/);
  });
});

