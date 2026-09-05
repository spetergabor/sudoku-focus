import test from "node:test";
import assert from "node:assert/strict";
import { calculateScore, countSolutions, generatePuzzle, isValidPlacement, solve, updateStreak } from "../lib/sudoku.ts";

const known = [5,3,0,0,7,0,0,0,0,6,0,0,1,9,5,0,0,0,0,9,8,0,0,0,0,6,0,8,0,0,0,6,0,0,0,3,4,0,0,8,0,3,0,0,1,7,0,0,0,2,0,0,0,6,0,6,0,0,0,0,2,8,0,0,0,0,4,1,9,0,0,5,0,0,0,0,8,0,0,7,9];

test("solver returns a valid completed grid", () => {
  const solved = solve(known); assert.ok(solved); assert.equal(solved.includes(0), false);
  for (let i = 0; i < 81; i++) assert.equal(isValidPlacement(solved, i, solved[i]), true);
});
test("known puzzle has a unique solution", () => assert.equal(countSolutions(known), 1));
test("generation produces a unique solvable puzzle", () => {
  const { puzzle, solution } = generatePuzzle("medium");
  assert.equal(puzzle.length, 81); assert.equal(solution.length, 81); assert.equal(countSolutions(puzzle), 1); assert.deepEqual(solve(puzzle), solution);
});
test("scoring rewards clean and fast play", () => {
  assert.ok(calculateScore("hard", 300, 0, 0) > calculateScore("hard", 1200, 2, 2));
});
test("streak continues only on adjacent days", () => {
  assert.deepEqual(updateStreak("2026-09-04", 4, 8, new Date("2026-09-05T12:00:00Z")), { current:5, longest:8, lastDate:"2026-09-05" });
  assert.equal(updateStreak("2026-09-01", 4, 8, new Date("2026-09-05T12:00:00Z")).current, 1);
});
