import { describe, expect, it } from 'vitest';
import { parsePdnSyntax, tagsToRecord } from './parser';

describe('parsePdnSyntax', () => {
  it('preserves nested variations, comments, NAGs and annotations without rules resolution', () => {
    const source = `[White "Иванов"]\n[Black "Петров"]\n[GameType "25"]\n\n1. c3-d4 {основная идея} f6-e5 (1... b6-c5 $1 (2. b2-c3?)) 2. d4xf6! g7xe5 1-1`;
    const parsed = parsePdnSyntax(source);
    const tags = tagsToRecord(parsed.tags);

    expect(tags.White).toBe('Иванов');
    expect(tags.GameType).toBe('25');
    expect(parsed.result).toBe('1-1');
    expect(parsed.warnings).toEqual([]);

    const topVariation = parsed.sequence.elements.find((element) => element.type === 'variation');
    expect(topVariation?.type).toBe('variation');
    if (topVariation?.type !== 'variation') throw new Error('variation not found');

    expect(topVariation.sequence.elements.some((element) => element.type === 'nag' && element.value === 1)).toBe(true);
    expect(topVariation.sequence.elements.some((element) => element.type === 'variation')).toBe(true);
    expect(parsed.sequence.elements.some((element) => element.type === 'comment' && element.value === 'основная идея')).toBe(true);
    expect(parsed.sequence.elements.some((element) => element.type === 'annotation' && element.value === '!')).toBe(true);
  });

  it('keeps unknown OCR fragments instead of rejecting the game', () => {
    const parsed = parsePdnSyntax('1. c3-d4 OСR f6-e5 *');
    expect(parsed.sequence.elements.some((element) => element.type === 'unknown')).toBe(true);
    expect(parsed.result).toBe('*');
  });

  it('reports unbalanced variation parentheses but preserves the available tree', () => {
    const opened = parsePdnSyntax('1. c3-d4 (1... f6-e5 2. d4xf6');
    expect(opened.warnings.some((warning) => warning.code === 'unclosed-variation')).toBe(true);
    expect(opened.sequence.elements.some((element) => element.type === 'variation')).toBe(true);

    const closed = parsePdnSyntax('1. c3-d4 ) f6-e5 *');
    expect(closed.warnings.some((warning) => warning.code === 'unmatched-variation-close')).toBe(true);
  });
});
