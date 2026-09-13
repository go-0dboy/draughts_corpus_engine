import { positionKey } from '../core/position';
import type { Position } from '../core/types';
import type { PdnGame, PdnReplayInfo } from '../corpus/pdn';
import { classifyResult } from '../corpus/result';

const DB_NAME = 'draughts-corpus-engine';
const DB_VERSION = 1;

const STORES = {
  games: 'games',
  summaries: 'gameSummaries',
  positions: 'positions',
  occurrences: 'occurrences',
  continuations: 'continuations',
} as const;

export interface StoredGame {
  id: string;
  headers: Record<string, string>;
  result: string;
  moves: string[];
  positionKeys: string[];
  source: string;
  warnings: string[];
  replay: PdnReplayInfo;
}

export interface GameSummary {
  id: string;
  white: string;
  black: string;
  event: string;
  site: string;
  date: string;
  result: string;
  moveCount: number;
  replayStatus: PdnReplayInfo['status'];
  searchText: string;
  searchTokens: string[];
}

export interface StoredPositionStats {
  key: string;
  position: Position;
  occurrences: number;
  whiteWins: number;
  draws: number;
  blackWins: number;
}

export interface StoredContinuation {
  id: string;
  positionKey: string;
  move: string;
  games: number;
  whiteWins: number;
  draws: number;
  blackWins: number;
}

export interface StoredOccurrence {
  id?: number;
  positionKey: string;
  gameId: string;
  ply: number;
  moveAfter: string | null;
  result: string;
}

export interface CorpusStats {
  games: number;
  positions: number;
}

export interface PositionDbReport {
  key: string;
  occurrences: number;
  whiteWins: number;
  draws: number;
  blackWins: number;
  continuations: StoredContinuation[];
}

export interface PositionOccurrenceView {
  gameId: string;
  ply: number;
  moveAfter: string | null;
  result: string;
  white: string;
  black: string;
  date: string;
  event: string;
}

export interface StoreBatchResult {
  insertedGames: number;
  skippedGames: number;
  occurrences: number;
  touchedPositions: number;
}

export async function openCorpusDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть локальную базу корпуса.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      const games = db.createObjectStore(STORES.games, { keyPath: 'id' });
      void games;

      const summaries = db.createObjectStore(STORES.summaries, { keyPath: 'id' });
      summaries.createIndex('date', 'date', { unique: false });
      summaries.createIndex('searchTokens', 'searchTokens', { unique: false, multiEntry: true });

      db.createObjectStore(STORES.positions, { keyPath: 'key' });

      const occurrences = db.createObjectStore(STORES.occurrences, { keyPath: 'id', autoIncrement: true });
      occurrences.createIndex('positionKey', 'positionKey', { unique: false });
      occurrences.createIndex('gameId', 'gameId', { unique: false });

      const continuations = db.createObjectStore(STORES.continuations, { keyPath: 'id' });
      continuations.createIndex('positionKey', 'positionKey', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getCorpusStats(): Promise<CorpusStats> {
  const db = await openCorpusDb();
  try {
    const tx = db.transaction([STORES.summaries, STORES.positions], 'readonly');
    const games = await requestValue(tx.objectStore(STORES.summaries).count());
    const positions = await requestValue(tx.objectStore(STORES.positions).count());
    await transactionDone(tx);
    return { games, positions };
  } finally {
    db.close();
  }
}

export async function listGames(options: { query?: string; offset?: number; limit?: number } = {}): Promise<GameSummary[]> {
  const db = await openCorpusDb();
  try {
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.max(1, Math.min(200, options.limit ?? 40));
    const normalizedQuery = normalizeSearch(options.query ?? '');
    const tx = db.transaction(STORES.summaries, 'readonly');
    const store = tx.objectStore(STORES.summaries);

    const result = normalizedQuery
      ? await searchSummaries(store, normalizedQuery, offset, limit)
      : await pageSummaries(store, offset, limit);

    await transactionDone(tx);
    return result;
  } finally {
    db.close();
  }
}

export async function getStoredGame(id: string): Promise<StoredGame | null> {
  const db = await openCorpusDb();
  try {
    const tx = db.transaction(STORES.games, 'readonly');
    const value = await requestValue<StoredGame | undefined>(tx.objectStore(STORES.games).get(id));
    await transactionDone(tx);
    return value ?? null;
  } finally {
    db.close();
  }
}

export async function loadGameForViewer(id: string): Promise<PdnGame | null> {
  const db = await openCorpusDb();
  try {
    const tx = db.transaction([STORES.games, STORES.positions], 'readonly');
    const game = await requestValue<StoredGame | undefined>(tx.objectStore(STORES.games).get(id));
    if (!game) {
      await transactionDone(tx);
      return null;
    }

    const positionStore = tx.objectStore(STORES.positions);
    const positions = await Promise.all(
      game.positionKeys.map(async (key) => {
        const stored = await requestValue<StoredPositionStats | undefined>(positionStore.get(key));
        if (!stored) throw new Error(`Позиция ${key} отсутствует в словаре корпуса.`);
        return stored.position;
      }),
    );
    await transactionDone(tx);

    return {
      id: game.id,
      headers: game.headers,
      result: game.result,
      moves: game.moves,
      positions,
      source: game.source,
      warnings: game.warnings,
      replay: game.replay,
    };
  } finally {
    db.close();
  }
}

export async function getPositionReport(position: Position): Promise<PositionDbReport> {
  const key = positionKey(position);
  const db = await openCorpusDb();
  try {
    const tx = db.transaction([STORES.positions, STORES.continuations], 'readonly');
    const stats = await requestValue<StoredPositionStats | undefined>(tx.objectStore(STORES.positions).get(key));
    const continuations = await allByIndex<StoredContinuation>(
      tx.objectStore(STORES.continuations).index('positionKey'),
      IDBKeyRange.only(key),
    );
    await transactionDone(tx);

    return {
      key,
      occurrences: stats?.occurrences ?? 0,
      whiteWins: stats?.whiteWins ?? 0,
      draws: stats?.draws ?? 0,
      blackWins: stats?.blackWins ?? 0,
      continuations: continuations.sort((a, b) => b.games - a.games || a.move.localeCompare(b.move)),
    };
  } finally {
    db.close();
  }
}

export async function listPositionOccurrences(
  position: Position,
  options: { offset?: number; limit?: number } = {},
): Promise<PositionOccurrenceView[]> {
  const key = positionKey(position);
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, Math.min(100, options.limit ?? 30));
  const db = await openCorpusDb();
  try {
    const tx = db.transaction([STORES.occurrences, STORES.summaries], 'readonly');
    const occurrenceStore = tx.objectStore(STORES.occurrences).index('positionKey');
    const occurrences = await pageByIndex<StoredOccurrence>(occurrenceStore, IDBKeyRange.only(key), offset, limit);
    const summaryStore = tx.objectStore(STORES.summaries);
    const summaries = await Promise.all(
      occurrences.map((occurrence) => requestValue<GameSummary | undefined>(summaryStore.get(occurrence.gameId))),
    );
    await transactionDone(tx);

    return occurrences.map((occurrence, index) => {
      const summary = summaries[index];
      return {
        gameId: occurrence.gameId,
        ply: occurrence.ply,
        moveAfter: occurrence.moveAfter,
        result: occurrence.result,
        white: summary?.white ?? '—',
        black: summary?.black ?? '—',
        date: summary?.date ?? '—',
        event: summary?.event ?? '',
      };
    });
  } finally {
    db.close();
  }
}

export async function storeGamesBatch(games: readonly PdnGame[]): Promise<StoreBatchResult> {
  if (games.length === 0) return { insertedGames: 0, skippedGames: 0, occurrences: 0, touchedPositions: 0 };

  const normalized = games.map((game) => normalizeGameForStorage(game));
  const db = await openCorpusDb();
  try {
    const existingTx = db.transaction(STORES.games, 'readonly');
    const existingStore = existingTx.objectStore(STORES.games);
    const exists = await Promise.all(
      normalized.map(({ stored }) => requestValue<IDBValidKey | undefined>(existingStore.getKey(stored.id))),
    );
    await transactionDone(existingTx);

    const fresh = normalized.filter((_, index) => exists[index] === undefined);
    if (fresh.length === 0) {
      return { insertedGames: 0, skippedGames: games.length, occurrences: 0, touchedPositions: 0 };
    }

    const positionDeltas = new Map<string, PositionDelta>();
    const continuationDeltas = new Map<string, ContinuationDelta>();
    const occurrences: StoredOccurrence[] = [];

    for (const item of fresh) {
      item.game.positions.forEach((position, ply) => {
        const key = item.stored.positionKeys[ply];
        const outcome = classifyResult(item.game.result);
        const delta = positionDeltas.get(key) ?? {
          key,
          position: { ...position },
          occurrences: 0,
          whiteWins: 0,
          draws: 0,
          blackWins: 0,
        };
        delta.occurrences += 1;
        if (outcome === 'white-win') delta.whiteWins += 1;
        else if (outcome === 'black-win') delta.blackWins += 1;
        else if (outcome === 'draw') delta.draws += 1;
        positionDeltas.set(key, delta);

        const moveAfter = item.game.moves[ply] ?? null;
        occurrences.push({ positionKey: key, gameId: item.stored.id, ply, moveAfter, result: item.game.result });

        if (moveAfter) {
          const continuationId = continuationKey(key, moveAfter);
          const continuation = continuationDeltas.get(continuationId) ?? {
            id: continuationId,
            positionKey: key,
            move: moveAfter,
            games: 0,
            whiteWins: 0,
            draws: 0,
            blackWins: 0,
          };
          continuation.games += 1;
          if (outcome === 'white-win') continuation.whiteWins += 1;
          else if (outcome === 'black-win') continuation.blackWins += 1;
          else if (outcome === 'draw') continuation.draws += 1;
          continuationDeltas.set(continuationId, continuation);
        }
      });
    }

    const tx = db.transaction(
      [STORES.games, STORES.summaries, STORES.positions, STORES.occurrences, STORES.continuations],
      'readwrite',
    );
    const gameStore = tx.objectStore(STORES.games);
    const summaryStore = tx.objectStore(STORES.summaries);
    const positionStore = tx.objectStore(STORES.positions);
    const occurrenceStore = tx.objectStore(STORES.occurrences);
    const continuationStore = tx.objectStore(STORES.continuations);

    for (const item of fresh) {
      gameStore.put(item.stored);
      summaryStore.put(item.summary);
    }
    for (const occurrence of occurrences) occurrenceStore.add(occurrence);

    for (const delta of positionDeltas.values()) {
      const request = positionStore.get(delta.key);
      request.onsuccess = () => {
        const current = request.result as StoredPositionStats | undefined;
        positionStore.put({
          key: delta.key,
          position: current?.position ?? delta.position,
          occurrences: (current?.occurrences ?? 0) + delta.occurrences,
          whiteWins: (current?.whiteWins ?? 0) + delta.whiteWins,
          draws: (current?.draws ?? 0) + delta.draws,
          blackWins: (current?.blackWins ?? 0) + delta.blackWins,
        } satisfies StoredPositionStats);
      };
    }

    for (const delta of continuationDeltas.values()) {
      const request = continuationStore.get(delta.id);
      request.onsuccess = () => {
        const current = request.result as StoredContinuation | undefined;
        continuationStore.put({
          id: delta.id,
          positionKey: delta.positionKey,
          move: delta.move,
          games: (current?.games ?? 0) + delta.games,
          whiteWins: (current?.whiteWins ?? 0) + delta.whiteWins,
          draws: (current?.draws ?? 0) + delta.draws,
          blackWins: (current?.blackWins ?? 0) + delta.blackWins,
        } satisfies StoredContinuation);
      };
    }

    await transactionDone(tx);
    return {
      insertedGames: fresh.length,
      skippedGames: games.length - fresh.length,
      occurrences: occurrences.length,
      touchedPositions: positionDeltas.size,
    };
  } finally {
    db.close();
  }
}

export async function clearCorpusDatabase(): Promise<void> {
  const db = await openCorpusDb();
  try {
    const tx = db.transaction(Object.values(STORES), 'readwrite');
    for (const name of Object.values(STORES)) tx.objectStore(name).clear();
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

function normalizeGameForStorage(game: PdnGame): { game: PdnGame; stored: StoredGame; summary: GameSummary } {
  const id = `g-${hash64(game.source)}`;
  const white = game.headers.White ?? '—';
  const black = game.headers.Black ?? '—';
  const event = game.headers.Event ?? '';
  const site = game.headers.Site ?? '';
  const date = game.headers.Date ?? '';
  const searchable = normalizeSearch([white, black, event, site, date, game.result].join(' '));
  const searchTokens = [...new Set(searchable.split(' ').filter(Boolean))];
  const positionKeys = game.positions.map(positionKey);

  return {
    game,
    stored: {
      id,
      headers: game.headers,
      result: game.result,
      moves: [...game.moves],
      positionKeys,
      source: game.source,
      warnings: [...game.warnings],
      replay: { ...game.replay },
    },
    summary: {
      id,
      white,
      black,
      event,
      site,
      date,
      result: game.result,
      moveCount: game.moves.length,
      replayStatus: game.replay.status,
      searchText: searchable,
      searchTokens,
    },
  };
}

interface PositionDelta extends StoredPositionStats {}
interface ContinuationDelta extends StoredContinuation {}

function continuationKey(position: string, move: string): string {
  return `${position}\u0000${move}`;
}

function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hash64(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a ^= code;
    a = Math.imul(a, 0x01000193);
    b ^= code + index;
    b = Math.imul(b, 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

async function pageSummaries(store: IDBObjectStore, offset: number, limit: number): Promise<GameSummary[]> {
  const index = store.index('date');
  return new Promise((resolve, reject) => {
    const rows: GameSummary[] = [];
    let skipped = 0;
    const request = index.openCursor(null, 'prev');
    request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать список партий.'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= limit) {
        resolve(rows);
        return;
      }
      if (skipped < offset) {
        skipped += 1;
        cursor.continue();
        return;
      }
      rows.push(cursor.value as GameSummary);
      cursor.continue();
    };
  });
}

async function searchSummaries(store: IDBObjectStore, query: string, offset: number, limit: number): Promise<GameSummary[]> {
  const firstToken = query.split(' ')[0];
  const range = IDBKeyRange.bound(firstToken, `${firstToken}\uffff`);
  const index = store.index('searchTokens');
  return new Promise((resolve, reject) => {
    const rows: GameSummary[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    const request = index.openCursor(range);
    request.onerror = () => reject(request.error ?? new Error('Не удалось выполнить поиск партий.'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= limit) {
        resolve(rows);
        return;
      }
      const row = cursor.value as GameSummary;
      if (!seen.has(row.id) && row.searchText.includes(query)) {
        seen.add(row.id);
        if (skipped < offset) skipped += 1;
        else rows.push(row);
      }
      cursor.continue();
    };
  });
}

async function allByIndex<T>(index: IDBIndex, query: IDBValidKey | IDBKeyRange): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = index.getAll(query);
    request.onerror = () => reject(request.error ?? new Error('Ошибка чтения индекса.'));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

async function pageByIndex<T>(index: IDBIndex, query: IDBValidKey | IDBKeyRange, offset: number, limit: number): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const rows: T[] = [];
    let skipped = 0;
    const request = index.openCursor(query);
    request.onerror = () => reject(request.error ?? new Error('Ошибка чтения индекса.'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= limit) {
        resolve(rows);
        return;
      }
      if (skipped < offset) skipped += 1;
      else rows.push(cursor.value as T);
      cursor.continue();
    };
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ошибка IndexedDB.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Транзакция IndexedDB завершилась с ошибкой.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Транзакция IndexedDB отменена.'));
  });
}
