import { describe, expect, it } from 'vitest';
import { actionForKey, type KeyLike } from './keymap';

function key(k: string, mods: Partial<KeyLike> = {}): KeyLike {
  return { key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods };
}

describe('actionForKey', () => {
  it('number keys pick tray slots', () => {
    expect(actionForKey(key('1'))).toEqual({ type: 'pickSlot', slot: 1 });
    expect(actionForKey(key('9'))).toEqual({ type: 'pickSlot', slot: 9 });
    expect(actionForKey(key('0'))).toBeNull();
  });

  it('plain letters, either case', () => {
    expect(actionForKey(key('r'))).toEqual({ type: 'restart' });
    expect(actionForKey(key('R', { shiftKey: true }))).toEqual({ type: 'restart' });
    expect(actionForKey(key('n'))).toEqual({ type: 'nextLevel' });
    expect(actionForKey(key(']'))).toEqual({ type: 'nextLevel' });
    expect(actionForKey(key('p'))).toEqual({ type: 'prevLevel' });
    expect(actionForKey(key('['))).toEqual({ type: 'prevLevel' });
    expect(actionForKey(key('?', { shiftKey: true }))).toEqual({ type: 'toggleHelp' });
    expect(actionForKey(key('h'))).toEqual({ type: 'toggleHelp' });
    expect(actionForKey(key('Escape'))).toEqual({ type: 'dropPick' });
    expect(actionForKey(key('s'))).toEqual({ type: 'toggleSolution' });
    expect(actionForKey(key('S', { shiftKey: true }))).toEqual({ type: 'toggleSolution' });
  });

  it('Ctrl and Cmd both work for G and Z; Shift picks redo', () => {
    expect(actionForKey(key('g', { ctrlKey: true }))).toEqual({ type: 'goToLevel' });
    expect(actionForKey(key('g', { metaKey: true }))).toEqual({ type: 'goToLevel' });
    expect(actionForKey(key('z', { metaKey: true }))).toEqual({ type: 'undo' });
    expect(actionForKey(key('Z', { ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(actionForKey(key('z', { metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
  });

  it('leaves browser shortcuts alone', () => {
    expect(actionForKey(key('r', { metaKey: true }))).toBeNull(); // reload
    expect(actionForKey(key('s', { ctrlKey: true }))).toBeNull(); // save page
    expect(actionForKey(key('g'))).toBeNull();
    expect(actionForKey(key('z'))).toBeNull();
    expect(actionForKey(key('n', { altKey: true }))).toBeNull();
  });
});
