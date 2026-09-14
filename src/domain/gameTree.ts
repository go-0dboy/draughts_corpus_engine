import type { Position } from '../core/types';
import type { GameMove } from './game';

/**
 * A serializable move tree independent from PDN, storage and UI.
 * children[0] is the main continuation, children[1..] are variations.
 *
 * We intentionally do not keep parent references here so the tree can be
 * persisted and transferred to workers without circular structures.
 */
export interface GameTreeNode {
  id: string;
  move: GameMove;
  annotation?: string;
  commentsBefore: readonly string[];
  commentsAfter: readonly string[];
  children: readonly GameTreeNode[];
}

export interface GameTree {
  initialPosition?: Position;
  commentsBefore: readonly string[];
  children: readonly GameTreeNode[];
}

/** Runtime-only navigation metadata. The serializable tree itself stays acyclic. */
export interface GameTreeIndexEntry {
  node: GameTreeNode;
  parentId?: string;
  /** Zero-based ply inside the game tree. Variations at the same move share a ply. */
  ply: number;
}

export function mainLine(tree: GameTree): readonly GameTreeNode[] {
  const nodes: GameTreeNode[] = [];
  let children = tree.children;
  while (children.length > 0) {
    const node = children[0];
    nodes.push(node);
    children = node.children;
  }
  return nodes;
}

/**
 * Builds a lightweight lookup table only while a game is open.
 * Parent references are deliberately derived here rather than stored in GameTree.
 */
export function indexGameTree(tree: GameTree): ReadonlyMap<string, GameTreeIndexEntry> {
  const index = new Map<string, GameTreeIndexEntry>();

  const walk = (nodes: readonly GameTreeNode[], parentId: string | undefined, ply: number): void => {
    for (const node of nodes) {
      index.set(node.id, { node, parentId, ply });
      walk(node.children, node.id, ply + 1);
    }
  };

  walk(tree.children, undefined, 0);
  return index;
}

export function countTreeNodes(tree: GameTree): number {
  let count = 0;
  visitGameTree(tree, () => { count += 1; });
  return count;
}

export function hasVariations(tree: GameTree): boolean {
  let result = tree.children.length > 1;
  if (result) return true;
  visitGameTree(tree, (node) => {
    if (node.children.length > 1) result = true;
  });
  return result;
}

export function findTreeNode(tree: GameTree, id: string): GameTreeNode | undefined {
  let found: GameTreeNode | undefined;
  visitGameTree(tree, (node) => {
    if (!found && node.id === id) found = node;
  });
  return found;
}

export function visitGameTree(tree: GameTree, visitor: (node: GameTreeNode, depth: number) => void): void {
  const walk = (nodes: readonly GameTreeNode[], depth: number): void => {
    for (const node of nodes) {
      visitor(node, depth);
      walk(node.children, depth + 1);
    }
  };
  walk(tree.children, 0);
}
