import { describe, expect, it } from 'vitest';
import { targetCount, parseLevel } from '../sim/board';
import { Puzzle, type Move } from '../sim/Puzzle';
import { LEVELS } from './levels';

/** One known way through each level, in the order a player could do it. */
const SOLUTIONS: Record<string, Move[]> = {
  'first-bounce': [
    { type: 'turn', at: { x: 7, y: 1 } },
    { type: 'place', at: { x: 7, y: 6 }, kind: 'mirror', turn: 0 },
  ],
  'b-before-c': [
    { type: 'place', at: { x: 3, y: 5 }, kind: 'mirror', turn: 0 },
    { type: 'place', at: { x: 3, y: 0 }, kind: 'mirror', turn: 0 },
    { type: 'turn', at: { x: 8, y: 0 } },
  ],
  zigzag: [
    { type: 'turn', at: { x: 1, y: 4 } },
    { type: 'place', at: { x: 6, y: 4 }, kind: 'mirror', turn: 1 },
    { type: 'place', at: { x: 6, y: 8 }, kind: 'mirror', turn: 1 },
    { type: 'place', at: { x: 8, y: 8 }, kind: 'mirror', turn: 0 },
  ],
  'split-beam': [
    { type: 'place', at: { x: 4, y: 4 }, kind: 'splitter', turn: 0 },
    { type: 'place', at: { x: 4, y: 1 }, kind: 'block', turn: 0 },
    { type: 'place', at: { x: 8, y: 4 }, kind: 'mirror', turn: 0 },
    { type: 'turn', at: { x: 8, y: 0 } },
  ],
  'hall-of-mirrors': [
    { type: 'turn', at: { x: 0, y: 5 } },
    { type: 'place', at: { x: 5, y: 5 }, kind: 'splitter', turn: 1 },
    { type: 'place', at: { x: 5, y: 8 }, kind: 'block', turn: 0 },
    { type: 'place', at: { x: 8, y: 5 }, kind: 'mirror', turn: 0 },
    { type: 'turn', at: { x: 8, y: 1 } },
    { type: 'turn', at: { x: 3, y: 1 } },
    { type: 'place', at: { x: 3, y: 9 }, kind: 'mirror', turn: 1 },
  ],
};

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
  }
}

describe('level registry', () => {
  it('has 5 levels with unique ids', () => {
    expect(LEVELS).toHaveLength(5);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  it('level n has n+1 targets: A→B first, one more each level', () => {
    LEVELS.forEach((lvl, i) => expect(targetCount(parseLevel(lvl))).toBe(i + 2));
  });
});

describe.each(LEVELS.map((l) => [l.id, l] as const))('%s', (id, lvl) => {
  it('is not already won when it starts', () => {
    expect(new Puzzle(lvl).won).toBe(false);
  });

  it('is won by its known solution, using only what the tray holds', () => {
    const solution = SOLUTIONS[id];
    expect(solution, `no known solution for ${id}`).toBeDefined();
    const p = new Puzzle(lvl);
    for (const move of solution) expect(play(p, move), JSON.stringify(move)).toBe(true);
    const beam = p.beam();
    expect(beam.won).toBe(true);
    expect(beam.looped).toBe(false);
  });
});
