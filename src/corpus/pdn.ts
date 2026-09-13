import { parseFen } from '../core/fen';
import { INITIAL_POSITION } from '../core/position';
import { applyRussianMove, parseRussianMove } from '../core/russianMove';
import type { Position } from '../core/types';

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
  /** Source move notation without annotations. Capture separator is preserved. */
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
 * Tolerant main-line reader used by the application while the full PDN AST
 * parser is being built. It deliberately separates parsing a game record from
 * replaying its moves: a replay problem must not make the whole game disappear.
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
  const headers: Record<string, string> = {};
  for (const match of source.matchAll(/^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"])*)"\]\s*$/gm)) {
    headers[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  validateRussianGameType(headers);

  const movetext = source.replace(/^\s*\[[^\n]*\]\s*$/gm, ' ');
  const mainLine = stripCommentsAndVariations(movetext)
    .replace(/\$\d+/g, ' ')
    .replace(/\b\d+\.(?:\.\.)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawTokens = mainLine.split(' ').filter(Boolean);
  const resultToken = rawTokens.find((token) => /^(1-0|0-1|1\/2-1\/2|2-0|0-2|1-1|0-0|\*)$/.test(token));
  const result = headers.Result ?? resultToken ?? '*';
  const moves = rawTokens
    .filter((token) => /^[a-h][1-8](?:[-x:][a-h][1-8])+(?:[!?]+)?$/i.test(token))
    .map((move) => move.replace(/[!?]+$/g, ''));

  if (moves.length === 0 && rawTokens.some((token) => /^\d{1,2}(?:[-x:]\d{1,2})+/i.test(token))) {
    throw new Error('обнаружена цифровая нотация ходов. Для корпуса русских шашек ожидается буквенная нотация a1-h8.');
  }

  let position = startingPosition(headers);
  const positions: Position[] = [{ ...position }];
  const warnings: string[] = [];
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

function stripCommentsAndVariations(value: string): string {
  let text = value.replace(/\{[^}]*\}/gs, ' ').replace(/;[^\n\r]*/g, ' ');
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(/\([^()]*\)/g, ' ');
  }
  return text;
}

const TAG_LINE = /^\s*\[[A-Za-z0-9_]+\s+"(?:\\.|[^"])*"\]\s*$/;

/**
 * Splits a PDN file by header blocks instead of assuming a particular first
 * tag such as Event. The supplied historical corpus starts each game with
 * White/Black and places Event later, which is valid input for a tolerant reader.
 *
 * This is still a transitional reader. The final PDN module will use a lexer/AST
 * and a streaming source so very large files do not have to be materialized as
 * one string on the UI thread.
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
