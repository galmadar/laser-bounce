import { CANVAS_H, CANVAS_W, cellAt, inTray, slotAt } from '../render/layout';
import type { Pos } from '../sim/types';

export type DragSource = { cell: Pos } | { slot: number };

/** What the board needs to hear from mouse, pen and touch, already sorted into taps, drags and deletes. */
export interface PointerHandlers {
  enabled(): boolean;
  slotCount(): number;
  hover(cell: Pos | null): void;
  tapCell(cell: Pos): void;
  tapSlot(slot: number): void;
  /** Right click, or a long press on touch. */
  secondary(cell: Pos): void;
  /** Return false to refuse (nothing to drag, or a fixed piece). */
  dragStart(from: DragSource, px: number, py: number): boolean;
  dragMove(px: number, py: number, cell: Pos | null): void;
  dragEnd(cell: Pos | null, overTray: boolean): void;
  dragCancel(): void;
}

/** In CSS pixels, so a shaky finger still counts as a tap at any board size. */
const DRAG_THRESHOLD = 8;
const LONG_PRESS_MS = 450;

interface Press {
  id: number;
  startX: number;
  startY: number;
  source: DragSource | null;
  cell: Pos | null;
  dragging: boolean;
  /** Already used up (long press fired, or a refused drag). */
  consumed: boolean;
  timer: number | null;
}

export class PointerInput {
  private press: Press | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly h: PointerHandlers,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onCancel(e));
    canvas.addEventListener('pointerleave', (e) => {
      if (!this.press && e.pointerType === 'mouse') h.hover(null);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private toCanvas(e: PointerEvent): { px: number; py: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      px: ((e.clientX - r.left) * CANVAS_W) / r.width,
      py: ((e.clientY - r.top) * CANVAS_H) / r.height,
    };
  }

  private onDown(e: PointerEvent): void {
    if (this.press || !this.h.enabled()) return;
    const { px, py } = this.toCanvas(e);
    const cell = cellAt(px, py);
    const slot = slotAt(px, py, this.h.slotCount());

    if (e.pointerType === 'mouse' && e.button === 2) {
      e.preventDefault();
      if (cell) this.h.secondary(cell);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // The pointer can already be gone (a very quick tap); the press still counts.
    }

    const press: Press = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      source: slot !== null ? { slot } : cell ? { cell } : null,
      cell,
      dragging: false,
      consumed: false,
      timer: null,
    };
    if (e.pointerType !== 'mouse' && cell) {
      press.timer = window.setTimeout(() => {
        if (this.press !== press || press.dragging) return;
        press.consumed = true;
        this.h.secondary(cell);
        navigator.vibrate?.(20);
      }, LONG_PRESS_MS);
    }
    this.press = press;
  }

  private onMove(e: PointerEvent): void {
    const { px, py } = this.toCanvas(e);
    const cell = cellAt(px, py);
    const press = this.press;
    if (!press || press.id !== e.pointerId) {
      if (e.pointerType === 'mouse') this.h.hover(cell);
      return;
    }
    if (press.consumed) return;
    if (!press.dragging) {
      if (Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < DRAG_THRESHOLD) return;
      this.clearTimer(press);
      if (press.source && this.h.dragStart(press.source, px, py)) {
        press.dragging = true;
      } else {
        press.consumed = true;
        return;
      }
    }
    this.h.dragMove(px, py, cell);
  }

  private onUp(e: PointerEvent): void {
    const press = this.press;
    if (!press || press.id !== e.pointerId) return;
    this.clearTimer(press);
    this.press = null;
    const { px, py } = this.toCanvas(e);
    if (press.consumed) return;
    if (press.dragging) {
      this.h.dragEnd(cellAt(px, py), inTray(px, py));
    } else if (press.source && 'slot' in press.source) {
      this.h.tapSlot(press.source.slot);
    } else if (press.cell) {
      this.h.tapCell(press.cell);
    }
    if (e.pointerType === 'mouse') this.h.hover(cellAt(px, py));
  }

  private onCancel(e: PointerEvent): void {
    const press = this.press;
    if (!press || press.id !== e.pointerId) return;
    this.clearTimer(press);
    this.press = null;
    if (press.dragging) this.h.dragCancel();
  }

  private clearTimer(press: Press): void {
    if (press.timer !== null) window.clearTimeout(press.timer);
    press.timer = null;
  }
}
