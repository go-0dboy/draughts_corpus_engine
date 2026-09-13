import { lexPdn, type PdnToken } from './lexer';

export interface PdnTagSyntax {
  name: string;
  value: string;
  raw: string;
  offset: number;
}

export interface PdnVariationSyntax {
  type: 'variation';
  sequence: PdnSequenceSyntax;
  offset: number;
}

export type PdnBodyToken = Exclude<PdnToken, { type: 'tag' | 'variation-open' | 'variation-close' }>;
export type PdnSyntaxElement = PdnBodyToken | PdnVariationSyntax;

export interface PdnSequenceSyntax {
  elements: PdnSyntaxElement[];
}

export interface PdnSyntaxWarning {
  code: 'tag-in-movetext' | 'unmatched-variation-close' | 'unclosed-variation';
  message: string;
  offset: number;
}

/**
 * A syntax-only representation of one PDN game.
 *
 * No move is validated here and comments/NAGs are deliberately not attached to
 * a particular resolved move yet. The next resolver stage may use move numbers,
 * side hints and the rules engine to decide the semantic base of a variation.
 * This keeps historical/OCR input representable even when a move is malformed.
 */
export interface PdnGameSyntax {
  tags: PdnTagSyntax[];
  sequence: PdnSequenceSyntax;
  result?: string;
  warnings: PdnSyntaxWarning[];
  source: string;
}

export function parsePdnSyntax(source: string): PdnGameSyntax {
  const tokens = lexPdn(source);
  const tags: PdnTagSyntax[] = [];
  const body: PdnToken[] = [];
  const warnings: PdnSyntaxWarning[] = [];
  let bodyStarted = false;

  for (const token of tokens) {
    if (token.type === 'tag' && !bodyStarted) {
      tags.push({ name: token.name, value: token.value, raw: token.raw, offset: token.offset });
      continue;
    }

    if (token.type === 'tag') {
      warnings.push({
        code: 'tag-in-movetext',
        message: `Тег [${token.name}] встретился после начала записи ходов и сохранён как предупреждение.`,
        offset: token.offset,
      });
      continue;
    }

    bodyStarted = true;
    body.push(token);
  }

  const cursor = { index: 0 };
  const sequence = parseSequence(body, cursor, false, warnings);
  const result = firstTopLevelResult(sequence);

  return { tags, sequence, result, warnings, source };
}

function parseSequence(
  tokens: PdnToken[],
  cursor: { index: number },
  nested: boolean,
  warnings: PdnSyntaxWarning[],
): PdnSequenceSyntax {
  const elements: PdnSyntaxElement[] = [];

  while (cursor.index < tokens.length) {
    const token = tokens[cursor.index];

    if (token.type === 'variation-close') {
      if (nested) {
        cursor.index += 1;
        return { elements };
      }

      warnings.push({
        code: 'unmatched-variation-close',
        message: 'Закрывающая скобка варианта не имеет соответствующей открывающей скобки.',
        offset: token.offset,
      });
      cursor.index += 1;
      continue;
    }

    if (token.type === 'variation-open') {
      const offset = token.offset;
      cursor.index += 1;
      const before = cursor.index;
      const sequence = parseSequence(tokens, cursor, true, warnings);
      const closed = cursor.index > before && tokens[cursor.index - 1]?.type === 'variation-close';
      if (!closed) {
        warnings.push({
          code: 'unclosed-variation',
          message: 'Вариант не закрыт скобкой; его содержимое сохранено до конца записи партии.',
          offset,
        });
      }
      elements.push({ type: 'variation', sequence, offset });
      continue;
    }

    if (token.type === 'tag') {
      // Tags are filtered before recursive parsing. Keep this guard so parser
      // stays total if token construction changes later.
      cursor.index += 1;
      continue;
    }

    elements.push(token);
    cursor.index += 1;
  }

  if (nested) {
    // Caller detects the missing close from cursor position and token history.
    return { elements };
  }

  return { elements };
}

function firstTopLevelResult(sequence: PdnSequenceSyntax): string | undefined {
  for (const element of sequence.elements) {
    if (element.type === 'result') return element.value;
  }
  return undefined;
}

export function tagsToRecord(tags: readonly PdnTagSyntax[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const tag of tags) record[tag.name] = tag.value;
  return record;
}
