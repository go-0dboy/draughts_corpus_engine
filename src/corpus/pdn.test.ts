import { describe, expect, it } from 'vitest';
import { CorpusIndex } from './index';
import { parsePdn } from './pdn';

const PDN = `[Event "Test"]
[Date "2026.09.13"]
[White "A"]
[Black "B"]
[Result "1-0"]
[GameType "25,W,8,8,A0,0"]

1. c3-d4 f6-e5 2. d4:f6 g7:e5 1-0`;

describe('PDN corpus', () => {
  it('imports an algebraic main line', () => {
    const result = parsePdn(PDN);
    expect(result.errors).toEqual([]);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].moves).toEqual(['c3-d4', 'f6-e5', 'd4:f6', 'g7:e5']);
    expect(result.games[0].positions).toHaveLength(5);
  });

  it('indexes positions and continuations', () => {
    const game = parsePdn(PDN).games[0];
    const corpus = new CorpusIndex([game]);
    const report = corpus.report(game.positions[0]);
    expect(report.occurrences).toHaveLength(1);
    expect(report.continuations[0].move).toBe('c3-d4');
    expect(report.whiteWins).toBe(1);
  });

  it('rejects another draughts variant instead of polluting the corpus', () => {
    const result = parsePdn(`[Event "International"]\n[GameType "20"]\n[Result "2-0"]\n\n1. 32-28 19-23 2-0`);
    expect(result.games).toHaveLength(0);
    expect(result.errors[0]).toMatch(/GameType 20/);
    expect(result.errors[0]).toMatch(/GameType 25/);
  });

  it('rejects numeric move notation when game type is missing', () => {
    const result = parsePdn(`[Event "Unknown"]\n\n1. 32-28 19-23 1-0`);
    expect(result.games).toHaveLength(0);
    expect(result.errors[0]).toMatch(/цифровая нотация/);
  });
});
