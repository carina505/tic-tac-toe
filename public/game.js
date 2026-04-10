// --- Sounds (Web Audio API) ---

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playClick(player) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(player === 'X' ? 520 : 380, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(player === 'X' ? 620 : 300, audioCtx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.12);
}

function playWin() {
  // Cheerful ascending fanfare: C5 E5 G5 C6
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const t = audioCtx.currentTime + i * 0.13;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.start(t);
    osc.stop(t + 0.3);
  });
}

function playLose() {
  // Sad descending trombone wah: Bb4 G4 Eb4 Bb3
  const notes = [466, 392, 311, 233];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const t = audioCtx.currentTime + i * 0.18;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.93, t + 0.16);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.start(t);
    osc.stop(t + 0.35);
  });
}

function playDraw() {
  // Neutral two-tone blip
  [440, 330].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const t = audioCtx.currentTime + i * 0.14;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.start(t);
    osc.stop(t + 0.22);
  });
}

// Resume AudioContext on first interaction (browser policy)
document.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

let board = Array(9).fill('');
let currentPlayer = 'X';
let gameActive = true;
let cpuMode = false;
let scores = { X: 0, O: 0, draws: 0 };

const cells = document.querySelectorAll('.cell');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const resetScoresBtn = document.getElementById('reset-scores');
const modePvpBtn = document.getElementById('mode-pvp');
const modeCpuBtn = document.getElementById('mode-cpu');
const xWinsEl = document.getElementById('x-wins');
const oWinsEl = document.getElementById('o-wins');
const drawsEl = document.getElementById('draws');

// --- CPU AI (minimax) ---

function minimax(b, isMaximizing) {
  const result = checkWinnerOnBoard(b);
  if (result === 'O') return 10;
  if (result === 'X') return -10;
  if (b.every(c => c !== '')) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === '') {
        b[i] = 'O';
        best = Math.max(best, minimax(b, false));
        b[i] = '';
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === '') {
        b[i] = 'X';
        best = Math.min(best, minimax(b, true));
        b[i] = '';
      }
    }
    return best;
  }
}

function getBestMove() {
  let bestScore = -Infinity;
  let bestIndex = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === '') {
      board[i] = 'O';
      const score = minimax(board, false);
      board[i] = '';
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }
  return bestIndex;
}

function checkWinnerOnBoard(b) {
  for (const [a, bIdx, c] of WINNING_COMBOS) {
    if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return b[a];
  }
  return null;
}

// --- Game logic ---

function placeMarker(index, player) {
  board[index] = player;
  const cell = cells[index];
  cell.textContent = player;
  cell.setAttribute('data-value', player);
  cell.classList.add('placed');
  cell.addEventListener('animationend', () => cell.classList.remove('placed'), { once: true });
  playClick(player);
}

function handleCellClick(e) {
  const index = parseInt(e.currentTarget.dataset.index);
  if (!gameActive || board[index] !== '') return;
  if (cpuMode && currentPlayer === 'O') return; // block clicks during CPU turn

  placeMarker(index, currentPlayer);

  if (resolveTurn()) return;

  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  updateStatus();

  if (cpuMode && currentPlayer === 'O' && gameActive) {
    scheduleCpuMove();
  }
}

function scheduleCpuMove() {
  statusEl.textContent = 'CPU is thinking...';
  statusEl.className = 'status o-turn';
  cells.forEach(c => c.style.pointerEvents = 'none');

  setTimeout(() => {
    cells.forEach(c => c.style.pointerEvents = '');
    if (!gameActive) return;

    const move = getBestMove();
    placeMarker(move, 'O');

    if (resolveTurn()) return;

    currentPlayer = 'X';
    updateStatus();
  }, 400);
}

// Returns true if the game ended (win or draw)
function resolveTurn() {
  const result = checkWinner();

  if (result) {
    highlightWinner(result.indices);
    const isPlayerWin = !cpuMode || result.winner === 'X';
    const label = cpuMode
      ? (result.winner === 'X' ? 'You win!' : 'CPU wins!')
      : `Player ${result.winner} wins!`;
    statusEl.textContent = label;
    statusEl.className = 'status winner';
    scores[result.winner]++;
    updateScoreboard();
    gameActive = false;
    if (cpuMode) {
      isPlayerWin ? playWin() : playLose();
    } else {
      playWin();
    }
    return true;
  }

  if (board.every(c => c !== '')) {
    statusEl.textContent = "It's a draw!";
    statusEl.className = 'status draw';
    scores.draws++;
    updateScoreboard();
    gameActive = false;
    playDraw();
    return true;
  }

  return false;
}

function checkWinner() {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], indices: [a, b, c] };
    }
  }
  return null;
}

function highlightWinner(indices) {
  indices.forEach(i => cells[i].classList.add('winning'));
}

function updateStatus() {
  if (cpuMode) {
    statusEl.textContent = currentPlayer === 'X' ? 'Your turn' : 'CPU is thinking...';
  } else {
    statusEl.textContent = `Player ${currentPlayer}'s turn`;
  }
  statusEl.className = `status ${currentPlayer === 'X' ? 'x-turn' : 'o-turn'}`;
}

function updateScoreboard() {
  xWinsEl.textContent = scores.X;
  oWinsEl.textContent = scores.O;
  drawsEl.textContent = scores.draws;
}

function resetGame() {
  board = Array(9).fill('');
  currentPlayer = 'X';
  gameActive = true;
  cells.forEach(c => c.style.pointerEvents = '');

  cells.forEach(cell => {
    cell.textContent = '';
    cell.removeAttribute('data-value');
    cell.classList.remove('winning', 'placed');
  });

  updateStatus();
}

// --- Mode switching ---

modePvpBtn.addEventListener('click', () => {
  if (!cpuMode) return;
  cpuMode = false;
  modePvpBtn.classList.add('active');
  modeCpuBtn.classList.remove('active');
  scores = { X: 0, O: 0, draws: 0 };
  updateScoreboard();
  resetGame();
});

modeCpuBtn.addEventListener('click', () => {
  if (cpuMode) return;
  cpuMode = true;
  modeCpuBtn.classList.add('active');
  modePvpBtn.classList.remove('active');
  scores = { X: 0, O: 0, draws: 0 };
  updateScoreboard();
  resetGame();
});

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
resetBtn.addEventListener('click', resetGame);
resetScoresBtn.addEventListener('click', () => {
  scores = { X: 0, O: 0, draws: 0 };
  updateScoreboard();
  resetGame();
});

updateStatus();
