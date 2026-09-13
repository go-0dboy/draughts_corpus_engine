import { useEffect, useMemo, useState } from 'react';
import { loadPreferences, watchSystemAppearance } from './application/preferences';
import { Board, type BoardOrientation } from './components/Board';
import { BottomNav, type AppTab } from './components/BottomNav';
import { Icon, type IconName } from './components/Icon';
import { SettingsSheet } from './components/SettingsSheet';
import { CorpusIndex, type PositionReport } from './corpus';
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

export default function MobileApp() {
  const [view, setView] = useState<View>('games');
  const [lastTab, setLastTab] = useState<AppTab>('games');
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  useEffect(() => watchSystemAppearance(), []);
  useEffect(() => { loadPreferences(); }, []);

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
    return games.filter((game) => [
      game.headers.White,
      game.headers.Black,
      game.headers.Event,
      game.headers.Site,
      game.headers.Date,
      game.result,
    ].filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(query));
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
        return [...previous, ...result.games.filter((game) => !existingSources.has(game.source))];
      });
    }
    const partial = result.games.filter((game) => game.replay.status !== 'complete').length;
    setImportMessages([
      `Найдено партий: ${result.games.length}`,
      `Полностью воспроизведено: ${result.games.length - partial}`,
      `Требуют разбора: ${partial}`,
      `Ошибок чтения: ${result.errors.length}`,
      ...result.errors.slice(0, 6),
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

  const flipBoard = () => setBoardOrientation((value) => value === 'white' ? 'black' : 'white');

  if (view === 'viewer' && selectedGame && currentPosition && currentReport) {
    const currentMove = safePly > 0 ? selectedGame.moves[safePly - 1] : 'Стартовая позиция';
    return (
      <div className="mobile-app compact-shell viewer-screen">
        <header className="compact-game-bar">
          <button className="compact-icon-button" type="button" aria-label="Назад" onClick={() => setView(lastTab)}>
            <Icon name="back" size={23} />
          </button>
          <div className="game-identity">
            <strong>{selectedGame.headers.White ?? '—'} — {selectedGame.headers.Black ?? '—'}</strong>
            <span>{[selectedGame.headers.Event, selectedGame.headers.Date].filter(Boolean).join(' · ') || 'Партия'}</span>
          </div>
          <span className="compact-result">{selectedGame.result}</span>
          <button className="compact-icon-button" type="button" aria-label="Перевернуть доску" onClick={flipBoard}>
            <Icon name="flip" size={21} />
          </button>
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </header>

        <main className="board-first-content">
          {selectedGame.replay.status === 'partial' && (
            <div className="replay-notice compact-notice" role="status">
              Восстановлено {maxViewPly} из {selectedGame.moves.length} полуходов.
            </div>
          )}

          <Board position={currentPosition} orientation={boardOrientation} highlightSquares={highlightedSquares} />

          <div className="move-now" aria-live="polite">
            <span>{safePly === 0 ? 'Начало' : `${safePly}/${maxViewPly}`}</span>
            <strong>{currentMove}</strong>
          </div>

          <div className="replay-controls" aria-label="Навигация по партии">
            <button type="button" aria-label="В начало" onClick={() => setPly(0)} disabled={safePly === 0}><Icon name="first" /></button>
            <button type="button" aria-label="Назад" onClick={() => setPly(Math.max(0, safePly - 1))} disabled={safePly === 0}><Icon name="previous" /></button>
            <button className="replay-position-button" type="button" onClick={() => setPositionSheetOpen(true)}>
              <span>{currentReport.occurrences.length}</span>
              <small>в базе</small>
            </button>
            <button type="button" aria-label="Вперёд" onClick={() => setPly(Math.min(maxViewPly, safePly + 1))} disabled={safePly >= maxViewPly}><Icon name="next" /></button>
            <button type="button" aria-label="В конец" onClick={() => setPly(maxViewPly)} disabled={safePly >= maxViewPly}><Icon name="last" /></button>
          </div>

          <div className="move-strip compact-move-strip" aria-label="Ходы партии">
            {selectedGame.moves.slice(0, maxViewPly).map((move, index) => (
              <button key={`${move}-${index}`} type="button" className={safePly === index + 1 ? 'active' : ''} onClick={() => setPly(index + 1)}>
                <span>{index + 1}</span>{move}
              </button>
            ))}
          </div>
        </main>

        {positionSheetOpen && (
          <PositionSheet
            report={currentReport}
            position={currentPosition}
            onClose={() => setPositionSheetOpen(false)}
            onExplore={() => analyzePosition(currentPosition)}
          />
        )}
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    );
  }

  const activeTab = view as AppTab;
  return (
    <div className="mobile-app compact-shell">
      <main className="compact-screen-content">
        {view === 'games' && (
          <>
            <CompactActionBar
              meta={`${games.length} партий · ${corpus.uniquePositionCount()} позиций`}
              onSettings={() => setSettingsOpen(true)}
            />
            <section className="compact-primary-section">
              <label className="search-box compact-search">
                <Icon name="search" size={20} />
                <input type="search" value={gameQuery} onChange={(event) => setGameQuery(event.target.value)} placeholder="Игрок, турнир, год…" aria-label="Поиск партий" />
              </label>
            </section>
            {games.length === 0 ? (
              <EmptyState title="Корпус пока пуст" text="Добавь PDN-файл. После импорта здесь появятся партии, позиции и статистика." action="Выбрать PDN" onAction={() => switchTab('import')} />
            ) : filteredGames.length === 0 ? (
              <EmptyState title="Ничего не найдено" text="Измени условия поиска." />
            ) : (
              <section className="game-list-mobile compact-game-list">
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
            <CompactActionBar meta={`${positionReport.occurrences.length} вхождений`} onSettings={() => setSettingsOpen(true)} />
            <section className="compact-board-section">
              <Board position={positionSearch} orientation={boardOrientation} />
              <div className="compact-board-actions">
                <span>Ход {positionSearch.sideToMove === 'W' ? 'белых' : 'чёрных'}</span>
                <button type="button" onClick={flipBoard}><Icon name="flip" size={18} /> Перевернуть</button>
              </div>
            </section>
            <section className="position-actions-row">
              <details className="compact-details">
                <summary>FEN</summary>
                <textarea value={fenInput} onChange={(event) => setFenInput(event.target.value)} rows={3} spellCheck={false} />
                {positionError && <p className="inline-error">{positionError}</p>}
                <button type="button" className="primary-button full-width" onClick={applyFen}>Применить</button>
              </details>
            </section>
            <section className="compact-stats-section">
              <ResultStats report={positionReport} />
              <ContinuationList report={positionReport} />
            </section>
            {positionReport.occurrences.length > 0 && (
              <section className="occurrence-list-mobile compact-occurrences">
                {positionReport.occurrences.slice(0, 30).map((occurrence, index) => {
                  const game = games.find((item) => item.id === occurrence.gameId);
                  return (
                    <button type="button" key={`${occurrence.gameId}-${occurrence.ply}-${index}`} disabled={!game} onClick={() => game && openGame(game, occurrence.ply)}>
                      <strong>{occurrence.white} — {occurrence.black}</strong>
                      <span>{occurrence.date} · позиция {occurrence.ply} · {occurrence.result}</span>
                    </button>
                  );
                })}
              </section>
            )}
          </>
        )}

        {view === 'import' && (
          <>
            <CompactActionBar meta="Локальная библиотека" onSettings={() => setSettingsOpen(true)} />
            <section className="import-hero compact-import-panel">
              <div className="import-icon"><Icon name="upload" size={29} /></div>
              <h2>Добавить партии</h2>
              <p>Выбери PDN русских шашек. Импортёр принимает исторические варианты записи, но статистика строится только по достоверно воспроизведённым партиям.</p>
              <label className="primary-button file-picker">
                Выбрать .pdn
                <input type="file" accept=".pdn,.txt,text/plain" onChange={(event) => void loadFile(event.target.files?.[0])} />
              </label>
            </section>
            {importMessages.length > 0 && (
              <section className="compact-report">
                {importMessages.map((message, index) => <p key={`${message}-${index}`}>{message}</p>)}
              </section>
            )}
            <details className="developer-import compact-details standalone-details">
              <summary>Текстовый импорт для диагностики</summary>
              <textarea value={pdnText} onChange={(event) => setPdnText(event.target.value)} rows={9} spellCheck={false} />
              <button type="button" className="secondary-button full-width" onClick={() => importText(pdnText)}>Импортировать текст</button>
            </details>
          </>
        )}

        {view === 'tools' && (
          <>
            <CompactActionBar meta="Расширения ядра" onSettings={() => setSettingsOpen(true)} />
            <section className="tool-list-modern">
              <ToolRow icon="openings" title="Дебюты" text="Дерево продолжений и исторические изменения." status="план" />
              <ToolRow icon="tactics" title="Комбинации" text="Поиск тактических переломов и жертв." status="план" />
              <ToolRow icon="evaluation" title="Оценка позиции" text="Value-модель без поиска лучшего хода." status="план" />
              <ToolRow icon="players" title="Игроки" text="Репертуар, статистика и сравнение игроков." status="план" />
            </section>
          </>
        )}
      </main>

      <BottomNav active={activeTab} onChange={switchTab} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function CompactActionBar({ meta, onSettings }: { meta: string; onSettings: () => void }) {
  return (
    <header className="compact-action-bar">
      <span>{meta}</span>
      <SettingsButton onClick={onSettings} />
    </header>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="compact-icon-button settings-button" type="button" aria-label="Настройки" onClick={onClick}>
      <Icon name="settings" size={21} />
    </button>
  );
}

function PositionSheet({ report, position, onClose, onExplore }: { report: PositionReport; position: Position; onClose: () => void; onExplore: () => void }) {
  return (
    <>
      <button className="sheet-backdrop" type="button" aria-label="Закрыть статистику" onClick={onClose} />
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label="Статистика текущей позиции">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-heading">
          <div><span className="section-kicker">Позиция</span><h2>{report.occurrences.length} вхождений</h2></div>
          <span className="side-chip">Ход {position.sideToMove === 'W' ? 'белых' : 'чёрных'}</span>
        </div>
        <ResultStats report={report} />
        <ContinuationList report={report} limit={6} />
        <div className="sheet-actions"><button type="button" className="primary-button full-width" onClick={onExplore}>Открыть поиск по позиции</button></div>
      </section>
    </>
  );
}

function ResultStats({ report }: { report: PositionReport }) {
  const total = report.whiteWins + report.draws + report.blackWins;
  const percent = (value: number) => total === 0 ? '—' : `${Math.round(value * 100 / total)}%`;
  return (
    <div className="result-stats">
      <div><strong>{percent(report.whiteWins)}</strong><span>Белые</span></div>
      <div><strong>{percent(report.draws)}</strong><span>Ничья</span></div>
      <div><strong>{percent(report.blackWins)}</strong><span>Чёрные</span></div>
    </div>
  );
}

function ContinuationList({ report, limit = 10 }: { report: PositionReport; limit?: number }) {
  if (report.continuations.length === 0) return <p className="muted-mobile">Продолжений пока нет.</p>;
  return (
    <div className="continuation-list-mobile">
      <h3>Продолжения</h3>
      {report.continuations.slice(0, limit).map((item) => (
        <div key={item.move}><code>{item.move}</code><span>{item.games} {pluralGames(item.games)}</span></div>
      ))}
    </div>
  );
}

function ToolRow({ icon, title, text, status }: { icon: IconName; title: string; text: string; status: string }) {
  return (
    <article className="tool-row-modern">
      <div className="tool-icon"><Icon name={icon} size={22} /></div>
      <div><strong>{title}</strong><p>{text}</p></div>
      <span>{status}</span>
    </article>
  );
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <section className="empty-mobile compact-empty">
      <div className="empty-symbol"><Icon name="games" size={28} /></div>
      <h2>{title}</h2><p>{text}</p>
      {action && onAction && <button type="button" className="primary-button" onClick={onAction}>{action}</button>}
    </section>
  );
}

function pluralGames(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'партия';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'партии';
  return 'партий';
}
