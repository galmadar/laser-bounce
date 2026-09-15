import { traceBeam, type Segment } from './beam';
import { parseLevel, type Board } from './board';
import type { Move } from './Puzzle';
import type { FixedTurn, LevelDef, Piece, Placement, Turn } from './types';

/** The bits of a Puzzle the solution needs to read. */
export interface BoardView {
  readonly level: LevelDef;
  readonly width: number;
  readonly height: number;
  pieceAt(x: number, y: number): Readonly<Piece> | null;
}

/** What the "show the solution" overlay draws: only what is still different from the solution. */
export interface SolutionOverlay {
  /** Tray pieces not yet on their square at the right angle. */
  place: Placement[];
  /** Fixed mirrors currently at the wrong angle, with the angle they need. */
  turn: FixedTurn[];
  /** The solved beam, in step order, so the route reads from the laser outward. */
  path: readonly Segment[];
}

/** Angle each fixed mirror needs, by board index: the solution's, or as drawn when it isn't listed. */
function fixedTargets(level: LevelDef): Map<number, FixedTurn> {
  const board = parseLevel(level);
  const out = new Map<number, FixedTurn>();
  board.pieces.forEach((pc, i) => {
    if (pc?.fixed) out.set(i, { at: { x: i % board.width, y: Math.floor(i / board.width) }, turn: pc.turn });
  });
  for (const t of level.solution.turn) out.set(t.at.y * board.width + t.at.x, t);
  return out;
}

function isPlaced(p: BoardView, pl: Placement): boolean {
  const pc = p.pieceAt(pl.at.x, pl.at.y);
  return !!pc && !pc.fixed && pc.kind === pl.kind && pc.turn === pl.turn;
}

/**
 * Moves that turn any layout into the solution: stray player pieces back to the tray,
 * fixed mirrors set, missing tray pieces placed. Pieces already right stay, so a solved board needs none.
 */
export function solutionMoves(p: BoardView): Move[] {
  const keep = new Set(p.level.solution.place.filter((pl) => isPlaced(p, pl)).map((pl) => pl.at.y * p.width + pl.at.x));
  const moves: Move[] = [];
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      const pc = p.pieceAt(x, y);
      if (pc && !pc.fixed && !keep.has(y * p.width + x)) moves.push({ type: 'remove', at: { x, y }, kind: pc.kind, turn: pc.turn });
    }
  }
  for (const t of fixedTargets(p.level).values()) {
    if (p.pieceAt(t.at.x, t.at.y)?.turn !== t.turn) moves.push({ type: 'turn', at: t.at });
  }
  for (const pl of p.level.solution.place) {
    if (!keep.has(pl.at.y * p.width + pl.at.x)) moves.push({ type: 'place', at: pl.at, kind: pl.kind, turn: pl.turn });
  }
  return moves;
}

/** The board as the solution leaves it. */
export function solvedBoard(level: LevelDef): Board {
  const board = parseLevel(level);
  for (const t of fixedTargets(level).values()) {
    const pc = board.pieces[t.at.y * board.width + t.at.x];
    if (pc) pc.turn = t.turn;
  }
  for (const pl of level.solution.place) {
    board.pieces[pl.at.y * board.width + pl.at.x] = { kind: pl.kind, turn: pl.turn, fixed: false };
  }
  return board;
}

const paths = new WeakMap<LevelDef, readonly Segment[]>();

function solvedPath(level: LevelDef): readonly Segment[] {
  let path = paths.get(level);
  if (!path) {
    path = traceBeam(solvedBoard(level)).segments;
    paths.set(level, path);
  }
  return path;
}

export function solutionOverlay(p: BoardView): SolutionOverlay {
  const place = p.level.solution.place.filter((pl) => !isPlaced(p, pl));
  const turn: FixedTurn[] = [];
  for (const t of fixedTargets(p.level).values()) {
    const current: Turn | undefined = p.pieceAt(t.at.x, t.at.y)?.turn;
    if (current !== t.turn) turn.push(t);
  }
  return { place, turn, path: solvedPath(p.level) };
}
