import { describe, expect, it } from 'vitest';
import { algebraicToSquare, squareToAlgebraic } from './board';
import { EMPTY_POSITION, pieceAt, setPiece } from './position';
import { applyLegalMove, generateLegalMoves, resolveLegalMove } from './rules';
import { INITIAL_POSITION } from './position';
import { parseRussianMove } from './russianMove';
import type { Piece, Position, Side } from './types';

function position(side: Side, pieces: Array<[string, Piece]>): Position {
  let result: Position = { ...EMPTY_POSITION, sideToMove: side };
  for (const [square, piece] of pieces) result = setPiece(result, algebraicToSquare(square), piece);
  return result;
}

describe('Russian draughts legal move generator', () => {
  it('generates the seven initial white moves', () => {
    const moves = generateLegalMoves(INITIAL_POSITION);
    expect(moves).toHaveLength(7);
    expect(moves.every((move) => !move.isCapture)).toBe(true);
  });

  it('makes capture mandatory', () => {
    const p = position('W', [
      ['c3', 'white-man'],
      ['g3', 'white-man'],
      ['d4', 'black-man'],
    ]);
    const moves = generateLegalMoves(p);
    expect(moves).toHaveLength(1);
    expect(moves[0].isCapture).toBe(true);
    expect(moves[0].path.map(squareToAlgebraic)).toEqual(['c3', 'e5']);
  });

  it('allows a man to capture backwards', () => {
    const p = position('W', [
      ['e5', 'white-man'],
      ['d4', 'black-man'],
    ]);
    const moves = generateLegalMoves(p);
    expect(moves.map((move) => move.path.map(squareToAlgebraic))).toContainEqual(['e5', 'c3']);
  });

  it('promotes during a capture and continues as a flying king', () => {
    const p = position('W', [
      ['b6', 'white-man'],
      ['c7', 'black-man'],
      ['f6', 'black-man'],
    ]);
    const moves = generateLegalMoves(p);
    const paths = moves.map((move) => move.path.map(squareToAlgebraic));

    expect(paths).toContainEqual(['b6', 'd8', 'g5']);
    expect(paths).toContainEqual(['b6', 'd8', 'h4']);
    expect(moves.every((move) => move.pieceAfter === 'white-king')).toBe(true);
  });

  it('resolves shortened historical multi-capture notation by legal endpoints', () => {
    const p = position('W', [
      ['b6', 'white-man'],
      ['c7', 'black-man'],
      ['f6', 'black-man'],
    ]);
    const selector = parseRussianMove('b6xg5');
    const move = resolveLegalMove(p, selector);
    expect(move.path.map(squareToAlgebraic)).toEqual(['b6', 'd8', 'g5']);

    const next = applyLegalMove(p, move);
    expect(pieceAt(next, algebraicToSquare('g5'))).toBe('white-king');
    expect(pieceAt(next, algebraicToSquare('c7'))).toBeNull();
    expect(pieceAt(next, algebraicToSquare('f6'))).toBeNull();
  });
});
