import type { Dir, LevelDef, Piece, Tile } from './types';

export const BOARD_SIZE = 10;

export interface Board {
  width: number;
  height: number;
  /** Row-major, index = y * width + x. */
  tiles: Tile[];
  pieces: (Piece | null)[];
}

const SOURCE_DIRS: Record<string, Dir> = { '^': 0, '>': 1, v: 2, '<': 3 };

export function parseLevel(level: LevelDef): Board {
  const height = level.map.length;
  const width = level.map[0]?.length ?? 0;
  if (width !== BOARD_SIZE || height !== BOARD_SIZE) {
    throw new Error(`${level.id}: map must be ${BOARD_SIZE}x${BOARD_SIZE}, got ${width}x${height}`);
  }
  const tiles: Tile[] = [];
  const pieces: (Piece | null)[] = [];
  let sources = 0;
  const targets = new Set<number>();

  level.map.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${level.id}: row ${y} is ${row.length} wide`);
    for (const ch of row) {
      let tile: Tile = { kind: 'floor' };
      let piece: Piece | null = null;
      if (ch === '#') tile = { kind: 'wall' };
      else if (ch in SOURCE_DIRS) {
        tile = { kind: 'source', dir: SOURCE_DIRS[ch] };
        sources++;
      } else if (ch >= 'A' && ch <= 'I') {
        const index = ch.charCodeAt(0) - 65;
        if (targets.has(index)) throw new Error(`${level.id}: target ${ch} appears twice`);
        targets.add(index);
        tile = { kind: 'target', index };
      } else if (ch === '/' || ch === '\\') {
        piece = { kind: 'mirror', turn: ch === '/' ? 0 : 1, fixed: true };
      } else if (ch !== '.') {
        throw new Error(`${level.id}: unknown map character "${ch}"`);
      }
      tiles.push(tile);
      pieces.push(piece);
    }
  });

  if (sources !== 1) throw new Error(`${level.id}: needs exactly one laser, found ${sources}`);
  for (let i = 0; i < targets.size; i++) {
    if (!targets.has(i)) throw new Error(`${level.id}: targets must run A, B, C… with no gaps`);
  }
  if (targets.size < 2) throw new Error(`${level.id}: needs at least A and B`);
  return { width, height, tiles, pieces };
}

export function targetCount(board: Board): number {
  return board.tiles.filter((t) => t.kind === 'target').length;
}
