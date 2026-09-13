export type GameOutcome = 'white-win' | 'draw' | 'black-win' | 'unknown';

/**
 * PDN supports several result conventions. Russian draughts corpora commonly use
 * 2-0 / 1-1 / 0-2, while some sources use chess-style 1-0 / 1/2-1/2 / 0-1.
 * Domain code must never depend on a particular textual spelling.
 */
export function classifyResult(result: string | undefined): GameOutcome {
  switch ((result ?? '').trim()) {
    case '2-0':
    case '1-0':
      return 'white-win';
    case '1-1':
    case '1/2-1/2':
      return 'draw';
    case '0-2':
    case '0-1':
      return 'black-win';
    default:
      return 'unknown';
  }
}
