import { useEffect, useRef } from 'react';
import type { GameTree, GameTreeNode } from '../domain/gameTree';

interface GameTreeNotationProps {
  tree: GameTree;
  activeNodeId?: string;
  startPly?: number;
  onSelectNode?: (node: GameTreeNode) => void;
  canSelectNode?: (node: GameTreeNode) => boolean;
}

/**
 * Mobile renderer for the storage-independent GameTree.
 *
 * It follows the successful visual idea from checkers-analyzer: the main line
 * remains visually flat while alternatives are shown as indented branches with
 * a depth marker. PDN parentheses are therefore not the primary UI.
 */
export function GameTreeNotation({
  tree,
  activeNodeId,
  startPly = 0,
  onSelectNode,
  canSelectNode,
}: GameTreeNotationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeNodeId || !containerRef.current) return;
    const active = containerRef.current.querySelector<HTMLElement>(`[data-node-id="${activeNodeId}"]`);
    if (!active) return;

    const container = containerRef.current;
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    if (aRect.top < cRect.top || aRect.bottom > cRect.bottom) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeNodeId]);

  if (tree.children.length === 0) {
    return <p className="notation-empty">Ходов нет.</p>;
  }

  return (
    <div className="notation-tree" aria-label="Дерево нотации" ref={containerRef}>
      {tree.commentsBefore.map((comment, index) => (
        <span className="notation-comment root-comment" key={`root-comment-${index}`}>{`{${comment}}`}</span>
      ))}
      <Continuation
        children={tree.children}
        ply={startPly}
        depth={0}
        activeNodeId={activeNodeId}
        onSelectNode={onSelectNode}
        canSelectNode={canSelectNode}
      />
    </div>
  );
}

function Continuation({
  children,
  ply,
  depth,
  activeNodeId,
  onSelectNode,
  canSelectNode,
}: {
  children: readonly GameTreeNode[];
  ply: number;
  depth: number;
  activeNodeId?: string;
  onSelectNode?: (node: GameTreeNode) => void;
  canSelectNode?: (node: GameTreeNode) => boolean;
}) {
  if (children.length === 0) return null;
  const main = children[0];
  const variations = children.slice(1);

  return (
    <>
      <MoveToken node={main} ply={ply} active={main.id === activeNodeId} onSelect={onSelectNode} canSelect={canSelectNode} />

      {variations.map((variation) => (
        <div
          className={`notation-variation depth-${Math.min(depth + 1, 4)}`}
          key={variation.id}
        >
          <VariationFrom
            node={variation}
            ply={ply}
            depth={depth + 1}
            activeNodeId={activeNodeId}
            onSelectNode={onSelectNode}
            canSelectNode={canSelectNode}
          />
        </div>
      ))}

      <Continuation
        children={main.children}
        ply={ply + 1}
        depth={depth}
        activeNodeId={activeNodeId}
        onSelectNode={onSelectNode}
        canSelectNode={canSelectNode}
      />
    </>
  );
}

function VariationFrom({
  node,
  ply,
  depth,
  activeNodeId,
  onSelectNode,
  canSelectNode,
}: {
  node: GameTreeNode;
  ply: number;
  depth: number;
  activeNodeId?: string;
  onSelectNode?: (node: GameTreeNode) => void;
  canSelectNode?: (node: GameTreeNode) => boolean;
}) {
  return (
    <>
      <MoveToken node={node} ply={ply} active={node.id === activeNodeId} onSelect={onSelectNode} canSelect={canSelectNode} forceNumber />
      <Continuation
        children={node.children}
        ply={ply + 1}
        depth={depth}
        activeNodeId={activeNodeId}
        onSelectNode={onSelectNode}
        canSelectNode={canSelectNode}
      />
    </>
  );
}

function MoveToken({
  node,
  ply,
  active,
  onSelect,
  canSelect,
  forceNumber = false,
}: {
  node: GameTreeNode;
  ply: number;
  active: boolean;
  onSelect?: (node: GameTreeNode) => void;
  canSelect?: (node: GameTreeNode) => boolean;
  forceNumber?: boolean;
}) {
  const notation = node.move.canonicalNotation ?? node.move.sourceNotation;
  const showNumber = forceNumber || ply % 2 === 0;
  const selectable = Boolean(onSelect) && (canSelect?.(node) ?? true);

  return (
    <span className="notation-node-wrap">
      {node.commentsBefore.map((comment, index) => (
        <span className="notation-comment" key={`${node.id}-before-${index}`}>{`{${comment}}`}</span>
      ))}
      {showNumber && <span className="notation-number">{moveNumber(ply)}</span>}
      <button
        type="button"
        className={`notation-move${active ? ' active' : ''}`}
        data-node-id={node.id}
        onClick={() => selectable && onSelect?.(node)}
        disabled={!selectable}
        aria-current={active ? 'step' : undefined}
      >
        {notation}
        {node.annotation && <i>{node.annotation}</i>}
      </button>
      {node.commentsAfter.map((comment, index) => (
        <span className="notation-comment" key={`${node.id}-after-${index}`}>{`{${comment}}`}</span>
      ))}
    </span>
  );
}

function moveNumber(ply: number): string {
  const number = Math.floor(ply / 2) + 1;
  return ply % 2 === 0 ? `${number}.` : `${number}...`;
}
