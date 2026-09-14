import { traceBeam, type BeamResult } from './beam';
import { parseLevel, type Board } from './board';
import { PIECE_KINDS, type LevelDef, type Piece, type PieceKind, type Pos, type Turn, type TrayCounts } from './types';

/** Everything the player can do to a board, as plain data so it can be undone, redone and tested. */
export type Move =
  | { type: 'place'; at: Pos; kind: PieceKind; turn: Turn }
  | { type: 'turn'; at: Pos }
  | { type: 'remove'; at: Pos; kind: PieceKind; turn: Turn }
  | { type: 'move'; from: Pos; to: Pos };

export type RemoveResult = 'removed' | 'fixed' | 'empty';

function emptyTray(): TrayCounts {
  return { mirror: 0, splitter: 0, block: 0 };
}

export class Puzzle {
  readonly level: LevelDef;
  /** Piece kinds this level offers, in slot order. Slot 1 is `slots[0]`. */
  readonly slots: readonly PieceKind[];
  private board: Board;
  private trayCounts: TrayCounts;
  private undoStack: Move[] = [];
  private redoStack: Move[] = [];
  private cached: BeamResult | null = null;

  constructor(level: LevelDef) {
    this.level = level;
    this.slots = PIECE_KINDS.filter((k) => (level.tray[k] ?? 0) > 0);
    this.board = parseLevel(level);
    this.trayCounts = { ...emptyTray(), ...level.tray };
  }

  get width(): number {
    return this.board.width;
  }

  get height(): number {
    return this.board.height;
  }

  tileAt(x: number, y: number) {
    return this.board.tiles[y * this.width + x];
  }

  pieceAt(x: number, y: number): Readonly<Piece> | null {
    if (!this.inBounds(x, y)) return null;
    return this.board.pieces[y * this.width + x];
  }

  trayCount(kind: PieceKind): number {
    return this.trayCounts[kind];
  }

  beam(): BeamResult {
    this.cached ??= traceBeam(this.board);
    return this.cached;
  }

  get won(): boolean {
    return this.beam().won;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** An empty floor square, so something can be put there. */
  isOpen(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.tileAt(x, y).kind === 'floor' && this.pieceAt(x, y) === null;
  }

  place(kind: PieceKind, x: number, y: number, turn: Turn = 0): boolean {
    if (!this.isOpen(x, y) || this.trayCounts[kind] <= 0) return false;
    return this.commit({ type: 'place', at: { x, y }, kind, turn });
  }

  turn(x: number, y: number): boolean {
    const piece = this.pieceAt(x, y);
    if (!piece || piece.kind === 'block') return false;
    return this.commit({ type: 'turn', at: { x, y } });
  }

  remove(x: number, y: number): RemoveResult {
    const piece = this.pieceAt(x, y);
    if (!piece) return 'empty';
    if (piece.fixed) return 'fixed';
    this.commit({ type: 'remove', at: { x, y }, kind: piece.kind, turn: piece.turn });
    return 'removed';
  }

  move(from: Pos, to: Pos): boolean {
    const piece = this.pieceAt(from.x, from.y);
    if (!piece || piece.fixed || !this.isOpen(to.x, to.y)) return false;
    return this.commit({ type: 'move', from, to });
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** What has been done since the level started, oldest first. */
  history(): readonly Move[] {
    return this.undoStack;
  }

  undo(): boolean {
    const move = this.undoStack.pop();
    if (!move) return false;
    this.apply(inverse(move));
    this.redoStack.push(move);
    return true;
  }

  redo(): boolean {
    const move = this.redoStack.pop();
    if (!move) return false;
    this.apply(move);
    this.undoStack.push(move);
    return true;
  }

  /** Back to how the level starts: pieces in the tray, fixed mirrors as drawn, no history. */
  restart(): void {
    this.board = parseLevel(this.level);
    this.trayCounts = { ...emptyTray(), ...this.level.tray };
    this.undoStack = [];
    this.redoStack = [];
    this.cached = null;
  }

  private commit(move: Move): boolean {
    this.apply(move);
    this.undoStack.push(move);
    this.redoStack = [];
    return true;
  }

  private apply(move: Move): void {
    const idx = (p: Pos) => p.y * this.width + p.x;
    const pieces = this.board.pieces;
    switch (move.type) {
      case 'place':
        pieces[idx(move.at)] = { kind: move.kind, turn: move.turn, fixed: false };
        this.trayCounts[move.kind]--;
        break;
      case 'remove':
        pieces[idx(move.at)] = null;
        this.trayCounts[move.kind]++;
        break;
      case 'turn': {
        const piece = pieces[idx(move.at)]!;
        piece.turn = piece.turn === 0 ? 1 : 0;
        break;
      }
      case 'move':
        pieces[idx(move.to)] = pieces[idx(move.from)];
        pieces[idx(move.from)] = null;
        break;
    }
    this.cached = null;
  }
}

function inverse(move: Move): Move {
  switch (move.type) {
    case 'place':
      return { type: 'remove', at: move.at, kind: move.kind, turn: move.turn };
    case 'remove':
      return { type: 'place', at: move.at, kind: move.kind, turn: move.turn };
    case 'turn':
      return move;
    case 'move':
      return { type: 'move', from: move.to, to: move.from };
  }
}
