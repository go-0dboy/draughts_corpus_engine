import { parseFen } from '../core/fen';
import { INITIAL_POSITION } from '../core/position';
import { applyRussianMove, parseRussianMove } from '../core/russianMove';
import type { Position } from '../core/types';
import { parsePdnSyntax, tagsToRecord } from '../pdn/parser';

export type ReplayStatus = 'complete' | 'partial' | 'not-replayed';

export interface PdnReplayInfo {
  status: ReplayStatus;
  appliedMoves: number;
  error?: string;
}

export interface PdnGame {
  id: string;
  headers: Record<string, string>;
  result: string;
  /** Source main-line notation. Full comments/variations stay available in source/AST pipeline. */
  moves: string[];
  /** Positions that the current rules/replay layer could reconstruct safely. */
  positions: Position[];
  source: string;
  warnings: string[];
  replay: PdnReplayInfo;
}

export interface PdnImportResult {
  games: PdnGame[];
  errors: string[];
}

/**
 * Transitional corpus adapter.
 *
 * Syntax is now read by the rules-independent PDN lexer/parser. This adapter
 * deliberately projects only the top-level/main-line moves into the old PdnGame
 * shape while the semantic GameTree resolver is being completed. Comments,
 * NAGs, annotations and nested variations are no longer destroyed by parsing;
 * they remain representable in the syntax tree and original source.
 */
export function parsePdn(text: string): PdnImportResult {
  const games: PdnGame[] = [];
  const errors: string[] = [];
  let sequence = 0;

  for (const chunk of iterateGameSources(text)) {
    sequence += 1;
    try {
      games.push(parseGame(chunk, sequence));
    } catch (error) {
      errors.push(`Партия ${sequence}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { games, errors };
}

function parseGame(source: string, sequence: number): PdnGame {
  const syntax = parsePdnSyntax(source);
  const headers = tagsToRecord(syntax.tags);
  validateRussianGameType(headers);

  const mainLineElements = syntax.sequence.elements.filter((element) => element.type !== 'variation');
  const moves = mainLineElements
    .filter((element) => element.type === 'move')
    .map((element) => element.raw.replace(/\s+/g, '').replace(/×/g, 'x'));

  const result = headers.Result ?? syntax.result ?? '*';

  if (moves.length === 0 && containsNumericMoveNotation(source)) {
    throw new Error('обнаружена цифровая нотация ходов. Для корпуса русских шашек ожидается буквенная нотация a1-h8.');
  }

  let position = startingPosition(headers);
  const positions: Position[] = [{ ...position }];
  const warnings: string[] = syntax.warnings.map((warning) => warning.message);
  const unknownFragments = collectTopLevelUnknowns(mainLineElements);
  if (unknownFragments.length > 0) {
    warnings.push(`Неопознанные фрагменты основной линии: ${unknownFragments.slice(0, 6).join(', ')}${unknownFragments.length > 6 ? '…' : ''}`);
  }

  let replay: PdnReplayInfo = {
    status: moves.length === 0 ? 'not-replayed' : 'complete',
    appliedMoves: 0,
  };

  for (let ply = 0; ply < moves.length; ply += 1) {
    const notation = moves[ply];
    try {
      position = applyRussianMove(position, parseRussianMove(notation));
      positions.push({ ...position });
      replay = { status: 'complete', appliedMoves: ply + 1 };
    } catch (error) {
      const message = `ход ${ply + 1} (${notation}): ${error instanceof Error ? error.message : String(error)}`;
      warnings.push(message);
      replay = { status: 'partial', appliedMoves: ply, error: message };
      break;
    }
  }

  if (moves.length === 0) warnings.push('В основной линии не найдено ходов в буквенной нотации.');
  if (unknownFragments.length > 0 && replay.status === 'complete') {
    // Missing OCR text can represent a move that the syntax layer could not
    // recognise. Do not index such a line as trustworthy even if the remaining
    // visible moves happen to replay legally.
    replay = {
      status: 'partial',
      appliedMoves: Math.min(replay.appliedMoves, moves.length),
      error: 'Основная линия содержит неопознанные фрагменты.',
    };
  }

  return {
    id: gameId(headers, sequence),
    headers,
    result,
    moves,
    positions,
    source,
    warnings,
    replay,
  };
}

function collectTopLevelUnknowns(elements: ReturnType<typeof parsePdnSyntax>['sequence']['elements']): string[] {
  return elements
    .filter((element) => element.type === 'unknown')
    .map((element) => element.raw);
}

function containsNumericMoveNotation(source: string): boolean {
  const movetext = source.replace(/^\s*\[[^\n]*\]\s*$/gm, ' ');
  return /(?:^|\s)\d{1,2}(?:\s*[-x:×]\s*\d{1,2})+(?=\s|$)/i.test(movetext);
}

function validateRussianGameType(headers: Record<string, string>): void {
  const value = headers.GameType?.trim();
  if (!value) return;
  const typeNumber = value.split(',')[0]?.trim();
  if (typeNumber !== '25') {
    throw new Error(`GameType ${typeNumber || value} не является русскими шашками. Ожидается GameType 25.`);
  }
}

function startingPosition(headers: Record<string, string>): Position {
  if (headers.FEN) return parseFen(headers.FEN);
  return { ...INITIAL_POSITION };
}

function gameId(headers: Record<string, string>, sequence: number): string {
  const parts = [headers.Date, headers.White, headers.Black, headers.Round].filter(Boolean);
  return parts.length ? `${parts.join('|')}|${sequence}` : `game-${sequence}`;
}

const TAG_LINE = /^\s*\[[A-Za-z0-9_]+\s+"(?:\\.|[^"])*"\]\s*$/;

/**
 * Splits a PDN file by header blocks instead of assuming a particular first
 * tag such as Event. The supplied historical corpus starts each game with
 * White/Black and places Event later, which is valid input for a tolerant reader.
 *
 * This remains an application adapter. The published-corpus builder will use a
 * streaming source so very large files never have to be materialized on the UI
 * thread.
 */
export function* iterateGameSources(text: string): Generator<string> {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return;

  const lines = normalized.split('\n');
  let current: string[] = [];
  let hasHeader = false;
  let bodyStarted = false;
  let commentDepth = 0;

  const flush = (): string | null => {
    const value = current.join('\n').trim();
    current = [];
    hasHeader = false;
    bodyStarted = false;
    commentDepth = 0;
    return value || null;
  };

  for (const line of lines) {
    const isTag = commentDepth === 0 && TAG_LINE.test(line);

    if (isTag && hasHeader && bodyStarted) {
      const game = flush();
      if (game) yield game;
    }

    current.push(line);

    if (isTag) {
      hasHeader = true;
    } else if (hasHeader && line.trim()) {
      bodyStarted = true;
    }

    for (const char of line) {
      if (char === '{') commentDepth += 1;
      else if (char === '}' && commentDepth > 0) commentDepth -= 1;
    }
  }

  const game = flush();
  if (game) yield game;
}
