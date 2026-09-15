import type { DragSource, PointerHandlers } from '../input/PointerInput';
import type { DragView, Shake, ViewState } from '../render/Renderer';
import { Puzzle } from '../sim/Puzzle';
import { solutionOverlay, type SolutionOverlay } from '../sim/solution';
import type { LevelDef, PieceKind, Pos } from '../sim/types';

export type GameEvent = 'changed' | 'won' | 'no';

/** One level being played: the puzzle plus what the hand is doing (picked piece, drag, hover). */
export class Game implements ViewState, PointerHandlers {
  readonly puzzle: Puzzle;
  picked: number | null = null;
  hoverCell: Pos | null = null;
  drag: DragView | null = null;
  shake: Shake | null = null;
  wonAt: number | null = null;
  locked = false;
  /** The solution overlay is up. It stays while the player keeps playing. */
  showSolution = false;

  constructor(
    level: LevelDef,
    private readonly emit: (e: GameEvent) => void,
  ) {
    this.puzzle = new Puzzle(level);
  }

  get solution(): SolutionOverlay | null {
    return this.showSolution ? solutionOverlay(this.puzzle) : null;
  }

  setSolution(show: boolean): void {
    this.showSolution = show;
    this.emit('changed');
  }

  /** Puts the whole solution on the board as one undo step. */
  applySolution(): void {
    this.showSolution = false;
    this.picked = null;
    this.drag = null;
    if (this.puzzle.applySolution()) this.changed();
    else this.emit('changed');
  }

  /** Won with the overlay up, or by "solve it for me". */
  wonWithHelp(): boolean {
    const h = this.puzzle.history();
    return this.showSolution || h[h.length - 1]?.type === 'solution';
  }

  enabled(): boolean {
    return !this.locked;
  }

  slotCount(): number {
    return this.puzzle.slots.length;
  }

  /** 0-based. Picking the same slot again puts it down. */
  pick(slot: number): void {
    const kind = this.puzzle.slots[slot];
    if (!kind) return this.no({ slot: -1 });
    if (this.puzzle.trayCount(kind) <= 0) return this.no({ slot });
    this.picked = this.picked === slot ? null : slot;
    this.emit('changed');
  }

  dropPick(): void {
    this.picked = null;
    this.emit('changed');
  }

  hover(cell: Pos | null): void {
    this.hoverCell = cell;
  }

  tapSlot(slot: number): void {
    this.pick(slot);
  }

  tapCell(c: Pos): void {
    const p = this.puzzle;
    const piece = p.pieceAt(c.x, c.y);
    if (piece) {
      if (p.turn(c.x, c.y)) this.changed();
      else this.no({ cell: c });
      return;
    }
    const kind = this.pickedKind();
    if (!kind || !p.isOpen(c.x, c.y)) return;
    if (p.place(kind, c.x, c.y)) {
      if (p.trayCount(kind) === 0) this.picked = null;
      this.changed();
    } else {
      this.no({ slot: this.picked ?? -1 });
    }
  }

  secondary(c: Pos): void {
    const result = this.puzzle.remove(c.x, c.y);
    if (result === 'fixed') this.no({ cell: c });
    else if (result === 'removed') this.changed();
  }

  dragStart(from: DragSource, px: number, py: number): boolean {
    const p = this.puzzle;
    if ('slot' in from) {
      const kind = p.slots[from.slot];
      if (!kind || p.trayCount(kind) <= 0) {
        this.no({ slot: from.slot });
        return false;
      }
      this.drag = { kind, turn: 0, px, py, from: null };
      return true;
    }
    const piece = p.pieceAt(from.cell.x, from.cell.y);
    if (!piece) return false;
    if (piece.fixed) {
      this.no({ cell: from.cell });
      return false;
    }
    this.drag = { kind: piece.kind, turn: piece.turn, px, py, from: from.cell };
    return true;
  }

  dragMove(px: number, py: number, cell: Pos | null): void {
    if (!this.drag) return;
    this.drag.px = px;
    this.drag.py = py;
    this.hoverCell = cell;
  }

  dragEnd(cell: Pos | null, overTray: boolean): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const p = this.puzzle;
    if (d.from === null) {
      if (cell && p.place(d.kind, cell.x, cell.y, d.turn)) {
        if (this.picked !== null && p.trayCount(d.kind) === 0 && p.slots[this.picked] === d.kind) this.picked = null;
        this.changed();
      }
    } else if (overTray) {
      if (p.remove(d.from.x, d.from.y) === 'removed') this.changed();
    } else if (cell && (cell.x !== d.from.x || cell.y !== d.from.y) && p.move(d.from, cell)) {
      this.changed();
    }
  }

  dragCancel(): void {
    this.drag = null;
  }

  undo(): void {
    if (this.puzzle.undo()) this.changed();
    else this.no({});
  }

  redo(): void {
    if (this.puzzle.redo()) this.changed();
    else this.no({});
  }

  restart(): void {
    this.puzzle.restart();
    this.picked = null;
    this.drag = null;
    this.changed();
  }

  private pickedKind(): PieceKind | null {
    return this.picked === null ? null : (this.puzzle.slots[this.picked] ?? null);
  }

  private changed(): void {
    const won = this.puzzle.won;
    if (won && this.wonAt === null) {
      this.wonAt = performance.now();
      this.emit('won');
    } else if (!won) {
      this.wonAt = null;
    }
    this.emit('changed');
  }

  private no(target: Omit<Shake, 'start'>): void {
    this.shake = { ...target, start: performance.now() };
    this.emit('no');
  }
}
