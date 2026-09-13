export type PdnToken =
  | { type: 'tag'; name: string; value: string; raw: string; offset: number }
  | { type: 'move-number'; number: number; side: 'white' | 'black'; raw: string; offset: number }
  | { type: 'move'; raw: string; squares: readonly string[]; capture: boolean; offset: number }
  | { type: 'comment'; value: string; raw: string; offset: number }
  | { type: 'variation-open' | 'variation-close'; raw: string; offset: number }
  | { type: 'nag'; value: number; raw: string; offset: number }
  | { type: 'annotation'; value: string; raw: string; offset: number }
  | { type: 'result'; value: string; raw: string; offset: number }
  | { type: 'unknown'; raw: string; offset: number };

const RESULT = /^(?:1-0|0-1|1\/2-1\/2|2-0|0-2|1-1|0-0|\*)/;
const MOVE_NUMBER = /^(\d+)\.(\.\.)?/;
const MOVE = /^([a-h][1-8](?:\s*[x:×-]\s*[a-h][1-8])+)/i;
const NAG = /^\$(\d+)/;
const ANNOTATION = /^(!!|\?\?|!\?|\?!|!|\?)/;
const TAG = /^\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\s*\]/;

/**
 * Tolerant lexical layer for historical PDN.
 *
 * It does not validate moves and has no dependency on the rules engine. That is
 * deliberate: malformed/OCR move text must remain representable in the AST so
 * the importer can report or repair it without losing the rest of the game.
 */
export function lexPdn(source: string): PdnToken[] {
  const tokens: PdnToken[] = [];
  let offset = 0;

  while (offset < source.length) {
    const rest = source.slice(offset);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      offset += whitespace[0].length;
      continue;
    }

    const tag = TAG.exec(rest);
    if (tag) {
      tokens.push({
        type: 'tag',
        name: tag[1],
        value: unescapeTagValue(tag[2]),
        raw: tag[0],
        offset,
      });
      offset += tag[0].length;
      continue;
    }

    if (rest[0] === '{') {
      const end = rest.indexOf('}');
      if (end >= 0) {
        const raw = rest.slice(0, end + 1);
        tokens.push({ type: 'comment', value: raw.slice(1, -1), raw, offset });
        offset += raw.length;
      } else {
        tokens.push({ type: 'unknown', raw: rest, offset });
        break;
      }
      continue;
    }

    if (rest[0] === ';') {
      const end = rest.search(/[\r\n]/);
      const raw = end < 0 ? rest : rest.slice(0, end);
      tokens.push({ type: 'comment', value: raw.slice(1).trim(), raw, offset });
      offset += raw.length;
      continue;
    }

    if (rest[0] === '(' || rest[0] === ')') {
      tokens.push({
        type: rest[0] === '(' ? 'variation-open' : 'variation-close',
        raw: rest[0],
        offset,
      });
      offset += 1;
      continue;
    }

    const result = RESULT.exec(rest);
    if (result) {
      tokens.push({ type: 'result', value: result[0], raw: result[0], offset });
      offset += result[0].length;
      continue;
    }

    const moveNumber = MOVE_NUMBER.exec(rest);
    if (moveNumber) {
      const raw = moveNumber[0];
      tokens.push({
        type: 'move-number',
        number: Number(moveNumber[1]),
        side: moveNumber[2] ? 'black' : 'white',
        raw,
        offset,
      });
      offset += raw.length;
      continue;
    }

    const nag = NAG.exec(rest);
    if (nag) {
      tokens.push({ type: 'nag', value: Number(nag[1]), raw: nag[0], offset });
      offset += nag[0].length;
      continue;
    }

    const annotation = ANNOTATION.exec(rest);
    if (annotation) {
      tokens.push({ type: 'annotation', value: annotation[0], raw: annotation[0], offset });
      offset += annotation[0].length;
      continue;
    }

    const move = MOVE.exec(rest);
    if (move) {
      const raw = move[1];
      const compact = raw.replace(/\s+/g, '');
      const capture = /[x:×]/i.test(compact);
      tokens.push({
        type: 'move',
        raw,
        squares: compact.toLowerCase().split(/[x:×-]/),
        capture,
        offset,
      });
      offset += raw.length;
      continue;
    }

    const unknown = /^[^\s()[\]{}]+/.exec(rest)?.[0] ?? rest[0];
    tokens.push({ type: 'unknown', raw: unknown, offset });
    offset += unknown.length;
  }

  return tokens;
}

function unescapeTagValue(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
