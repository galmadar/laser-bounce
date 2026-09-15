import type { Puzzle } from '../sim/Puzzle';
import type { SolutionOverlay } from '../sim/solution';
import type { Dir, PieceKind, Pos, Turn } from '../sim/types';
import { BOARD_PX, CANVAS_H, CANVAS_W, CELL, MARGIN, TRAY_H, TRAY_Y, boardToPx, cellAt, cellOrigin, slotRect } from './layout';
import { BOARD as PAL, PIECES, applyCssPalette } from './palette';

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
  solution: SolutionOverlay | null;
}

const SHAKE_MS = 320;
const DIR_V: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Draws in layout units (a cell is 16) scaled to the canvas's real device pixels,
 * so hit-testing in layout.ts stays the same at any size.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private font: string;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2D canvas');
    this.ctx = ctx;
    const root = canvas.ownerDocument.documentElement;
    // Page CSS reads its colours from the same palette as the canvas.
    applyCssPalette(root);
    this.font = getComputedStyle(root).getPropertyValue('--font').trim() || 'system-ui, sans-serif';
    // Canvas text switches to the web font once it loads; every frame redraws anyway.
    canvas.ownerDocument.fonts.load(`800 16px ${this.font}`).catch(() => undefined);
  }

  draw(v: ViewState, now: number): void {
    const { ctx } = this;
    const p = v.puzzle;
    const beam = p.beam();
    this.fitBacking();
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const sinceWin = v.wonAt === null ? null : now - v.wonAt;
    this.boardBase(sinceWin);

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

    if (v.solution) this.solution(v.solution, now);

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

    for (const s of beam.stops) this.spark(boardToPx(s.x), boardToPx(s.y), now);

    this.tray(v, now);

    if (v.drag) {
      this.piece(v.drag.px - 8, v.drag.py - 8, v.drag.kind, v.drag.turn, false, 0.95, true);
    }
  }

  /** Match the backing store to the element's CSS size times devicePixelRatio. */
  private fitBacking(): void {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round((c.clientWidth || CANVAS_W) * dpr));
    const h = Math.max(1, Math.round((c.clientHeight || CANVAS_H) * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    this.scale = w / CANVAS_W;
    this.ctx.setTransform(w / CANVAS_W, 0, 0, h / CANVAS_H, 0, 0);
  }

  /** Canvas shadows ignore the transform, so blur and offset are scaled by hand. */
  private shadow(color: string, blur: number, dy = 0): void {
    const { ctx } = this;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * this.scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = dy * this.scale;
  }

  private noShadow(): void {
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;
  }

  private rrect(x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient): void {
    const { ctx } = this;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  private circle(cx: number, cy: number, r: number, fill: string): void {
    const { ctx } = this;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private vGradient(y0: number, y1: number, top: string, bottom: string): CanvasGradient {
    const g = this.ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    return g;
  }

  private text(s: string, cx: number, cy: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
    const { ctx } = this;
    ctx.font = `800 ${size}px ${this.font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    // Centre on the glyph's real ink, not the font's line box.
    const m = ctx.measureText(s);
    ctx.fillText(s, cx, cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  }

  private boardBase(sinceWin: number | null): void {
    const { ctx } = this;
    const x = MARGIN - 3;
    const s = BOARD_PX + 6;
    this.shadow(PAL.shadow, 8, 2.5);
    this.rrect(x, x, s, s, 7, PAL.boardBase);
    this.noShadow();
    // The rim flashes when the level is won, then stays gold.
    let rim = PAL.boardEdge;
    let width = 0.8;
    if (sinceWin !== null) {
      rim = sinceWin < 1200 && Math.floor(sinceWin / 120) % 2 === 0 ? PAL.beamCore : PAL.gold;
      width = 1.6;
    }
    ctx.strokeStyle = rim;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.roundRect(x + width / 2, x + width / 2, s - width, s - width, 7 - width / 2);
    ctx.stroke();
  }

  private floor(x: number, y: number, even: boolean): void {
    this.rrect(x + 0.5, y + 0.5, CELL - 1, CELL - 1, 2.5, even ? PAL.floorA : PAL.floorB);
  }

  private wall(x: number, y: number): void {
    this.rrect(x + 0.6, y + 0.6, CELL - 1.2, CELL - 1.2, 3, this.vGradient(y, y + CELL, PAL.wallHi, PAL.wall));
    this.rrect(x + 2.5, y + 1.6, CELL - 5, 1, 0.5, PAL.wallShine);
  }

  private beam(segments: readonly { x1: number; y1: number; x2: number; y2: number }[], now: number, won: boolean): void {
    if (segments.length === 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const s of segments) {
      ctx.moveTo(boardToPx(s.x1), boardToPx(s.y1));
      ctx.lineTo(boardToPx(s.x2), boardToPx(s.y2));
    }
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    this.shadow(PAL.beamHalo, won ? 10 : 5 + 2 * pulse);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = PAL.beamGlow;
    ctx.lineWidth = won ? 4.6 : 3.6;
    ctx.stroke();
    this.noShadow();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PAL.beamMid;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = PAL.beamCore;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  private piece(x: number, y: number, kind: PieceKind, turn: Turn, fixed: boolean, alpha: number, lifted = false): void {
    const pal = kind === 'mirror' ? (fixed ? PIECES.mirrorFixed : PIECES.mirror) : PIECES[kind];
    const { ctx } = this;
    const glass = kind === 'splitter';
    ctx.save();
    ctx.globalAlpha = alpha;

    // Body: a soft rounded tile. Glass lets the board and beam show through.
    if (!glass) this.shadow(PAL.pieceShadow, lifted ? 5 : 1.8, lifted ? 2.5 : 0.8);
    ctx.globalAlpha = glass ? alpha * 0.6 : alpha;
    this.rrect(x + 1.5, y + 1.5, 13, 13, 3.5, this.vGradient(y + 1.5, y + 14.5, pal.light, pal.body));
    this.noShadow();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = glass ? 0.9 : 0.6;
    ctx.strokeStyle = glass ? pal.light : pal.dark;
    ctx.stroke();

    if (kind === 'block') {
      this.rrect(x + 4.5, y + 4.5, 7, 7, 1.8, this.vGradient(y + 4.5, y + 11.5, pal.face, pal.light));
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = pal.shadow;
      ctx.stroke();
    } else {
      const [ax, ay, bx, by] = turn === 0 ? [4.5, 11.5, 11.5, 4.5] : [4.5, 4.5, 11.5, 11.5];
      ctx.lineCap = 'round';
      if (glass) {
        this.rrect(x + 3.2, y + 2.8, 5.5, 1.3, 0.65, PAL.glassShine);
      } else {
        ctx.strokeStyle = pal.shadow;
        ctx.lineWidth = 2.8;
        this.line(x + ax, y + ay + 0.7, x + bx, y + by + 0.7);
      }
      ctx.strokeStyle = pal.face;
      ctx.lineWidth = 2.2;
      if (glass) ctx.setLineDash([2.4, 1.5]);
      this.line(x + ax, y + ay, x + bx, y + by);
      ctx.setLineDash([]);
      if (fixed) {
        // Fixed mirrors: an inset ring and two pins in the corners the bar leaves free.
        ctx.strokeStyle = pal.dark;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, 10, 10, 2);
        ctx.stroke();
        const pins = turn === 0 ? [[5, 5], [11, 11]] : [[11, 5], [5, 11]];
        for (const [px, py] of pins) {
          this.circle(x + px, y + py, 1.05, pal.dark);
          this.circle(x + px - 0.3, y + py - 0.3, 0.4, pal.light);
        }
      }
    }
    ctx.restore();
  }

  private line(x1: number, y1: number, x2: number, y2: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private source(x: number, y: number, dir: Dir, now: number): void {
    const cx = x + 8;
    const cy = y + 8;
    const [vx, vy] = DIR_V[dir];
    this.rrect(cx + vx * 5 - 2.5, cy + vy * 5 - 2.5, 5, 5, 1.4, PAL.laserLo);
    this.shadow(PAL.pieceShadow, 1.8, 0.8);
    this.rrect(x + 2.5, y + 2.5, 11, 11, 3, this.vGradient(y + 2.5, y + 13.5, PAL.laserHi, PAL.laserBody));
    this.noShadow();
    const pulse = 0.5 + 0.5 * Math.sin(now / 200);
    this.circle(cx, cy, 3, PAL.laserLens);
    this.shadow(PAL.beamHalo, 2 + 3 * pulse);
    this.circle(cx, cy, 1.7, PAL.beamGlow);
    this.noShadow();
    this.circle(cx, cy, 0.7, PAL.beamCore);
  }

  private target(x: number, y: number, index: number, state: 'lit' | 'wrong' | 'next' | 'idle', now: number, sinceWin: number | null): void {
    const { ctx } = this;
    const cx = x + 8;
    const cy = y + 8;
    const pulse = 0.5 + 0.5 * Math.sin(now / 150);
    let ring: string;
    let fill: string;
    let letter: string;
    let glow: string | null = null;
    let glowBlur = 4;
    switch (state) {
      case 'lit':
        ring = PAL.goldPale;
        fill = PAL.gold;
        letter = PAL.goldInk;
        glow = PAL.goldGlow;
        break;
      case 'wrong':
        ring = PAL.red;
        fill = PAL.redFill;
        letter = PAL.redInk;
        glow = PAL.redGlow;
        glowBlur = 2 + 5 * pulse;
        break;
      case 'next':
        ring = PAL.gold;
        fill = PAL.plate;
        letter = PAL.gold;
        break;
      default:
        ring = PAL.goldDim;
        fill = PAL.plate;
        letter = PAL.stopIdleInk;
    }

    if (glow) this.shadow(glow, glowBlur);
    else this.shadow(PAL.pieceShadow, 1.5, 0.6);
    this.circle(cx, cy, 6.2, fill);
    this.noShadow();
    ctx.strokeStyle = ring;
    ctx.lineWidth = state === 'wrong' ? 1.4 : 1.1;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.65, 0, Math.PI * 2);
    ctx.stroke();
    if (state === 'next') {
      // A ring that breathes outward: "this one next".
      ctx.globalAlpha = 0.85 * (1 - pulse);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 6.6 + 1.2 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    this.text(String.fromCharCode(65 + index), cx, cy, 7.5, letter);

    if (sinceWin !== null && sinceWin < 900) {
      const r = 4 + sinceWin / 60;
      ctx.globalAlpha = 1 - sinceWin / 900;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.9, PAL.goldPale);
      }
      ctx.globalAlpha = 1;
    }
  }

  private spark(px: number, py: number, now: number): void {
    const r = 1.3 + 0.35 * Math.sin(now / 70);
    this.shadow(PAL.beamHalo, 4);
    this.circle(px, py, r, PAL.beamMid);
    this.noShadow();
    this.circle(px, py, r * 0.5, PAL.beamCore);
  }

  /** Faint pieces where the solution puts them, angle hints on fixed mirrors, and the solved route as flowing dots. */
  private solution(s: SolutionOverlay, now: number): void {
    const { ctx } = this;
    const breathe = 0.5 + 0.5 * Math.sin(now / 400);

    for (const pl of s.place) {
      const o = cellOrigin(pl.at.x, pl.at.y);
      this.piece(o.x, o.y, pl.kind, pl.turn, false, 0.38 + 0.12 * breathe);
      ctx.save();
      ctx.strokeStyle = PAL.solutionGhost;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([1.6, 1.2]);
      ctx.beginPath();
      ctx.roundRect(o.x + 1, o.y + 1, CELL - 2, CELL - 2, 3.5);
      ctx.stroke();
      ctx.restore();
    }

    for (const t of s.turn) {
      const o = cellOrigin(t.at.x, t.at.y);
      const [ax, ay, bx, by] = t.turn === 0 ? [3.5, 12.5, 12.5, 3.5] : [3.5, 3.5, 12.5, 12.5];
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.7 + 0.3 * breathe;
      ctx.strokeStyle = PAL.solutionGhost;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([1.8, 1.4]);
      this.line(o.x + ax, o.y + ay, o.x + bx, o.y + by);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // Corner badge with a turn arrow: "turn this one".
      const cx = o.x + 13;
      const cy = o.y + 3;
      const r = 1.5;
      const end = Math.PI * 1.3;
      this.circle(cx, cy, 2.9, PAL.solutionGhost);
      ctx.strokeStyle = PAL.solutionBadgeInk;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.2, end);
      ctx.stroke();
      const ex = cx + Math.cos(end) * r;
      const ey = cy + Math.sin(end) * r;
      const [tx, ty] = [-Math.sin(end), Math.cos(end)];
      const [nx, ny] = [Math.cos(end), Math.sin(end)];
      ctx.fillStyle = PAL.solutionBadgeInk;
      ctx.beginPath();
      ctx.moveTo(ex + tx * 1, ey + ty * 1);
      ctx.lineTo(ex + nx * 0.8, ey + ny * 0.8);
      ctx.lineTo(ex - nx * 0.8, ey - ny * 0.8);
      ctx.fill();
      ctx.restore();
    }

    if (s.path.length === 0) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = PAL.solutionPath;
    ctx.lineWidth = 1.5;
    // Round-capped tiny dashes are dots; the offset makes them flow away from the laser.
    ctx.setLineDash([0.01, 3.2]);
    ctx.lineDashOffset = -now / 80;
    this.shadow(PAL.solutionPathGlow, 2);
    ctx.beginPath();
    for (const seg of s.path) {
      ctx.moveTo(boardToPx(seg.x1), boardToPx(seg.y1));
      ctx.lineTo(boardToPx(seg.x2), boardToPx(seg.y2));
    }
    ctx.stroke();
    ctx.restore();
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
    const { ctx } = this;
    const p = v.puzzle;
    const returning = v.drag?.from != null;
    const pulse = 0.5 + 0.5 * Math.sin(now / 110);
    const x0 = MARGIN - 3;
    this.shadow(PAL.shadow, 6, 2);
    this.rrect(x0, TRAY_Y - 1, BOARD_PX + 6, TRAY_H + 2, 7, PAL.tray);
    this.noShadow();
    ctx.lineWidth = returning ? 1.4 : 0.8;
    ctx.strokeStyle = returning ? PAL.gold : PAL.boardEdge;
    ctx.globalAlpha = returning ? 0.5 + 0.5 * pulse : 1;
    ctx.beginPath();
    ctx.roundRect(x0 + 0.5, TRAY_Y - 0.5, BOARD_PX + 5, TRAY_H + 1, 6.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    p.slots.forEach((kind, i) => {
      const r = slotRect(i);
      const count = p.trayCount(kind);
      const picked = v.picked === i;
      const x = r.x + (v.shake?.slot === i ? shakeOffset(v.shake, now) : 0);
      if (picked) this.shadow(PAL.goldGlow, 3 + 3 * pulse);
      this.rrect(x, r.y, r.w, r.h, 4.5, PAL.slot);
      this.noShadow();
      ctx.lineWidth = picked ? 1.3 : 0.8;
      ctx.strokeStyle = picked ? PAL.gold : PAL.slotEdge;
      ctx.beginPath();
      ctx.roundRect(x + ctx.lineWidth / 2, r.y + ctx.lineWidth / 2, r.w - ctx.lineWidth, r.h - ctx.lineWidth, 4.5);
      ctx.stroke();

      const dim = count > 0 ? 1 : 0.35;
      this.piece(x + 7, r.y + 5, kind, 0, false, dim);
      ctx.globalAlpha = dim;
      this.text(`×${count}`, x + r.w - 3.5, r.y + r.h / 2, 7.5, PAL.goldPale, 'right');
      ctx.globalAlpha = 1;
      // Number badge: the key that picks this slot.
      this.circle(x + 4, r.y + 4, 3.1, picked ? PAL.gold : PAL.slotEdge);
      this.text(String(i + 1), x + 4, r.y + 4, 4.4, picked ? PAL.goldInk : PAL.goldPale);
    });
  }
}

function shakeOffset(s: Shake, now: number): number {
  const t = now - s.start;
  if (t < 0 || t > SHAKE_MS) return 0;
  return Math.sin(t / 22) * 2 * (1 - t / SHAKE_MS);
}
