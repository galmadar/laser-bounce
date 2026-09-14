import type { Pos } from '../sim/types';

/** Everything is drawn at this tiny size and scaled up with hard pixel edges. */
export const CELL = 16;
export const BOARD_CELLS = 10;
export const MARGIN = 8;
export const BOARD_PX = CELL * BOARD_CELLS;

export const TRAY_Y = MARGIN + BOARD_PX + 6;
export const TRAY_H = 34;
export const SLOT_W = 40;
export const SLOT_H = 26;
export const SLOT_GAP = 6;

export const CANVAS_W = BOARD_PX + MARGIN * 2;
export const CANVAS_H = TRAY_Y + TRAY_H + MARGIN;

export function cellOrigin(x: number, y: number): Pos {
  return { x: MARGIN + x * CELL, y: MARGIN + y * CELL };
}

/** Board units (cell centre = x + 0.5) to canvas pixels. */
export function boardToPx(v: number): number {
  return MARGIN + v * CELL;
}

export function cellAt(px: number, py: number): Pos | null {
  const x = Math.floor((px - MARGIN) / CELL);
  const y = Math.floor((py - MARGIN) / CELL);
  if (x < 0 || y < 0 || x >= BOARD_CELLS || y >= BOARD_CELLS) return null;
  return { x, y };
}

export function slotRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: MARGIN + 4 + i * (SLOT_W + SLOT_GAP), y: TRAY_Y + 4, w: SLOT_W, h: SLOT_H };
}

export function slotAt(px: number, py: number, slotCount: number): number | null {
  for (let i = 0; i < slotCount; i++) {
    const r = slotRect(i);
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
  }
  return null;
}

export function inTray(px: number, py: number): boolean {
  return py >= TRAY_Y && py < TRAY_Y + TRAY_H && px >= MARGIN && px < MARGIN + BOARD_PX;
}
