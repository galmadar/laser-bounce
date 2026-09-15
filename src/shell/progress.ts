const KEY = 'laser-bounce.progress.v1';

interface Saved {
  current: number;
  /** Won by the player alone. */
  solved: string[];
  /** Won with the solution showing or applied, and never yet alone. Kept apart so older saves still read right. */
  helped: string[];
}

export type SolvedState = 'no' | 'self' | 'helped';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
    return { current: Number(data.current) || 0, solved: strings(data.solved), helped: strings(data.helped) };
  } catch {
    return { current: 0, solved: [], helped: [] };
  }
}

const saved = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // A private window just forgets between visits.
  }
}

export function currentLevel(): number {
  return saved.current;
}

export function setCurrentLevel(index: number): void {
  saved.current = index;
  save();
}

export function solvedState(id: string): SolvedState {
  if (saved.solved.includes(id)) return 'self';
  return saved.helped.includes(id) ? 'helped' : 'no';
}

/** A win alone upgrades a helped level; a helped win never downgrades one already won alone. */
export function markSolved(id: string, helped = false): void {
  const state = solvedState(id);
  if (helped) {
    if (state !== 'no') return;
    saved.helped.push(id);
  } else {
    if (state === 'self') return;
    saved.helped = saved.helped.filter((h) => h !== id);
    saved.solved.push(id);
  }
  save();
}
