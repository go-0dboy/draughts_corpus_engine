import { describe, expect, it } from 'vitest';
import { lexPdn } from './lexer';

describe('lexPdn', () => {
  it('preserves tags, legacy x captures, comments, NAGs and variations', () => {
    const source = `[White "Иванов"]\n[Black "Петров"]\n[GameType "25"]\n\n1. c3-d4 f6-e5 2. d4xf6 $1 {идея} (2... b6-c5?!) g7xe5 1-1`;
    const tokens = lexPdn(source);

    expect(tokens.filter((token) => token.type === 'tag')).toHaveLength(3);
    expect(tokens.filter((token) => token.type === 'move').map((token) => token.raw.replace(/\s+/g, '')))
      .toEqual(['c3-d4', 'f6-e5', 'd4xf6', 'b6-c5', 'g7xe5']);
    expect(tokens.some((token) => token.type === 'nag' && token.value === 1)).toBe(true);
    expect(tokens.some((token) => token.type === 'comment' && token.value === 'идея')).toBe(true);
    expect(tokens.some((token) => token.type === 'variation-open')).toBe(true);
    expect(tokens.some((token) => token.type === 'variation-close')).toBe(true);
    expect(tokens.some((token) => token.type === 'annotation' && token.value === '?!')).toBe(true);
    expect(tokens.some((token) => token.type === 'result' && token.value === '1-1')).toBe(true);
  });

  it('marks black move numbers written with ellipses', () => {
    const token = lexPdn('14... f6-g5')[0];
    expect(token).toMatchObject({ type: 'move-number', number: 14, side: 'black' });
  });

  it('keeps unknown OCR fragments instead of throwing', () => {
    const tokens = lexPdn('1. c3-d4 OCRBAD f6-e5');
    expect(tokens.some((token) => token.type === 'unknown' && token.raw === 'OCRBAD')).toBe(true);
  });
});
