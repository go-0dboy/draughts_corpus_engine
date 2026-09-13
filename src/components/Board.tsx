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

const FILES = 'abcdefgh';

export function Board({
  position,
  orientation = 'white',
  highlightSquares = [],
  onSquareClick,
  showCoordinates = true,
}: BoardProps) {
  const highlights = new Set(highlightSquares);

  return (
    <div
      className={`board board-${orientation}`}
      role="grid"
      aria-label={`Шашечная доска, ${orientation === 'white' ? 'белые снизу' : 'чёрные снизу'}`}
    >
      {Array.from({ length: 64 }, (_, visualIndex) => {
        const visualRow = Math.floor(visualIndex / 8);
        const visualCol = visualIndex % 8;
        const row = orientation === 'white' ? visualRow : 7 - visualRow;
        const col = orientation === 'white' ? visualCol : 7 - visualCol;
        const square = rowColToSquare(row, col);
        const piece = square === null ? null : pieceAt(position, square);
        const algebraic = square === null ? `${FILES[col]}${8 - row}` : squareToAlgebraic(square);
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
            aria-label={`${algebraic}${piece ? `, ${pieceLabel(piece)}` : ', пусто'}`}
            onClick={() => square !== null && onSquareClick?.(square)}
          >
            {piece && (
              <span
                className={`piece ${piece} ${piece.endsWith('king') ? 'king' : 'man'}`}
                aria-hidden="true"
              />
            )}
            {showCoordinates && visualRow === 7 && (
              <span className="board-coordinate coordinate-file" aria-hidden="true">{FILES[col]}</span>
            )}
            {showCoordinates && visualCol === 0 && (
              <span className="board-coordinate coordinate-rank" aria-hidden="true">{8 - row}</span>
            )}
          </button>
        );
      })}
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
