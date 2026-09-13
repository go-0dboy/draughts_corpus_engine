# Mobile UX / Design System

## Цель

Android — основной продукт. Web/GitHub Pages отображает ту же оболочку, но интерфейс проектируется сначала под портретный телефон.

Минимальные контрольные ширины:

- 360 px;
- 390 px;
- 430 px;
- tablet adaptive layout — отдельная адаптация.

## Принципы

### 1. Один экран — одна основная задача

- `Партии`: найти и открыть партию;
- viewer: смотреть одну партию;
- `Позиция`: сформировать/вставить позицию и найти её;
- `Импорт`: добавить данные;
- `Инструменты`: запускать подключённые analysis tools.

Никаких desktop dashboard с одновременно видимыми списком, доской, импортом и статистикой.

### 2. Доска — главный объект viewer

На телефоне доска занимает доступную ширину. Заголовок, навигация по ходам и краткая информация располагаются вокруг неё. Подробная статистика позиции открывается как bottom sheet/expandable surface.

### 3. Navigation bar только для top-level экранов

Top-level destinations:

- Партии;
- Позиция;
- Импорт;
- Инструменты — показывается, когда registry содержит пользовательские инструменты.

Viewer партии — detail route и не является вкладкой navigation bar.

### 4. Progressive disclosure

Показываем сначала то, что нужно почти всегда. Редкие/технические функции раскрываются по запросу:

- FEN input;
- диагностический text import;
- исходный PDN;
- технические ошибки parser-а;
- расширенная статистика;
- developer diagnostics.

### 5. Не всё является карточкой

Иерархия строится через spacing, typography, surface elevation и grouping. Border используется только когда реально помогает отделить интерактивный объект.

### 6. Touch first

- интерактивная область не меньше ~48x48 dp;
- расстояние между тесно расположенными действиями;
- состояние `pressed`/`selected`;
- управление партией доступно большим пальцем;
- свайп по viewer позже дополняет, но не заменяет кнопки.

### 7. Edge-to-edge и safe areas

- фон может идти под system bars;
- app bar и bottom navigation учитывают `env(safe-area-inset-*)`;
- контент не попадает под gesture/navigation area.

### 8. Типографика

Три уровня достаточно для MVP:

- `title-large` — заголовок экрана;
- `title-medium` — название сущности/партии;
- `body`/`label` — данные и действия.

Длинные фамилии и названия турниров должны корректно переноситься/обрезаться, не ломая layout.

### 9. Иконки

- единый SVG icon set;
- никаких Unicode-символов как постоянных UI icons;
- icon-only button всегда имеет доступное `aria-label`/description;
- иконка не заменяет текст там, где действие неочевидно.

### 10. Состояния обязательны

Каждый экран проектируется минимум для:

- empty;
- loading;
- success;
- partial success;
- error;
- offline (если операция требует внешнего ресурса);
- large-data progress.

## Design tokens

Начальный набор CSS variables:

```text
spacing: 4 / 8 / 12 / 16 / 24 / 32
radius: 12 / 16 / 24
control-height: >= 48
content-max-phone: 520px
```

Цвета задаются семантически, а не напрямую в компонентах:

```text
--surface
--surface-container
--surface-container-high
--on-surface
--on-surface-muted
--primary
--on-primary
--outline
--error
--success
```

Доска имеет собственную палитру и не диктует цвет всей оболочке.

## Viewer партии

Иерархия:

```text
App bar: back + players + result
Board
Current move / move pair
Large move controls
Position insight handle
Bottom sheet: statistics / continuations / occurrences
```

### Bottom sheet позиции

Collapsed:

```text
Эта позиция · 142 партии   ↑
```

Expanded:

```text
142 вхождения
White / Draw / Black percentages
Top continuations
Open all occurrences
Open Position Explorer
```

## Экран партий

- compact app bar;
- search bar;
- filter chips;
- plain list rows, не тяжёлые карточки;
- результат визуально отделён справа;
- secondary line: event/date/site;
- list virtualization после подключения большого storage.

## Экран позиции

Основной режим — доска.

Действия:

- Расставить;
- Вставить FEN;
- Сторона хода;
- Найти.

После поиска результат находится на том же экране и не требует отдельного desktop panel.

## Экран импорта

Основной сценарий:

```text
Choose PDN
 -> file summary
 -> Import
 -> progress
 -> result report
```

Textarea отсутствует в основном пользовательском пути и доступна только через diagnostics/developer action.

Для большого официального корпуса приложение не предлагает повторно импортировать исходный PDN — используется готовая published corpus database.

## Tools UX

UI не знает заранее список tools.

```ts
interface AnalysisToolDescriptor {
  id: string;
  title: string;
  description: string;
  icon: string;
  supportedContexts: AnalysisContextKind[];
}
```

Экран `Инструменты` строится из registry. Новый инструмент добавляется без изменения основной навигационной логики.

Если tool поддерживает текущую позицию, он также может появиться в contextual actions Position/Viewer.

## UX критерии Sprint 1

- отсутствует горизонтальный scroll на 360 px;
- главный action каждого экрана виден без поиска по интерфейсу;
- viewer usable одной рукой;
- системный Back возвращает из viewer;
- import errors не заменяют весь экран stack trace/техническим текстом;
- никакой внутренней нумерации 1..32 в UI;
- никакого обязательного знания FEN/PDN для просмотра корпуса;
- technical diagnostics отделены от обычного UX.
