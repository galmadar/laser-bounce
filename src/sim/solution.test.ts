import { describe, expect, it } from 'vitest';
import { LEVELS } from '../content/levels';
import { traceBeam } from './beam';
import { Puzzle } from './Puzzle';
import { solutionOverlay, solvedBoard } from './solution';
import type { LevelDef } from './types';

function layout(p: Puzzle): string {
  const cells: string[] = [];
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const pc = p.pieceAt(x, y);
      if (pc) cells.push(`${x},${y}:${pc.kind}${pc.turn}${pc.fixed ? 'F' : ''}`);
    }
  return `${cells.join(' ')} | ${p.slots.map((k) => `${k}x${p.trayCount(k)}`).join(' ')}`;
}

const byCell = <T extends { at: { x: number; y: number } }>(list: readonly T[]) =>
  [...list].sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);

/** A player's half-finished mess: every fixed mirror turned, tray pieces dropped on the first open squares. */
function mess(lvl: LevelDef): Puzzle {
  const p = new Puzzle(lvl);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) if (p.pieceAt(x, y)?.fixed) p.turn(x, y);
  let dropped = 0;
  for (let y = 0; y < p.height && dropped < 3; y++)
    for (let x = 0; x < p.width && dropped < 3; x++) {
      const kind = p.slots.find((k) => p.trayCount(k) > 0);
      if (kind && p.isOpen(x, y) && p.place(kind, x, y, 1)) dropped++;
    }
  return p;
}

describe.each(LEVELS.map((l) => [l.id, l] as const))('solution for %s', (id, lvl) => {
  it('apply wins from a fresh board', () => {
    const p = new Puzzle(lvl);
    expect(p.applySolution()).toBe(true);
    expect(p.won, id).toBe(true);
    expect(p.beam().looped).toBe(false);
  });

  it('apply wins from a messy board, as one undo step that brings the mess back', () => {
    const p = mess(lvl);
    const before = layout(p);
    const steps = p.history().length;
    expect(p.applySolution()).toBe(true);
    expect(p.won).toBe(true);
    expect(p.history()).toHaveLength(steps + 1);
    expect(p.history()[steps].type).toBe('solution');

    expect(p.undo()).toBe(true);
    expect(layout(p)).toBe(before);
    expect(p.history()).toHaveLength(steps);

    expect(p.redo()).toBe(true);
    expect(p.won).toBe(true);
  });

  it('apply uses the whole solution and nothing else', () => {
    const p = new Puzzle(lvl);
    p.applySolution();
    expect(layout(p)).toBe(layoutOf(lvl));
    expect(p.applySolution()).toBe(false); // already there: no empty undo step
  });

  it('overlay on a fresh board is exactly the solution, and its path is the solved beam', () => {
    const o = solutionOverlay(new Puzzle(lvl));
    expect(o.place).toEqual(lvl.solution.place);
    expect(byCell(o.turn)).toEqual(byCell(lvl.solution.turn));
    expect(o.path).toEqual(traceBeam(solvedBoard(lvl)).segments);
    expect(o.path.length).toBeGreaterThan(0);
  });

  it('overlay shrinks to nothing to do once the solution is on the board', () => {
    const p = mess(lvl);
    p.applySolution();
    const o = solutionOverlay(p);
    expect(o.place).toEqual([]);
    expect(o.turn).toEqual([]);
  });
});

/** Fresh puzzle, solution played by hand through the public moves. */
function layoutOf(lvl: LevelDef): string {
  const p = new Puzzle(lvl);
  for (const t of lvl.solution.turn) p.turn(t.at.x, t.at.y);
  for (const pl of lvl.solution.place) p.place(pl.kind, pl.at.x, pl.at.y, pl.turn);
  return layout(p);
}

describe('solution overlay', () => {
  it('asks to turn back a fixed mirror the player turned, even when the solution leaves it as drawn', () => {
    const lvl = LEVELS.find((l) => l.id === 'detour')!;
    const p = new Puzzle(lvl);
    // (7,1) is fixed and the solution keeps it as drawn.
    expect(lvl.solution.turn.some((t) => t.at.x === 7 && t.at.y === 1)).toBe(false);
    p.turn(7, 1);
    expect(solutionOverlay(p).turn).toContainEqual({ at: { x: 7, y: 1 }, turn: 1 });
  });

  it('drops a ghost once the player puts the right piece there', () => {
    const lvl = LEVELS[0];
    const p = new Puzzle(lvl);
    const pl = lvl.solution.place[0];
    p.place(pl.kind, pl.at.x, pl.at.y, pl.turn === 0 ? 1 : 0);
    expect(solutionOverlay(p).place).toHaveLength(1); // wrong angle still shows
    p.turn(pl.at.x, pl.at.y);
    expect(solutionOverlay(p).place).toHaveLength(0);
  });
});
