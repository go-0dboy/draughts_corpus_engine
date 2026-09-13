export type Side = 'W' | 'B';

export interface Position {
  whiteMen: number;
  whiteKings: number;
  blackMen: number;
  blackKings: number;
  sideToMove: Side;
}

export type Piece = 'white-man' | 'white-king' | 'black-man' | 'black-king';

export interface PackedPosition {
  white: bigint;
  black: bigint;
}

