import {
  detectPdnEncoding,
  encodingDisplayName,
  type PdnTextEncoding,
} from '../corpus/encoding';

export const PDN_ENCODING_OPTIONS: readonly PdnTextEncoding[] = [
  'utf-8',
  'windows-1251',
  'koi8-r',
  'ibm866',
  'iso-8859-5',
  'utf-16le',
  'utf-16be',
] as const;

const PREVIEW_BYTES = 160 * 1024;
const PREVIEW_GAMES = 4;

export interface PdnHeaderPreview {
  white: string;
  black: string;
  event: string;
  site: string;
}

export interface PdnEncodingInspection {
  detected: PdnTextEncoding;
  selected: PdnTextEncoding;
  preview: PdnHeaderPreview[];
}

export async function inspectPdnEncoding(file: File): Promise<PdnEncodingInspection> {
  const detected = await detectPdnEncoding(file);
  return {
    detected,
    selected: detected,
    preview: await previewPdnEncoding(file, detected),
  };
}

export async function previewPdnEncoding(
  file: File,
  encoding: PdnTextEncoding,
): Promise<PdnHeaderPreview[]> {
  const bytes = await file.slice(0, PREVIEW_BYTES).arrayBuffer();
  const text = new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, '');
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const result: PdnHeaderPreview[] = [];
  let current: Record<string, string> = {};
  let sawMovetext = false;

  const flush = () => {
    if (Object.keys(current).length === 0) return;
    result.push({
      white: current.White || '—',
      black: current.Black || '—',
      event: current.Event || '—',
      site: current.Site || '—',
    });
    current = {};
    sawMovetext = false;
  };

  for (const line of lines) {
    const tag = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"])*)"\]\s*$/);
    if (tag) {
      // A tag after movetext starts the next game. Also handle corpora where
      // White is the first tag and Event appears later in the same header block.
      if (sawMovetext) flush();
      current[tag[1]] = tag[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      continue;
    }

    if (Object.keys(current).length > 0 && line.trim()) sawMovetext = true;
    if (result.length >= PREVIEW_GAMES) break;
  }

  if (result.length < PREVIEW_GAMES) flush();
  return result.slice(0, PREVIEW_GAMES);
}

export function pdnEncodingLabel(encoding: PdnTextEncoding): string {
  return encodingDisplayName(encoding);
}
