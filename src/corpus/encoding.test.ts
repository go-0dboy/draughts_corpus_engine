import { describe, expect, it } from 'vitest';
import { detectPdnEncodingBytes } from './encoding';

describe('PDN encoding detection', () => {
  it('detects UTF-8 text', () => {
    const bytes = new TextEncoder().encode('[White "Иванов"]\n[Event "Москва"]\n1. c3-d4');
    expect(detectPdnEncodingBytes(bytes)).toBe('utf-8');
  });

  it('detects Windows-1251 Russian headers', () => {
    const ascii = (value: string) => [...value].map((char) => char.charCodeAt(0));
    const bytes = new Uint8Array([
      ...ascii('[White "'), 0xc8, 0xe2, 0xe0, 0xed, 0xee, 0xe2, ...ascii(' Александр"]\n[Black "'),
      0xcf, 0xe5, 0xf2, 0xf0, 0xee, 0xe2, ...ascii(' Сергей"]\n[Event "'),
      0xd7, 0xe5, 0xec, 0xef, 0xe8, 0xee, 0xed, 0xe0, 0xf2, ...ascii(' '),
      0xcc, 0xee, 0xf1, 0xea, 0xe2, 0xfb, ...ascii('"]\n1. c3-d4 f6-e5'),
    ]);
    expect(detectPdnEncodingBytes(bytes)).toBe('windows-1251');
  });

  it('detects UTF-16 LE by BOM', () => {
    expect(detectPdnEncodingBytes(new Uint8Array([0xff, 0xfe, 0x5b, 0x00, 0x57, 0x00]))).toBe('utf-16le');
  });
});
