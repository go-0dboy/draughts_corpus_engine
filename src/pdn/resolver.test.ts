import { describe, expect, it } from 'vitest';
import { resolvePdnSource } from './resolver';

describe('PDN semantic resolver', () => {
  it('attaches a recursive variation as an alternative to the preceding move', () => {
    const resolved = resolvePdnSource(`[GameType "25,W,8,8,A0,0"]

1. c3-d4 f6-e5 (1... b6-c5) 2. d4:f6 *`);

    const first = resolved.tree.children[0];
    expect(first.move.canonicalNotation).toBe('c3-d4');
    expect(first.children).toHaveLength(2);
    expect(first.children[0].move.canonicalNotation).toBe('f6-e5');
    expect(first.children[1].move.canonicalNotation).toBe('b6-c5');
    expect(first.children[0].children[0].move.canonicalNotation).toBe('d4:f6');
    expect(Object.keys(resolved.positionsByNodeId)).toHaveLength(4);
    expect(resolved.complete).toBe(true);
  });

  it('preserves root comments, move comments and annotations', () => {
    const resolved = resolvePdnSource(`[GameType "25,W,8,8,A0,0"]

{Перед партией} 1. c3-d4! {Основная идея} (1. g3-f4 $5 {Вариант}) f6-e5 *`);

    const main = resolved.tree.children[0];
    const variation = resolved.tree.children[1];

    expect(resolved.tree.commentsBefore).toEqual(['Перед партией']);
    expect(main.annotation).toBe('!');
    expect(main.commentsAfter).toEqual(['Основная идея']);
    expect(variation.move.canonicalNotation).toBe('g3-f4');
    expect(variation.annotation).toBe('!?');
    expect(variation.commentsAfter).toEqual(['Вариант']);
  });

  it('can still resolve an alternative branch when the main move is illegal', () => {
    const resolved = resolvePdnSource(`[GameType "25,W,8,8,A0,0"]

1. c3-h8 (1. g3-f4) *`);

    expect(resolved.complete).toBe(false);
    expect(resolved.tree.children).toHaveLength(2);
    expect(resolved.tree.children[0].move.canonicalNotation).toBeUndefined();
    expect(resolved.tree.children[1].move.canonicalNotation).toBe('g3-f4');
    expect(resolved.positionsByNodeId[resolved.tree.children[1].id]).toBeDefined();
    expect(resolved.warnings.some((warning) => warning.code === 'illegal-move')).toBe(true);
  });
});
