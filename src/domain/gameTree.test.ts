import { describe, expect, it } from 'vitest';
import type { GameTree } from './gameTree';
import { countTreeNodes, findTreeNode, hasVariations, mainLine } from './gameTree';

const tree: GameTree = {
  commentsBefore: ['Перед партией'],
  children: [
    {
      id: 'm1',
      move: { sourceNotation: 'c3-d4', canonicalNotation: 'c3-d4' },
      commentsBefore: [],
      commentsAfter: ['Основная идея'],
      children: [
        {
          id: 'm2-main',
          move: { sourceNotation: 'f6-e5', canonicalNotation: 'f6-e5' },
          commentsBefore: [],
          commentsAfter: [],
          children: [],
        },
        {
          id: 'm2-var',
          move: { sourceNotation: 'b6-c5', canonicalNotation: 'b6-c5' },
          annotation: '!?',
          commentsBefore: ['Вариант'],
          commentsAfter: [],
          children: [],
        },
      ],
    },
  ],
};

describe('GameTree', () => {
  it('treats children[0] as the main line', () => {
    expect(mainLine(tree).map((node) => node.id)).toEqual(['m1', 'm2-main']);
  });

  it('preserves variations as sibling branches', () => {
    expect(hasVariations(tree)).toBe(true);
    expect(countTreeNodes(tree)).toBe(3);
    expect(findTreeNode(tree, 'm2-var')?.annotation).toBe('!?');
  });
});
