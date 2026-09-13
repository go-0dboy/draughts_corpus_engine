import { rowColToSquare, squareToAlgebraic } from '../core/board';
import { pieceAt } from '../core/position';
import type { Position } from '../core/types';

export type BoardOrientation = 'white' | 'black';

interface BoardProps {
  position: Position;
  orientation?: BoardOrientation;
  highlightSquares?: number[];
  onSquareClick?: (square: number) => void;
  showCoordinates?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS_WHITE = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function Board({
  position,
  orientation = 'white',
  highlightSquares = [],
  onSquareClick,
  showCoordinates = true,
}: BoardProps) {
  const highlights = new Set(highlightSquares);
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? RANKS_WHITE : [...RANKS_WHITE].reverse();

  return (
    <div
      className={`board-frame board-${orientation}`}
      aria-label={`Шашечная доска, ${orientation === 'white' ? 'белые снизу' : 'чёрные снизу'}`}
    >
      {showCoordinates && <FileCoordinates className="board-coords-top" values={files} />}
      {showCoordinates && <RankCoordinates className="board-coords-left" values={ranks} />}

      <div className="board" role="grid">
        {Array.from({ length: 64 }, (_, visualIndex) => {
          const visualRow = Math.floor(visualIndex / 8);
          const visualCol = visualIndex % 8;
          const row = orientation === 'white' ? visualRow : 7 - visualRow;
          const col = orientation === 'white' ? visualCol : 7 - visualCol;
          const square = rowColToSquare(row, col);
          const piece = square === null ? null : pieceAt(position, square);
          const algebraic = `${FILES[col]}${8 - row}`;
          const isDark = (row + col) % 2 === 1;
          const isHighlighted = square !== null && highlights.has(square);
          const interactive = square !== null && Boolean(onSquareClick);

          return (
            <button
              type="button"
              role="gridcell"
              className={`cell ${isDark ? 'dark' : 'light'}${isHighlighted ? ' highlighted' : ''}`}
              key={`${row}-${col}`}
              disabled={!interactive}
              tabIndex={interactive ? 0 : -1}
              aria-label={`${square === null ? algebraic : squareToAlgebraic(square)}${piece ? `, ${pieceLabel(piece)}` : ', пусто'}`}
              onClick={() => square !== null && onSquareClick?.(square)}
            >
              {piece && (
                <span
                  className={`piece ${piece} ${piece.endsWith('king') ? 'king' : 'man'}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {showCoordinates && <RankCoordinates className="board-coords-right" values={ranks} />}
      {showCoordinates && <FileCoordinates className="board-coords-bottom" values={files} />}
    </div>
  );
}

function FileCoordinates({ className, values }: { className: string; values: string[] }) {
  return (
    <div className={`board-coords board-coords-files ${className}`} aria-hidden="true">
      {values.map((value) => <span key={value}>{value}</span>)}
    </div>
  );
}

function RankCoordinates({ className, values }: { className: string; values: string[] }) {
  return (
    <div className={`board-coords board-coords-ranks ${className}`} aria-hidden="true">
      {values.map((value) => <span key={value}>{value}</span>)}
    </div>
  );
}

function pieceLabel(piece: 'white-man' | 'white-king' | 'black-man' | 'black-king'): string {
  switch (piece) {
    case 'white-man': return 'белая шашка';
    case 'white-king': return 'белая дамка';
    case 'black-man': return 'чёрная шашка';
    case 'black-king': return 'чёрная дамка';
  }
}
