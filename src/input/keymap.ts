/** Every keyboard shortcut in the game. The help card is drawn from this table too. */

export type KeyAction =
  | { type: 'pickSlot'; slot: number }
  | { type: 'restart' }
  | { type: 'nextLevel' }
  | { type: 'prevLevel' }
  | { type: 'goToLevel' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'dropPick' }
  | { type: 'toggleHelp' }
  | { type: 'toggleSolution' };

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface Binding {
  /** Compared lower-cased. */
  keys: string[];
  /** Ctrl on Windows/Linux, Cmd on Mac. */
  mod: boolean;
  /** undefined means "either". */
  shift?: boolean;
  action: KeyAction | ((key: string) => KeyAction);
  /** For the help card. */
  label: string;
  help: string;
}

export const KEYMAP: readonly Binding[] = [
  {
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    mod: false,
    action: (key) => ({ type: 'pickSlot', slot: Number(key) }),
    label: '1–9',
    help: 'Pick a piece from the tray',
  },
  {
    keys: ['escape'],
    mod: false,
    action: { type: 'dropPick' },
    label: 'Esc',
    help: 'Put the picked piece down, or hide the solution',
  },
  { keys: ['r'], mod: false, action: { type: 'restart' }, label: 'R', help: 'Start the level again' },
  { keys: ['n', ']'], mod: false, action: { type: 'nextLevel' }, label: 'N  ]', help: 'Next level' },
  { keys: ['p', '['], mod: false, action: { type: 'prevLevel' }, label: 'P  [', help: 'Previous level' },
  { keys: ['g'], mod: true, action: { type: 'goToLevel' }, label: 'Ctrl/Cmd G', help: 'Go to a level' },
  { keys: ['z'], mod: true, shift: false, action: { type: 'undo' }, label: 'Ctrl/Cmd Z', help: 'Undo' },
  { keys: ['z'], mod: true, shift: true, action: { type: 'redo' }, label: 'Ctrl/Cmd Shift Z', help: 'Redo' },
  { keys: ['s'], mod: false, action: { type: 'toggleSolution' }, label: 'S', help: 'Show or hide the solution' },
  { keys: ['?', 'h'], mod: false, action: { type: 'toggleHelp' }, label: '?  H', help: 'Show or hide this card' },
];

export function actionForKey(e: KeyLike): KeyAction | null {
  if (e.altKey) return null;
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  for (const b of KEYMAP) {
    if (!b.keys.includes(key) || b.mod !== mod) continue;
    if (b.shift !== undefined && b.shift !== e.shiftKey) continue;
    return typeof b.action === 'function' ? b.action(key) : b.action;
  }
  return null;
}
