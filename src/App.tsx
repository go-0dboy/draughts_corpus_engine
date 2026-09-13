import { useMemo, useState } from 'react';
import { Board } from './components/Board';
import { BottomNav, type AppTab } from './components/BottomNav';
import { CorpusIndex } from './corpus';
import { parsePdn, type PdnGame } from './corpus/pdn';
import { parseFen, toFen } from './core/fen';
import { INITIAL_POSITION } from './core/position';
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

  const corpus = useMemo(() => new CorpusIndex(games), [games]);
  const selectedGame = games.find((game) => game.id === selectedGameId) ?? null;
  const safePly = selectedGame ? Math.min(ply, selectedGame.positions.length - 1) : 0;
  const currentPosition = selectedGame?.positions[safePly] ?? null;
  const currentReport = currentPosition ? corpus.report(currentPosition) : null;
  const positionReport = corpus.report(positionSearch);

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
    setLastTab(tab);
    setView(tab);
  };

  const openGame = (game: PdnGame, targetPly = 0) => {
    setSelectedGameId(game.id);
    setPly(Math.max(0, Math.min(targetPly, game.moves.length)));
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
    switchTab('position');
  };

  if (view === 'viewer' && selectedGame && currentPosition && currentReport) {
    return (
      <div className="mobile-app viewer-screen">
        <header className="app-bar viewer-bar">
          <button className="icon-button" type="button" aria-label="Назад" onClick={() => setView(lastTab)}>‹</button>
          <div className="app-bar-title">
            <strong>{selectedGame.headers.White ?? '—'} — {selectedGame.headers.Black ?? '—'}</strong>
            <span>{[selectedGame.headers.Event, selectedGame.headers.Date].filter(Boolean).join(' · ') || 'Партия'}</span>
          </div>
          <span className="game-result">{selectedGame.result}</span>
        </header>

        <main className="viewer-content">
          <section className="board-wrap">
            <Board position={currentPosition} />
          </section>

          <section className="move-controller" aria-label="Навигация по партии">
            <button type="button" onClick={() => setPly(0)} disabled={safePly === 0}>|‹</button>
            <button type="button" onClick={() => setPly(Math.max(0, safePly - 1))} disabled={safePly === 0}>‹</button>
            <div>
              <strong>{safePly}</strong>
              <span>из {selectedGame.moves.length}</span>
            </div>
            <button type="button" onClick={() => setPly(Math.min(selectedGame.moves.length, safePly + 1))} disabled={safePly >= selectedGame.moves.length}>›</button>
            <button type="button" onClick={() => setPly(selectedGame.moves.length)} disabled={safePly >= selectedGame.moves.length}>›|</button>
          </section>

          <section className="move-strip" aria-label="Ходы партии">
            {selectedGame.moves.map((move, index) => (
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

          <section className="mobile-card position-summary-card">
            <div className="card-heading-row">
              <div>
                <span className="section-kicker">Текущая позиция</span>
                <h2>Встречалась {currentReport.occurrences.length} раз</h2>
              </div>
              <button type="button" className="text-button" onClick={() => analyzePosition(currentPosition)}>Подробнее</button>
            </div>
            <ResultStats report={currentReport} />
            <ContinuationList report={currentReport} limit={4} />
          </section>
        </main>
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
                <span aria-hidden="true">⌕</span>
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
                      <small>{game.headers.Date ?? 'Дата неизвестна'} · {game.moves.length} полуходов</small>
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
              <Board position={positionSearch} />
            </section>
            <section className="mobile-card fen-card">
              <label htmlFor="position-fen">FEN позиции</label>
              <textarea
                id="position-fen"
                value={fenInput}
                onChange={(event) => setFenInput(event.target.value)}
                rows={3}
                spellCheck={false}
              />
              {positionError && <p className="inline-error">{positionError}</p>}
              <button type="button" className="primary-button full-width" onClick={applyFen}>Найти в корпусе</button>
            </section>
            <section className="mobile-card">
              <div className="card-heading-row">
                <div>
                  <span className="section-kicker">Результат поиска</span>
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
            <ScreenHeader title="Импорт" subtitle="Добавление партий в локальный корпус" />
            <section className="import-hero mobile-card">
              <div className="import-icon" aria-hidden="true">⇩</div>
              <h2>Открыть PDN-файл</h2>
              <p>Выбери файл с партиями в русские шашки. Основная пользовательская нотация — буквенная.</p>
              <label className="primary-button file-picker full-width">
                Выбрать .pdn
                <input type="file" accept=".pdn,.txt,text/plain" onChange={(event) => void loadFile(event.target.files?.[0])} />
              </label>
            </section>

            <section className="mobile-card">
              <h2>Состояние корпуса</h2>
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
              <summary>Текстовый импорт / диагностика</summary>
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
            <ScreenHeader title="Инструменты" subtitle="Аналитика корпуса" />
            <section className="tool-grid">
              <ToolCard icon="⌘" title="Дебюты" text="Дерево вариантов, частота и результативность." status="Планируется" />
              <ToolCard icon="✦" title="Комбинации" text="Поиск тактических эпизодов и жертв в реальных партиях." status="Планируется" />
              <ToolCard icon="≈" title="Оценка позиции" text="Классическая и нейросетевая оценка без поиска продолжения." status="Планируется" />
              <ToolCard icon="◎" title="Игроки" text="Репертуар, статистика, сравнение и подготовка к сопернику." status="Планируется" />
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
      <span className="app-mark">DC</span>
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
      <div className="empty-symbol" aria-hidden="true">◈</div>
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
  icon: string;
  title: string;
  text: string;
  status: string;
}

function ToolCard({ icon, title, text, status }: ToolCardProps) {
  return (
    <article className="tool-card mobile-card">
      <div className="tool-icon" aria-hidden="true">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <span>{status}</span>
    </article>
  );
}

export default App;
