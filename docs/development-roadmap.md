# Карта разработки Draughts Corpus Engine

## Цель продукта

Создать полноценное **мобильное Android-приложение** для исследования корпуса партий в русские шашки, построенное поверх независимого библиотечного ядра.

Главные требования:

- Android — основной продукт;
- TypeScript/React + Capacitor;
- APK собирается через Node.js;
- та же UI-сборка может работать на GitHub Pages;
- приложение не требует собственного сервера для базовых функций;
- интерфейс mobile-first;
- пользовательская нотация — алгебраическая `a1-h8`;
- большой исторический корпус поставляется как готовая опубликованная база;
- новые пользовательские партии добавляются локально;
- аналитические возможности расширяются через независимые tools/plugins.

## Главный архитектурный принцип

```text
Mobile/Web UI
     ↓
Application use-cases
     ↓
Public Corpus API
     ↓
┌───────────┬───────────┬────────────┐
│ Core      │ PDN       │ Storage    │
│ rules     │ reader    │ adapters   │
│ position  │ writer    │            │
└───────────┴───────────┴────────────┘
     ↑
Analysis Tools Registry
```

UI и инструменты не знают внутреннюю схему SQLite/IndexedDB и не вызывают parser напрямую.

Подробности: `docs/architecture-decisions.md`.

---

# Этап 0 — Product/Corpus Discovery — ЗАВЕРШЁН ДЛЯ ПЕРВОЙ ИТЕРАЦИИ

Результаты анализа реального `russian2012.pdn`:

- 109 616 партий;
- ~5,2 млн ходов;
- 6 496 стартовых FEN;
- все партии `GameType 25`;
- legacy capture separator `x` используется значительно чаще `:`;
- присутствуют comments, RAV, NAG;
- множество многошаговых взятий записаны сокращённо только start/end;
- результаты представлены как `2-0 / 1-1 / 0-2 / *`.

Документ: `docs/corpus-analysis-russian2012.md`.

Следствия:

- tolerant reader обязателен;
- полноценный Rules Engine обязателен для импорта;
- большой официальный корпус нельзя держать как гигантский JS array;
- published corpus должен собираться офлайн;
- импорт одной проблемной партии не должен останавливать весь файл.

---

# Этап 1 — Core library boundary — В РАБОТЕ

Цель: отделить предметное ядро от приложения и подготовить расширяемость.

Уже сделано:

- [x] bitboard position model;
- [x] `sideToMove` в позиции;
- [x] algebraic square mapping;
- [x] FEN reader/writer;
- [x] `CorpusReadApi`;
- [x] memory adapter для development;
- [x] `AnalysisTool` contract;
- [x] `ToolRegistry`;
- [x] первый tool: Position Statistics;
- [x] единая классификация результатов `2-0/1-1/0-2` и chess-style variants.

Следующее:

- [ ] выделить domain `Game/Move/Result` отдельно от `PdnGame`;
- [ ] UI импортирует только public API из `src/engine`;
- [ ] repository contracts для read/write;
- [ ] application use-cases поверх repository;
- [ ] убрать зависимости tools от parser/storage internals.

Критерий: tool можно unit-test-ить без React и без конкретной БД.

---

# Этап 2 — Rules Engine русских шашек — ТЕКУЩИЙ CORE-ЭТАП

Цель: любая позиция, построенная из партии, должна быть следствием легального хода.

Уже реализовано:

- [x] генерация тихих ходов простых;
- [x] обязательность взятия;
- [x] взятие простой вперёд/назад;
- [x] летающая дамка;
- [x] многократные взятия;
- [x] запрет повторного взятия той же шашки;
- [x] побитые шашки остаются блокерами до окончания серии;
- [x] превращение во время серии;
- [x] продолжение после превращения как дамкой;
- [x] выбор любой легальной серии, без правила максимального взятия;
- [x] разрешение исторического shortened capture по legal start/end;
- [x] ambiguous shortened capture не угадывается;
- [x] regression tests на реальные фрагменты корпуса.

Осталось:

- [ ] расширенный набор rule fixtures;
- [ ] benchmark generator-а;
- [ ] corpus replay benchmark на больших выборках;
- [ ] оптимизация только после профилирования.

Критерий: corpus replay не создаёт нелегальных позиций и выдаёт диагностируемые исключения вместо угадывания.

---

# Этап 3 — Tolerant PDN / AST

Цель: читать исторические данные и уметь сохранить их без потерь.

Текущий transitional reader уже:

- [x] не зависит от `[Event]` как первой строки;
- [x] принимает `GameType 25` в сокращённой форме;
- [x] принимает `x` и `:` при чтении;
- [x] сохраняет исходный source;
- [x] читает legacy numeric FEN;
- [x] не удаляет game record при replay error;
- [x] main line отделяется от comments/RAV для позиционного индекса.

Нужно:

- [ ] lexer;
- [ ] AST;
- [ ] arbitrary tag order;
- [ ] comments;
- [ ] nested RAV;
- [ ] NAG;
- [ ] move strength;
- [ ] `%` line comments;
- [ ] setup commands;
- [ ] source locations line/column;
- [ ] diagnostics severity/code;
- [ ] canonical writer;
- [ ] lossless source retention;
- [ ] round-trip tests.

Критерий: реальная выборка корпуса проходит parser без потери структурных данных; несовместимые конструкции перечислены в diagnostics.

---

# Этап 4 — Corpus Builder и постоянное хранилище

Этот этап повышен в приоритете после анализа файла ~64 MB.

## 4A. Published corpus builder (Node)

```text
source PDN
 -> tolerant reader
 -> normalized domain game
 -> Rules Engine replay
 -> position deduplication
 -> transition aggregation
 -> storage builder
 -> versioned published corpus
```

Требования:

- [ ] streaming input;
- [ ] batch processing;
- [ ] progress;
- [ ] per-game diagnostics;
- [ ] resume/rebuild strategy;
- [ ] deterministic output;
- [ ] corpus manifest/version/checksum;
- [ ] benchmark report.

## 4B. Storage contracts

Основная модель:

```text
positions(id, white64, black64, side_to_move, hash)
games(id, metadata, result, source_ref)
game_plies(game_id, ply, position_id, move_code)
transitions(position_id, move_code, next_position_id, counters...)
```

Дополнительно сохраняются source/AST/diagnostics.

## 4C. Adapters

- Android: SQLite;
- Web: SQLite WASM/OPFS или IndexedDB после benchmark;
- development: MemoryCorpus;
- published corpus: read-only adapter;
- user library: writable adapter.

Критерий: `russian2012.pdn` не требуется повторно парсить при запуске приложения.

---

# Этап 5 — User Import Pipeline

Цель: пользователь добавляет новые партии без серверной инфраструктуры.

```text
file picker
 -> worker/stream reader
 -> PDN
 -> rules
 -> local write repository
 -> index update
 -> structured report
```

- [ ] multiple files;
- [ ] progress;
- [ ] cancellation;
- [ ] duplicate detection;
- [ ] incremental transaction batches;
- [ ] background worker;
- [ ] report: discovered / parsed / replayed / indexed / warning / error;
- [ ] problem game viewer;
- [ ] retry after parser/rule update.

Критерий: импорт не блокирует UI и одна ошибочная партия не останавливает остальные.

---

# Этап 6 — Mobile UX / Design System — ПАРАЛЛЕЛЬНЫЙ ТРЕК

Документ: `docs/design-system.md`.

Основные решения:

- одна задача на экран;
- доска — главный объект viewer;
- compact app bar;
- bottom navigation для top-level routes;
- position analytics в bottom sheet;
- настоящие SVG icons вместо Unicode glyphs;
- touch target >= 48 dp;
- edge-to-edge + safe areas;
- progressive disclosure;
- минимум тяжёлых карточек/рамок;
- обязательные empty/loading/progress/error/partial states;
- 360/390/430 px regression sizes.

### Экраны MVP

#### Партии

- search;
- filter chips;
- list;
- result/date/event;
- virtualized/paged source from repository.

#### Game Viewer

- board;
- move navigation;
- move list/strip;
- position insight handle;
- bottom sheet with statistics/continuations/occurrences.

#### Position

- board editor;
- side to move;
- optional FEN input;
- corpus search;
- occurrences/statistics.

#### Import

- file picker;
- progress;
- report;
- diagnostics as secondary view.

#### Tools

- generated from ToolRegistry;
- no hard-coded placeholder tools in production UI.

---

# Этап 7 — Position Explorer

Центральный research tool:

- [ ] FEN/current position search;
- [ ] occurrences;
- [ ] W/D/L and percentages;
- [ ] continuations;
- [ ] continuation W/D/L;
- [ ] players/events/dates;
- [ ] filters;
- [ ] jump to exact ply;
- [ ] transpositions;
- [ ] compare time periods.

---

# Этап 8 — Opening / Player / Corpus Analytics

Tools/plugins:

- Opening Explorer;
- opening tree;
- frequency;
- success rate;
- popularity by decade;
- novelty/first occurrence;
- repeated sequences;
- Player Explorer;
- compare players;
- opponent preparation;
- anomaly detection;
- historical theory evolution.

Каждый tool работает через `CorpusReadApi`, а не через SQL напрямую.

---

# Этап 9 — Combination Finder

- material swing;
- sacrifices;
- promotion sequences;
- forced tactical sequences;
- evaluation swing;
- ranking;
- manual confirmation;
- training puzzle generation.

---

# Этап 10 — Position Evaluation

Задача: **оценка позиции без поиска лучшего хода**.

## Classical evaluator

- material;
- kings;
- mobility;
- center;
- tempo;
- structure;
- threats;
- empirical corpus stats.

## Value network

Input:

```text
white men
white kings
black men
black kings
side to move
```

Output:

```text
P(win), P(draw), P(loss)
```

- dataset;
- leakage-safe train/validation split;
- bias analysis;
- ONNX export;
- local inference;
- historical vs neural comparison.

AlphaZero/MCTS не обязателен, потому что отдельная задача — статическая value evaluation.

---

# Этап 11 — AI Agent layer

LLM/agent — только orchestration layer над точными tools.

Пример:

> Найди редкие продолжения этого дебюта после 1990 года и сравни их результативность.

Agent:

1. выбирает tools;
2. формирует query;
3. получает структурированные результаты;
4. объясняет их.

Parser/rules/storage никогда не зависят от LLM.

---

# Этап 12 — Android Release

- Android project/reproducible generation;
- package id;
- icon/splash;
- edge-to-edge;
- system file picker;
- back/predictive back;
- offline mode;
- signed release APK;
- AAB при необходимости;
- safe local DB migration;
- published corpus update mechanism.

---

# Нефункциональные требования

## Correctness

- rules unit tests;
- parser fixtures;
- corpus regression fixtures;
- no silent guessing;
- source preservation;
- deterministic builder.

## Performance

- no full scans for position lookup;
- no huge corpus in React state;
- no full `File.text()` path for production large corpus import;
- worker/background processing;
- paged/virtualized UI;
- benchmark before Rust/WASM optimization.

## Extensibility

- public API versioning;
- tools registry;
- storage adapters;
- parser adapters;
- UI does not import internal storage implementation.

## UX

- Russian primary UI;
- no internal 1..32 notation;
- normal user can browse/search without knowing PDN/FEN;
- technical diagnostics are secondary;
- mobile-first.

---

# Ближайшие спринты

## Sprint A — Corpus correctness

1. finish rules regression suite;
2. replay larger real fixtures;
3. tolerant reader diagnostics;
4. result/capture normalization;
5. corpus compatibility report.

## Sprint B — Library boundary

1. domain Game/Move types;
2. write repository contract;
3. use-cases;
4. migrate UI to `src/engine` public API;
5. ToolRegistry-driven tools UI.

## Sprint C — Published corpus builder

1. streaming Node reader;
2. storage prototype;
3. build first database from `russian2012.pdn`;
4. benchmark size/speed;
5. choose production storage backend.

## Sprint D — Modern mobile UX

1. SVG icon set;
2. compact app bars;
3. list/filter UX;
4. viewer bottom sheet;
5. import progress/report;
6. responsive regression checks.

После Sprint C у нас должна появиться первая версия, которая работает не на игрушечном массиве, а на настоящем историческом корпусе.
