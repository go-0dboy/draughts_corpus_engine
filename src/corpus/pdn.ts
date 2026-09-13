import { parseFen } from '../core/fen';
import { INITIAL_POSITION } from '../core/position';
import { applyRussianMove, parseRussianMove } from '../core/russianMove';
import type { Position } from '../core/types';

export interface PdnGame {
  id: string;
  headers: Record<string, string>;
  result: string;
  moves: string[];
  positions: Position[];
  source: string;
  warnings: string[];
}

export interface PdnImportResult {
  games: PdnGame[];
  errors: string[];
}

export function parsePdn(text: string): PdnImportResult {
  const chunks = splitGames(text);
  const games: PdnGame[] = [];
  const errors: string[] = [];

  chunks.forEach((chunk, index) => {
    try {
      games.push(parseGame(chunk, index + 1));
    } catch (error) {
      errors.push(`Партия ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return { games, errors };
}

function parseGame(source: string, sequence: number): PdnGame {
  const headers: Record<string, string> = {};
  for (const match of source.matchAll(/^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"])*)"\]\s*$/gm)) {
    headers[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  const movetext = source.replace(/^\s*\[[^\n]*\]\s*$/gm, ' ');
  const mainLine = stripCommentsAndVariations(movetext)
    .replace(/\$\d+/g, ' ')
    .replace(/\b\d+\.(?:\.\.)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawTokens = mainLine.split(' ').filter(Boolean);
  const resultToken = rawTokens.find((token) => /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token));
  const result = headers.Result ?? resultToken ?? '*';
  const moves = rawTokens.filter((token) => /^[a-h][1-8](?:[-:][a-h][1-8])+(?:[!?]+)?$/i.test(token));

  let position = startingPosition(headers);
  const positions: Position[] = [{ ...position }];
  const warnings: string[] = [];

  moves.forEach((notation, ply) => {
    try {
      position = applyRussianMove(position, parseRussianMove(notation));
      positions.push({ ...position });
    } catch (error) {
      throw new Error(`ход ${ply + 1} (${notation}): ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  if (moves.length === 0) warnings.push('В основной линии не найдено ходов в буквенной нотации.');

  return {
    id: gameId(headers, sequence),
    headers,
    result,
    moves: moves.map((move) => move.replace(/[!?]+$/g, '')),
    positions,
    source,
    warnings,
  };
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

function splitGames(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const starts = [...normalized.matchAll(/^\s*\[Event\s+"/gm)].map((match) => match.index ?? 0);
  if (starts.length <= 1) return [normalized];

  const chunks: string[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = index + 1 < starts.length ? starts[index + 1] : normalized.length;
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}
