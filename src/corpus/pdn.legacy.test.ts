import { describe, expect, it } from 'vitest';
import { parseRussianMove } from '../core/russianMove';
import { CorpusIndex } from './index';
import { parsePdn } from './pdn';
import { classifyResult } from './result';

const LEGACY = `[White "Полоусов А."]
[Black "Казас Д."]
[Event ""]
[Round ""]
[Site ""]
[Date ""]
[Result "2-0"]
[GameType "25"]

1. c3-b4 b6-c5 2. b2-c3 f6-e5 3. a1-b2 g7-f6 4. e3-f4 f6-g5 5.
b4-a5 g5xe3 6. d2xf4 c7-b6 7. a5xc7 d8xb6 8. f4-g5 h6xf4 9.
a3-b4 c5xa3 10. c1-d2 a3xe3 11. f2xa5 2-0

[White "Цирик З.И."]
[Black "Борисов"]
[Event ""]
[Round ""]
[Site ""]
[Date ""]
[Result "2-0"]
[GameType "25"]
[FEN "B:W18,19,21,22,23,25,26,27,28,32:B3,6,8,9,10,11,12,13,14,20"]

{ Белые эффектно опровергают стандартную жертву: } 1... h6-g5 2.
f4xh6 d6-e5 3. a3-b4 $3 c5xc1 4. c3-b4 $3 e5xg3 5. h2xf4 a5xc3
6. f4-g5 c1xf4 7. g5xe7 f8xd6 8. h6xh6 2-0`;

describe('historical Russian PDN reader', () => {
  it('splits games by header blocks instead of Event position', () => {
    const result = parsePdn(LEGACY);
    expect(result.errors).toEqual([]);
    expect(result.games).toHaveLength(2);
    expect(result.games[0].headers.White).toBe('Полоусов А.');
    expect(result.games[1].headers.FEN).toMatch(/^B:W/);
  });

  it('accepts x as a legacy capture separator and normalizes internally', () => {
    const move = parseRussianMove('g5xe3');
    expect(move.isCapture).toBe(true);
    expect(move.sourceNotation).toBe('g5xe3');
    expect(move.notation).toBe('g5:e3');
  });

  it('keeps a game when shortened capture replay is not yet resolvable', () => {
    const result = parsePdn(LEGACY);
    expect(result.games[0].moves.at(-1)).toBe('f2xa5');
    expect(result.games[0].replay.status).toBe('partial');
    expect(result.games[0].warnings.length).toBeGreaterThan(0);
  });

  it('understands default draughts results', () => {
    expect(classifyResult('2-0')).toBe('white-win');
    expect(classifyResult('1-1')).toBe('draw');
    expect(classifyResult('0-2')).toBe('black-win');
  });

  it('does not index partially replayed games', () => {
    const games = parsePdn(LEGACY).games;
    const corpus = new CorpusIndex(games);
    expect(corpus.pendingReplayGameCount()).toBeGreaterThan(0);
  });
});
