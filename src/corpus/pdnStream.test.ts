import { describe, expect, it } from 'vitest';
import { iterateGameSourcesFromBlob } from './pdnStream';

describe('streamed PDN splitter', () => {
  it('yields games without materializing the whole file in the importer', async () => {
    const source = `[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. c3-d4 f6-e5 1-0\n\n[White "C"]\n[Black "D"]\n[Result "1-1"]\n\n1. g3-f4 b6-a5 1-1`;
    const games: string[] = [];
    for await (const game of iterateGameSourcesFromBlob(new Blob([source]))) games.push(game);

    expect(games).toHaveLength(2);
    expect(games[0]).toContain('[White "A"]');
    expect(games[0]).toContain('c3-d4');
    expect(games[1]).toContain('[White "C"]');
    expect(games[1]).toContain('g3-f4');
  });

  it('does not split on tag-like text inside a multiline comment', async () => {
    const source = `[White "A"]\n[Black "B"]\n\n1. c3-d4 { note\n[White "not a header"]\nstill comment } f6-e5\n\n[White "C"]\n[Black "D"]\n\n1. g3-f4 b6-a5`;
    const games: string[] = [];
    for await (const game of iterateGameSourcesFromBlob(new Blob([source]))) games.push(game);

    expect(games).toHaveLength(2);
    expect(games[0]).toContain('[White "not a header"]');
  });
});
