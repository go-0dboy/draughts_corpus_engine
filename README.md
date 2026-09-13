# Draughts Corpus Engine

**Library-first ядро + мобильное Android-приложение** для исследования корпуса партий в русские шашки.

Android проектируется как основной продукт. TypeScript/React UI собирается через Capacitor в APK и одновременно может публиковаться через GitHub Pages. Главное отличие архитектуры: правила, позиции, PDN, corpus queries и аналитические tools не должны зависеть от React или конкретной БД.

## Архитектура

```text
Mobile / Web UI
      ↓
Application use-cases
      ↓
Public Corpus API
      ↓
Core / PDN / Storage adapters
      ↑
Analysis Tool Registry
```

Аналитический инструмент работает через стабильный `CorpusReadApi`. Новый tool можно добавить без прямого доступа к SQLite/IndexedDB и без изменения ядра интерфейса.

Документы:

- [Карта разработки](docs/development-roadmap.md)
- [Архитектурные решения](docs/architecture-decisions.md)
- [Mobile UX / Design System](docs/design-system.md)
- [Анализ реального russian2012.pdn](docs/corpus-analysis-russian2012.md)
- [Базовая архитектура данных](docs/architecture.md)

## Реальный corpus benchmark

Предоставленный `russian2012.pdn` используется как compatibility benchmark, а не как демонстрационный файл. Полный scan показывает:

- 109 616 партий;
- около 5,2 млн записей ходов;
- 6 496 стартовых FEN;
- `GameType 25`;
- результаты `2-0 / 1-1 / 0-2 / *`;
- исторический separator взятия `x` используется намного чаще `:`;
- comments, RAV и NAG;
- сокращённые многошаговые взятия, где PDN хранит только начальное и конечное поле.

Из этого следует: большой официальный корпус не должен загружаться через `File.text()` в React state. Он собирается офлайн Node corpus builder-ом в готовую индексированную read-only базу. Пользовательские партии импортируются отдельно в локальную writable library.

## Что уже реализовано

### Core

- четыре `uint32` bitboard;
- упаковка позиции в два `uint64` (`bigint`);
- `sideToMove` в идентичности позиции;
- algebraic mapping `a1-h8`;
- FEN reader/writer;
- генератор легальных ходов русских шашек;
- обязательное взятие;
- взятие простой вперёд и назад;
- летающая дамка;
- многошаговые взятия;
- побитые шашки остаются блокерами до окончания серии;
- превращение во время взятия и продолжение как дамкой;
- восстановление сокращённого исторического взятия через legal-move generation.

### PDN / corpus

- transitional tolerant main-line reader;
- arbitrary header order для реального корпуса;
- `x` и `:` при чтении;
- legacy numeric FEN при чтении;
- `2-0 / 1-1 / 0-2` и chess-style result normalization;
- replay problem не удаляет всю партию;
- позиционный индекс строится только для достоверно воспроизведённых партий;
- сохранение исходного source на текущем переходном этапе.

### Library API / tools

- async `CorpusReadApi`;
- `CorpusWriteRepository` contract;
- development `MemoryCorpus` adapter;
- `AnalysisTool` contract;
- `ToolRegistry`;
- первый tool — Position Statistics;
- storage-independent domain `Game` model;
- structured `ImportReport` / diagnostics contract.

### Mobile

- React + Vite + Capacitor;
- mobile-first shell;
- Партии / Позиция / Импорт / Инструменты;
- отдельный viewer партии;
- GitHub Pages;
- GitHub Actions test + build.

## Проверка корпуса

Потоковый scanner не загружает весь файл в память:

```bash
npm run corpus:inspect -- ./russian2012.pdn
```

Можно сохранить JSON-отчёт:

```bash
npm run corpus:inspect -- ./russian2012.pdn ./corpus-report.json
```

Scanner используется для воспроизводимого corpus discovery. Следующий CLI — полноценный builder positions/games/transitions.

## Запуск приложения

Нужен Node.js 24 или новее.

```bash
npm install
npm run dev
```

Проверка:

```bash
npm test
npm run build
```

## Android

```bash
npm install
npm run build
npm run android:add
npm run android:sync
npm run android:open
```

Debug APK также собирается через GitHub Actions.

## Нотация

Пользовательский интерфейс русских шашек использует только поля `a1-h8` и ходы вроде:

```text
c3-d4
d4:f6
```

Внутренняя 1..32 адресация существует только для bitboard и не является пользовательской нотацией.

Reader исторических данных принимает `x` как legacy separator (`d4xf6`), сохраняя исходную запись. Канонический writer будет выдавать `:`.

## Что делаем дальше

Ближайший технический приоритет — **Published Corpus Builder**: потоково разобрать весь `russian2012.pdn`, воспроизвести партии через Rules Engine, дедуплицировать позиции, агрегировать transitions и построить первую постоянную базу. После benchmark выбирается финальный storage backend для Android/Web.

Параллельно mobile UI переводится на public `src/engine` API и обновляется по [design system](docs/design-system.md): SVG icons, compact app bars, меньше тяжёлых карточек, viewer с position bottom sheet и корректные loading/progress/error states.
