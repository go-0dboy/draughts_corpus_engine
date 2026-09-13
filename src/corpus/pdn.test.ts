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
});
