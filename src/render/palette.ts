/** Every colour in the game: soft pastels on a dusk-lavender ground. Canvas and page CSS both read from here. */

export interface PiecePalette {
  body: string;
  light: string;
  dark: string;
  face: string;
  shadow: string;
}

const dusk = {
  deep: '#1f1b33',
  night: '#2a2640',
  plum: '#2f2b4a',
  page: '#3a3558',
  glow: '#544c7e',
  panel: '#474170',
  tile: '#625d94',
  tileAlt: '#5c578c',
  tileLo: '#4a4675',
  lilac: '#b9a8e6',
  slotEdge: '#6d66a0',
};

const butter = { base: '#ffe08a', dim: '#b8a36a', pale: '#fff4c9', ink: '#4a3200', idle: '#d9c890', edge: '#c9a94f' };
const mint = { glow: '#9dffc4', mid: '#c9ffe0', core: '#ffffff' };
const coral = { base: '#ff6b81', fill: '#4a1f35', ink: '#ff8a9a' };
const peach = { base: '#ffc3a0', edge: '#c98a6d', ink: '#3a2433' };

export const BOARD = {
  boardBase: dusk.tileLo,
  boardEdge: '#b9a8e64d',
  shadow: '#15122699',
  pieceShadow: '#15122680',
  floorA: dusk.tile,
  floorB: dusk.tileAlt,
  wall: dusk.plum,
  wallHi: '#463f6b',
  wallShine: '#ffffff14',
  beamGlow: mint.glow,
  beamMid: mint.mid,
  beamCore: mint.core,
  beamHalo: '#9dffc4d9',
  gold: butter.base,
  goldDim: butter.dim,
  goldPale: butter.pale,
  goldInk: butter.ink,
  goldGlow: '#ffe08aa6',
  stopIdleInk: butter.idle,
  red: coral.base,
  redFill: coral.fill,
  redInk: coral.ink,
  redGlow: '#ff6b81cc',
  plate: dusk.plum,
  tray: '#3f3a60',
  slot: '#2e2a47',
  slotEdge: dusk.slotEdge,
  glassShine: '#ffffff80',
  laserBody: '#8a86a8',
  laserHi: '#c2bfd8',
  laserLo: '#4a4668',
  laserLens: dusk.night,
};

export const PIECES: Record<'mirror' | 'mirrorFixed' | 'splitter' | 'block', PiecePalette> = {
  mirror: { body: '#ffb48a', light: '#ffd6bd', dark: '#c97a58', face: '#fffaf3', shadow: '#a85f44' },
  mirrorFixed: { body: '#c97c6c', light: '#e29d8b', dark: '#6f3a30', face: '#ffe6d8', shadow: '#7a4034' },
  splitter: { body: '#8fd3f0', light: '#c9ecfb', dark: '#4f93b3', face: '#ffffff', shadow: '#3f7a96' },
  block: { body: '#b3adc9', light: '#dcd8ea', dark: '#736d8c', face: '#f1eff7', shadow: '#8f89a8' },
};

/** Page chrome. Each key becomes a CSS variable: `buttonInk` → `--button-ink`. */
export const UI = {
  bg: dusk.page,
  bgGlow: dusk.glow,
  panel: dusk.panel,
  edge: dusk.lilac,
  ink: '#f6f1ff',
  dim: '#c9c1e6',
  gold: butter.base,
  goldGlow: '#ffe08a59',
  button: peach.base,
  buttonEdge: peach.edge,
  buttonInk: peach.ink,
  buttonHotEdge: butter.edge,
  buttonOff: '#6a6490',
  buttonOffEdge: '#4f4a72',
  buttonOffInk: dusk.plum,
  shadow: '#1512268c',
  shadowSoft: '#15122659',
  overlay: '#1f1b33b8',
  field: dusk.night,
  warn: coral.base,
  win: mint.glow,
  winGlow: '#9dffc4b3',
};

export function applyCssPalette(root: HTMLElement): void {
  for (const [key, value] of Object.entries(UI)) {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
  }
  root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', UI.bg);
}
