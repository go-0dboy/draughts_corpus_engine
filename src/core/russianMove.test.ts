import { describe, expect, it } from 'vitest';
import { pieceAt } from './position';
import { algebraicToSquare } from './board';
import { applyRussianMove, parseRussianMove } from './russianMove';
import { INITIAL_POSITION } from './position';

describe('Russian algebraic moves', () => {
  it('replays a quiet move', () => {
    const next = applyRussianMove(INITIAL_POSITION, parseRussianMove('c3-d4'));
    expect(pieceAt(next, algebraicToSquare('c3'))).toBeNull();
    expect(pieceAt(next, algebraicToSquare('d4'))).toBe('white-man');
    expect(next.sideToMove).toBe('B');
  });

  it('replays a capture', () => {
    let position = applyRussianMove(INITIAL_POSITION, parseRussianMove('c3-d4'));
    position = applyRussianMove(position, parseRussianMove('f6-e5'));
    position = applyRussianMove(position, parseRussianMove('d4:f6'));
    expect(pieceAt(position, algebraicToSquare('e5'))).toBeNull();
    expect(pieceAt(position, algebraicToSquare('f6'))).toBe('white-man');
  });

  it('normalizes historical x, typographic × and separator whitespace', () => {
    expect(parseRussianMove('d4 x f6').notation).toBe('d4:f6');
    expect(parseRussianMove('d4×f6').notation).toBe('d4:f6');
    expect(parseRussianMove('d4 : f6 !').notation).toBe('d4:f6');
  });
});
