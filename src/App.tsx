import { useMemo, useState } from 'react';
import { Board } from './components/Board';
import { parseFen, toFen } from './core/fen';
import {
  countPieces,
  EMPTY_POSITION,
  INITIAL_POSITION,
  packPosition,
  pieceAt,
  positionKey,
  setPiece,
  toHex64,
} from './core/position';
import type { Piece, Position } from './core/types';

const PIECE_CYCLE: Array<Piece | null> = [null, 'white-man', 'white-king', 'black-man', 'black-king'];

function App() {
  const [position, setPosition] = useState<Position>(INITIAL_POSITION);
  const [fenInput, setFenInput] = useState(toFen(INITIAL_POSITION));
  const [error, setError] = useState('');
  const packed = useMemo(() => packPosition(position), [position]);
  const counts = useMemo(() => countPieces(position), [position]);

  const updatePosition = (next: Position) => {
    setPosition(next);
    setFenInput(toFen(next));
    setError('');
  };

  const cycleSquare = (square: number) => {
    const current = pieceAt(position, square);
    const next = PIECE_CYCLE[(PIECE_CYCLE.indexOf(current) + 1) % PIECE_CYCLE.length];
    updatePosition(setPiece(position, square, next));
  };

  const applyFen = () => {
    try {
      updatePosition(parseFen(fenInput));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось прочитать FEN.');
    }
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">Русские шашки · лаборатория корпуса</span>
          <h1>Draughts Corpus Engine</h1>
          <p>Первая рабочая опора будущей базы: каноническая позиция, FEN и интерактивная доска.</p>
        </div>
        <span className="version">v0.1 core</span>
      </header>

      <section className="workspace">
        <div className="board-panel">
          <Board position={position} onSquareClick={cycleSquare} />
          <p className="hint">Нажимайте на тёмное поле: пусто → белая → белая дамка → чёрная → чёрная дамка.</p>
        </div>

        <aside className="control-panel">
          <section className="card">
            <div className="section-title">
              <h2>Позиция</h2>
              <div className="turn-switch" aria-label="Очередь хода">
                <button className={position.sideToMove === 'W' ? 'active' : ''} onClick={() => updatePosition({ ...position, sideToMove: 'W' })}>Белые</button>
                <button className={position.sideToMove === 'B' ? 'active' : ''} onClick={() => updatePosition({ ...position, sideToMove: 'B' })}>Чёрные</button>
              </div>
            </div>
            <label htmlFor="fen">PDN FEN</label>
            <textarea id="fen" value={fenInput} onChange={(event) => setFenInput(event.target.value)} rows={3} spellCheck={false} />
            {error && <p className="error" role="alert">{error}</p>}
            <div className="actions">
              <button className="primary" onClick={applyFen}>Применить FEN</button>
              <button onClick={() => updatePosition(INITIAL_POSITION)}>Начальная</button>
              <button onClick={() => updatePosition(EMPTY_POSITION)}>Очистить</button>
            </div>
          </section>

          <section className="card metrics">
            <h2>Представление в ядре</h2>
            <div className="metric-row"><span>Белых</span><strong>{counts.white}</strong></div>
            <div className="metric-row"><span>Чёрных</span><strong>{counts.black}</strong></div>
            <div className="metric-row"><span>Дамок</span><strong>{counts.kings}</strong></div>
            <label>White 64-bit</label>
            <code>0x{toHex64(packed.white)}</code>
            <label>Black 64-bit</label>
            <code>0x{toHex64(packed.black)}</code>
            <label>Ключ позиции</label>
            <code className="key">{positionKey(position)}</code>
          </section>

          <section className="card roadmap-card">
            <span className="status-dot" />
            <div>
              <h2>Следующий модуль</h2>
              <p>Генератор обязательных взятий и легальных ходов по правилам русских шашек.</p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default App;

