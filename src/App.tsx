import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  inspectPdnEncoding,
  PDN_ENCODING_OPTIONS,
  pdnEncodingLabel,
  previewPdnEncoding,
  type PdnHeaderPreview,
} from './application/encodingPreview';
import { importCorpusFile, importCorpusText, type ImportProgress } from './application/importCorpus';
import {
  APP_THEMES,
  BOARD_SKINS,
  loadPreferences,
  savePreferences,
  watchSystemAppearance,
  type AppPreferences,
  type AppTheme,
  type BoardSkin,
} from './application/preferences';
import { Board, type BoardOrientation } from './components/Board';
import { BottomNav, type AppTab } from './components/BottomNav';
import { Icon, type IconName } from './components/Icon';
import { PositionEditor } from './components/PositionEditor';
import { parseFen, toFen } from './core/fen';
import { INITIAL_POSITION, positionKey } from './core/position';
import { parseRussianMove } from './core/russianMove';
import type { Position } from './core/types';
import type { PdnTextEncoding } from './corpus/encoding';
import type { PdnGame } from './corpus/pdn';
import {
  clearCorpusDatabase,
  getCorpusStats,
  getPositionReport,
  listGames,
  listPositionOccurrences,
  loadGameForViewer,
  type CorpusStats,
  type GameSummary,
  type PositionDbReport,
  type PositionOccurrenceView,
} from './storage/corpusDb';

const PAGE_SIZE = 40;
const OCCURRENCE_PAGE_SIZE = 30;

const SAMPLE_PDN = `[Event "Учебная партия"]
[Site "Draughts Corpus Engine"]
[Date "2026.09.13"]
[Round "1"]
[White "Белые"]
[Black "Чёрные"]
[Result "*"]
[GameType "25,W,8,8,A0,0"]

1. c3-d4 f6-e5 2. d4:f6 g7:e5 *`;

type View = AppTab | 'viewer';

function App() {
  const [view, setView] = useState<View>('games');
  const [lastTab, setLastTab] = useState<AppTab>('games');
  const [stats, setStats] = useState<CorpusStats>({ games: 0, positions: 0 });
  const [gameRows, setGameRows] = useState<GameSummary[]>([]);
  const [gameQuery, setGameQuery] = useState('');
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesExhausted, setGamesExhausted] = useState(false);

  const [selectedGame, setSelectedGame] = useState<PdnGame | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [ply, setPly] = useState(0);
  const [viewerReport, setViewerReport] = useState<PositionDbReport | null>(null);
  const [positionSheetOpen, setPositionSheetOpen] = useState(false);

  const [positionSearch, setPositionSearch] = useState<Position>({ ...INITIAL_POSITION });
  const [positionReport, setPositionReport] = useState<PositionDbReport>(emptyReport(INITIAL_POSITION));
  const [fenInput, setFenInput] = useState(toFen(INITIAL_POSITION));
  const [positionError, setPositionError] = useState('');
  const [positionOccurrences, setPositionOccurrences] = useState<PositionOccurrenceView[]>([]);
  const [showOccurrences, setShowOccurrences] = useState(false);
  const [occurrencesExhausted, setOccurrencesExhausted] = useState(false);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);

  const [boardOrientation, setBoardOrientation] = useState<BoardOrientation>('white');
  const [pdnText, setPdnText] = useState(SAMPLE_PDN);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState('');
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [detectedEncoding, setDetectedEncoding] = useState<PdnTextEncoding | null>(null);
  const [selectedEncoding, setSelectedEncoding] = useState<PdnTextEncoding | null>(null);
  const [encodingPreview, setEncodingPreview] = useState<PdnHeaderPreview[]>([]);
  const [encodingInspecting, setEncodingInspecting] = useState(false);
  const [importRunning, setImportRunning] = useState(false);

  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());

  const maxViewPly = selectedGame ? Math.max(0, selectedGame.positions.length - 1) : 0;
  const safePly = Math.min(ply, maxViewPly);
  const currentPosition = selectedGame?.positions[safePly] ?? null;
  const isInitialPosition = positionKey(positionSearch) === positionKey(INITIAL_POSITION);

  const highlightedSquares = useMemo(() => {
    if (!selectedGame || safePly === 0) return [];
    const notation = selectedGame.moves[safePly - 1];
    if (!notation) return [];
    try {
      const move = parseRussianMove(notation);
      return [move.path[0], move.path[move.path.length - 1]];
    } catch {
      return [];
    }
  }, [selectedGame, safePly]);

  const refreshStats = useCallback(async () => {
    setStats(await getCorpusStats());
  }, []);

  const reloadGames = useCallback(async () => {
    setGamesLoading(true);
    try {
      const rows = await listGames({ query: gameQuery, limit: PAGE_SIZE });
      setGameRows(rows);
      setGamesExhausted(rows.length < PAGE_SIZE);
    } finally {
      setGamesLoading(false);
    }
  }, [gameQuery]);

  const refreshPositionReport = useCallback(async (position: Position) => {
    setPositionReport(await getPositionReport(position));
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reloadGames(), 220);
    return () => window.clearTimeout(timer);
  }, [reloadGames]);

  useEffect(() => {
    setShowOccurrences(false);
    setPositionOccurrences([]);
    setOccurrencesExhausted(false);
    const timer = window.setTimeout(() => void refreshPositionReport(positionSearch), 100);
    return () => window.clearTimeout(timer);
  }, [positionSearch, refreshPositionReport]);

  useEffect(() => watchSystemAppearance((next) => setPreferences(next)), []);

  useEffect(() => {
    if (!currentPosition) {
      setViewerReport(null);
      return;
    }
    let cancelled = false;
    void getPositionReport(currentPosition).then((report) => {
      if (!cancelled) setViewerReport(report);
    });
    return () => { cancelled = true; };
  }, [currentPosition]);

  const switchTab = (tab: AppTab) => {
    setPositionSheetOpen(false);
    setLastTab(tab);
    setView(tab);
  };

  const openGame = async (gameId: string, targetPly = 0) => {
    setViewerLoading(true);
    try {
      const game = await loadGameForViewer(gameId);
      if (!game) return;
      if (view !== 'viewer') setLastTab(view as AppTab);
      setSelectedGame(game);
      setPly(Math.max(0, Math.min(targetPly, Math.max(0, game.positions.length - 1))));
      setPositionSheetOpen(false);
      setView('viewer');
    } finally {
      setViewerLoading(false);
    }
  };

  const loadMoreGames = async () => {
    if (gamesLoading || gamesExhausted) return;
    setGamesLoading(true);
    try {
      const rows = await listGames({ query: gameQuery, offset: gameRows.length, limit: PAGE_SIZE });
      setGameRows((current) => [...current, ...rows]);
      setGamesExhausted(rows.length < PAGE_SIZE);
    } finally {
      setGamesLoading(false);
    }
  };

  const updatePosition = (position: Position) => {
    setPositionSearch(position);
    setFenInput(toFen(position));
    setPositionError('');
  };

  const applyFen = () => {
    try {
      updatePosition(parseFen(fenInput));
    } catch (error) {
      setPositionError(error instanceof Error ? error.message : 'Не удалось прочитать FEN.');
    }
  };

  const analyzePosition = (position: Position) => {
    updatePosition({ ...position });
    setPositionSheetOpen(false);
    switchTab('position');
  };

  const flipBoard = () => {
    setBoardOrientation((value) => value === 'white' ? 'black' : 'white');
  };

  const openOccurrences = async () => {
    if (occurrencesLoading) return;
    setShowOccurrences(true);
    if (positionOccurrences.length > 0) return;
    await loadMoreOccurrences(true);
  };

  const loadMoreOccurrences = async (reset = false) => {
    if (occurrencesLoading || (!reset && occurrencesExhausted)) return;
    setOccurrencesLoading(true);
    try {
      const offset = reset ? 0 : positionOccurrences.length;
      const rows = await listPositionOccurrences(positionSearch, { offset, limit: OCCURRENCE_PAGE_SIZE });
      setPositionOccurrences((current) => reset ? rows : [...current, ...rows]);
      setOccurrencesExhausted(rows.length < OCCURRENCE_PAGE_SIZE);
    } finally {
      setOccurrencesLoading(false);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setImportError('');
    setImportProgress(null);
    setPendingImportFile(file);
    setDetectedEncoding(null);
    setSelectedEncoding(null);
    setEncodingPreview([]);
    setEncodingInspecting(true);
    try {
      const inspection = await inspectPdnEncoding(file);
      setDetectedEncoding(inspection.detected);
      setSelectedEncoding(inspection.selected);
      setEncodingPreview(inspection.preview);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setEncodingInspecting(false);
    }
  };

  const changeEncoding = async (encoding: PdnTextEncoding) => {
    setSelectedEncoding(encoding);
    if (!pendingImportFile) return;
    setEncodingInspecting(true);
    try {
      setEncodingPreview(await previewPdnEncoding(pendingImportFile, encoding));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setEncodingInspecting(false);
    }
  };

  const startFileImport = async () => {
    if (!pendingImportFile || !selectedEncoding || importRunning) return;
    setImportError('');
    setImportRunning(true);
    setImportProgress({ parsed: 0, imported: 0, skipped: 0, errors: 0, encoding: selectedEncoding, done: false });
    try {
      await importCorpusFile(pendingImportFile, selectedEncoding, setImportProgress);
      await Promise.all([refreshStats(), reloadGames(), refreshPositionReport(positionSearch)]);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImportRunning(false);
    }
  };

  const handleTextImport = async () => {
    setImportError('');
    try {
      await importCorpusText(pdnText, setImportProgress);
      await Promise.all([refreshStats(), reloadGames(), refreshPositionReport(positionSearch)]);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };

  const updatePreferences = (patch: Partial<AppPreferences>) => {
    setPreferences(savePreferences(patch));
  };

  const clearDatabase = async () => {
    if (!window.confirm('Удалить все партии и позиции из локальной базы на этом устройстве?')) return;
    await clearCorpusDatabase();
    setSelectedGame(null);
    setPositionOccurrences([]);
    setShowOccurrences(false);
    await Promise.all([refreshStats(), reloadGames(), refreshPositionReport(positionSearch)]);
  };

  if (view === 'viewer') {
    return (
      <div className="mobile-app viewer-screen">
        <main className="viewer-content board-first-viewer">
          {viewerLoading && <p className="loading-line">Загрузка партии…</p>}
          {selectedGame && currentPosition && (
            <>
              {selectedGame.replay.status === 'partial' && (
                <div className="replay-notice" role="status">
                  Позиции восстановлены до {maxViewPly}-го полухода из {selectedGame.moves.length}.
                </div>
              )}

              <section className="board-wrap viewer-board-wrap">
                <Board position={currentPosition} orientation={boardOrientation} highlightSquares={highlightedSquares} />
              </section>

              <section className="game-context-line">
                <div>
                  <strong>{selectedGame.headers.White ?? '—'} — {selectedGame.headers.Black ?? '—'}</strong>
                  <span>{[selectedGame.headers.Event, selectedGame.headers.Date].filter(Boolean).join(' · ') || 'Партия'}</span>
                </div>
                <span className="result-chip">{selectedGame.result}</span>
                <button className="icon-button ghost-button" type="button" aria-label="Перевернуть доску" onClick={flipBoard}>
                  <Icon name="flip" />
                </button>
              </section>

              <section className="current-move-line" aria-live="polite">
                <span>{safePly === 0 ? 'Начало партии' : `Полуход ${safePly}`}</span>
                <strong>{safePly > 0 ? selectedGame.moves[safePly - 1] : 'Стартовая позиция'}</strong>
              </section>

              <section className="move-controller" aria-label="Навигация по партии">
                <button type="button" aria-label="В начало" onClick={() => setPly(0)} disabled={safePly === 0}><Icon name="first" /></button>
                <button type="button" aria-label="Предыдущий ход" onClick={() => setPly(Math.max(0, safePly - 1))} disabled={safePly === 0}><Icon name="previous" /></button>
                <div><strong>{safePly}</strong><span>из {maxViewPly}</span></div>
                <button type="button" aria-label="Следующий ход" onClick={() => setPly(Math.min(maxViewPly, safePly + 1))} disabled={safePly >= maxViewPly}><Icon name="next" /></button>
                <button type="button" aria-label="В конец" onClick={() => setPly(maxViewPly)} disabled={safePly >= maxViewPly}><Icon name="last" /></button>
              </section>

              <section className="move-strip" aria-label="Ходы партии">
                {selectedGame.moves.slice(0, maxViewPly).map((move, index) => (
                  <button type="button" key={`${move}-${index}`} className={safePly === index + 1 ? 'active' : ''} onClick={() => setPly(index + 1)}>
                    <span>{index + 1}</span>{move}
                  </button>
                ))}
              </section>

              {viewerReport && (
                <button type="button" className="position-insight" onClick={() => setPositionSheetOpen(true)} aria-haspopup="dialog">
                  <div><span>Эта позиция</span><strong>{viewerReport.occurrences} {pluralGames(viewerReport.occurrences)}</strong></div>
                  <Icon name="up" size={21} />
                </button>
              )}
            </>
          )}
        </main>

        {positionSheetOpen && viewerReport && currentPosition && (
          <>
            <button className="sheet-backdrop" type="button" aria-label="Закрыть статистику" onClick={() => setPositionSheetOpen(false)} />
            <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label="Статистика текущей позиции">
              <div className="sheet-handle" aria-hidden="true" />
              <div className="sheet-heading">
                <div><span className="section-kicker">Текущая позиция</span><h2>{viewerReport.occurrences} вхождений</h2></div>
                <span className="side-chip">Ход {currentPosition.sideToMove === 'W' ? 'белых' : 'чёрных'}</span>
              </div>
              <ResultStats report={viewerReport} />
              <ContinuationList report={viewerReport} limit={6} />
              <div className="sheet-actions">
                <button type="button" className="primary-button full-width" onClick={() => analyzePosition(currentPosition)}>Открыть позицию</button>
                <button type="button" className="secondary-button full-width" onClick={() => setPositionSheetOpen(false)}>Закрыть</button>
              </div>
            </section>
          </>
        )}

        <BottomNav active={lastTab} onChange={switchTab} />
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <main className="screen-content no-top-chrome">
        {view === 'games' && (
          <>
            <section className="screen-section content-top compact-overview">
              <label className="search-box">
                <Icon name="search" size={21} />
                <input type="search" value={gameQuery} onChange={(event) => setGameQuery(event.target.value)} placeholder="Игрок, турнир, год…" aria-label="Поиск партий" />
              </label>
            </section>

            {stats.games === 0 && !gamesLoading ? (
              <EmptyState title="Корпус пока пуст" text="Импортируй PDN-файл. Партии будут сохранены в локальной базе, а не в памяти страницы." action="Импортировать PDN" onAction={() => switchTab('import')} />
            ) : gameRows.length === 0 && !gamesLoading ? (
              <EmptyState title="Ничего не найдено" text="Измени строку поиска." />
            ) : (
              <section className="game-list-mobile">
                {gameRows.map((game) => (
                  <button type="button" className="game-card" key={game.id} onClick={() => void openGame(game.id)}>
                    <div className="game-card-main">
                      <strong>{game.white} — {game.black}</strong>
                      <span>{[game.event, game.site].filter(Boolean).join(' · ') || 'Без названия'}</span>
                      <small>{game.date || 'Дата неизвестна'} · {game.moveCount} полуходов</small>
                    </div>
                    <span className="game-card-result">{game.result}</span>
                  </button>
                ))}
                {!gamesExhausted && <button className="secondary-button full-width load-more" type="button" onClick={() => void loadMoreGames()} disabled={gamesLoading}>{gamesLoading ? 'Загрузка…' : 'Показать ещё'}</button>}
              </section>
            )}
          </>
        )}

        {view === 'position' && (
          <>
            <div className="content-top">
              <PositionEditor position={positionSearch} orientation={boardOrientation} onChange={updatePosition} onFlip={flipBoard} />
            </div>

            <details className="mobile-card fen-card">
              <summary>FEN позиции</summary>
              <label htmlFor="position-fen">Буквенная запись позиции</label>
              <textarea id="position-fen" value={fenInput} onChange={(event) => setFenInput(event.target.value)} rows={3} spellCheck={false} />
              {positionError && <p className="inline-error">{positionError}</p>}
              <button type="button" className="primary-button full-width" onClick={applyFen}>Применить FEN</button>
            </details>

            <section className="mobile-card explorer-summary">
              <div className="card-heading-row">
                <div><span className="section-kicker">Position Explorer</span><h2>{positionReport.occurrences} вхождений</h2></div>
              </div>
              <ResultStats report={positionReport} />
              <ContinuationList report={positionReport} limit={12} />
            </section>

            {positionReport.occurrences > 0 && (
              <section className="mobile-card occurrence-gate">
                {isInitialPosition ? (
                  <>
                    <h2>Стартовая позиция</h2>
                    <p>Почти каждая обычная партия начинается здесь. Основная информация — частота первых ходов и статистика выше; список партий открывается только по запросу.</p>
                  </>
                ) : (
                  <><h2>Партии с этой позицией</h2><p>Список читается из позиционного индекса порциями.</p></>
                )}
                {!showOccurrences && <button type="button" className="secondary-button full-width" onClick={() => void openOccurrences()}>Показать партии</button>}
                {showOccurrences && (
                  <div className="occurrence-list-mobile">
                    {positionOccurrences.map((occurrence, index) => (
                      <button type="button" key={`${occurrence.gameId}-${occurrence.ply}-${index}`} onClick={() => void openGame(occurrence.gameId, occurrence.ply)}>
                        <strong>{occurrence.white} — {occurrence.black}</strong>
                        <span>{[occurrence.date, occurrence.event, `позиция ${occurrence.ply}`, occurrence.result].filter(Boolean).join(' · ')}</span>
                      </button>
                    ))}
                    {!occurrencesExhausted && <button type="button" className="secondary-button full-width load-more" onClick={() => void loadMoreOccurrences()} disabled={occurrencesLoading}>{occurrencesLoading ? 'Загрузка…' : 'Показать ещё'}</button>}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {view === 'import' && (
          <>
            <section className="import-hero mobile-card content-top">
              <div className="import-icon" aria-hidden="true"><Icon name="upload" size={28} /></div>
              <h2>Добавить корпус</h2>
              <p>Сначала проверяем кодировку и показываем, как читаются имена игроков и турниры. Затем файл потоково импортируется в локальную базу.</p>
              <label className="primary-button file-picker full-width">
                Выбрать .pdn
                <input type="file" accept=".pdn,.txt,text/plain" disabled={importRunning} onChange={(event) => void handleFileSelected(event.target.files?.[0])} />
              </label>
              {pendingImportFile && <p className="file-name-line">{pendingImportFile.name} · {formatBytes(pendingImportFile.size)}</p>}
            </section>

            {pendingImportFile && (
              <section className="encoding-panel">
                <div className="encoding-panel-head">
                  <div>
                    <strong>Проверка кодировки</strong>
                    <span>{encodingInspecting ? 'Читаем образец…' : 'Автоопределение выполнено первым'}</span>
                  </div>
                  {detectedEncoding && (
                    <span className="encoding-auto-badge">Авто: {pdnEncodingLabel(detectedEncoding)}</span>
                  )}
                </div>

                <label className="encoding-select-label">
                  Кодировка файла
                  <select
                    value={selectedEncoding ?? ''}
                    disabled={encodingInspecting || importRunning}
                    onChange={(event) => void changeEncoding(event.target.value as PdnTextEncoding)}
                  >
                    {PDN_ENCODING_OPTIONS.map((encoding) => (
                      <option value={encoding} key={encoding}>{pdnEncodingLabel(encoding)}</option>
                    ))}
                  </select>
                </label>

                <div className="encoding-preview" aria-live="polite">
                  {encodingInspecting ? (
                    <div className="encoding-preview-empty">Формируем предпросмотр…</div>
                  ) : encodingPreview.length === 0 ? (
                    <div className="encoding-preview-empty">В начале файла не удалось найти заголовки партий.</div>
                  ) : (
                    encodingPreview.map((row, index) => (
                      <div className="encoding-preview-row" key={`${row.white}-${row.black}-${index}`}>
                        <strong>{row.white} — {row.black}</strong>
                        <span>{[row.event, row.site].filter((value) => value && value !== '—').join(' · ') || 'Турнир/место не указаны'}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="encoding-actions">
                  <button type="button" className="primary-button full-width" disabled={!selectedEncoding || encodingInspecting || importRunning} onClick={() => void startFileImport()}>
                    {importRunning ? 'Импорт идёт…' : selectedEncoding === detectedEncoding ? 'Импортировать (авто)' : 'Импортировать с выбранной кодировкой'}
                  </button>
                </div>
              </section>
            )}

            <section className="mobile-card">
              <h2>Локальная база</h2>
              <div className="metric-grid">
                <div><strong>{stats.games}</strong><span>партий</span></div>
                <div><strong>{stats.positions}</strong><span>уникальных позиций</span></div>
              </div>
              {importProgress && <ImportStatus progress={importProgress} />}
              {importError && <p className="inline-error">{importError}</p>}
            </section>

            <details className="mobile-card developer-import">
              <summary>Тестовый текстовый импорт</summary>
              <textarea value={pdnText} onChange={(event) => setPdnText(event.target.value)} rows={8} spellCheck={false} />
              <div className="stacked-actions">
                <button type="button" className="primary-button" onClick={() => void handleTextImport()}>Импортировать текст</button>
                <button type="button" className="secondary-button" onClick={() => setPdnText(SAMPLE_PDN)}>Учебный пример</button>
              </div>
            </details>
          </>
        )}

        {view === 'tools' && (
          <>
            <section className="mobile-card content-top tools-explainer">
              <span className="section-kicker">Расширяемое ядро</span>
              <h2>Инструменты — модули анализа корпуса</h2>
              <p>Каждый модуль работает через общее ядро и единый Corpus API. Новые инструменты можно добавлять без изменения формата партий и позиций.</p>
            </section>

            <section className="mobile-card available-tool">
              <div className="tool-icon" aria-hidden="true"><Icon name="evaluation" size={22} /></div>
              <div className="tool-copy">
                <span className="available-badge">Доступно</span>
                <h2>Статистика корпуса</h2>
                <p>Размер локального корпуса и позиционного словаря.</p>
                <div className="metric-grid"><div><strong>{stats.games}</strong><span>партий</span></div><div><strong>{stats.positions}</strong><span>позиций</span></div></div>
              </div>
            </section>

            <section className="tool-grid">
              <ToolCard icon="openings" title="Дебюты" text="Дерево вариантов, частота и результативность." />
              <ToolCard icon="tactics" title="Комбинации" text="Поиск тактических эпизодов и жертв в реальных партиях." />
              <ToolCard icon="evaluation" title="Оценка позиции" text="Классическая и нейросетевая оценка без поиска лучшего хода." />
              <ToolCard icon="players" title="Игроки" text="Репертуар, статистика и подготовка к сопернику." />
            </section>
          </>
        )}

        {view === 'settings' && (
          <SettingsView preferences={preferences} onChange={updatePreferences} onClear={() => void clearDatabase()} stats={stats} />
        )}
      </main>

      <BottomNav active={view} onChange={switchTab} />
    </div>
  );
}

function SettingsView({
  preferences,
  onChange,
  onClear,
  stats,
}: {
  preferences: AppPreferences;
  onChange: (patch: Partial<AppPreferences>) => void;
  onClear: () => void;
  stats: CorpusStats;
}) {
  const themeLabels: Record<AppTheme, string> = { system: 'Как в системе', dark: 'Тёмная', light: 'Светлая' };
  const boardLabels: Record<BoardSkin, string> = {
    auto: 'Как приложение',
    classic: 'Классика',
    green: 'Сукно',
    graphite: 'Графит',
    sand: 'Песок',
    cherry: 'Вишня',
    ocean: 'Океан',
    marble: 'Мрамор',
  };

  return (
    <div className="settings-view content-top">
      <section className="settings-section">
        <h2>Оформление</h2>
        <div className="choice-list">
          {APP_THEMES.map((theme) => (
            <button type="button" key={theme} className={preferences.theme === theme ? 'selected' : ''} onClick={() => onChange({ theme })}>
              <span>{themeLabels[theme]}</span><span className="radio-mark" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>Доска</h2>
        <div className="choice-list">
          {BOARD_SKINS.map((boardSkin) => (
            <button type="button" key={boardSkin} className={preferences.boardSkin === boardSkin ? 'selected' : ''} onClick={() => onChange({ boardSkin })}>
              <span>{boardLabels[boardSkin]}</span><span className="radio-mark" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section danger-zone">
        <h2>Локальная база</h2>
        <p>Сейчас на устройстве: {stats.games} партий и {stats.positions} уникальных позиций.</p>
        <button type="button" className="danger-button full-width" onClick={onClear} disabled={stats.games === 0}>Очистить локальный корпус</button>
      </section>
    </div>
  );
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <section className="empty-mobile">
      <div className="empty-symbol" aria-hidden="true"><Icon name="position" size={28} /></div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && onAction && <button type="button" className="primary-button" onClick={onAction}>{action}</button>}
    </section>
  );
}

function ResultStats({ report }: { report: PositionDbReport }) {
  const decided = report.whiteWins + report.draws + report.blackWins;
  const percent = (value: number) => decided === 0 ? 0 : Math.round((value / decided) * 100);
  return (
    <div className="result-stats">
      <div><strong>{percent(report.whiteWins)}%</strong><span>Белые</span></div>
      <div><strong>{percent(report.draws)}%</strong><span>Ничья</span></div>
      <div><strong>{percent(report.blackWins)}%</strong><span>Чёрные</span></div>
    </div>
  );
}

function ContinuationList({ report, limit }: { report: PositionDbReport; limit?: number }) {
  const items = typeof limit === 'number' ? report.continuations.slice(0, limit) : report.continuations;
  if (items.length === 0) return <p className="muted-mobile">Нет продолжений из этой позиции.</p>;
  return (
    <div className="continuation-list-mobile">
      <h3>Продолжения</h3>
      {items.map((item) => (
        <div key={item.move}><code>{item.move}</code><span>{item.games} партий</span></div>
      ))}
    </div>
  );
}

function ToolCard({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <article className="tool-card mobile-card planned-tool">
      <div className="tool-icon" aria-hidden="true"><Icon name={icon} size={22} /></div>
      <div className="tool-copy"><span className="planned-badge">В разработке</span><h2>{title}</h2><p>{text}</p></div>
    </article>
  );
}

function ImportStatus({ progress }: { progress: ImportProgress }) {
  return (
    <div className="import-report-mobile import-progress">
      <p><strong>{progress.done ? 'Импорт завершён' : 'Импорт идёт в фоне…'}</strong></p>
      {progress.encoding && <p>Кодировка: {pdnEncodingLabel(progress.encoding)}</p>}
      <p>Разобрано: {progress.parsed}</p>
      <p>Добавлено: {progress.imported} · уже было: {progress.skipped} · ошибок: {progress.errors}</p>
      {progress.lastError && <p className="import-last-error">Последняя ошибка: {progress.lastError}</p>}
    </div>
  );
}

function emptyReport(position: Position): PositionDbReport {
  return { key: positionKey(position), occurrences: 0, whiteWins: 0, draws: 0, blackWins: 0, continuations: [] };
}

function pluralGames(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'партия';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'партии';
  return 'партий';
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} МБ`;
}

export default App;
