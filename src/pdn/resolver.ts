import { parseFen } from '../core/fen';
import { INITIAL_POSITION } from '../core/position';
import { applyRussianMove, parseRussianMove } from '../core/russianMove';
import type { Position, Side } from '../core/types';
import type { GameMove } from '../domain/game';
import type { GameTree, GameTreeNode } from '../domain/gameTree';
import { parsePdnSyntax, tagsToRecord, type PdnGameSyntax, type PdnSequenceSyntax } from './parser';

export type PdnResolutionWarningCode =
  | 'illegal-move'
  | 'unresolved-after-error'
  | 'unknown-token'
  | 'orphan-annotation'
  | 'orphan-variation'
  | 'move-number-side';

export interface PdnResolutionWarning {
  code: PdnResolutionWarningCode;
  message: string;
  offset?: number;
}

export interface ResolvedPdnTree {
  tree: GameTree;
  /** Position after each successfully resolved node. */
  positionsByNodeId: Readonly<Record<string, Position>>;
  warnings: readonly PdnResolutionWarning[];
  /** False when at least one move on any represented branch could not be resolved. */
  complete: boolean;
}

interface MutableNode extends Omit<GameTreeNode, 'commentsBefore' | 'commentsAfter' | 'children'> {
  commentsBefore: string[];
  commentsAfter: string[];
  children: MutableNode[];
}

interface ResolveContext {
  nextId: number;
  positions: Record<string, Position>;
  warnings: PdnResolutionWarning[];
  complete: boolean;
}

interface SequenceResult {
  children: MutableNode[];
  leadingComments: string[];
}

/** Convenience entry point used by the viewer/import pipeline. */
export function resolvePdnSource(source: string): ResolvedPdnTree {
  const syntax = parsePdnSyntax(source);
  const tags = tagsToRecord(syntax.tags);
  const initialPosition = tags.FEN ? parseFen(tags.FEN) : { ...INITIAL_POSITION };
  return resolvePdnSyntax(syntax, initialPosition);
}

/**
 * Resolves the rules-independent PDN syntax tree against the Russian-draughts
 * rules engine.
 *
 * A variation is attached as an alternative to the move immediately preceding
 * its opening parenthesis, which matches PDN/PGN recursive-variation semantics:
 * the branch starts from the position BEFORE that preceding move.
 */
export function resolvePdnSyntax(syntax: PdnGameSyntax, initialPosition: Position): ResolvedPdnTree {
  const context: ResolveContext = {
    nextId: 1,
    positions: {},
    warnings: [],
    complete: true,
  };

  const startPly = initialPosition.sideToMove === 'W' ? 0 : 1;
  const resolved = resolveSequence(syntax.sequence, initialPosition, startPly, context, true);

  return {
    tree: {
      initialPosition: { ...initialPosition },
      commentsBefore: resolved.leadingComments,
      children: resolved.children,
    },
    positionsByNodeId: context.positions,
    warnings: context.warnings,
    complete: context.complete,
  };
}

function resolveSequence(
  sequence: PdnSequenceSyntax,
  startPosition: Position | null,
  startPly: number,
  context: ResolveContext,
  topLevel: boolean,
): SequenceResult {
  const roots: MutableNode[] = [];
  let continuation = roots;
  let position: Position | null = startPosition ? { ...startPosition } : null;
  let ply = startPly;

  let lastNode: MutableNode | null = null;
  let lastNodeParentChildren: MutableNode[] | null = null;
  let positionBeforeLastMove: Position | null = position ? { ...position } : null;
  let plyBeforeLastMove = ply;

  let pendingComments: string[] = [];
  const leadingComments: string[] = [];
  let beforeFirstMove = true;
  let moveNumberSeenBeforeFirstMove = false;
  let afterMove = false;
  let pendingSideHint: Side | null = null;

  for (const element of sequence.elements) {
    switch (element.type) {
      case 'comment': {
        if (afterMove && lastNode) {
          lastNode.commentsAfter.push(element.value.trim());
        } else if (topLevel && beforeFirstMove && !moveNumberSeenBeforeFirstMove) {
          leadingComments.push(element.value.trim());
        } else {
          pendingComments.push(element.value.trim());
        }
        break;
      }

      case 'move-number': {
        afterMove = false;
        if (beforeFirstMove) moveNumberSeenBeforeFirstMove = true;
        pendingSideHint = element.side === 'white' ? 'W' : 'B';
        break;
      }

      case 'move': {
        if (position && pendingSideHint && position.sideToMove !== pendingSideHint) {
          context.warnings.push({
            code: 'move-number-side',
            message: `Номер хода указывает на ${pendingSideHint === 'W' ? 'белых' : 'чёрных'}, но по позиции ход ${position.sideToMove === 'W' ? 'белых' : 'чёрных'}.`,
            offset: element.offset,
          });
        }
        pendingSideHint = null;

        const sourceNotation = element.raw.replace(/\s+/g, '').replace(/×/g, 'x');
        const node: MutableNode = {
          id: `n${context.nextId++}`,
          move: { sourceNotation },
          commentsBefore: pendingComments,
          commentsAfter: [],
          children: [],
        };
        pendingComments = [];

        positionBeforeLastMove = position ? { ...position } : null;
        plyBeforeLastMove = ply;

        if (position) {
          try {
            const parsed = parseRussianMove(sourceNotation);
            const next = applyRussianMove(position, parsed);
            node.move = {
              sourceNotation,
              canonicalNotation: parsed.notation,
            } satisfies GameMove;
            context.positions[node.id] = { ...next };
            position = next;
          } catch (error) {
            context.complete = false;
            context.warnings.push({
              code: 'illegal-move',
              message: `${sourceNotation}: ${error instanceof Error ? error.message : String(error)}`,
              offset: element.offset,
            });
            position = null;
          }
        } else {
          context.complete = false;
          context.warnings.push({
            code: 'unresolved-after-error',
            message: `${sourceNotation}: позиция перед ходом неизвестна из-за более ранней ошибки в этой ветви.`,
            offset: element.offset,
          });
        }

        continuation.push(node);
        lastNode = node;
        lastNodeParentChildren = continuation;
        continuation = node.children;
        beforeFirstMove = false;
        afterMove = true;
        ply += 1;
        break;
      }

      case 'annotation': {
        if (lastNode && afterMove) {
          lastNode.annotation = appendAnnotation(lastNode.annotation, element.value);
        } else {
          context.warnings.push({
            code: 'orphan-annotation',
            message: `Аннотация ${element.raw} не привязана к ходу.`,
            offset: element.offset,
          });
        }
        break;
      }

      case 'nag': {
        if (lastNode && afterMove) {
          lastNode.annotation = appendAnnotation(lastNode.annotation, nagLabel(element.value));
        } else {
          context.warnings.push({
            code: 'orphan-annotation',
            message: `NAG ${element.raw} не привязан к ходу.`,
            offset: element.offset,
          });
        }
        break;
      }

      case 'variation': {
        if (!lastNode || !lastNodeParentChildren) {
          context.warnings.push({
            code: 'orphan-variation',
            message: 'Вариант встретился до хода, к которому он мог бы относиться; синтаксис сохранён, но ветка не присоединена к семантическому дереву.',
            offset: element.offset,
          });
          afterMove = false;
          break;
        }

        const variation = resolveSequence(
          element.sequence,
          positionBeforeLastMove,
          plyBeforeLastMove,
          context,
          false,
        );

        if (variation.children.length > 0) {
          if (variation.leadingComments.length > 0) {
            variation.children[0].commentsBefore.unshift(...variation.leadingComments);
          }
          lastNodeParentChildren.push(...variation.children);
        }
        afterMove = false;
        break;
      }

      case 'unknown': {
        context.warnings.push({
          code: 'unknown-token',
          message: `Неопознанный фрагмент PDN: ${element.raw}`,
          offset: element.offset,
        });
        afterMove = false;
        break;
      }

      case 'result': {
        afterMove = false;
        pendingSideHint = null;
        break;
      }
    }
  }

  // A trailing comment that was explicitly moved to the "before next move"
  // bucket has no next move. Preserve it on the last node rather than lose it.
  if (pendingComments.length > 0 && lastNode) {
    lastNode.commentsAfter.push(...pendingComments);
  }

  return { children: roots, leadingComments };
}

function appendAnnotation(current: string | undefined, value: string): string {
  if (!current) return value;
  return `${current}${value}`;
}

function nagLabel(value: number): string {
  return {
    1: '!',
    2: '?',
    3: '!!',
    4: '??',
    5: '!?',
    6: '?!',
  }[value] ?? `$${value}`;
}
