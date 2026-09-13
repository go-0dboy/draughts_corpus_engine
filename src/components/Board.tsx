import { rowColToSquare } from '../core/board';
import { pieceAt } from '../core/position';
import type { Piece, Position } from '../core/types';

const SYMBOL: Record<Piece, string> = {
  'white-man': '●',
  'white-king': '♛',
  'black-man': '●',
  'black-king': '♛',
};

interface BoardProps {
  position: Position;
  onSquareClick: (square: number) => void;
}

export function Board({ position, onSquareClick }: BoardProps) {
  return (
    <div className="board" role="grid" aria-label="Шашечная доска">
      {Array.from({ length: 64 }, (_, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;
        const square = rowColToSquare(row, col);
        const piece = square === null ? null : pieceAt(position, square);
        return (
          <button
            type="button"
            role="gridcell"
            className={`cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`}
            key={`${row}-${col}`}
            disabled={square === null}
            aria-label={square === null ? 'Светлое поле' : `Поле ${square}${piece ? `, ${piece}` : ''}`}
            onClick={() => square !== null && onSquareClick(square)}
          >
            {piece && <span className={`piece ${piece}`}>{SYMBOL[piece]}</span>}
            {square !== null && <span className="square-number">{square}</span>}
          </button>
        );
      })}
    </div>
  );
}

