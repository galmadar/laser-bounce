import { describe, expect, it } from 'vitest';
import { Puzzle } from './Puzzle';
import type { LevelDef } from './types';

const LEVEL: LevelDef = {
  id: 'test',
  name: 'Test',
  hint: '',
  map: [
    '..........',
    '>..A.../..',
    '..........',
    '..........',
    '..........',
    '..........',
    '...B......',
    '..........',
    '..........',
    '..........',
  ],
  tray: { mirror: 2, block: 1 },
  solution: { place: [{ at: { x: 7, y: 6 }, kind: 'mirror', turn: 0 }], turn: [{ at: { x: 7, y: 1 }, turn: 1 }] },
};

describe('Puzzle', () => {
  it('lists tray slots in a fixed order, skipping kinds the level does not offer', () => {
    expect(new Puzzle(LEVEL).slots).toEqual(['mirror', 'block']);
  });

  it('places only on empty floor, and only while the tray has one left', () => {
    const p = new Puzzle(LEVEL);
    expect(p.place('mirror', 3, 1)).toBe(false); // target
    expect(p.place('mirror', 0, 1)).toBe(false); // laser
    expect(p.place('mirror', 7, 1)).toBe(false); // fixed mirror
    expect(p.place('splitter', 5, 5)).toBe(false); // none in tray
    expect(p.place('mirror', 5, 5)).toBe(true);
    expect(p.place('mirror', 5, 5)).toBe(false); // taken
    expect(p.place('mirror', 5, 6)).toBe(true);
    expect(p.place('mirror', 5, 7)).toBe(false); // tray empty
    expect(p.trayCount('mirror')).toBe(0);
  });

  it('turns mirrors, fixed or placed, but not blocks', () => {
    const p = new Puzzle(LEVEL);
    expect(p.turn(7, 1)).toBe(true);
    expect(p.pieceAt(7, 1)?.turn).toBe(1);
    p.place('block', 2, 2);
    expect(p.turn(2, 2)).toBe(false);
    expect(p.turn(4, 4)).toBe(false);
  });

  it('delete puts a placed piece back in the tray, and refuses fixed pieces', () => {
    const p = new Puzzle(LEVEL);
    p.place('mirror', 5, 5, 1);
    expect(p.trayCount('mirror')).toBe(1);
    expect(p.remove(5, 5)).toBe('removed');
    expect(p.pieceAt(5, 5)).toBeNull();
    expect(p.trayCount('mirror')).toBe(2);
    expect(p.remove(7, 1)).toBe('fixed');
    expect(p.pieceAt(7, 1)).not.toBeNull();
    expect(p.remove(4, 4)).toBe('empty');
  });

  it('moves a placed piece to another empty square, keeping its turn', () => {
    const p = new Puzzle(LEVEL);
    p.place('mirror', 5, 5, 1);
    expect(p.move({ x: 5, y: 5 }, { x: 6, y: 6 })).toBe(true);
    expect(p.pieceAt(6, 6)).toEqual({ kind: 'mirror', turn: 1, fixed: false });
    expect(p.move({ x: 7, y: 1 }, { x: 8, y: 8 })).toBe(false); // fixed
  });

  it('undo and redo walk back and forth through place, turn, move and delete', () => {
    const p = new Puzzle(LEVEL);
    p.turn(7, 1);
    p.place('mirror', 7, 6, 0);
    expect(p.won).toBe(true);
    p.move({ x: 7, y: 6 }, { x: 8, y: 8 });
    p.remove(8, 8);
    expect(p.history().map((m) => m.type)).toEqual(['turn', 'place', 'move', 'remove']);

    expect(p.undo()).toBe(true); // remove
    expect(p.pieceAt(8, 8)?.kind).toBe('mirror');
    expect(p.trayCount('mirror')).toBe(1);
    expect(p.undo()).toBe(true); // move
    expect(p.pieceAt(7, 6)?.kind).toBe('mirror');
    expect(p.won).toBe(true);
    expect(p.undo()).toBe(true); // place
    expect(p.trayCount('mirror')).toBe(2);
    expect(p.undo()).toBe(true); // turn
    expect(p.pieceAt(7, 1)?.turn).toBe(0);
    expect(p.undo()).toBe(false);

    expect(p.redo()).toBe(true);
    expect(p.redo()).toBe(true);
    expect(p.won).toBe(true);
    expect(p.canRedo).toBe(true);

    p.place('block', 0, 0); // a new move clears redo
    expect(p.canRedo).toBe(false);
    expect(p.redo()).toBe(false);
  });

  it('history is plain data', () => {
    const p = new Puzzle(LEVEL);
    p.place('mirror', 5, 5, 1);
    expect(JSON.parse(JSON.stringify(p.history()))).toEqual([
      { type: 'place', at: { x: 5, y: 5 }, kind: 'mirror', turn: 1 },
    ]);
  });

  it('restart puts every piece back where the level starts and clears history', () => {
    const p = new Puzzle(LEVEL);
    p.turn(7, 1);
    p.place('mirror', 7, 6);
    p.place('block', 1, 3);
    expect(p.won).toBe(true);

    p.restart();
    expect(p.won).toBe(false);
    expect(p.pieceAt(7, 1)).toEqual({ kind: 'mirror', turn: 0, fixed: true });
    expect(p.pieceAt(7, 6)).toBeNull();
    expect(p.pieceAt(1, 3)).toBeNull();
    expect(p.trayCount('mirror')).toBe(2);
    expect(p.trayCount('block')).toBe(1);
    expect(p.canUndo).toBe(false);
    expect(p.canRedo).toBe(false);
  });
});
