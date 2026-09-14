/** 0 up, 1 right, 2 down, 3 left — clockwise, so turning is arithmetic. */
export type Dir = 0 | 1 | 2 | 3;

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export type PieceKind = 'mirror' | 'splitter' | 'block';

/** Tray slots appear in this order, so slot numbers stay stable between levels. */
export const PIECE_KINDS: readonly PieceKind[] = ['mirror', 'splitter', 'block'];

/** 0 is `/`, 1 is `\`. Blocks ignore it. */
export type Turn = 0 | 1;

export interface Piece {
  kind: PieceKind;
  turn: Turn;
  /** Part of the level: can be turned, never moved or deleted. */
  fixed: boolean;
}

export type Tile =
  | { kind: 'floor' }
  | { kind: 'wall' }
  | { kind: 'source'; dir: Dir }
  | { kind: 'target'; index: number };

export interface Pos {
  x: number;
  y: number;
}

export type TrayCounts = Record<PieceKind, number>;

export interface LevelDef {
  id: string;
  name: string;
  /** One short line shown under the board. */
  hint: string;
  /**
   * 10 rows of 10 characters.
   * `.` floor  `#` wall  `> < ^ v` laser  `A`–`I` targets in order  `/ \` fixed mirror
   */
  map: readonly string[];
  tray: Partial<TrayCounts>;
}
