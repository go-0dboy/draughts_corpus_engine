import type { Position } from '../core/types';
import type { GameOutcome } from '../corpus/result';

export interface GameMetadata {
  white: string;
  black: string;
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  /** Additional source tags that are not promoted to first-class fields. */
  extra: Readonly<Record<string, string>>;
}

export interface GameResult {
  /** Exact textual result preserved from the source. */
  text: string;
  outcome: GameOutcome;
}

export interface GameMove {
  /** Exact source notation without trailing annotations such as !?. */
  sourceNotation: string;
  /** Canonical notation after successful rules resolution. */
  canonicalNotation?: string;
}

/**
 * Stable game entity used by application/services and storage.
 *
 * It deliberately contains no PDN AST types and no database-specific ids.
 * Position chains are stored/retrieved separately because materializing them for
 * every game would be too expensive for a 100k+ game corpus.
 */
export interface Game {
  id: string;
  metadata: GameMetadata;
  result: GameResult;
  moves: readonly GameMove[];
  initialPosition?: Position;
}

export interface GamePly {
  gameId: string;
  ply: number;
  position: Position;
  moveAfter?: GameMove;
}
