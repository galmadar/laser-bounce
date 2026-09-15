import { describe, expect, it } from 'vitest';
import { traceBeam } from './beam';
import { parseLevel } from './board';
import { Puzzle } from './Puzzle';
import type { LevelDef } from './types';

function level(map: string[], tray: LevelDef['tray'] = {}): LevelDef {
  return { id: 'test', name: 'Test', hint: '', map, tray, solution: { place: [], turn: [] } };
}

const EMPTY = '..........';

describe('traceBeam', () => {
  it('runs straight through targets in order and wins', () => {
    const b = traceBeam(parseLevel(level(['>.A..B....', ...Array(9).fill(EMPTY)])));
    expect(b.firstHit).toEqual([2, 5]);
    expect(b.won).toBe(true);
    expect(b.looped).toBe(false);
  });

  it('does not count targets reached out of order', () => {
    const b = traceBeam(parseLevel(level(['>.B..A....', ...Array(9).fill(EMPTY)])));
    expect(b.won).toBe(false);
    expect(b.lit).toEqual([true, false]);
    expect(b.wrong).toEqual([false, true]);
  });

  it('bounces off `/` and `\\` mirrors', () => {
    // The mirror at (4,0) sends the beam down through A and B.
    const p = new Puzzle(level(['>...\\.....', '..........', '....A.....', '..........', '....B.....', ...Array(5).fill(EMPTY)]));
    expect(p.won).toBe(true);
    p.turn(4, 0); // now `/`: up and off the board
    expect(p.beam().firstHit).toEqual([null, null]);
    p.turn(4, 0);
    expect(p.won).toBe(true);
  });

  it('stops at walls and blocks', () => {
    const walled = traceBeam(parseLevel(level(['>.A.#.B...', ...Array(9).fill(EMPTY)])));
    expect(walled.firstHit).toEqual([2, null]);
    expect(walled.stops).toHaveLength(1);

    const p = new Puzzle(level(['>.A...B...', ...Array(9).fill(EMPTY)], { block: 1 }));
    expect(p.won).toBe(true);
    p.place('block', 4, 0);
    expect(p.won).toBe(false);
  });

  it('a splitter sends light both ways, and first hit is by distance', () => {
    // Splitter at (3,0): straight on to B at (6,0) in 6 steps, down to A at (3,2) in 5.
    const p = new Puzzle(level(['>.....B...', '..........', '...A......', ...Array(7).fill(EMPTY)], { splitter: 1 }));
    p.place('splitter', 3, 0, 1);
    const b = p.beam();
    expect(b.firstHit).toEqual([5, 6]);
    expect(b.won).toBe(true);
  });

  it('ends when the beam goes round a loop forever', () => {
    // Four mirrors make a closed square; a splitter feeds light into it.
    const map = [
      '..........',
      './.....\\..',
      '..........',
      '..........',
      '>...A.....',
      '..........',
      '.B........',
      '.\\...../..',
      '..........',
      '..........',
    ];
    const p = new Puzzle(level(map, { splitter: 1 }));
    p.place('splitter', 7, 4, 0);
    const b = p.beam();
    expect(b.looped).toBe(true);
    expect(b.segments.length).toBeLessThan(400);
  });
});
