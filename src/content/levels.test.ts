import { describe, expect, it } from 'vitest';
import { targetCount, parseLevel } from '../sim/board';
import { Puzzle, type Move } from '../sim/Puzzle';
import type { LevelDef } from '../sim/types';
import { LEVELS } from './levels';

/** The level's known solution, as moves a player could make. */
function solutionAsMoves(lvl: LevelDef): Move[] {
  return [
    ...lvl.solution.turn.map((t): Move => ({ type: 'turn', at: t.at })),
    ...lvl.solution.place.map((pl): Move => ({ type: 'place', at: pl.at, kind: pl.kind, turn: pl.turn })),
  ];
}

function play(p: Puzzle, move: Move): boolean {
  switch (move.type) {
    case 'place':
      return p.place(move.kind, move.at.x, move.at.y, move.turn);
    case 'turn':
      return p.turn(move.at.x, move.at.y);
    case 'remove':
      return p.remove(move.at.x, move.at.y) === 'removed';
    case 'move':
      return p.move(move.from, move.to);
    case 'solution':
      return move.moves.every((m) => play(p, m));
  }
}

describe('level registry', () => {
  it('has 15 levels with unique ids and names', () => {
    expect(LEVELS).toHaveLength(15);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
  });

  it('levels 1–5 teach one more stop each: A→B first', () => {
    LEVELS.slice(0, 5).forEach((lvl, i) => expect(targetCount(parseLevel(lvl))).toBe(i + 2));
  });

  it('every level has a hint and fits the tray and the A–I stop letters', () => {
    for (const lvl of LEVELS) {
      expect(lvl.hint.length).toBeGreaterThan(0);
      expect(targetCount(parseLevel(lvl))).toBeLessThanOrEqual(9);
      // "x10" would not fit in a tray slot.
      for (const n of Object.values(lvl.tray)) expect(n).toBeLessThanOrEqual(9);
    }
  });
});

describe.each(LEVELS.map((l) => [l.id, l] as const))('%s', (id, lvl) => {
  it('lists only fixed mirrors that need a different angle', () => {
    const start = new Puzzle(lvl);
    for (const t of lvl.solution.turn) {
      const pc = start.pieceAt(t.at.x, t.at.y);
      expect(pc?.fixed, `${id}: ${JSON.stringify(t.at)}`).toBe(true);
      expect(pc?.turn).not.toBe(t.turn);
    }
  });

  it('is not already won when it starts', () => {
    expect(new Puzzle(lvl).won).toBe(false);
  });

  it('is won by its known solution, played by hand, using only what the tray holds', () => {
    const p = new Puzzle(lvl);
    for (const move of solutionAsMoves(lvl)) expect(play(p, move), `${id}: ${JSON.stringify(move)}`).toBe(true);
    const beam = p.beam();
    expect(beam.won).toBe(true);
    expect(beam.looped).toBe(false);
  });
});
