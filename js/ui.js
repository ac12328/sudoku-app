/**
 * UI controller — Traditional Chinese labels, board, pads, modals
 */

const DIFF_LABELS = {
  easy: '簡單',
  medium: '中等',
  hard: '困難',
  expert: '專家',
};

const game = new SudokuGame();
let timerInterval = null;
let flashCells = new Set();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function applyTheme() {
  const mode = game.settings.darkMode;
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
}

function buildBoard() {
  const boardEl = $('#board');
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.setAttribute('aria-label', `第 ${r + 1} 列第 ${c + 1} 欄`);
      if (c % 3 === 0) cell.classList.add('box-left');
      if (r % 3 === 0) cell.classList.add('box-top');
      if (c === 8) cell.classList.add('box-right');
      if (r === 8) cell.classList.add('box-bottom');
      cell.addEventListener('click', () => onCellTap(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function onCellTap(r, c) {
  if (game.paused) return;
  game.select(r, c);
  renderBoard();
  haptic();
}

function renderBoard() {
  const cells = $$('.cell');
  const sel = game.selected;
  let selVal = 0;
  if (sel) selVal = game.board[sel.r][sel.c];

  cells.forEach((cell) => {
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    const val = game.board[r][c];
    const isGiven = game.given[r][c];
    const notes = game.notes[r][c];

    cell.classList.remove(
      'selected',
      'peer',
      'same',
      'given',
      'wrong',
      'hint-flash',
      'has-notes'
    );

    // Content
    if (val !== 0) {
      cell.innerHTML = `<span class="digit">${val}</span>`;
    } else if (notes.size) {
      cell.classList.add('has-notes');
      let html = '<div class="notes">';
      for (let n = 1; n <= 9; n++) {
        html += `<span class="note${notes.has(n) ? ' on' : ''}">${notes.has(n) ? n : ''}</span>`;
      }
      html += '</div>';
      cell.innerHTML = html;
    } else {
      cell.innerHTML = '';
    }

    if (isGiven) cell.classList.add('given');

    if (sel && sel.r === r && sel.c === c) {
      cell.classList.add('selected');
    } else if (sel) {
      const sameBox =
        Math.floor(sel.r / 3) === Math.floor(r / 3) &&
        Math.floor(sel.c / 3) === Math.floor(c / 3);
      if (sel.r === r || sel.c === c || sameBox) {
        cell.classList.add('peer');
      }
      if (selVal && val === selVal) {
        cell.classList.add('same');
      }
    }

    // Wrong highlight (auto-check)
    if (
      game.settings.autoCheck &&
      val !== 0 &&
      !isGiven &&
      val !== game.solution[r][c]
    ) {
      cell.classList.add('wrong');
    }

    if (flashCells.has(`${r},${c}`)) {
      cell.classList.add('hint-flash');
    }
  });

  updateChrome();
}

function updateChrome() {
  $('#diff-label').textContent = DIFF_LABELS[game.difficulty] || '';
  $('#timer').textContent = formatTime(game.getElapsedMs());
  $('#mistakes').textContent = game.mistakes;
  const hintsLeft = game.remainingHints();
  $('#hint-btn .badge').textContent = hintsLeft;
  $('#hint-btn').disabled = !game.started || game.won || game.lost || game.paused || hintsLeft <= 0;
  $('#notes-btn').classList.toggle('active', game.notesMode);
  $('#undo-btn').disabled = !game.history.length || game.paused || game.won || game.lost;
  $('#redo-btn').disabled = !game.redoStack.length || game.paused || game.won || game.lost;
  $('#pause-btn').disabled = !game.started || game.won || game.lost;
  $('#pause-btn').textContent = game.paused ? '繼續' : '暫停';
  $('#pause-overlay').classList.toggle('show', game.paused);
  $('#board-wrap').classList.toggle('paused', game.paused);

  // Number pad counts remaining
  const counts = Array(10).fill(0);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = game.board[r][c];
      if (v) counts[v]++;
    }
  }
  $$('.num-btn[data-num]').forEach((btn) => {
    const n = +btn.dataset.num;
    btn.classList.toggle('done', counts[n] >= 9);
  });
}

function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (game.timerRunning && !game.paused && !game.won && !game.lost) {
      $('#timer').textContent = formatTime(game.getElapsedMs());
    }
  }, 250);
}

function haptic() {
  // CSS class pulse; optional vibrate
  if (navigator.vibrate && game.settings.sound) {
    try {
      navigator.vibrate(8);
    } catch (_) {}
  }
}

function flashWrong() {
  const board = $('#board');
  board.classList.add('shake');
  setTimeout(() => board.classList.remove('shake'), 350);
}

function onNumber(num) {
  if (!game.started || game.paused || game.won || game.lost) return;
  if (!game.selected) return;
  const result = game.inputNumber(num);
  if (!result.ok) return;
  haptic();
  renderBoard();
  if (result.wrong) flashWrong();
  if (result.type === 'win') showWin();
  if (result.type === 'lose') showLose();
}

function onClear() {
  if (game.clearCell()) {
    haptic();
    renderBoard();
  }
}

function onUndo() {
  if (game.undo()) {
    haptic();
    renderBoard();
  }
}

function onRedo() {
  if (game.redo()) {
    haptic();
    renderBoard();
  }
}

function onHint() {
  const res = game.hint();
  if (!res) return;
  if (res.limited) {
    showToast('提示已用完');
    return;
  }
  haptic();
  flashCells.add(`${res.r},${res.c}`);
  renderBoard();
  setTimeout(() => {
    flashCells.delete(`${res.r},${res.c}`);
    renderBoard();
  }, 600);
  if (res.win) showWin();
}

function onPauseToggle() {
  if (game.paused) {
    game.resumeTimer();
  } else {
    game.pauseTimer();
  }
  renderBoard();
}

function showModal(id) {
  $(id).classList.add('show');
}

function hideModal(id) {
  $(id).classList.remove('show');
}

function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function showWin() {
  const ms = game.getElapsedMs();
  $('#win-time').textContent = formatTime(ms);
  $('#win-mistakes').textContent = game.mistakes;
  $('#win-diff').textContent = DIFF_LABELS[game.difficulty];
  showModal('#win-modal');
  celebrate();
}

function showLose() {
  showModal('#lose-modal');
}

function celebrate() {
  const conf = $('#confetti');
  conf.innerHTML = '';
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#5f27cd', '#ff9ff3'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.5 + 's';
    p.style.animationDuration = 1.2 + Math.random() * 1.2 + 's';
    conf.appendChild(p);
  }
  conf.classList.add('show');
  setTimeout(() => {
    conf.classList.remove('show');
    conf.innerHTML = '';
  }, 2800);
}

function requestNewGame(diff) {
  const start = () => {
    hideModal('#new-modal');
    hideModal('#win-modal');
    hideModal('#lose-modal');
    hideModal('#home-modal');
    showGenerating();
    // Yield so UI updates before heavy generation
    setTimeout(() => {
      game.newGame(diff);
      hideGenerating();
      renderBoard();
      startTimerLoop();
      showToast(`${DIFF_LABELS[diff]} · 新遊戲`);
    }, 40);
  };

  if (game.hasUnfinished()) {
    pendingDiff = diff;
    showModal('#confirm-modal');
  } else {
    start();
  }
}

let pendingDiff = 'medium';

function showGenerating() {
  $('#generating').classList.add('show');
}

function hideGenerating() {
  $('#generating').classList.remove('show');
}

function openSettings() {
  $('#set-autocheck').checked = game.settings.autoCheck;
  $('#set-challenge').checked = game.settings.mistakeChallenge;
  $$('input[name="theme"]').forEach((inp) => {
    inp.checked = inp.value === game.settings.darkMode;
  });
  showModal('#settings-modal');
}

function bindUI() {
  buildBoard();

  $$('.num-btn[data-num]').forEach((btn) => {
    btn.addEventListener('click', () => onNumber(+btn.dataset.num));
  });
  $('#clear-btn').addEventListener('click', onClear);
  $('#notes-btn').addEventListener('click', () => {
    game.toggleNotesMode();
    haptic();
    renderBoard();
  });
  $('#undo-btn').addEventListener('click', onUndo);
  $('#redo-btn').addEventListener('click', onRedo);
  $('#hint-btn').addEventListener('click', onHint);
  $('#pause-btn').addEventListener('click', onPauseToggle);
  $('#new-btn').addEventListener('click', () => showModal('#new-modal'));
  $('#settings-btn').addEventListener('click', openSettings);

  $$('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => requestNewGame(btn.dataset.diff));
  });

  $('#confirm-yes').addEventListener('click', () => {
    hideModal('#confirm-modal');
    const diff = pendingDiff;
    showGenerating();
    setTimeout(() => {
      game.newGame(diff);
      hideGenerating();
      hideModal('#new-modal');
      hideModal('#win-modal');
      hideModal('#lose-modal');
      hideModal('#home-modal');
      renderBoard();
      startTimerLoop();
      showToast(`${DIFF_LABELS[diff]} · 新遊戲`);
    }, 40);
  });
  $('#confirm-no').addEventListener('click', () => hideModal('#confirm-modal'));

  $$('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => hideModal('#' + btn.dataset.close));
  });

  $('#win-again').addEventListener('click', () => {
    hideModal('#win-modal');
    requestNewGame(game.difficulty);
  });
  $('#lose-again').addEventListener('click', () => {
    hideModal('#lose-modal');
    requestNewGame(game.difficulty);
  });

  $('#set-autocheck').addEventListener('change', (e) => {
    game.updateSetting('autoCheck', e.target.checked);
    renderBoard();
  });
  $('#set-challenge').addEventListener('change', (e) => {
    game.updateSetting('mistakeChallenge', e.target.checked);
  });
  $$('input[name="theme"]').forEach((inp) => {
    inp.addEventListener('change', () => {
      if (inp.checked) {
        game.updateSetting('darkMode', inp.value);
        applyTheme();
      }
    });
  });

  $('#pause-overlay').addEventListener('click', () => {
    if (game.paused) onPauseToggle();
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    const key = e.key;
    if (key >= '1' && key <= '9') {
      e.preventDefault();
      onNumber(+key);
      return;
    }
    if (key === 'Backspace' || key === 'Delete' || key === '0') {
      e.preventDefault();
      onClear();
      return;
    }
    if (key === 'n' || key === 'N') {
      e.preventDefault();
      game.toggleNotesMode();
      renderBoard();
      return;
    }
    if (key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      onUndo();
      return;
    }
    if (
      (key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
      (key === 'y' && (e.metaKey || e.ctrlKey))
    ) {
      e.preventDefault();
      onRedo();
      return;
    }
    if (!game.selected) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        game.select(0, 0);
        renderBoard();
        e.preventDefault();
      }
      return;
    }
    let { r, c } = game.selected;
    if (key === 'ArrowUp') {
      r = Math.max(0, r - 1);
      e.preventDefault();
    } else if (key === 'ArrowDown') {
      r = Math.min(8, r + 1);
      e.preventDefault();
    } else if (key === 'ArrowLeft') {
      c = Math.max(0, c - 1);
      e.preventDefault();
    } else if (key === 'ArrowRight') {
      c = Math.min(8, c + 1);
      e.preventDefault();
    } else {
      return;
    }
    game.select(r, c);
    renderBoard();
  });

  // Pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.started && !game.paused && !game.won && !game.lost) {
      game.pauseTimer();
      renderBoard();
    }
  });

  // Close modals on backdrop
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('show');
    });
  });
}

function init() {
  applyTheme();
  bindUI();

  const restored = game.restore();
  if (restored) {
    hideModal('#home-modal');
    renderBoard();
    startTimerLoop();
    // Start paused so user can resume intentionally
    game.pauseTimer();
    renderBoard();
    showToast('已還原未完成的遊戲');
  } else {
    showModal('#home-modal');
    renderBoard();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
