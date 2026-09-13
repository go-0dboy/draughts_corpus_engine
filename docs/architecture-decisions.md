# Архитектурные решения

## ADR-001 — Library first

**Решение:** основная ценность проекта реализуется как библиотечное ядро. Android/Web приложение — клиент этого ядра.

```text
UI
  -> application/use-cases
      -> corpus public API
          -> core / pdn / storage
              -> adapters
```

UI не импортирует внутренние bitboard helpers, parser internals или SQL schema напрямую.

## ADR-002 — PDN не является доменной моделью

PDN — внешний формат. Доменная модель хранит игру, ход, позицию и результат независимо от того, откуда они пришли.

```text
PDN -> reader -> normalized domain objects
```

Это позволяет позже добавить другой importer/exporter без переписывания tools.

## ADR-003 — Rules Engine является частью core

В реальном историческом корпусе многошаговые взятия часто записаны только начальной и конечной клеткой. Поэтому importer обязан разрешать запись через генерацию легальных ходов.

Никакой importer не должен самостоятельно вычислять шашечную геометрию в обход core rules.

## ADR-004 — Published corpus и User library разделены

### Published corpus

Историческая база собирается заранее Node corpus builder-ом и поставляется как готовая индексированная read-only база.

### User library

Новые партии импортируются локально и хранятся отдельно.

Corpus API объединяет оба источника на уровне запросов.

Преимущества:

- не нужно повторно парсить десятки MB PDN при старте;
- обновление опубликованной базы не уничтожает пользовательские данные;
- проще versioning и migrations;
- можно независимо оптимизировать read-only и writable storage.

## ADR-005 — Инструменты являются plugins/extensions

Инструмент работает через `CorpusReadApi` и контекст анализа.

```ts
interface AnalysisTool<TResult = unknown> {
  descriptor: AnalysisToolDescriptor;
  canRun(context: AnalysisContext): boolean;
  run(context: AnalysisContext): Promise<TResult>;
}
```

Tool не получает прямой доступ к IndexedDB/SQLite и не зависит от React.

Следовательно, новые функции можно добавлять как независимые модули:

- Position Statistics;
- Opening Explorer;
- Player Explorer;
- Combination Finder;
- Anomaly Finder;
- Novelty Finder;
- Value Network;
- Endgame tools.

## ADR-006 — Storage API асинхронный

Даже development memory adapter реализует Promise-based API, потому что production backend будет SQLite/OPFS/IndexedDB.

Это предотвращает ситуацию, когда весь tools/UI слой приходится переписывать при переходе с `Map` на БД.

## ADR-007 — Импорт всегда выдаёт diagnostics

Плохая партия не останавливает весь корпус.

Import pipeline:

```text
discover
 -> parse
 -> normalize
 -> replay/validate
 -> store
 -> index
```

Каждая фаза возвращает структурированную диагностику.

## ADR-008 — Correctness before optimization

Сначала создаём проверяемый rules engine и integration fixtures. Затем профилируем на полном корпусе.

Rust/WASM, custom binary indexes и низкоуровневые bit tricks вводятся только если benchmark показывает необходимость.

При этом публичные API проектируются так, чтобы внутреннюю реализацию можно было заменить без изменения tools/UI.

## ADR-009 — Mobile-first UI

Android — эталон UX. GitHub Pages — второй frontend той же системы.

- одна задача на экран;
- доска — главный объект viewer;
- secondary analytics — bottom sheet;
- top-level navigation — navigation bar;
- technical diagnostics отделены от обычного UI;
- 360/390/430 px — обязательные контрольные размеры.

Подробности: `docs/design-system.md`.

## ADR-010 — Corpus-driven development

`russian2012.pdn` используется как corpus compatibility benchmark.

Новые особенности parser/rules/storage добавляются не по догадкам, а после:

1. scan реальных данных;
2. формулировки требования;
3. минимального regression fixture;
4. реализации;
5. CI;
6. повторного corpus benchmark.

Подробности: `docs/corpus-analysis-russian2012.md`.
