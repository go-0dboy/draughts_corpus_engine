import type { Position } from '../core/types';
import type { PositionReport } from '../corpus';
import type { GameOutcome } from '../corpus/result';

/** Stable domain-facing summary. It intentionally does not expose PDN parser details. */
export interface GameSummary {
  id: string;
  white: string;
  black: string;
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  resultText: string;
  outcome: GameOutcome;
  plyCount: number;
  indexed: boolean;
}

export interface CorpusStats {
  games: number;
  indexedGames: number;
  pendingReplayGames: number;
  uniquePositions: number;
}

export interface GameSearchQuery {
  text?: string;
  white?: string;
  black?: string;
  event?: string;
  dateFrom?: string;
  dateTo?: string;
  outcome?: GameOutcome;
  limit?: number;
  offset?: number;
}

/**
 * Read API consumed by UI and analytical tools.
 *
 * It is asynchronous on purpose: the production implementation will use
 * SQLite/OPFS/IndexedDB and must not force tools to depend on an in-memory Map.
 */
export interface CorpusReadApi {
  stats(): Promise<CorpusStats>;
  searchGames(query?: GameSearchQuery): Promise<GameSummary[]>;
  positionReport(position: Position): Promise<PositionReport>;
}

export type AnalysisContextKind = 'corpus' | 'game' | 'position';

export interface AnalysisContext {
  kind: AnalysisContextKind;
  corpus: CorpusReadApi;
  gameId?: string;
  position?: Position;
}

export interface AnalysisToolDescriptor {
  id: string;
  title: string;
  description: string;
  icon: string;
  supportedContexts: AnalysisContextKind[];
}

/** A tool is an extension over the stable corpus API, not a direct DB client. */
export interface AnalysisTool<TResult = unknown> {
  descriptor: AnalysisToolDescriptor;
  canRun(context: AnalysisContext): boolean;
  run(context: AnalysisContext): Promise<TResult>;
}
