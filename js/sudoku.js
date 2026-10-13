/**
 * Sudoku generator & solver (backtracking)
 * Ensures every generated puzzle has a unique solution.
 */

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Empty 9×9 board filled with 0 */
function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

/** Find next empty cell; returns [r,c] or null */
function findEmpty(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) return [r, c];
    }
  }
  return null;
}

/**
 * Solve board in-place. Returns true if solved.
 * If countSolutionsOnly, stop after finding `limit` solutions (mutates board temporarily).
 */
function solve(board, randomized = false) {
  const empty = findEmpty(board);
  if (!empty) return true;
  const [row, col] = empty;
  const nums = randomized ? shuffle(DIGITS) : DIGITS;
  for (const num of nums) {
    if (isValid(board, row, col, num)) {
      board[row][col] = num;
      if (solve(board, randomized)) return true;
      board[row][col] = 0;
    }
  }
  return false;
}

/** Count solutions up to `limit` (usually 2 for uniqueness check) */
function countSolutions(board, limit = 2) {
  let count = 0;
  function dfs() {
    if (count >= limit) return;
    const empty = findEmpty(board);
    if (!empty) {
      count++;
      return;
    }
    const [row, col] = empty;
    for (const num of DIGITS) {
      if (isValid(board, row, col, num)) {
        board[row][col] = num;
        dfs();
        board[row][col] = 0;
        if (count >= limit) return;
      }
    }
  }
  dfs();
  return count;
}

/** Generate a complete filled valid board */
function generateComplete() {
  const board = emptyBoard();
  solve(board, true);
  return board;
}

/**
 * Difficulty → approximate clues remaining (cells filled in puzzle).
 * Classic ranges; we remove until unique solution is preserved.
 */
const DIFFICULTY_TARGETS = {
  easy: { minClues: 40, maxRemove: 41 },
  medium: { minClues: 32, maxRemove: 49 },
  hard: { minClues: 26, maxRemove: 55 },
  expert: { minClues: 22, maxRemove: 59 },
};

/**
 * Create a unique-solution puzzle.
 * @param {'easy'|'medium'|'hard'|'expert'} difficulty
 * @returns {{ puzzle: number[][], solution: number[][] }}
 */
function generatePuzzle(difficulty = 'medium') {
  const solution = generateComplete();
  const puzzle = cloneBoard(solution);
  const target = DIFFICULTY_TARGETS[difficulty] || DIFFICULTY_TARGETS.medium;

  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
  );

  let removed = 0;
  for (const [r, c] of positions) {
    if (81 - removed <= target.minClues) break;
    if (removed >= target.maxRemove) break;

    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    const test = cloneBoard(puzzle);
    if (countSolutions(test, 2) !== 1) {
      puzzle[r][c] = backup;
    } else {
      removed++;
    }
  }

  return { puzzle, solution };
}

/** Check if a digit placement is correct against solution */
function isCorrect(solution, row, col, num) {
  return solution[row][col] === num;
}

/** Board is complete and matches solution */
function isComplete(board, solution) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

/** Get candidates for a cell (for notes / validation helpers) */
function getCandidates(board, row, col) {
  if (board[row][col] !== 0) return [];
  const out = [];
  for (const n of DIGITS) {
    if (isValid(board, row, col, n)) out.push(n);
  }
  return out;
}

window.SudokuEngine = {
  emptyBoard,
  cloneBoard,
  generatePuzzle,
  solve,
  countSolutions,
  isValid,
  isCorrect,
  isComplete,
  getCandidates,
  DIGITS,
};
