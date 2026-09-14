import { targetCount, type Board } from './board';
import { DX, DY, type Dir, type Pos, type Turn } from './types';

/** A straight piece of beam, in board units: cell (x, y) spans x..x+1, its centre is x+0.5. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BeamResult {
  segments: Segment[];
  /** Where a beam stopped against something solid (for sparks). Board units. */
  stops: Pos[];
  /** Step at which the light first reached each target, or null if it never did. */
  firstHit: (number | null)[];
  /** Target i is lit when A..i were all reached, each strictly after the one before. */
  lit: boolean[];
  /** Reached, but out of order. */
  wrong: boolean[];
  won: boolean;
  /** The beam came back onto a path it had already taken, so tracing stopped there. */
  looped: boolean;
}

/** `/` sends right→up, up→right, left→down, down→left. `\` mirrors that. */
const REFLECT: readonly (readonly Dir[])[] = [
  [1, 0, 3, 2],
  [3, 2, 1, 0],
];

export function reflect(dir: Dir, turn: Turn): Dir {
  return REFLECT[turn][dir];
}

/** Far more than the 10×10×4 distinct beam states; only here in case the state check is ever broken. */
const MAX_STEPS = 10_000;

interface Head {
  x: number;
  y: number;
  dir: Dir;
}

/**
 * Traces the laser one cell per step, all branches in lockstep, so "first hit"
 * means the same thing with or without a splitter: the light got there sooner.
 *
 * Loop guard: a beam state is (cell, direction). Mirrors are deterministic, so a
 * state seen before would replay the same path forever; such a head is dropped.
 * There are at most width×height×4 states, so this always ends.
 */
export function traceBeam(board: Board): BeamResult {
  const { width, height, tiles, pieces } = board;
  const n = targetCount(board);
  const firstHit: (number | null)[] = new Array(n).fill(null);
  const segments: Segment[] = [];
  const stops: Pos[] = [];
  const seen = new Set<number>();
  let looped = false;

  const src = tiles.findIndex((t) => t.kind === 'source');
  const srcTile = tiles[src];
  if (srcTile.kind !== 'source') throw new Error('board has no laser');

  let heads: Head[] = [{ x: src % width, y: Math.floor(src / width), dir: srcTile.dir }];
  let step = 0;

  while (heads.length > 0 && step < MAX_STEPS) {
    step++;
    const next: Head[] = [];
    for (const h of heads) {
      const cx = h.x + 0.5;
      const cy = h.y + 0.5;
      const nx = h.x + DX[h.dir];
      const ny = h.y + DY[h.dir];
      const edgeX = cx + DX[h.dir] * 0.5;
      const edgeY = cy + DY[h.dir] * 0.5;

      const outside = nx < 0 || ny < 0 || nx >= width || ny >= height;
      if (outside) {
        segments.push({ x1: cx, y1: cy, x2: edgeX, y2: edgeY });
        continue;
      }
      const i = ny * width + nx;
      const tile = tiles[i];
      const piece = pieces[i];
      if (tile.kind === 'wall' || tile.kind === 'source' || piece?.kind === 'block') {
        segments.push({ x1: cx, y1: cy, x2: edgeX, y2: edgeY });
        stops.push({ x: edgeX, y: edgeY });
        continue;
      }

      segments.push({ x1: cx, y1: cy, x2: nx + 0.5, y2: ny + 0.5 });
      const state = i * 4 + h.dir;
      if (seen.has(state)) {
        looped = true;
        continue;
      }
      seen.add(state);

      if (tile.kind === 'target' && firstHit[tile.index] === null) firstHit[tile.index] = step;

      if (!piece) {
        next.push({ x: nx, y: ny, dir: h.dir });
      } else if (piece.kind === 'mirror') {
        next.push({ x: nx, y: ny, dir: reflect(h.dir, piece.turn) });
      } else {
        next.push({ x: nx, y: ny, dir: h.dir });
        next.push({ x: nx, y: ny, dir: reflect(h.dir, piece.turn) });
      }
    }
    heads = next;
  }
  if (heads.length > 0) looped = true;

  const lit: boolean[] = new Array(n).fill(false);
  let prev = 0;
  for (let t = 0; t < n; t++) {
    const hit = firstHit[t];
    if (hit === null || hit <= prev) break;
    lit[t] = true;
    prev = hit;
  }
  const wrong = firstHit.map((hit, t) => hit !== null && !lit[t]);
  return { segments, stops, firstHit, lit, wrong, won: lit.every(Boolean), looped };
}
