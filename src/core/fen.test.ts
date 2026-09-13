import { describe, expect, it } from 'vitest';
import { parseFen, toFen } from './fen';
import { INITIAL_POSITION } from './position';

describe('PDN FEN', () => {
  it('reads numeric archive notation for compatibility', () => {
    expect(parseFen('W:W21-32:B1-12')).toEqual(INITIAL_POSITION);
  });

  it('writes algebraic notation by default', () => {
    const fen = 'B:Wa3,Kc1:Bb8,Kd6';
    expect(toFen(parseFen(fen))).toBe(fen);
  });

  it('can still emit numeric notation explicitly', () => {
    expect(toFen(parseFen('W:WKa1:BKh8'), 'numeric')).toBe('W:WK29:BK4');
  });

  it('rejects overlapping pieces', () => {
    expect(() => parseFen('W:Wa3:Ba3')).toThrow(/одно поле/);
  });
});
