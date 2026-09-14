import { LEVELS } from './content/levels';
import { actionForKey, KEYMAP, type KeyAction } from './input/keymap';
import { PointerInput, type PointerHandlers } from './input/PointerInput';
import { CANVAS_H, CANVAS_W } from './render/layout';
import { Renderer } from './render/Renderer';
import { Game, type GameEvent } from './shell/Game';
import { Modals } from './shell/Modal';
import * as progress from './shell/progress';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('board');
const levelLabel = $('level-label');
const hint = $('hint');
const help = $('help');
const buttons = {
  prev: $<HTMLButtonElement>('btn-prev'),
  next: $<HTMLButtonElement>('btn-next'),
  undo: $<HTMLButtonElement>('btn-undo'),
  redo: $<HTMLButtonElement>('btn-redo'),
  restart: $<HTMLButtonElement>('btn-restart'),
  help: $<HTMLButtonElement>('btn-help'),
};

const renderer = new Renderer(canvas);
const modals = new Modals(document.body);

let levelIndex = Math.min(Math.max(0, progress.currentLevel()), LEVELS.length - 1);
let game = makeGame(levelIndex);
let winTimer: number | null = null;

function makeGame(index: number): Game {
  const g: Game = new Game(LEVELS[index], (e) => onGameEvent(g, e));
  return g;
}

function loadLevel(index: number): void {
  if (winTimer !== null) window.clearTimeout(winTimer);
  modals.close();
  levelIndex = index;
  game = makeGame(index);
  progress.setCurrentLevel(index);
  updateHud();
}

function onGameEvent(g: Game, e: GameEvent): void {
  if (g !== game) return;
  if (e === 'won') {
    progress.markSolved(g.puzzle.level.id);
    if (winTimer !== null) window.clearTimeout(winTimer);
    // Let the beam flash first, then say so.
    winTimer = window.setTimeout(() => {
      winTimer = null;
      if (g === game && g.puzzle.won && !modals.isOpen()) showWin();
    }, 700);
  }
  if (e === 'no') navigator.vibrate?.(30);
  updateHud();
}

function showWin(): void {
  const last = levelIndex === LEVELS.length - 1;
  modals.open({
    className: 'win',
    title: last ? 'ALL LEVELS DONE!' : 'LEVEL COMPLETE!',
    body: last ? 'The laser got through every level. Nice work.' : 'The laser hit every stop, in order.',
    ok: { label: last ? 'Play level 1' : 'Next level', run: () => loadLevel(last ? 0 : levelIndex + 1) },
    cancel: { label: 'Stay here' },
  });
}

function askLevel(index: number): void {
  if (index < 0 || index >= LEVELS.length) {
    game.shake = { start: performance.now() };
    return;
  }
  modals.open({
    title: `Go to level ${index + 1}?`,
    body: `${LEVELS[index].name}. The pieces on this level go back to the tray.`,
    ok: { label: 'Go', run: () => loadLevel(index) },
    cancel: { label: 'Stay' },
  });
}

function askGoTo(): void {
  modals.open({
    title: 'Go to level',
    body: `Type a number from 1 to ${LEVELS.length}.`,
    numberInput: { min: 1, max: LEVELS.length, value: levelIndex + 1 },
    ok: { label: 'Go', run: (n) => loadLevel(n - 1) },
    cancel: { label: 'Cancel' },
  });
}

function toggleHelp(show = help.hidden): void {
  help.hidden = !show;
  buttons.help.classList.toggle('on', show);
}

function run(action: KeyAction): void {
  switch (action.type) {
    case 'pickSlot':
      return game.pick(action.slot - 1);
    case 'dropPick':
      if (!help.hidden) toggleHelp(false);
      return game.dropPick();
    case 'restart':
      return game.restart();
    case 'nextLevel':
      return askLevel(levelIndex + 1);
    case 'prevLevel':
      return askLevel(levelIndex - 1);
    case 'goToLevel':
      return askGoTo();
    case 'undo':
      return game.undo();
    case 'redo':
      return game.redo();
    case 'toggleHelp':
      return toggleHelp();
  }
}

document.addEventListener('keydown', (e) => {
  if (modals.isOpen()) {
    // Keep the browser's find-next away even with a modal up.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') e.preventDefault();
    modals.handleKey(e);
    return;
  }
  const action = actionForKey(e);
  if (!action) return;
  e.preventDefault();
  if (e.repeat && action.type !== 'undo' && action.type !== 'redo') return;
  run(action);
});

// Pointer events always go to whichever level is loaded now.
const pointer: PointerHandlers = {
  enabled: () => !modals.isOpen(),
  slotCount: () => game.slotCount(),
  hover: (c) => game.hover(c),
  tapCell: (c) => game.tapCell(c),
  tapSlot: (s) => game.tapSlot(s),
  secondary: (c) => game.secondary(c),
  dragStart: (from, px, py) => game.dragStart(from, px, py),
  dragMove: (px, py, c) => game.dragMove(px, py, c),
  dragEnd: (c, overTray) => game.dragEnd(c, overTray),
  dragCancel: () => game.dragCancel(),
};
new PointerInput(canvas, pointer);

buttons.prev.addEventListener('click', () => askLevel(levelIndex - 1));
buttons.next.addEventListener('click', () => askLevel(levelIndex + 1));
buttons.undo.addEventListener('click', () => game.undo());
buttons.redo.addEventListener('click', () => game.redo());
buttons.restart.addEventListener('click', () => game.restart());
buttons.help.addEventListener('click', () => toggleHelp());
$('help-close').addEventListener('click', () => toggleHelp(false));

function updateHud(): void {
  const lvl = LEVELS[levelIndex];
  levelLabel.textContent = `Level ${levelIndex + 1}/${LEVELS.length} · ${lvl.name}${progress.isSolved(lvl.id) ? ' ★' : ''}`;
  hint.textContent = lvl.hint;
  buttons.prev.disabled = levelIndex === 0;
  buttons.next.disabled = levelIndex === LEVELS.length - 1;
  buttons.undo.disabled = !game.puzzle.canUndo;
  buttons.redo.disabled = !game.puzzle.canRedo;
}

function buildHelp(): void {
  const list = $('help-keys');
  const rows: [string, string][] = [
    ['Click / tap', 'Turn a mirror, or place the picked piece'],
    ['Drag', 'Move a piece; drop it on the tray to put it back'],
    ['Right click / long press', 'Put a piece back in the tray'],
    ...KEYMAP.map((b) => [b.label, b.help] as [string, string]),
  ];
  for (const [k, what] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = what;
    list.append(dt, dd);
  }
}

function fit(): void {
  const top = $('bar').getBoundingClientRect().height;
  const bottom = hint.getBoundingClientRect().height;
  const availW = window.innerWidth - 16;
  const availH = window.innerHeight - top - bottom - 28;
  // Any scale stays sharp: the renderer sizes its backing store to these whole CSS pixels × devicePixelRatio.
  const s = Math.max(1, Math.min(availW / CANVAS_W, availH / CANVAS_H));
  canvas.style.width = `${Math.floor(CANVAS_W * s)}px`;
  canvas.style.height = `${Math.floor(CANVAS_H * s)}px`;
}

function frame(now: number): void {
  renderer.draw(game, now);
  requestAnimationFrame(frame);
}

// Dev server only: a browser check fires `laser:dump` and reads the state back off the page.
if (import.meta.env.DEV) {
  document.addEventListener('laser:dump', () => {
    const p = game.puzzle;
    const pieces: string[] = [];
    for (let y = 0; y < p.height; y++)
      for (let x = 0; x < p.width; x++) {
        const pc = p.pieceAt(x, y);
        if (pc) pieces.push(`${x},${y}:${pc.kind}${pc.turn}${pc.fixed ? 'F' : ''}`);
      }
    document.documentElement.dataset.laser = JSON.stringify({
      level: levelIndex + 1,
      picked: game.picked,
      tray: p.slots.map((k) => `${k}x${p.trayCount(k)}`),
      pieces,
      undo: p.canUndo,
      redo: p.canRedo,
      shake: game.shake,
      won: p.won,
      modal: document.querySelector('.modal h2')?.textContent ?? null,
      help: !help.hidden,
    });
  });
}

buildHelp();
updateHud();
fit();
window.addEventListener('resize', fit);
requestAnimationFrame(frame);
