import { useState } from 'react';
import { squareToRowCol } from '../core/board';
import { EMPTY_POSITION, INITIAL_POSITION, setPiece } from '../core/position';
import type { Piece, Position } from '../core/types';
import { Board, type BoardOrientation } from './Board';
import { Icon } from './Icon';

export type PositionTool = Piece | 'erase';

interface PositionEditorProps {
  position: Position;
  orientation: BoardOrientation;
  onChange: (position: Position) => void;
  onFlip: () => void;
}

const TOOLS: Array<{ id: PositionTool; label: string }> = [
  { id: 'white-man', label: 'Белая шашка' },
  { id: 'white-king', label: 'Белая дамка' },
  { id: 'black-man', label: 'Чёрная шашка' },
  { id: 'black-king', label: 'Чёрная дамка' },
  { id: 'erase', label: 'Удалить' },
];

export function PositionEditor({ position, orientation, onChange, onFlip }: PositionEditorProps) {
  const [tool, setTool] = useState<PositionTool>('white-man');

  const place = (square: number) => {
    if (tool === 'erase') {
      onChange(setPiece(position, square, null));
      return;
    }

    const { row } = squareToRowCol(square);
    let piece: Piece = tool;
    // Same behaviour as the user's existing analyzer: a man placed directly on
    // the promotion rank becomes a king immediately.
    if (piece === 'white-man' && row === 0) piece = 'white-king';
    if (piece === 'black-man' && row === 7) piece = 'black-king';
    onChange(setPiece(position, square, piece));
  };

  const setTurn = (sideToMove: Position['sideToMove']) => {
    onChange({ ...position, sideToMove });
  };

  return (
    <section className="position-editor" aria-label="Расстановка позиции">
      <Board position={position} orientation={orientation} onSquareClick={place} />

      <div className="position-editor-palette" role="toolbar" aria-label="Фигуры для расстановки">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tool === item.id ? 'selected' : ''}
            onClick={() => setTool(item.id)}
            aria-pressed={tool === item.id}
            aria-label={item.label}
            title={item.label}
          >
            {item.id === 'erase' ? (
              <span className="setup-eraser" aria-hidden="true">×</span>
            ) : (
              <span className={`setup-piece ${item.id} ${item.id.endsWith('king') ? 'king' : 'man'}`} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <div className="position-editor-controls">
        <div className="turn-segment" role="group" aria-label="Сторона хода">
          <button type="button" className={position.sideToMove === 'W' ? 'selected' : ''} onClick={() => setTurn('W')}>Ход белых</button>
          <button type="button" className={position.sideToMove === 'B' ? 'selected' : ''} onClick={() => setTurn('B')}>Ход чёрных</button>
        </div>

        <div className="position-editor-actions">
          <button type="button" onClick={() => onChange({ ...INITIAL_POSITION })}>Начальная</button>
          <button type="button" onClick={() => onChange({ ...EMPTY_POSITION, sideToMove: position.sideToMove })}>Очистить</button>
          <button type="button" onClick={onFlip}><Icon name="flip" size={18} /> Перевернуть</button>
        </div>
      </div>
    </section>
  );
}
