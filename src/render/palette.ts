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
  tileHi: '#7570a8',
  tileLo: '#4a4675',
  lilac: '#b9a8e6',
  slotEdge: '#6d66a0',
};

const butter = { base: '#ffe08a', dim: '#b8a36a', pale: '#fff4c9', ink: '#4a3200', idle: '#d9c890', edge: '#c9a94f' };
const mint = { glow: '#9dffc4', mid: '#c9ffe0', core: '#ffffff', shade: '#2f6b4d' };
const coral = { base: '#ff6b81', dark: '#8a3350', fill: '#4a1f35', ink: '#ff8a9a' };
const peach = { base: '#ffc3a0', edge: '#c98a6d', ink: '#3a2433' };

export const BOARD = {
  bg: dusk.page,
  frame: dusk.lilac,
  frameDark: dusk.deep,
  floorA: dusk.tile,
  floorB: dusk.tileAlt,
  floorHi: dusk.tileHi,
  floorLo: dusk.tileLo,
  wall: dusk.plum,
  wallMortar: dusk.deep,
  wallHi: '#463f6b',
  outline: dusk.deep,
  beamGlow: mint.glow,
  beamMid: mint.mid,
  beamCore: mint.core,
  gold: butter.base,
  goldDim: butter.dim,
  goldPale: butter.pale,
  goldInk: butter.ink,
  stopIdleInk: butter.idle,
  red: coral.base,
  redDark: coral.dark,
  redFill: coral.fill,
  redInk: coral.ink,
  plate: dusk.plum,
  tray: '#3f3a60',
  slot: '#2e2a47',
  slotEdge: dusk.slotEdge,
  laserBody: '#8a86a8',
  laserHi: '#c2bfd8',
  laserLo: '#4a4668',
  laserLens: dusk.night,
};

export const PIECES: Record<'mirror' | 'mirrorFixed' | 'splitter' | 'block', PiecePalette> = {
  mirror: { body: '#ffb48a', light: '#ffd6bd', dark: '#c97a58', face: '#fffaf3', shadow: '#a85f44' },
  mirrorFixed: { body: '#d98a78', light: '#eda996', dark: '#8f4c3e', face: '#ffe6d8', shadow: '#7a4034' },
  splitter: { body: '#8fd3f0', light: '#c9ecfb', dark: '#4f93b3', face: '#ffffff', shadow: '#3f7a96' },
  block: { body: '#b3adc9', light: '#dcd8ea', dark: '#736d8c', face: '#948eab', shadow: '#5e5977' },
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
  titleShadow: '#8a5a8f',
  button: peach.base,
  buttonEdge: peach.edge,
  buttonInk: peach.ink,
  buttonHotEdge: butter.edge,
  buttonOff: '#6a6490',
  buttonOffEdge: '#4f4a72',
  buttonOffInk: dusk.plum,
  ring: dusk.deep,
  beamHalo: '#9dffc41f',
  overlay: '#1f1b33b8',
  field: dusk.night,
  warn: coral.base,
  win: mint.glow,
  winGlow: '#9dffc4b3',
  winShade: mint.shade,
};

export function applyCssPalette(root: HTMLElement): void {
  for (const [key, value] of Object.entries(UI)) {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
  }
  root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', UI.bg);
}
