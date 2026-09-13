#!/usr/bin/env node

import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const input = process.argv[2];
const output = process.argv[3];

if (!input) {
  console.error('Usage: npm run corpus:inspect -- <file.pdn> [report.json]');
  process.exit(2);
}

const inputPath = resolve(input);
const startedAt = performance.now();
const fileSize = statSync(inputPath).size;

const report = {
  source: inputPath,
  bytes: fileSize,
  lines: 0,
  games: 0,
  headers: {},
  gameTypes: {},
  results: {},
  fenGames: 0,
  moves: {
    total: 0,
    quiet: 0,
    captureX: 0,
    captureColon: 0,
    explicitMultiCapture: 0,
  },
  syntax: {
    commentOpenBraces: 0,
    ravOpenParens: 0,
    nags: 0,
  },
  warnings: [],
};

const movePattern = /\b[a-h][1-8](?:[-x:][a-h][1-8])+(?:[!?]+)?\b/gi;
const headerPattern = /^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"])*)"\]\s*$/;
const resultPattern = /^(?:2-0|1-1|0-2|1-0|1\/2-1\/2|0-1|\*)$/;

let currentGameHasFen = false;
let currentGameHasType = false;
let currentGameHasWhite = false;
let currentGameHasBlack = false;
let sawBodySinceHeaders = false;
let gameHeaders = 0;
let gameBodyLines = 0;
let firstHeaderOfCurrentGame = true;

function inc(bucket, key, amount = 1) {
  bucket[key] = (bucket[key] ?? 0) + amount;
}

function finalizeGame() {
  if (gameHeaders === 0) return;
  report.games += 1;
  if (currentGameHasFen) report.fenGames += 1;
  if (!currentGameHasWhite || !currentGameHasBlack) {
    report.warnings.push(`Game ${report.games}: missing White or Black tag`);
  }
  if (!currentGameHasType) {
    report.warnings.push(`Game ${report.games}: missing GameType tag`);
  }

  currentGameHasFen = false;
  currentGameHasType = false;
  currentGameHasWhite = false;
  currentGameHasBlack = false;
  sawBodySinceHeaders = false;
  gameHeaders = 0;
  gameBodyLines = 0;
  firstHeaderOfCurrentGame = true;
}

const rl = createInterface({
  input: createReadStream(inputPath, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  report.lines += 1;
  report.syntax.commentOpenBraces += countChar(line, '{');
  report.syntax.ravOpenParens += countChar(line, '(');
  report.syntax.nags += [...line.matchAll(/\$\d+/g)].length;

  const header = headerPattern.exec(line);
  if (header) {
    if (sawBodySinceHeaders && gameHeaders > 0) finalizeGame();

    const [, key, rawValue] = header;
    const value = rawValue.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    inc(report.headers, key);
    gameHeaders += 1;

    if (key === 'White') currentGameHasWhite = true;
    if (key === 'Black') currentGameHasBlack = true;
    if (key === 'FEN') currentGameHasFen = true;
    if (key === 'GameType') {
      currentGameHasType = true;
      inc(report.gameTypes, value.trim());
    }
    if (key === 'Result' && resultPattern.test(value.trim())) inc(report.results, value.trim());

    firstHeaderOfCurrentGame = false;
    continue;
  }

  if (gameHeaders > 0 && line.trim()) {
    sawBodySinceHeaders = true;
    gameBodyLines += 1;
  }

  for (const match of line.matchAll(movePattern)) {
    const token = match[0].replace(/[!?]+$/g, '');
    report.moves.total += 1;
    if (token.includes('-')) report.moves.quiet += 1;
    if (/[x]/i.test(token)) report.moves.captureX += 1;
    if (token.includes(':')) report.moves.captureColon += 1;
    const separators = token.match(/[-x:]/gi)?.length ?? 0;
    if (separators > 1 && /[x:]/i.test(token)) report.moves.explicitMultiCapture += 1;
  }
}

finalizeGame();

report.elapsedMs = Math.round(performance.now() - startedAt);
report.mbPerSecond = Number((fileSize / 1024 / 1024 / (report.elapsedMs / 1000)).toFixed(2));

const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  const stream = createWriteStream(resolve(output), { encoding: 'utf8' });
  stream.end(json);
  await new Promise((accept, reject) => {
    stream.on('finish', accept);
    stream.on('error', reject);
  });
}

process.stdout.write(json);

function countChar(value, char) {
  let count = 0;
  for (const current of value) if (current === char) count += 1;
  return count;
}
