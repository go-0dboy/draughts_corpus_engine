import { useMemo, useState } from 'react';
import { Board } from './components/Board';
import { CorpusIndex } from './corpus';
import { parsePdn, type PdnGame } from './corpus/pdn';
import { toFen } from './core/fen';

const SAMPLE_PDN = `[Event "Учебная партия"]
[Site "Draughts Corpus Engine"]
[Date "2026.09.13"]
[Round "1"]
[White "Белые"]
[Black "Чёрные"]
[Result "*"]
[GameType "25,W,8,8,A0,0"]

1. c3-d4 f6-e5 2. d4:f6 g7:e5 *`;

function App() {
  const [pdnText, setPdnText] = useState(SAMPLE_PDN);
  const [games, setGames] = useState<PdnGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);

  const corpus = useMemo(() => new CorpusIndex(games), [games]);
  const selectedGame = games.find((game) => game.id === selectedGameId) ?? games[0] ?? null;
  const safePly = selectedGame ? Math.min(ply, selectedGame.positions.length - 1) : 0;
  const position = selectedGame?.positions[safePly] ?? null;
  const report = position ? corpus.report(position) : null;

  const importText = (text: string) => {
    const result = parsePdn(text);
    setGames(result.games);
    setSelectedGameId(result.games[0]?.id ?? null);
    setPly(0);
    setMessages([
      `Импортировано партий: ${result.games.length}`,
      `Ошибок: ${result.errors.length}`,
      ...result.errors.slice(0, 5),
    ]);
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setPdnText(text);
    importText(text);
  };

  const selectGame = (game: PdnGame) => {
    setSelectedGameId(game.id);
    setPly(0);
  };

  return (
    <main className="app-shell corpus-app">
      <header className="hero">
        <div>
          <span className="eyebrow">Русские шашки · корпус партий</span>
          <h1>Draughts Corpus Engine</h1>
          <p>Импорт PDN, просмотр партий и поиск повторяющихся позиций. Пользовательская нотация — только буквенная.</p>
        </div>
        <span className="version">v0.2 corpus</span>
      </header>

      <section className="import-card card">
        <div className="section-title">
          <div>
            <h2>Импорт PDN</h2>
            <p className="muted">Основная линия читается в русской алгебраической нотации: c3-d4, d4:f6.</p>
          </div>
          <label className="file-button">
            Открыть .pdn
            <input type="file" accept=".pdn,.txt,text/plain" onChange={(event) => void loadFile(event.target.files?.[0])} />
          </label>
        </div>
        <textarea value={pdnText} onChange={(event) => setPdnText(event.target.value)} rows={8} spellCheck={false} />
        <div className="actions">
          <button className="primary" onClick={() => importText(pdnText)}>Импортировать в корпус</button>
          <button onClick={() => { setPdnText(SAMPLE_PDN); setMessages([]); }}>Учебный пример</button>
        </div>
        {messages.length > 0 && <div className="import-report">{messages.map((message, index) => <div key={`${message}-${index}`}>{message}</div>)}</div>}
      </section>

      <section className="corpus-summary">
        <div className="summary-tile"><strong>{games.length}</strong><span>партий</span></div>
        <div className="summary-tile"><strong>{corpus.uniquePositionCount()}</strong><span>уникальных позиций</span></div>
        <div className="summary-tile"><strong>{games.reduce((sum, game) => sum + game.moves.length, 0)}</strong><span>полуходов</span></div>
      </section>

      {games.length === 0 ? (
        <section className="empty-state card">
          <h2>Корпус пока пуст</h2>
          <p>Нажми «Импортировать в корпус» для загрузки примера или выбери свой PDN-файл.</p>
        </section>
      ) : (
        <section className="corpus-layout">
          <aside className="game-list card">
            <h2>Партии</h2>
            {games.map((game) => (
              <button key={game.id} className={game.id === selectedGame?.id ? 'game-row active' : 'game-row'} onClick={() => selectGame(game)}>
                <strong>{game.headers.White ?? '—'} — {game.headers.Black ?? '—'}</strong>
                <span>{game.headers.Date ?? '—'} · {game.result}</span>
              </button>
            ))}
          </aside>

          {selectedGame && position && report && (
            <div className="viewer-column">
              <section className="viewer card">
                <div className="game-heading">
                  <div>
                    <span className="eyebrow">{selectedGame.headers.Event ?? 'Партия'}</span>
                    <h2>{selectedGame.headers.White ?? '—'} — {selectedGame.headers.Black ?? '—'}</h2>
                  </div>
                  <strong>{selectedGame.result}</strong>
                </div>

                <div className="viewer-grid">
                  <Board position={position} />
                  <div className="moves-panel">
                    <div className="ply-controls">
                      <button onClick={() => setPly(0)} disabled={safePly === 0}>⏮</button>
                      <button onClick={() => setPly(Math.max(0, safePly - 1))} disabled={safePly === 0}>◀</button>
                      <span>Позиция {safePly}/{selectedGame.moves.length}</span>
                      <button onClick={() => setPly(Math.min(selectedGame.moves.length, safePly + 1))} disabled={safePly >= selectedGame.moves.length}>▶</button>
                      <button onClick={() => setPly(selectedGame.moves.length)} disabled={safePly >= selectedGame.moves.length}>⏭</button>
                    </div>
                    <div className="move-list">
                      {selectedGame.moves.map((move, index) => (
                        <button key={`${move}-${index}`} className={safePly === index + 1 ? 'active' : ''} onClick={() => setPly(index + 1)}>
                          <span>{index + 1}</span>{move}
                        </button>
                      ))}
                    </div>
                    <label>FEN текущей позиции</label>
                    <code>{toFen(position, 'algebraic')}</code>
                  </div>
                </div>
              </section>

              <section className="position-explorer card">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">Position Explorer</span>
                    <h2>Эта позиция в корпусе</h2>
                  </div>
                  <strong className="occurrence-count">{report.occurrences.length}×</strong>
                </div>
                <div className="result-strip">
                  <span>Белые <strong>{report.whiteWins}</strong></span>
                  <span>Ничьи <strong>{report.draws}</strong></span>
                  <span>Чёрные <strong>{report.blackWins}</strong></span>
                </div>

                <h3>Продолжения</h3>
                {report.continuations.length === 0 ? <p className="muted">В корпусе нет следующего хода из этой позиции.</p> : (
                  <div className="continuations">
                    {report.continuations.map((item) => (
                      <div className="continuation-row" key={item.move}>
                        <code>{item.move}</code>
                        <span>{item.games} партий</span>
                        <span>{item.whiteWins} / {item.draws} / {item.blackWins}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3>Где встречалась</h3>
                <div className="occurrences">
                  {report.occurrences.slice(0, 20).map((item, index) => (
                    <button key={`${item.gameId}-${item.ply}-${index}`} onClick={() => { setSelectedGameId(item.gameId); setPly(item.ply); }}>
                      <strong>{item.white} — {item.black}</strong>
                      <span>{item.date} · позиция {item.ply} · {item.result}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
