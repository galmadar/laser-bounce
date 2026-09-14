const KEY = 'laser-bounce.progress.v1';

interface Saved {
  current: number;
  solved: string[];
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
    return { current: Number(data.current) || 0, solved: Array.isArray(data.solved) ? data.solved : [] };
  } catch {
    return { current: 0, solved: [] };
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

export function isSolved(id: string): boolean {
  return saved.solved.includes(id);
}

export function markSolved(id: string): void {
  if (isSolved(id)) return;
  saved.solved.push(id);
  save();
}
