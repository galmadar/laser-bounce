import type { Puzzle } from '../sim/Puzzle';
import type { Dir, PieceKind, Pos, Turn } from '../sim/types';
import { BOARD_PX, CANVAS_H, CANVAS_W, CELL, MARGIN, TRAY_H, TRAY_Y, boardToPx, cellAt, cellOrigin, slotRect } from './layout';
import { drawText, textWidth } from './pixelFont';

export interface DragView {
  kind: PieceKind;
  turn: Turn;
  px: number;
  py: number;
  /** null when it came from the tray. */
  from: Pos | null;
}

export interface Shake {
  cell?: Pos;
  slot?: number;
  start: number;
}

export interface ViewState {
  puzzle: Puzzle;
  picked: number | null;
  hoverCell: Pos | null;
  drag: DragView | null;
  shake: Shake | null;
  wonAt: number | null;
}

interface PiecePalette {
  body: string;
  light: string;
  dark: string;
  face: string;
  shadow: string;
}

const PAL = {
  bg: '#0d1020',
  frame: '#3d4d80',
  frameDark: '#070914',
  floorA: '#2a3864',
  floorB: '#27345e',
  floorHi: '#34467a',
  floorLo: '#1b2547',
  wall: '#141a31',
  wallMortar: '#0a0d1c',
  wallHi: '#232c50',
  outline: '#0a0c16',
  beamGlow: '#2cff6e',
  beamMid: '#8dffa9',
  beamCore: '#f4fff6',
  gold: '#ffd23f',
  goldDim: '#8a7430',
  goldPale: '#fff3b0',
  red: '#ff4d6d',
  redDark: '#6a1428',
  plate: '#171e3c',
  tray: '#131831',
  slot: '#0e1226',
  slotEdge: '#2c3558',
};

const PIECES: Record<'mirror' | 'mirrorFixed' | 'splitter' | 'block', PiecePalette> = {
  mirror: { body: '#e8801f', light: '#ffb34f', dark: '#8f420b', face: '#fff0cc', shadow: '#a84d0c' },
  mirrorFixed: { body: '#c9661a', light: '#ee9640', dark: '#6f3008', face: '#ffe2ad', shadow: '#843a08' },
  splitter: { body: '#2a8aa3', light: '#7ae0f0', dark: '#134656', face: '#effdff', shadow: '#1b5f72' },
  block: { body: '#7c859d', light: '#c1c8d9', dark: '#3e4458', face: '#5a627a', shadow: '#2e3345' },
};

const SHAKE_MS = 320;
const NOZZLE: readonly (readonly [number, number])[] = [
  [6, 0],
  [12, 6],
  [6, 12],
  [0, 6],
];

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2D canvas');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
  }

  draw(v: ViewState, now: number): void {
    const { ctx } = this;
    const p = v.puzzle;
    const beam = p.beam();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Frame flashes when the level is won.
    const sinceWin = v.wonAt === null ? null : now - v.wonAt;
    const frame = sinceWin === null ? PAL.frame : sinceWin < 1200 && Math.floor(sinceWin / 120) % 2 === 0 ? PAL.beamCore : PAL.gold;
    this.rect(MARGIN - 3, MARGIN - 3, BOARD_PX + 6, BOARD_PX + 6, frame);
    this.rect(MARGIN - 1, MARGIN - 1, BOARD_PX + 2, BOARD_PX + 2, PAL.frameDark);

    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        const o = cellOrigin(x, y);
        if (p.tileAt(x, y).kind === 'wall') this.wall(o.x, o.y);
        else this.floor(o.x, o.y, (x + y) % 2 === 0);
      }
    }

    this.beam(beam.segments, now, v.wonAt !== null);

    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        const piece = p.pieceAt(x, y);
        if (!piece) continue;
        const o = cellOrigin(x, y);
        const lifted = v.drag?.from && v.drag.from.x === x && v.drag.from.y === y;
        const dx = v.shake?.cell && v.shake.cell.x === x && v.shake.cell.y === y ? shakeOffset(v.shake, now) : 0;
        this.piece(o.x + dx, o.y, piece.kind, piece.turn, piece.fixed, lifted ? 0.35 : 1);
      }
    }

    const next = beam.lit.indexOf(false);
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        const tile = p.tileAt(x, y);
        const o = cellOrigin(x, y);
        if (tile.kind === 'source') this.source(o.x, o.y, tile.dir, now);
        if (tile.kind === 'target') {
          const state = beam.lit[tile.index] ? 'lit' : beam.wrong[tile.index] ? 'wrong' : tile.index === next ? 'next' : 'idle';
          this.target(o.x, o.y, tile.index, state, now, sinceWin);
        }
      }
    }

    this.ghost(v);

    for (const s of beam.stops) this.spark(Math.round(boardToPx(s.x)), Math.round(boardToPx(s.y)), now);

    this.tray(v, now);

    if (v.drag) {
      this.piece(Math.round(v.drag.px) - 8, Math.round(v.drag.py) - 8, v.drag.kind, v.drag.turn, false, 0.9);
    }
  }

  private rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  private floor(x: number, y: number, even: boolean): void {
    this.rect(x, y, CELL, CELL, even ? PAL.floorA : PAL.floorB);
    this.rect(x, y, CELL, 1, PAL.floorHi);
    this.rect(x, y, 1, CELL, PAL.floorHi);
    this.rect(x, y + CELL - 1, CELL, 1, PAL.floorLo);
    this.rect(x + CELL - 1, y, 1, CELL, PAL.floorLo);
  }

  private wall(x: number, y: number): void {
    this.rect(x, y, CELL, CELL, PAL.wall);
    for (const my of [5, 10, 15]) this.rect(x, y + my, CELL, 1, PAL.wallMortar);
    for (const [bx, by, h] of [[7, 0, 5], [3, 6, 4], [11, 6, 4], [7, 11, 4]] as const) this.rect(x + bx, y + by, 1, h, PAL.wallMortar);
    for (const [hx, hy] of [[0, 0], [8, 0], [0, 6], [4, 6], [12, 6], [0, 11], [8, 11]] as const) this.rect(x + hx, y + hy, 3, 1, PAL.wallHi);
  }

  private beam(segments: readonly { x1: number; y1: number; x2: number; y2: number }[], now: number, won: boolean): void {
    const { ctx } = this;
    const flicker = 0.24 + 0.08 * Math.sin(now / 60);
    const layers: [number, string, number][] = won
      ? [[4, PAL.beamGlow, 0.3 + flicker], [2, PAL.beamMid, 0.9], [1, PAL.beamCore, 1]]
      : [[3, PAL.beamGlow, flicker], [2, PAL.beamGlow, 0.6], [1, PAL.beamCore, 1]];
    for (const [half, color, alpha] of layers) {
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = color;
      for (const s of segments) {
        const x1 = boardToPx(Math.min(s.x1, s.x2));
        const x2 = boardToPx(Math.max(s.x1, s.x2));
        const y1 = boardToPx(Math.min(s.y1, s.y2));
        const y2 = boardToPx(Math.max(s.y1, s.y2));
        ctx.fillRect(Math.round(x1) - half, Math.round(y1) - half, Math.round(x2 - x1) + half * 2, Math.round(y2 - y1) + half * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  private piece(x: number, y: number, kind: PieceKind, turn: Turn, fixed: boolean, alpha: number): void {
    const pal = kind === 'mirror' ? (fixed ? PIECES.mirrorFixed : PIECES.mirror) : PIECES[kind];
    this.ctx.globalAlpha = alpha;
    this.rect(x + 1, y + 1, 14, 14, PAL.outline);
    this.rect(x + 2, y + 2, 12, 12, pal.body);
    this.rect(x + 2, y + 2, 12, 2, pal.light);
    this.rect(x + 2, y + 2, 2, 12, pal.light);
    this.rect(x + 2, y + 12, 12, 2, pal.dark);
    this.rect(x + 12, y + 2, 2, 12, pal.dark);

    if (kind === 'block') {
      this.rect(x + 5, y + 5, 6, 6, pal.face);
      this.rect(x + 5, y + 5, 6, 1, pal.shadow);
      this.rect(x + 5, y + 5, 1, 6, pal.shadow);
      this.rect(x + 6, y + 10, 5, 1, pal.light);
      this.rect(x + 10, y + 6, 1, 5, pal.light);
    } else {
      // The light face runs corner to corner, with a dark lip on one side.
      for (let i = 0; i < 10; i++) {
        const sx = x + 3 + i;
        const sy = turn === 0 ? y + 11 - i : y + 2 + i;
        this.rect(sx + 1, sy + (turn === 0 ? 1 : -1), 2, 2, pal.shadow);
      }
      for (let i = 0; i < 10; i++) {
        const sx = x + 3 + i;
        const sy = turn === 0 ? y + 11 - i : y + 2 + i;
        const dashed = kind === 'splitter' && i % 3 === 2;
        this.rect(sx, sy, 2, 2, dashed ? pal.light : pal.face);
      }
      if (fixed) {
        const rivets = turn === 0 ? [[4, 4], [10, 10]] : [[10, 4], [4, 10]];
        for (const [rx, ry] of rivets) {
          this.rect(x + rx, y + ry, 2, 2, pal.dark);
          this.rect(x + rx, y + ry, 1, 1, pal.light);
        }
      }
    }
    this.ctx.globalAlpha = 1;
  }

  private source(x: number, y: number, dir: Dir, now: number): void {
    this.rect(x + 2, y + 2, 12, 12, PAL.outline);
    this.rect(x + 3, y + 3, 10, 10, '#4a5270');
    this.rect(x + 3, y + 3, 10, 1, '#8a93b0');
    this.rect(x + 3, y + 3, 1, 10, '#8a93b0');
    this.rect(x + 3, y + 12, 10, 1, '#262b40');
    this.rect(x + 12, y + 3, 1, 10, '#262b40');
    const [nx, ny] = NOZZLE[dir];
    this.rect(x + nx, y + ny, 4, 4, '#262b40');
    const hot = Math.floor(now / 180) % 2 === 0;
    this.rect(x + nx + 1, y + ny + 1, 2, 2, hot ? PAL.beamCore : PAL.beamGlow);
    this.rect(x + 6, y + 6, 4, 4, '#1a1f30');
    this.rect(x + 7, y + 7, 2, 2, hot ? PAL.beamGlow : PAL.beamMid);
  }

  private target(x: number, y: number, index: number, state: 'lit' | 'wrong' | 'next' | 'idle', now: number, sinceWin: number | null): void {
    const blink = Math.floor(now / 250) % 2 === 0;
    let ring: string;
    let fill: string;
    let letter: string;
    switch (state) {
      case 'lit':
        ring = PAL.goldPale;
        fill = PAL.gold;
        letter = '#3a2600';
        break;
      case 'wrong':
        ring = blink ? PAL.red : PAL.redDark;
        fill = '#3a0c1a';
        letter = PAL.red;
        break;
      case 'next':
        ring = blink ? PAL.gold : PAL.goldDim;
        fill = PAL.plate;
        letter = PAL.gold;
        break;
      default:
        ring = PAL.goldDim;
        fill = PAL.plate;
        letter = '#c9b46a';
    }
    if (state === 'lit') {
      this.ctx.globalAlpha = 0.35;
      this.rect(x, y, CELL, CELL, PAL.gold);
      this.ctx.globalAlpha = 1;
    }
    // A chunky pixel ring: a square with its corners knocked in.
    this.rect(x + 3, y + 2, 10, 12, PAL.outline);
    this.rect(x + 2, y + 3, 12, 10, PAL.outline);
    this.rect(x + 4, y + 2, 8, 1, ring);
    this.rect(x + 4, y + 13, 8, 1, ring);
    this.rect(x + 2, y + 4, 1, 8, ring);
    this.rect(x + 13, y + 4, 1, 8, ring);
    for (const [cx, cy] of [[3, 3], [12, 3], [3, 12], [12, 12]] as const) this.rect(x + cx, y + cy, 1, 1, ring);
    this.rect(x + 4, y + 3, 8, 10, fill);
    this.rect(x + 3, y + 4, 10, 8, fill);
    const ch = String.fromCharCode(65 + index);
    drawText(this.ctx, ch, x + 5, y + 3, 2, letter);

    if (sinceWin !== null && sinceWin < 900) {
      const r = 3 + Math.floor(sinceWin / 60);
      this.ctx.globalAlpha = 1 - sinceWin / 900;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        this.rect(x + 7 + dx * r, y + 7 + dy * r, 2, 2, PAL.goldPale);
      }
      this.ctx.globalAlpha = 1;
    }
  }

  private spark(px: number, py: number, now: number): void {
    const f = Math.floor(now / 90) % 3;
    this.rect(px - 1, py - 1, 2, 2, PAL.beamCore);
    const d = 2 + f;
    this.ctx.globalAlpha = 0.8;
    this.rect(px - 1 - d, py - 1, 1, 1, PAL.beamMid);
    this.rect(px + d, py, 1, 1, PAL.beamMid);
    this.rect(px, py - 1 - d, 1, 1, PAL.beamMid);
    this.rect(px - 1, py + d, 1, 1, PAL.beamMid);
    this.ctx.globalAlpha = 1;
  }

  private ghost(v: ViewState): void {
    const p = v.puzzle;
    let kind: PieceKind | null = null;
    let turn: Turn = 0;
    let cell: Pos | null = null;
    if (v.drag) {
      kind = v.drag.kind;
      turn = v.drag.turn;
      cell = cellAt(v.drag.px, v.drag.py);
    } else if (v.picked !== null && v.hoverCell) {
      const k = p.slots[v.picked];
      if (k && p.trayCount(k) > 0) {
        kind = k;
        cell = v.hoverCell;
      }
    }
    if (!kind || !cell || !p.isOpen(cell.x, cell.y)) return;
    const o = cellOrigin(cell.x, cell.y);
    this.piece(o.x, o.y, kind, turn, false, 0.45);
  }

  private tray(v: ViewState, now: number): void {
    const p = v.puzzle;
    const returning = v.drag?.from != null;
    const blink = Math.floor(now / 200) % 2 === 0;
    this.rect(MARGIN - 1, TRAY_Y - 1, BOARD_PX + 2, TRAY_H + 2, returning && blink ? PAL.gold : PAL.frame);
    this.rect(MARGIN, TRAY_Y, BOARD_PX, TRAY_H, PAL.tray);

    p.slots.forEach((kind, i) => {
      const r = slotRect(i);
      const count = p.trayCount(kind);
      const picked = v.picked === i;
      const dx = v.shake?.slot === i ? shakeOffset(v.shake, now) : 0;
      const x = r.x + dx;
      this.rect(x, r.y, r.w, r.h, picked ? (blink ? PAL.gold : PAL.goldPale) : PAL.slotEdge);
      this.rect(x + 2, r.y + 2, r.w - 4, r.h - 4, PAL.slot);
      // Number tag: the key that picks this slot.
      this.rect(x, r.y, 6, 8, picked ? PAL.gold : PAL.slotEdge);
      drawText(this.ctx, String(i + 1), x + 1, r.y + 1, 1, picked ? '#1a1200' : PAL.goldPale);
      this.ctx.globalAlpha = count > 0 ? 1 : 0.3;
      this.piece(x + 6, r.y + 5, kind, 0, false, count > 0 ? 1 : 0.3);
      this.ctx.globalAlpha = count > 0 ? 1 : 0.3;
      const label = `x${count}`;
      drawText(this.ctx, label, x + r.w - 3 - textWidth(label, 2), r.y + 8, 2, PAL.goldPale);
      this.ctx.globalAlpha = 1;
    });
  }
}

function shakeOffset(s: Shake, now: number): number {
  const t = now - s.start;
  if (t < 0 || t > SHAKE_MS) return 0;
  return Math.round(Math.sin(t / 22) * 2 * (1 - t / SHAKE_MS));
}
