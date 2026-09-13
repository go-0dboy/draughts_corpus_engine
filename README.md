# Draughts Corpus Engine

Исследовательская платформа для корпуса партий в русские шашки: быстрый поиск по
позиции, статистика продолжений, просмотр партий и постепенно подключаемые
аналитические инструменты.

Сейчас реализован фундамент `v0.1`:

- TypeScript + React + Vite;
- одна кодовая база для Web/PWA и Android (Capacitor);
- нумерация 32 игровых полей и алгебраические координаты;
- четыре `uint32` bitboard и упаковка в два `uint64` (`bigint`);
- канонический ключ с обязательным `sideToMove`;
- чтение и запись PDN FEN, включая простые диапазоны;
- интерактивный редактор позиции;
- тесты, GitHub Pages и workflow сборки debug APK.

## Запуск сейчас

Нужен Node.js 20 или новее.

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

Первый раз:

```bash
npm install
npm run build
npm run android:add
npm run android:sync
npm run android:open
```

Папка `android/` пока генерируется локально и не хранится в Git. Debug APK также
можно собрать вручную из вкладки **Actions → Build Android APK → Run workflow**.

## GitHub Pages

Workflow публикует содержимое `dist/` после push в `main`. В настройках репозитория
нужно один раз выбрать **Settings → Pages → Source: GitHub Actions**, если источник
ещё не настроен.

## Ближайший этап

1. Генератор легальных ходов по правилам русских шашек: обязательное взятие,
   взятие назад простой, летающая дамка, многоходовое взятие и превращение.
2. Толерантный PDN 3.0 parser с AST и сохранением исходных данных.
3. Преобразование партии в уникальные позиции и обратный индекс.
4. Просмотр партии и Position Explorer.

Подробности: [docs/architecture.md](docs/architecture.md).
