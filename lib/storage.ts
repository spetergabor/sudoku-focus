import type { Difficulty, Grid } from "./sudoku";

export type HistoryItem = { cells: Grid; notes: number[][] };
export type SavedGame = { puzzle: Grid; solution: Grid; cells: Grid; notes: number[][]; difficulty: Difficulty; seconds: number; mistakes: number; hintsLeft: number; hintsUsed: number; history: HistoryItem[]; status: "playing" | "paused" | "over" | "complete" };
export type Stats = { totalScore: number; played: number; completed: number; currentStreak: number; longestStreak: number; lastDate: string | null; byDifficulty: Record<Difficulty, { completed: number; bestTime: number | null; totalTime: number; bestScore: number }> };

export const emptyStats = (): Stats => ({
  totalScore: 0, played: 0, completed: 0, currentStreak: 0, longestStreak: 0, lastDate: null,
  byDifficulty: Object.fromEntries(["easy", "medium", "hard", "expert", "master"].map(k => [k, { completed: 0, bestTime: null, totalTime: 0, bestScore: 0 }])) as Stats["byDifficulty"],
});

export const storage = {
  loadGame: (): SavedGame | null => { try { return JSON.parse(localStorage.getItem("sudoku.game.v1") || "null"); } catch { return null; } },
  saveGame: (game: SavedGame | null) => game ? localStorage.setItem("sudoku.game.v1", JSON.stringify(game)) : localStorage.removeItem("sudoku.game.v1"),
  loadStats: (): Stats => { try { return { ...emptyStats(), ...JSON.parse(localStorage.getItem("sudoku.stats.v1") || "{}") }; } catch { return emptyStats(); } },
  saveStats: (stats: Stats) => localStorage.setItem("sudoku.stats.v1", JSON.stringify(stats)),
};
