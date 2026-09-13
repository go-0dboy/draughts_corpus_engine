import { useMemo, useState } from 'react';
import { Board, type BoardOrientation } from './components/Board';
import { BottomNav, type AppTab } from './components/BottomNav';
import { Icon, type IconName } from './components/Icon';
import { CorpusIndex } from './corpus';
import { parsePdn, type PdnGame } from './corpus/pdn';
import { parseFen, toFen } from './core/fen';
import { INITIAL_POSITION } from './core/position';
import { parseRussianMove } from './core/russianMove';
import type { Position } from './core/types';

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
  const [games, setGames] = useState<PdnGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const [gameQuery, setGameQuery] = useState('');
  const [pdnText, setPdnText] = useState(SAMPLE_PDN);
  const [importMessages, setImportMessages] = useState<string[]>([]);
  const [positionSearch, setPositionSearch] = useState<Position>({ ...INITIAL_POSITION });
  const [fenInput, setFenInput] = useState(toFen(INITIAL_POSITION));
  const [positionError, setPositionError] = useState('');
  const [boardOrientation, setBoardOrientation] = useState<BoardOrientation>('white');
  const [positionSheetOpen, setPositionSheetOpen] = useState(false);

  const corpus = useMemo(() => new CorpusIndex(games), [games]);
  const selectedGame = games.find((game) => game.id === selectedGameId) ?? null;
  const maxViewPly = selectedGame ? Math.max(0, selectedGame.positions.length - 1) : 0;
  const safePly = Math.min(ply, maxViewPly);
  const currentPosition = selectedGame?.positions[safePly] ?? null;
  const currentReport = currentPosition ? corpus.report(currentPosition) : null;
  const positionReport = corpus.report(positionSearch);

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

  const filteredGames = useMemo(() => {
    const query = gameQuery.trim().toLocaleLowerCase('ru');
    if (!query) return games;
    return games.filter((game) => {
      const text = [
        game.headers.White,
        game.headers.Black,
        game.headers.Event,
        game.headers.Site,
        game.headers.Date,
        game.result,
      ].filter(Boolean).join(' ').toLocaleLowerCase('ru');
      return text.includes(query);
    });
  }, [games, gameQuery]);

  const switchTab = (tab: AppTab) => {
    setPositionSheetOpen(false);
    setLastTab(tab);
    setView(tab);
  };

  const openGame = (game: PdnGame, targetPly = 0) => {
    const availablePly = Math.max(0, game.positions.length - 1);
    setSelectedGameId(game.id);
    setPly(Math.max(0, Math.min(targetPly, availablePly)));
    setPositionSheetOpen(false);
    setView('viewer');
  };

  const importText = (text: string) => {
    const result = parsePdn(text);
    if (result.games.length > 0) {
      setGames((previous) => {
        const existingSources = new Set(previous.map((game) => game.source));
        const fresh = result.games.filter((game) => !existingSources.has(game.source));
        return [...previous, ...fresh];
      });
    }
    setImportMessages([
      `Найдено партий: ${result.games.length}`,
      `Ошибок: ${result.errors.length}`,
      ...result.errors.slice(0, 8),
    ]);
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setPdnText(text);
    importText(text);
  };

  const applyFen = () => {
    try {
      const position = parseFen(fenInput);
      setPositionSearch(position);
      setFenInput(toFen(position));
      setPositionError('');
    } catch (error) {
      setPositionError(error instanceof Error ? error.message : 'Не удалось прочитать FEN.');
    }
  };

  const analyzePosition = (position: Position) => {
    setPositionSearch({ ...position });
    setFenInput(toFen(position));
    setPositionError('');
    setPositionSheetOpen(false);
    switchTab('position');
  };

  const flipBoard = () => {
    setBoardOrientation((value) => value === 'white' ? 'black' : 'white');
  };

  if (view === 'viewer' && selectedGame && currentPosition && currentReport) {
    const currentMove = safePly > 0 ? selectedGame.moves[safePly - 1] : 'Стартовая позиция';
    const isReplayPartial = selectedGame.replay.status === 'partial';

    return (
      <div className="mobile-app viewer-screen">
        <header className="app-bar viewer-bar">
          <button className="icon-button ghost-button" type="button" aria-label="Назад" onClick={() => setView(lastTab)}>
            <Icon name="back" />
          </button>
          <div className="app-bar-title">
            <strong>{selectedGame.headers.White ?? '—'} — {selectedGame.headers.Black ?? '—'}</strong>
            <span>{[selectedGame.headers.Event, selectedGame.headers.Date].filter(Boolean).join(' · ') || 'Партия'}</span>
          </div>
          <div className="app-bar-actions">
            <span className="result-chip">{selectedGame.result}</span>
            <button className="icon-button ghost-button" type="button" aria-label="Перевернуть доску" onClick={flipBoard}>
              <Icon name="flip" />
            </button>
          </div>
        </header>

        <main className="viewer-content">
          {isReplayPartial && (
            <div className="replay-notice" role="status">
              Позиции восстановлены до {maxViewPly}-го полухода из {selectedGame.moves.length}.
            </div>
          )}

          <section className="board-wrap">
            <Board
              position={currentPosition}
              orientation={boardOrientation}
              highlightSquares={highlightedSquares}
            />
          </section>

          <section className="current-move-line" aria-live="polite">
            <span>{safePly === 0 ? 'Начало партии' : `Полуход ${safePly}`}</span>
            <strong>{currentMove}</strong>
          </section>

          <section className="move-controller" aria-label="Навигация по партии">
            <button type="button" aria-label="В начало" onClick={() => setPly(0)} disabled={safePly === 0}><Icon name="first" /></button>
            <button type="button" aria-label="Предыдущий ход" onClick={() => setPly(Math.max(0, safePly - 1))} disabled={safePly === 0}><Icon name="previous" /></button>
            <div>
              <strong>{safePly}</strong>
              <span>из {maxViewPly}</span>
            </div>
            <button type="button" aria-label="Следующий ход" onClick={() => setPly(Math.min(maxViewPly, safePly + 1))} disabled={safePly >= maxViewPly}><Icon name="next" /></button>
            <button type="button" aria-label="В конец" onClick={() => setPly(maxViewPly)} disabled={safePly >= maxViewPly}><Icon name="last" /></button>
          </section>

          <section className="move-strip" aria-label="Ходы партии">
            {selectedGame.moves.slice(0, maxViewPly).map((move, index) => (
              <button
                type="button"
                key={`${move}-${index}`}
                className={safePly === index + 1 ? 'active' : ''}
                onClick={() => setPly(index + 1)}
              >
                <span>{index + 1}</span>{move}
              </button>
            ))}
          </section>

          <button
            type="button"
            className="position-insight"
            onClick={() => setPositionSheetOpen(true)}
            aria-haspopup="dialog"
          >
            <div>
              <span>Эта позиция</span>
              <strong>{currentReport.occurrences.length} {pluralGames(currentReport.occurrences.length)}</strong>
            </div>
            <Icon name="up" size={21} />
          </button>
        </main>

        {positionSheetOpen && (
          <>
            <button className="sheet-backdrop" type="button" aria-label="Закрыть статистику" onClick={() => setPositionSheetOpen(false)} />
            <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label="Статистика текущей позиции">
              <div className="sheet-handle" aria-hidden="true" />
              <div className="sheet-heading">
                <div>
                  <span className="section-kicker">Текущая позиция</span>
                  <h2>{currentReport.occurrences.length} вхождений</h2>
                </div>
                <span className="side-chip">Ход {currentPosition.sideToMove === 'W' ? 'белых' : 'чёрных'}</span>
              </div>
              <ResultStats report={currentReport} />
              <ContinuationList report={currentReport} limit={6} />
              <div className="sheet-actions">
                <button type="button" className="primary-button full-width" onClick={() => analyzePosition(currentPosition)}>Открыть Position Explorer</button>
                <button type="button" className="secondary-button full-width" onClick={() => setPositionSheetOpen(false)}>Закрыть</button>
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  const activeTab: AppTab = view === 'viewer' ? lastTab : view;

  return (
    <div className="mobile-app">
      <main className="screen-content">
        {view === 'games' && (
          <>
            <ScreenHeader title="Партии" subtitle={`${games.length} партий · ${corpus.uniquePositionCount()} позиций`} />
            <section className="screen-section">
              <label className="search-box">
                <Icon name="search" size={21} />
                <input
                  type="search"
                  value={gameQuery}
                  onChange={(event) => setGameQuery(event.target.value)}
                  placeholder="Игрок, турнир, год…"
                  aria-label="Поиск партий"
                />
              </label>
            </section>

            {games.length === 0 ? (
              <EmptyState
                title="Корпус пока пуст"
                text="Импортируй PDN-файл, чтобы открыть партии и искать повторяющиеся позиции."
                action="Импортировать PDN"
                onAction={() => switchTab('import')}
              />
            ) : filteredGames.length === 0 ? (
              <EmptyState title="Ничего не найдено" text="Измени строку поиска." />
            ) : (
              <section className="game-list-mobile">
                {filteredGames.map((game) => (
                  <button type="button" className="game-card" key={game.id} onClick={() => openGame(game)}>
                    <div className="game-card-main">
                      <strong>{game.headers.White ?? '—'} — {game.headers.Black ?? '—'}</strong>
                      <span>{[game.headers.Event, game.headers.Site].filter(Boolean).join(' · ') || 'Без названия'}</span>
                      <small>{game.headers.Date || 'Дата неизвестна'} · {game.moves.length} полуходов</small>
                    </div>
                    <span className="game-card-result">{game.result}</span>
                  </button>
                ))}
              </section>
            )}
          </>
        )}

        {view === 'position' && (
          <>
            <ScreenHeader title="Позиция" subtitle="Поиск по всему корпусу" />
            <section className="position-board-section">
              <Board position={positionSearch} orientation={boardOrientation} />
              <div className="board-toolbar">
                <span className="side-chip">Ход {positionSearch.sideToMove === 'W' ? 'белых' : 'чёрных'}</span>
                <button className="compact-action" type="button" onClick={flipBoard}><Icon name="flip" size={19} /> Перевернуть</button>
              </div>
            </section>

            <details className="mobile-card fen-card">
              <summary>Вставить FEN</summary>
              <label htmlFor="position-fen">FEN позиции</label>
              <textarea
                id="position-fen"
                value={fenInput}
                onChange={(event) => setFenInput(event.target.value)}
                rows={3}
                spellCheck={false}
              />
              {positionError && <p className="inline-error">{positionError}</p>}
              <button type="button" className="primary-button full-width" onClick={applyFen}>Применить FEN</button>
            </details>

            <section className="mobile-card explorer-summary">
              <div className="card-heading-row">
                <div>
                  <span className="section-kicker">Position Explorer</span>
                  <h2>{positionReport.occurrences.length} вхождений</h2>
                </div>
              </div>
              <ResultStats report={positionReport} />
              <ContinuationList report={positionReport} />
            </section>

            {positionReport.occurrences.length > 0 && (
              <section className="mobile-card">
                <h2>Партии с этой позицией</h2>
                <div className="occurrence-list-mobile">
                  {positionReport.occurrences.slice(0, 30).map((occurrence, index) => {
                    const game = games.find((item) => item.id === occurrence.gameId);
                    return (
                      <button
                        type="button"
                        key={`${occurrence.gameId}-${occurrence.ply}-${index}`}
                        disabled={!game}
                        onClick={() => game && openGame(game, occurrence.ply)}
                      >
                        <strong>{occurrence.white} — {occurrence.black}</strong>
                        <span>{occurrence.date} · позиция {occurrence.ply} · {occurrence.result}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {view === 'import' && (
          <>
            <ScreenHeader title="Импорт" subtitle="Добавление партий в локальную библиотеку" />
            <section className="import-hero mobile-card">
              <div className="import-icon" aria-hidden="true"><Icon name="upload" size={28} /></div>
              <h2>Добавить партии</h2>
              <p>Выбери PDN-файл. Исторические варианты записи будут нормализованы ядром, исходный текст при этом сохраняется.</p>
              <label className="primary-button file-picker full-width">
                Выбрать .pdn
                <input type="file" accept=".pdn,.txt,text/plain" onChange={(event) => void loadFile(event.target.files?.[0])} />
              </label>
            </section>

            <section className="mobile-card">
              <h2>Локальная библиотека</h2>
              <div className="metric-grid">
                <div><strong>{games.length}</strong><span>партий</span></div>
                <div><strong>{corpus.uniquePositionCount()}</strong><span>позиций</span></div>
              </div>
              {importMessages.length > 0 && (
                <div className="import-report-mobile">
                  {importMessages.map((message, index) => <p key={`${message}-${index}`}>{message}</p>)}
                </div>
              )}
            </section>

            <details className="mobile-card developer-import">
              <summary>Диагностика и текстовый импорт</summary>
              <textarea value={pdnText} onChange={(event) => setPdnText(event.target.value)} rows={8} spellCheck={false} />
              <div className="stacked-actions">
                <button type="button" className="primary-button" onClick={() => importText(pdnText)}>Импортировать текст</button>
                <button type="button" className="secondary-button" onClick={() => setPdnText(SAMPLE_PDN)}>Вставить учебный пример</button>
              </div>
            </details>
          </>
        )}

        {view === 'tools' && (
          <>
            <ScreenHeader title="Инструменты" subtitle="Расширения аналитического ядра" />
            <section className="tool-grid">
              <ToolCard icon="openings" title="Дебюты" text="Дерево вариантов, частота и результативность." status="Планируется" />
              <ToolCard icon="tactics" title="Комбинации" text="Поиск тактических эпизодов и жертв в реальных партиях." status="Планируется" />
              <ToolCard icon="evaluation" title="Оценка позиции" text="Классическая и нейросетевая оценка без поиска продолжения." status="Планируется" />
              <ToolCard icon="players" title="Игроки" text="Репертуар, статистика, сравнение и подготовка к сопернику." status="Планируется" />
            </section>
          </>
        )}
      </main>

      <BottomNav active={activeTab} onChange={switchTab} />
    </div>
  );
}

interface ScreenHeaderProps {
  title: string;
  subtitle: string;
}

function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <div>
        <span className="app-caption">Русские шашки</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <span className="app-mark" aria-hidden="true">DC</span>
    </header>
  );
}

interface EmptyStateProps {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}

function EmptyState({ title, text, action, onAction }: EmptyStateProps) {
  return (
    <section className="empty-mobile">
      <div className="empty-symbol" aria-hidden="true"><Icon name="position" size={28} /></div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && onAction && <button type="button" className="primary-button" onClick={onAction}>{action}</button>}
    </section>
  );
}

function ResultStats({ report }: { report: ReturnType<CorpusIndex['report']> }) {
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

function ContinuationList({ report, limit }: { report: ReturnType<CorpusIndex['report']>; limit?: number }) {
  const items = typeof limit === 'number' ? report.continuations.slice(0, limit) : report.continuations;
  if (items.length === 0) return <p className="muted-mobile">Нет продолжений из этой позиции.</p>;
  return (
    <div className="continuation-list-mobile">
      <h3>Продолжения</h3>
      {items.map((item) => (
        <div key={item.move}>
          <code>{item.move}</code>
          <span>{item.games} партий</span>
        </div>
      ))}
    </div>
  );
}

interface ToolCardProps {
  icon: IconName;
  title: string;
  text: string;
  status: string;
}

function ToolCard({ icon, title, text, status }: ToolCardProps) {
  return (
    <article className="tool-card mobile-card">
      <div className="tool-icon" aria-hidden="true"><Icon name={icon} size={22} /></div>
      <div className="tool-copy">
        <h2>{title}</h2>
        <p>{text}</p>
        <span>{status}</span>
      </div>
    </article>
  );
}

function pluralGames(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'партия';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'партии';
  return 'партий';
}

export default App;
