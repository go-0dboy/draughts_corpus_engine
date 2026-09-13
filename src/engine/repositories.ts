import type { Game, GamePly } from '../domain/game';

export interface WriteBatchResult {
  insertedGames: number;
  insertedPlies: number;
  skippedDuplicates: number;
}

/**
 * Write-side boundary for user imports and the offline corpus builder.
 * Implementations may be SQLite, OPFS/SQLite, IndexedDB, or a build-time DB.
 */
export interface CorpusWriteRepository {
  beginImport(sourceId: string): Promise<void>;
  writeGame(game: Game, plies: readonly GamePly[]): Promise<'inserted' | 'duplicate'>;
  flush(): Promise<WriteBatchResult>;
  commitImport(): Promise<void>;
  rollbackImport(reason?: unknown): Promise<void>;
}
