export type Difficulty = "easy" | "medium" | "hard" | "expert" | "master";
export type Grid = number[];

export const DIFFICULTIES: Record<Difficulty, { label: string; clues: number; hints: number; base: number; target: number }> = {
  easy: { label: "Easy", clues: 42, hints: 5, base: 500, target: 360 },
  medium: { label: "Medium", clues: 36, hints: 4, base: 1000, target: 600 },
  hard: { label: "Hard", clues: 31, hints: 3, base: 2000, target: 900 },
  expert: { label: "Expert", clues: 27, hints: 2, base: 4000, target: 1200 },
  master: { label: "Master", clues: 24, hints: 1, base: 7500, target: 1800 },
};

const shuffle = <T,>(items: T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function isValidPlacement(grid: Grid, index: number, value: number) {
  const row = Math.floor(index / 9), col = index % 9;
  for (let i = 0; i < 9; i++) {
    if (i !== col && grid[row * 9 + i] === value) return false;
    if (i !== row && grid[i * 9 + col] === value) return false;
  }
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) {
    const at = r * 9 + c;
    if (at !== index && grid[at] === value) return false;
  }
  return true;
}

export function solve(grid: Grid): Grid | null {
  const board = [...grid];
  const visit = (): boolean => {
    let best = -1, candidates: number[] = [];
    for (let i = 0; i < 81; i++) if (!board[i]) {
      const opts = Array.from({ length: 9 }, (_, n) => n + 1).filter(n => isValidPlacement(board, i, n));
      if (!opts.length) return false;
      if (best < 0 || opts.length < candidates.length) { best = i; candidates = opts; if (opts.length === 1) break; }
    }
    if (best < 0) return true;
    for (const n of candidates) { board[best] = n; if (visit()) return true; board[best] = 0; }
    return false;
  };
  return visit() ? board : null;
}

export function countSolutions(grid: Grid, limit = 2) {
  const board = [...grid]; let count = 0;
  const visit = () => {
    if (count >= limit) return;
    const empty = board.indexOf(0);
    if (empty < 0) { count++; return; }
    for (let n = 1; n <= 9; n++) if (isValidPlacement(board, empty, n)) {
      board[empty] = n; visit(); board[empty] = 0;
    }
  };
  visit(); return count;
}

function fullGrid(): Grid {
  const base = 3, side = 9;
  const pattern = (r: number, c: number) => (base * (r % base) + Math.floor(r / base) + c) % side;
  const bands = shuffle([0, 1, 2]);
  const rows = bands.flatMap(b => shuffle([0, 1, 2]).map(r => b * 3 + r));
  const stacks = shuffle([0, 1, 2]);
  const cols = stacks.flatMap(s => shuffle([0, 1, 2]).map(c => s * 3 + c));
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return rows.flatMap(r => cols.map(c => nums[pattern(r, c)]));
}

export function generatePuzzle(difficulty: Difficulty) {
  const solution = fullGrid(), puzzle = [...solution];
  const target = DIFFICULTIES[difficulty].clues;
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (puzzle.filter(Boolean).length <= target) break;
    const old = puzzle[index]; puzzle[index] = 0;
    if (countSolutions(puzzle) !== 1) puzzle[index] = old;
  }
  return { puzzle, solution };
}

export function calculateScore(difficulty: Difficulty, seconds: number, mistakes: number, hints: number) {
  const d = DIFFICULTIES[difficulty];
  const timeBonus = Math.round(d.base * 0.5 * Math.max(0, 1 - seconds / (d.target * 2)));
  const penalties = mistakes * Math.round(d.base * 0.08) + hints * Math.round(d.base * 0.12);
  return Math.max(Math.round(d.base * 0.25), d.base + timeBonus - penalties);
}

export function updateStreak(lastDate: string | null, current: number, longest: number, today = new Date()) {
  const key = today.toISOString().slice(0, 10);
  if (lastDate === key) return { current, longest, lastDate: key };
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const next = lastDate === yesterday.toISOString().slice(0, 10) ? current + 1 : 1;
  return { current: next, longest: Math.max(longest, next), lastDate: key };
}
