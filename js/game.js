/**
 * Game state, persistence, undo/redo, timer, hints
 */

const STORAGE_KEY = 'sudoku-charlie-v1';
const HINT_LIMIT = 3;

const DEFAULT_SETTINGS = {
  autoCheck: true,
  mistakeChallenge: false, // soft: track count; if true, 3 mistakes = lose
  darkMode: 'system', // 'system' | 'light' | 'dark'
  sound: true,
};

function createEmptyNotes() {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set())
  );
}

function notesToJSON(notes) {
  return notes.map((row) => row.map((set) => [...set].sort()));
}

function notesFromJSON(data) {
  return data.map((row) => row.map((arr) => new Set(arr)));
}

class SudokuGame {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.loadSettings();
    this.resetEmpty();
  }

  resetEmpty() {
    this.difficulty = 'medium';
    this.puzzle = SudokuEngine.emptyBoard();
    this.solution = SudokuEngine.emptyBoard();
    this.board = SudokuEngine.emptyBoard();
    this.given = Array.from({ length: 9 }, () => Array(9).fill(false));
    this.notes = createEmptyNotes();
    this.selected = null; // {r,c}
    this.notesMode = false;
    this.history = [];
    this.redoStack = [];
    this.mistakes = 0;
    this.hintsUsed = 0;
    this.elapsedMs = 0;
    this.timerRunning = false;
    this.paused = false;
    this.won = false;
    this.lost = false;
    this.started = false;
    this._timerStart = null;
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      }
    } catch (_) {
      /* ignore */
    }
  }

  save() {
    try {
      const payload = {
        settings: this.settings,
        game: this.started
          ? {
              difficulty: this.difficulty,
              puzzle: this.puzzle,
              solution: this.solution,
              board: this.board,
              given: this.given,
              notes: notesToJSON(this.notes),
              mistakes: this.mistakes,
              hintsUsed: this.hintsUsed,
              elapsedMs: this.getElapsedMs(),
              won: this.won,
              lost: this.lost,
              started: this.started,
            }
          : null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      /* ignore quota */
    }
  }

  restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      }
      const g = data.game;
      if (!g || !g.started || g.won || g.lost) return false;
      this.difficulty = g.difficulty;
      this.puzzle = g.puzzle;
      this.solution = g.solution;
      this.board = g.board;
      this.given = g.given;
      this.notes = notesFromJSON(g.notes);
      this.mistakes = g.mistakes || 0;
      this.hintsUsed = g.hintsUsed || 0;
      this.elapsedMs = g.elapsedMs || 0;
      this.won = false;
      this.lost = false;
      this.started = true;
      this.history = [];
      this.redoStack = [];
      this.paused = false;
      this.timerRunning = false;
      return true;
    } catch (_) {
      return false;
    }
  }

  hasUnfinished() {
    if (!this.started || this.won || this.lost) return false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!this.given[r][c] && (this.board[r][c] !== 0 || this.notes[r][c].size)) {
          return true;
        }
      }
    }
    // Also unfinished if any empty cell remains
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[r][c] === 0) return true;
      }
    }
    return false;
  }

  newGame(difficulty) {
    this.difficulty = difficulty;
    const { puzzle, solution } = SudokuEngine.generatePuzzle(difficulty);
    this.puzzle = puzzle;
    this.solution = solution;
    this.board = SudokuEngine.cloneBoard(puzzle);
    this.given = puzzle.map((row) => row.map((v) => v !== 0));
    this.notes = createEmptyNotes();
    this.selected = null;
    this.notesMode = false;
    this.history = [];
    this.redoStack = [];
    this.mistakes = 0;
    this.hintsUsed = 0;
    this.elapsedMs = 0;
    this.won = false;
    this.lost = false;
    this.started = true;
    this.paused = false;
    this._timerStart = null;
    this.timerRunning = true;
    this._timerStart = Date.now();
    this.save();
  }

  getElapsedMs() {
    let ms = this.elapsedMs;
    if (this.timerRunning && this._timerStart && !this.paused && !this.won && !this.lost) {
      ms += Date.now() - this._timerStart;
    }
    return ms;
  }

  pauseTimer() {
    if (!this.timerRunning || this.paused || this.won || this.lost) return;
    this.elapsedMs = this.getElapsedMs();
    this._timerStart = null;
    this.timerRunning = false;
    this.paused = true;
    this.save();
  }

  resumeTimer() {
    if (!this.started || this.won || this.lost) return;
    this.paused = false;
    this.timerRunning = true;
    this._timerStart = Date.now();
    this.save();
  }

  _pushHistory() {
    this.history.push({
      board: SudokuEngine.cloneBoard(this.board),
      notes: notesToJSON(this.notes),
      mistakes: this.mistakes,
    });
    if (this.history.length > 100) this.history.shift();
    this.redoStack = [];
  }

  select(r, c) {
    this.selected = { r, c };
  }

  toggleNotesMode() {
    this.notesMode = !this.notesMode;
  }

  canEdit(r, c) {
    return this.started && !this.won && !this.lost && !this.paused && !this.given[r][c];
  }

  inputNumber(num) {
    if (!this.selected) return { ok: false };
    const { r, c } = this.selected;
    if (!this.canEdit(r, c)) return { ok: false };

    this._pushHistory();

    if (this.notesMode) {
      if (this.board[r][c] !== 0) {
        // Clear number first when entering notes
        this.board[r][c] = 0;
      }
      const set = this.notes[r][c];
      if (set.has(num)) set.delete(num);
      else set.add(num);
      this.save();
      return { ok: true, type: 'note' };
    }

    // Place number
    this.notes[r][c].clear();
    const prev = this.board[r][c];
    this.board[r][c] = num;

    // Clear same number from notes in peer cells
    this._clearPeerNotes(r, c, num);

    let wrong = false;
    if (this.settings.autoCheck && num !== this.solution[r][c]) {
      wrong = true;
      this.mistakes++;
      if (this.settings.mistakeChallenge && this.mistakes >= 3) {
        this.lost = true;
        this.elapsedMs = this.getElapsedMs();
        this.timerRunning = false;
        this._timerStart = null;
        this.save();
        return { ok: true, type: 'lose', wrong: true };
      }
    }

    if (SudokuEngine.isComplete(this.board, this.solution)) {
      this.won = true;
      this.elapsedMs = this.getElapsedMs();
      this.timerRunning = false;
      this._timerStart = null;
      this.save();
      return { ok: true, type: 'win', wrong: false, prev };
    }

    this.save();
    return { ok: true, type: 'place', wrong, prev };
  }

  _clearPeerNotes(row, col, num) {
    for (let i = 0; i < 9; i++) {
      this.notes[row][i].delete(num);
      this.notes[i][col].delete(num);
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        this.notes[r][c].delete(num);
      }
    }
  }

  clearCell() {
    if (!this.selected) return false;
    const { r, c } = this.selected;
    if (!this.canEdit(r, c)) return false;
    if (this.board[r][c] === 0 && this.notes[r][c].size === 0) return false;
    this._pushHistory();
    this.board[r][c] = 0;
    this.notes[r][c].clear();
    this.save();
    return true;
  }

  undo() {
    if (!this.history.length || this.won || this.lost || this.paused) return false;
    this.redoStack.push({
      board: SudokuEngine.cloneBoard(this.board),
      notes: notesToJSON(this.notes),
      mistakes: this.mistakes,
    });
    const prev = this.history.pop();
    this.board = prev.board;
    this.notes = notesFromJSON(prev.notes);
    this.mistakes = prev.mistakes;
    this.save();
    return true;
  }

  redo() {
    if (!this.redoStack.length || this.won || this.lost || this.paused) return false;
    this.history.push({
      board: SudokuEngine.cloneBoard(this.board),
      notes: notesToJSON(this.notes),
      mistakes: this.mistakes,
    });
    const next = this.redoStack.pop();
    this.board = next.board;
    this.notes = notesFromJSON(next.notes);
    this.mistakes = next.mistakes;
    this.save();
    return true;
  }

  hint() {
    if (!this.started || this.won || this.lost || this.paused) return null;
    if (this.hintsUsed >= HINT_LIMIT) return { limited: true };

    // Prefer selected empty cell, else random empty
    let targets = [];
    if (
      this.selected &&
      !this.given[this.selected.r][this.selected.c] &&
      this.board[this.selected.r][this.selected.c] === 0
    ) {
      targets = [this.selected];
    } else {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!this.given[r][c] && this.board[r][c] === 0) {
            targets.push({ r, c });
          }
        }
      }
    }
    if (!targets.length) return null;

    const pick = targets[Math.floor(Math.random() * targets.length)];
    this._pushHistory();
    const num = this.solution[pick.r][pick.c];
    this.board[pick.r][pick.c] = num;
    this.notes[pick.r][pick.c].clear();
    this._clearPeerNotes(pick.r, pick.c, num);
    this.hintsUsed++;
    this.selected = pick;

    if (SudokuEngine.isComplete(this.board, this.solution)) {
      this.won = true;
      this.elapsedMs = this.getElapsedMs();
      this.timerRunning = false;
      this._timerStart = null;
      this.save();
      return { r: pick.r, c: pick.c, num, win: true };
    }

    this.save();
    return { r: pick.r, c: pick.c, num, win: false };
  }

  remainingHints() {
    return Math.max(0, HINT_LIMIT - this.hintsUsed);
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    this.save();
  }
}

window.HINT_LIMIT = HINT_LIMIT;
window.SudokuGame = SudokuGame;
