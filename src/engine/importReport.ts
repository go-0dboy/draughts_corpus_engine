import type { PdnGame, PdnImportResult } from '../corpus/pdn';

export type ImportPhase = 'discover' | 'parse' | 'notation' | 'rules' | 'storage' | 'index';
export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface ImportDiagnostic {
  severity: DiagnosticSeverity;
  phase: ImportPhase;
  code: string;
  message: string;
  gameId?: string;
  gameNumber?: number;
  ply?: number;
  sourceFragment?: string;
}

export interface ImportReport {
  discoveredGames: number;
  parsedGames: number;
  replayedGames: number;
  partialReplayGames: number;
  notReplayedGames: number;
  indexedGames: number;
  warnings: ImportDiagnostic[];
  errors: ImportDiagnostic[];
}

/**
 * Transitional adapter from the current PDN reader to the stable import-report
 * contract. Storage/index stages will append their own diagnostics later.
 */
export function buildImportReport(result: PdnImportResult): ImportReport {
  const warnings: ImportDiagnostic[] = [];
  const errors: ImportDiagnostic[] = result.errors.map((message, index) => ({
    severity: 'error',
    phase: 'parse',
    code: 'PDN_PARSE_ERROR',
    message,
    gameNumber: index + 1,
  }));

  let replayedGames = 0;
  let partialReplayGames = 0;
  let notReplayedGames = 0;

  result.games.forEach((game, index) => {
    if (game.replay.status === 'complete') replayedGames += 1;
    else if (game.replay.status === 'partial') partialReplayGames += 1;
    else notReplayedGames += 1;

    appendReplayWarnings(warnings, game, index + 1);
  });

  return {
    // The current reader can only report records it successfully delimited plus
    // parse errors. The streaming reader will later expose discoveredGames
    // independently before parsing starts.
    discoveredGames: result.games.length + result.errors.length,
    parsedGames: result.games.length,
    replayedGames,
    partialReplayGames,
    notReplayedGames,
    indexedGames: replayedGames,
    warnings,
    errors,
  };
}

function appendReplayWarnings(target: ImportDiagnostic[], game: PdnGame, gameNumber: number): void {
  for (const message of game.warnings) {
    target.push({
      severity: 'warning',
      phase: game.replay.status === 'partial' ? 'rules' : 'notation',
      code: game.replay.status === 'partial' ? 'REPLAY_PARTIAL' : 'PDN_WARNING',
      message,
      gameId: game.id,
      gameNumber,
      ply: game.replay.status === 'partial' ? game.replay.appliedMoves + 1 : undefined,
    });
  }
}
