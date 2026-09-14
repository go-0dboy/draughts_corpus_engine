import type { Position } from '../core/types';
import { indexGameTree, mainLine, type GameTreeNode } from '../domain/gameTree';
import type { ResolvedPdnTree } from '../pdn/resolver';

export interface ViewerNavigationState {
  activeNodeId: string | null;
  activeNode: GameTreeNode | null;
  position: Position;
  ply: number;
  previousNodeId: string | null;
  nextNodeId: string | null;
  lastNodeId: string | null;
}

/**
 * Converts a corpus occurrence ply into a node on the resolved main line.
 * Ply 0 means the initial position; ply 1 means the position after the first move.
 */
export function nodeIdAtMainLinePly(resolved: ResolvedPdnTree, ply: number): string | null {
  if (ply <= 0) return null;
  const node = mainLine(resolved.tree)[ply - 1];
  if (!node) return null;
  return resolved.positionsByNodeId[node.id] ? node.id : null;
}

/**
 * Derives all viewer navigation from one active tree node.
 *
 * `null` is the initial position. "Next" always follows children[0], i.e. the
 * main continuation of the currently selected branch. "Last" follows that same
 * continuation until it ends or reaches an unresolved historical fragment.
 */
export function getViewerNavigation(
  resolved: ResolvedPdnTree,
  activeNodeId: string | null,
): ViewerNavigationState {
  const initialPosition = resolved.tree.initialPosition;
  if (!initialPosition) throw new Error('У дерева партии отсутствует начальная позиция.');

  const index = indexGameTree(resolved.tree);
  const rawEntry = activeNodeId ? index.get(activeNodeId) : undefined;
  const activePosition = activeNodeId ? resolved.positionsByNodeId[activeNodeId] : undefined;
  const entry = rawEntry && activePosition ? rawEntry : undefined;
  const activeNode = entry?.node ?? null;
  const position = activePosition && entry ? activePosition : initialPosition;

  const nextCandidate = activeNode ? activeNode.children[0] : resolved.tree.children[0];
  const nextNodeId = selectableNodeId(resolved, nextCandidate);

  let lastNodeId: string | null = entry ? entry.node.id : null;
  let cursor = nextCandidate;
  while (cursor && resolved.positionsByNodeId[cursor.id]) {
    lastNodeId = cursor.id;
    cursor = cursor.children[0];
  }

  return {
    activeNodeId: entry ? entry.node.id : null,
    activeNode,
    position,
    ply: entry ? entry.ply + 1 : 0,
    previousNodeId: entry?.parentId ?? null,
    nextNodeId,
    lastNodeId,
  };
}

export function canSelectViewerNode(resolved: ResolvedPdnTree, node: GameTreeNode): boolean {
  return Boolean(resolved.positionsByNodeId[node.id]);
}

function selectableNodeId(resolved: ResolvedPdnTree, node: GameTreeNode | undefined): string | null {
  return node && resolved.positionsByNodeId[node.id] ? node.id : null;
}
