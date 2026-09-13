# Corpus storage architecture

## Goal

The application must remain usable with 100,000+ games and millions of position occurrences. The UI must never own the corpus as one JavaScript array and analytical tools must never depend on an in-memory `Map` implementation.

## Platform strategy

The domain/core layer is storage-agnostic.

- Web / GitHub Pages: IndexedDB adapter.
- Android / Capacitor: IndexedDB works as the baseline implementation; a native SQLite adapter can be introduced behind the same asynchronous corpus API when large-device benchmarks justify it.
- Import and indexing run outside the React UI thread.

The application must not require a server for its local corpus.

## Logical model

### `games`

One record per imported game. It contains metadata, the main-line move sequence, position keys, replay diagnostics and source material required for future PDN reconstruction.

The game ID is stable for the same source, so importing the same corpus again can skip duplicates.

### `gameSummaries`

A deliberately small projection used by the game browser. It contains only player/event/date/result/search fields and move count. Lists and searches must read this store instead of loading complete games.

### `positions`

Unique dictionary of board positions.

The canonical key is:

`side:WHITE64:BLACK64`

where `WHITE64 = whiteMen32 | whiteKings32 << 32` and `BLACK64 = blackMen32 | blackKings32 << 32`.

The key itself fully encodes the position, therefore a second copy of the four bitboards is not stored. Aggregate statistics are stored next to the key.

### `occurrences`

Reverse index from a position to a game and ply. This allows position search to find games without scanning every game. The UI reads occurrences in pages.

Only completely replayed games are allowed to contribute occurrence/statistical records. A damaged historical game may still be stored and viewed, but it must not contaminate statistics.

### `continuations`

Aggregated `position + next move` statistics. This makes Position Explorer and opening tools cheap: they do not need to re-scan all game records for every screen.

## Import pipeline

```text
File/Blob
   ↓ stream
Web Worker
   ↓ one PDN game at a time
PDN lexer / syntax parser / rules replay
   ↓ batches (currently 100 games)
IndexedDB transaction
   ├─ games
   ├─ gameSummaries
   ├─ positions
   ├─ occurrences
   └─ continuations
```

The main React thread receives only progress counters. It never receives the full parsed corpus.

## UI query rules

- Game list: page 40 summaries at a time.
- Position occurrences: not loaded until the user asks; page 30 at a time.
- Standard initial position: show aggregate first-move statistics first. Do not automatically render the list of practically every normal game.
- Game viewer: load one complete game on demand.
- Search: query indexed summary data, never `Array.filter()` over the whole corpus.

## Tool architecture

Analysis tools consume an asynchronous corpus read API, not IndexedDB directly. This preserves the ability to swap the storage adapter and lets each new tool be tested independently from React and the physical database.

Planned modules include opening explorer, repeated sequences/novelties, tactical combination mining, position evaluation, player repertoire analysis and anomaly detection.

## Next storage work

1. Add versioned database migrations before schema v2 is required.
2. Benchmark the supplied historical corpus on Chromium/Android devices: import throughput, database size, search latency and position lookup latency.
3. Decide from measured data whether the Android build should use a native SQLite adapter while GitHub Pages keeps IndexedDB.
4. Replace raw source duplication with a compact reconstructable game/AST representation once semantic `GameTree` resolution is complete.
