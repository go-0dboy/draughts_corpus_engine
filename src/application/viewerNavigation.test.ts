import { describe, expect, it } from 'vitest';
import { resolvePdnSource } from '../pdn/resolver';
import {
  canSelectViewerNode,
  getViewerNavigation,
  nodeIdAtMainLinePly,
} from './viewerNavigation';

const SOURCE = `[Event "Navigation test"]
[White "Белые"]
[Black "Чёрные"]
[Result "*"]
[GameType "25,W,8,8,A0,0"]

1. c3-d4 f6-e5 (1... b6-c5 2. d4:b6) 2. d4:f6 g7:e5 *`;

describe('viewer tree navigation', () => {
  it('maps corpus plies to the resolved main line', () => {
    const resolved = resolvePdnSource(SOURCE);
    expect(nodeIdAtMainLinePly(resolved, 0)).toBeNull();
    expect(nodeIdAtMainLinePly(resolved, 1)).toBe(resolved.tree.children[0]?.id);
  });

  it('uses the selected branch for previous/next navigation', () => {
    const resolved = resolvePdnSource(SOURCE);
    const first = resolved.tree.children[0];
    expect(first).toBeDefined();

    const variation = first.children[1];
    expect(variation?.move.sourceNotation).toBe('b6-c5');
    expect(canSelectViewerNode(resolved, variation)).toBe(true);

    const state = getViewerNavigation(resolved, variation.id);
    expect(state.previousNodeId).toBe(first.id);
    expect(state.nextNodeId).toBe(variation.children[0]?.id ?? null);
    expect(state.ply).toBe(2);
    expect(state.activeNode?.move.sourceNotation).toBe('b6-c5');
  });

  it('follows children[0] to the end of the current continuation', () => {
    const resolved = resolvePdnSource(SOURCE);
    const start = getViewerNavigation(resolved, null);
    const main = resolved.tree.children[0];
    expect(start.nextNodeId).toBe(main?.id ?? null);

    let expected = main;
    while (expected?.children[0] && resolved.positionsByNodeId[expected.children[0].id]) {
      expected = expected.children[0];
    }
    expect(start.lastNodeId).toBe(expected?.id ?? null);
  });
});
