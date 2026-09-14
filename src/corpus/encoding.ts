export type PdnTextEncoding =
  | 'utf-8'
  | 'utf-16le'
  | 'utf-16be'
  | 'windows-1251'
  | 'koi8-r'
  | 'ibm866'
  | 'iso-8859-5';

const SAMPLE_BYTES = 96 * 1024;
const LEGACY_ENCODINGS: readonly PdnTextEncoding[] = [
  'windows-1251',
  'koi8-r',
  'ibm866',
  'iso-8859-5',
] as const;

/**
 * Detects the text encoding of a PDN file without loading the whole file.
 *
 * Historical Russian draughts archives are commonly found in Windows-1251,
 * KOI8-R and DOS CP866 in addition to UTF-8. UTF-16 BOMs and a simple no-BOM
 * UTF-16 zero-byte pattern are also recognised.
 */
export async function detectPdnEncoding(blob: Blob): Promise<PdnTextEncoding> {
  const sample = new Uint8Array(await blob.slice(0, SAMPLE_BYTES).arrayBuffer());
  return detectPdnEncodingBytes(sample);
}

export function detectPdnEncodingBytes(bytes: Uint8Array): PdnTextEncoding {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';

  const utf16 = detectUtf16WithoutBom(bytes);
  if (utf16) return utf16;

  // A valid UTF-8 stream wins immediately. Plain ASCII is valid UTF-8 and is
  // byte-compatible with all legacy candidates, so selecting UTF-8 is safe.
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return 'utf-8';
  } catch {
    // Continue with legacy single-byte encodings.
  }

  let best: { encoding: PdnTextEncoding; score: number } | null = null;
  for (const encoding of LEGACY_ENCODINGS) {
    try {
      const text = new TextDecoder(encoding).decode(bytes);
      const score = scoreRussianPdnText(text);
      if (!best || score > best.score) best = { encoding, score };
    } catch {
      // Some JS runtimes may omit an optional legacy decoder. Ignore it and
      // continue with the remaining encodings.
    }
  }

  return best?.encoding ?? 'windows-1251';
}

function detectUtf16WithoutBom(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const pairs = Math.min(Math.floor(bytes.length / 2), 2048);
  if (pairs < 8) return null;

  let evenZero = 0;
  let oddZero = 0;
  for (let index = 0; index < pairs * 2; index += 2) {
    if (bytes[index] === 0) evenZero += 1;
    if (bytes[index + 1] === 0) oddZero += 1;
  }

  const evenRatio = evenZero / pairs;
  const oddRatio = oddZero / pairs;
  if (oddRatio > 0.35 && evenRatio < 0.08) return 'utf-16le';
  if (evenRatio > 0.35 && oddRatio < 0.08) return 'utf-16be';
  return null;
}

const RUSSIAN_FREQUENCY: Readonly<Record<string, number>> = {
  о: 10.97, е: 8.45, а: 8.01, и: 7.35, н: 6.70, т: 6.26, с: 5.47, р: 4.73,
  в: 4.54, л: 4.40, к: 3.49, м: 3.21, д: 2.98, п: 2.81, у: 2.62, я: 2.01,
  ы: 1.90, ь: 1.74, г: 1.70, з: 1.65, б: 1.59, ч: 1.44, й: 1.21, х: 0.97,
  ж: 0.94, ш: 0.73, ю: 0.64, ц: 0.48, щ: 0.36, э: 0.32, ф: 0.26, ъ: 0.04,
  ё: 0.04,
};

const COMMON_BIGRAMS = [
  'ст', 'но', 'то', 'на', 'ен', 'ов', 'ни', 'ра', 'во', 'ко', 'ре', 'по',
  'пр', 'ив', 'ва', 'ск', 'мо', 'ал', 'ин', 'ро', 'ер', 'ет', 'те', 'ос', 'ор',
] as const;

/**
 * Wrong single-byte Russian decoders often still produce Cyrillic letters.
 * A simple "contains Cyrillic" test therefore is not enough. The score uses
 * Russian letter likelihood, common bigrams and strong penalties for control /
 * box-drawing characters that frequently appear after a wrong CP866 decode.
 */
function scoreRussianPdnText(text: string): number {
  const lower = text.toLocaleLowerCase('ru');
  const russianLetters = [...lower].filter((char) => Object.hasOwn(RUSSIAN_FREQUENCY, char));

  let score = 0;
  if (russianLetters.length > 0) {
    const averageLogLikelihood = russianLetters.reduce((sum, char) => {
      return sum + Math.log((RUSSIAN_FREQUENCY[char] ?? 0.01) / 100);
    }, 0) / russianLetters.length;
    score += averageLogLikelihood * 10;
    score += Math.min(russianLetters.length, 240) * 0.05;
  } else {
    score -= 200;
  }

  for (const bigram of COMMON_BIGRAMS) {
    let offset = 0;
    while (true) {
      const index = lower.indexOf(bigram, offset);
      if (index < 0) break;
      score += 0.8;
      offset = index + bigram.length;
    }
  }

  const pdnTags = text.match(/^\s*\[(?:White|Black|Event|Site|Round|Date|Result|GameType|FEN)\s+"/gim)?.length ?? 0;
  score += Math.min(pdnTags, 30) * 0.4;

  for (const char of text) {
    const code = char.charCodeAt(0);
    if ((code < 32 && char !== '\n' && char !== '\r' && char !== '\t') || (code >= 0x7f && code <= 0x9f)) {
      score -= 8;
    }
    if (code >= 0x2500 && code <= 0x259f) score -= 3;
    if (char === '\ufffd') score -= 20;
  }

  return score;
}

export function encodingDisplayName(encoding: PdnTextEncoding): string {
  return {
    'utf-8': 'UTF-8',
    'utf-16le': 'UTF-16 LE',
    'utf-16be': 'UTF-16 BE',
    'windows-1251': 'Windows-1251',
    'koi8-r': 'KOI8-R',
    ibm866: 'DOS CP866',
    'iso-8859-5': 'ISO-8859-5',
  }[encoding];
}
