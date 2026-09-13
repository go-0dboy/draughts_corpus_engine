import { describe, expect, it } from 'vitest';
import { INITIAL_POSITION, packPosition, positionKey, setPiece, unpackPosition } from './position';

describe('position representation', () => {
  it('packs and unpacks four uint32 bitboards without loss', () => {
    const packed = packPosition(INITIAL_POSITION);
    expect(unpackPosition(packed, 'W')).toEqual(INITIAL_POSITION);
  });

  it('includes side to move in the canonical key', () => {
    expect(positionKey(INITIAL_POSITION)).not.toBe(positionKey({ ...INITIAL_POSITION, sideToMove: 'B' }));
  });

  it('keeps a square exclusive when replacing a piece', () => {
    const position = setPiece(INITIAL_POSITION, 1, 'white-king');
    expect(position.blackMen & 1).toBe(0);
    expect(position.whiteKings & 1).toBe(1);
  });
});

