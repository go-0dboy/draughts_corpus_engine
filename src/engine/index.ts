export type {
  AnalysisContext,
  AnalysisContextKind,
  AnalysisTool,
  AnalysisToolDescriptor,
  CorpusReadApi,
  CorpusStats,
  GameSearchQuery,
  GameSummary,
} from './contracts';
export type { CorpusWriteRepository, WriteBatchResult } from './repositories';
export type {
  DiagnosticSeverity,
  ImportDiagnostic,
  ImportPhase,
  ImportReport,
} from './importReport';
export { buildImportReport } from './importReport';
export { MemoryCorpus } from './memoryCorpus';
export { ToolRegistry } from './toolRegistry';

export type { Game, GameMetadata, GameMove, GamePly, GameResult } from '../domain/game';
export { gameFromPdn } from '../domain/fromPdn';

// Transitional import facade. UI may use these through engine while the final
// PDN package boundary is being extracted.
export { parsePdn, iterateGameSources } from '../corpus/pdn';
export type { PdnGame, PdnImportResult, PdnReplayInfo, ReplayStatus } from '../corpus/pdn';
export { classifyResult } from '../corpus/result';
export type { GameOutcome } from '../corpus/result';
export type { PositionReport, PositionOccurrence, ContinuationStat } from '../corpus';
export { parseFen, toFen } from '../core/fen';
export { INITIAL_POSITION } from '../core/position';
export type { Position } from '../core/types';

export { positionStatisticsTool } from '../tools/positionStatistics';
