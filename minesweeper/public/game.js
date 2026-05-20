// ==================== Configuration ====================
const API = '/api';

const DIFFICULTIES = [
  { name: '初级', rows: 9,  cols: 9,  mines: 10, emoji: '😊' },
  { name: '中级', rows: 16, cols: 16, mines: 40, emoji: '🙂' },
  { name: '高级', rows: 16, cols: 30, mines: 99, emoji: '😈' },
];

// ==================== State ====================
let currentDiff = 0;
let rows, cols, totalMines;
let board = [];       // board[r][c] = { mine, revealed, flagged, adjacentMines }
let gameOver = false;
let gameStarted = false;
let flagsPlaced = 0;
let cellsRevealed = 0;
let timerInterval = null;
let elapsed = 0;
let hintCell = null;  // Currently highlighted hint cell {r, c}

// ==================== DOM refs ====================
const boardEl = document.getElementById('board');
const mineCountEl = document.getElementById('mineCount');
const timerEl = document.getElementById('timer');
const hintBtn = document.getElementById('hintBtn');
const restartBtn = document.getElementById('restartBtn');
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlayContent');
const rankingContent = document.getElementById('rankingContent');
const myScoresContent = document.getElementById('myScoresContent');
const rankTitle = document.getElementById('rankTitle');
const userBadge = document.getElementById('userBadge');
const displayName = document.getElementById('displayName');
const avatarLetter = document.getElementById('avatarLetter');
const logoutBtn = document.getElementById('logoutBtn');
const loginBtn = document.getElementById('loginBtn');
const sidePanels = document.getElementById('sidePanels');

// ==================== Auth ====================
function getToken() { return localStorage.getItem('token'); }
function getUsername() { return localStorage.getItem('username'); }

function updateAuthUI() {
  const token = getToken();
  const name = getUsername();
  if (token && name) {
    userBadge.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loginBtn.classList.add('hidden');
    displayName.textContent = name;
    avatarLetter.textContent = name[0].toUpperCase();
  } else {
    userBadge.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    loginBtn.classList.remove('hidden');
  }
}

loginBtn.addEventListener('click', () => { window.location.href = '/login.html'; });
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  updateAuthUI();
  loadMyScores();
  showToast('已退出登录');
});

// ==================== Init ====================
function initGame() {
  const d = DIFFICULTIES[currentDiff];
  rows = d.rows;
  cols = d.cols;
  totalMines = d.mines;
  gameOver = false;
  gameStarted = false;
  flagsPlaced = 0;
  cellsRevealed = 0;
  elapsed = 0;
  hintCell = null;

  clearInterval(timerInterval);
  timerInterval = null;
  timerEl.textContent = '0';
  mineCountEl.textContent = totalMines;

  // Create empty board
  board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = { mine: false, revealed: false, flagged: false, adjacentMines: 0 };
    }
  }

  overlay.classList.add('hidden');
  renderBoard();
}

function placeMines(safeR, safeC) {
  // Place mines randomly, avoiding the safe cell and its neighbors
  const safe = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeR + dr, nc = safeC + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) safe.add(`${nr},${nc}`);
    }
  }

  let placed = 0;
  while (placed < totalMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!board[r][c].mine && !safe.has(`${r},${c}`)) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // Calculate adjacent mine counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++;
        }
      }
      board[r][c].adjacentMines = count;
    }
  }
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    elapsed++;
    timerEl.textContent = elapsed;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ==================== Render ====================
function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 32px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;

      const state = board[r][c];

      if (state.revealed) {
        cell.classList.add('revealed');
        if (state.mine && state !== board[hintCell?.r]?.[hintCell?.c]) {
          cell.classList.add('mine-reveal');
          cell.textContent = '💣';
        } else if (state.adjacentMines > 0) {
          cell.textContent = state.adjacentMines;
          cell.classList.add(`n${state.adjacentMines}`);
        }
      } else if (state.flagged) {
        cell.classList.add('flagged');
        cell.textContent = '🚩';
      }

      // Hint highlight
      if (hintCell && r === hintCell.r && c === hintCell.c && !state.revealed) {
        cell.classList.add('hint');
      }

      cell.addEventListener('click', (e) => onCellClick(r, c));
      cell.addEventListener('contextmenu', (e) => { e.preventDefault(); onRightClick(r, c); });

      boardEl.appendChild(cell);
    }
  }
}

function updateCell(r, c) {
  const cell = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  if (!cell) return;
  const state = board[r][c];

  if (state.revealed) {
    cell.classList.add('revealed');
    if (state.mine) {
      cell.classList.add('mine-reveal');
      cell.textContent = '💣';
    } else if (state.adjacentMines > 0) {
      cell.textContent = state.adjacentMines;
      cell.classList.add(`n${state.adjacentMines}`);
    }
  } else if (state.flagged) {
    cell.classList.add('flagged');
    cell.textContent = '🚩';
  } else {
    cell.classList.remove('flagged');
    cell.textContent = '';
  }

  if (hintCell && r === hintCell.r && c === hintCell.c && !state.revealed) {
    cell.classList.add('hint');
  }
}

// ==================== Game Logic ====================
function onCellClick(r, c) {
  if (gameOver) return;
  const state = board[r][c];
  if (state.revealed || state.flagged) return;

  // First click: place mines
  if (!gameStarted) {
    gameStarted = true;
    placeMines(r, c);
    startTimer();
  }

  revealCell(r, c);

  if (!state.mine) {
    checkWin();
  }
}

function revealCell(r, c) {
  const state = board[r][c];
  if (state.revealed || state.flagged) return;

  state.revealed = true;
  cellsRevealed++;

  if (state.mine) {
    loseGame(r, c);
    return;
  }

  // Flood fill for empty cells
  if (state.adjacentMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          revealCell(nr, nc);
        }
      }
    }
  }
}

function onRightClick(r, c) {
  if (gameOver) return;
  if (!gameStarted) return;
  const state = board[r][c];
  if (state.revealed) return;

  state.flagged = !state.flagged;
  flagsPlaced += state.flagged ? 1 : -1;
  mineCountEl.textContent = totalMines - flagsPlaced;

  // Clear hint when flagging
  if (hintCell && hintCell.r === r && hintCell.c === c) {
    hintCell = null;
  }

  updateCell(r, c);
}

function loseGame(hitR, hitC) {
  gameOver = true;
  stopTimer();

  // Reveal all mines
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) {
        board[r][c].revealed = true;
      }
    }
  }

  // Mark the hit mine
  board[hitR][hitC].mineHit = true;

  renderBoard();
  // Add mine-hit class after render
  const hitCell = boardEl.querySelector(`[data-r="${hitR}"][data-c="${hitC}"]`);
  if (hitCell) {
    hitCell.classList.add('mine-hit');
  }

  showOverlay('lose');
}

function checkWin() {
  const totalCells = rows * cols;
  if (cellsRevealed === totalCells - totalMines) {
    gameOver = true;
    stopTimer();

    // Auto-flag remaining mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine && !board[r][c].flagged) {
          board[r][c].flagged = true;
          flagsPlaced++;
        }
      }
    }
    mineCountEl.textContent = 0;
    renderBoard();
    showOverlay('win');
  }
}

// ==================== Auto-Hint ====================
function findSafeCell() {
  // Strategy 1: If a revealed number cell has exactly the required flagged neighbors
  // remaining, all unflagged neighbors are safe (or mines)
  const safeCells = [];
  const certainMines = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const state = board[r][c];
      if (!state.revealed || state.adjacentMines === 0) continue;

      let flagged = 0;
      let hidden = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (board[nr][nc].flagged) flagged++;
            else if (!board[nr][nc].revealed) hidden++;
          }
        }
      }

      if (flagged === state.adjacentMines && hidden > 0) {
        // All hidden neighbors are safe -> click them
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              if (!board[nr][nc].revealed && !board[nr][nc].flagged) {
                safeCells.push({ r: nr, c: nc });
              }
            }
          }
        }
      }

      if (flagged < state.adjacentMines && flagged + hidden === state.adjacentMines) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              if (!board[nr][nc].revealed && !board[nr][nc].flagged) {
                certainMines.push({ r: nr, c: nc });
              }
            }
          }
        }
      }
    }
  }

  // If certain mines found, flag them
  if (certainMines.length > 0) {
    const unique = certainMines.filter((v, i, a) =>
      a.findIndex(t => t.r === v.r && t.c === v.c) === i
    );
    return { type: 'mines', cells: unique };
  }

  // Prioritize safe cells found by deduction
  if (safeCells.length > 0) {
    const unique = safeCells.filter((v, i, a) =>
      a.findIndex(t => t.r === v.r && t.c === v.c) === i
    );
    return { type: 'safe', cells: unique, cell: unique[0] };
  }

  // Strategy 2: Probability-based — pick hidden cell with lowest mine probability
  // Simplified: look at edge cells (hidden but adjacent to revealed numbers)
  const edgeCells = new Map(); // "r,c" -> { r, c, totalMines, count }
  const allHidden = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].revealed || board[r][c].flagged) continue;

      let adjacentToRevealed = false;
      let totalAdjMines = 0;
      let adjacentHidden = 0;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].revealed) {
            adjacentToRevealed = true;
            totalAdjMines += board[nr][nc].adjacentMines;
            adjacentHidden++;
          }
        }
      }

      if (adjacentToRevealed) {
        const key = `${r},${c}`;
        const prob = totalAdjMines / Math.max(1, adjacentHidden * 8);
        edgeCells.set(key, { r, c, prob });
      } else {
        allHidden.push({ r, c });
      }
    }
  }

  // Pick the edge cell with lowest probability
  if (edgeCells.size > 0) {
    const sorted = [...edgeCells.values()].sort((a, b) => a.prob - b.prob);
    return { type: 'prob', cell: sorted[0] };
  }

  // Random hidden cell
  if (allHidden.length > 0) {
    const pick = allHidden[Math.floor(Math.random() * allHidden.length)];
    return { type: 'random', cell: pick };
  }

  return null;
}

function doHint() {
  if (gameOver) return;
  if (!gameStarted) {
    // Auto-start by clicking a random cell
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    onCellClick(r, c);
    return;
  }

  // Clear previous hint
  hintCell = null;

  const result = findSafeCell();
  if (!result) return;

  if (result.type === 'mines') {
    // Auto-flag certain mines
    for (const m of result.cells) {
      if (!board[m.r][m.c].flagged) {
        board[m.r][m.c].flagged = true;
        flagsPlaced++;
      }
    }
    mineCountEl.textContent = totalMines - flagsPlaced;
    renderBoard();
    showToast(`提示: 已自动标记 ${result.cells.length} 个雷`, 'success');
  } else if (result.type === 'safe') {
    hintCell = result.cell;
    renderBoard();
    showToast(`提示: 已标出安全格 (共找到 ${result.cells.length} 个)`, 'success');
  } else {
    hintCell = result.cell;
    renderBoard();
    const typeText = result.type === 'prob' ? '概率推算' : '随机推荐';
    showToast(`提示: ${typeText} — 点击高亮格子`, 'success');
  }
}

// ==================== Overlay ====================
async function showOverlay(result) {
  const d = DIFFICULTIES[currentDiff];
  let html = '';
  let scoreData = null;

  if (result === 'win') {
    html += `<h2 class="win-title">🎉 恭喜过关！</h2>`;
    html += `<p class="result-stat">难度: ${d.name}</p>`;
    html += `<p class="result-stat">用时: ${elapsed} 秒</p>`;

    if (getToken()) {
      try {
        const res = await fetch(`${API}/scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            difficulty: currentDiff,
            time: elapsed,
            boardSize: rows * cols,
            mineCount: totalMines
          })
        });
        scoreData = await res.json();
        html += `<p class="result-score">🏆 ${scoreData.score} 分</p>`;
        html += `<p class="score-submitted">成绩已提交</p>`;
      } catch {
        html += `<p class="score-submitted" style="color:#ff6b6b">成绩提交失败</p>`;
      }
    } else {
      html += `<p style="color:#888;font-size:13px;">登录后可提交成绩参与排名</p>`;
    }
  } else {
    html += `<h2 class="lose-title">💥 踩到雷了！</h2>`;
    html += `<p class="result-stat">难度: ${d.name}</p>`;
    html += `<p class="result-stat">用时: ${elapsed} 秒</p>`;
  }

  html += `<button id="overlayRestart" class="btn btn-primary">🔄 再来一局</button>`;
  overlayContent.innerHTML = html;
  overlay.classList.remove('hidden');

  document.getElementById('overlayRestart').addEventListener('click', () => {
    overlay.classList.add('hidden');
    initGame();
    loadRanking();
    loadMyScores();
  });

  loadRanking();
  loadMyScores();
}

// ==================== Ranking ====================
async function loadRanking() {
  const diffParam = currentDiff;
  try {
    const res = await fetch(`${API}/scores?difficulty=${diffParam}`);
    const data = await res.json();
    rankTitle.textContent = `- ${DIFFICULTIES[currentDiff].name}`;

    if (data.length === 0) {
      rankingContent.innerHTML = `<div class="empty-state">暂无排名数据<br>完成游戏即可上榜</div>`;
      return;
    }

    const curUser = getUsername();
    let html = `<table class="rank-table">
      <thead><tr><th class="rank-num">#</th><th>玩家</th><th>用时</th><th>分数</th></tr></thead><tbody>`;

    data.forEach((s, i) => {
      const rank = i + 1;
      const isMe = curUser && s.username === curUser;
      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
      html += `<tr class="${isMe ? 'rank-me' : ''}">
        <td class="rank-num ${rankClass}">${rank <= 3 ? ['🥇','🥈','🥉'][i] : rank}</td>
        <td>${escHtml(s.username)}${isMe ? ' ⭐' : ''}</td>
        <td>${s.time}秒</td>
        <td>${s.score}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    rankingContent.innerHTML = html;
  } catch (e) {
    rankingContent.innerHTML = `<div class="empty-state">加载排行榜失败</div>`;
  }
}

async function loadMyScores() {
  const token = getToken();
  if (!token) {
    myScoresContent.innerHTML = `<div class="empty-state">登录后查看个人成绩</div>`;
    return;
  }

  try {
    const res = await fetch(`${API}/my-scores`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.length === 0) {
      myScoresContent.innerHTML = `<div class="empty-state">暂无成绩<br>完成游戏后自动记录</div>`;
      return;
    }

    let html = `<table class="rank-table">
      <thead><tr><th>难度</th><th>用时</th><th>分数</th><th>日期</th></tr></thead><tbody>`;

    data.forEach(s => {
      const diffName = DIFFICULTIES[s.difficulty]?.name || '未知';
      html += `<tr>
        <td>${diffName}</td>
        <td>${s.time}秒</td>
        <td>${s.score}</td>
        <td>${new Date(s.date).toLocaleDateString('zh-CN')}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    myScoresContent.innerHTML = html;
  } catch {
    myScoresContent.innerHTML = `<div class="empty-state">加载个人成绩失败</div>`;
  }
}

// ==================== Helpers ====================
function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function showToast(msg, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ==================== Event Listeners ====================
hintBtn.addEventListener('click', doHint);

restartBtn.addEventListener('click', () => {
  initGame();
  loadRanking();
  loadMyScores();
});

// Difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDiff = Number(btn.dataset.diff);
    initGame();
    loadRanking();
    loadMyScores();
  });
});

// ==================== Keyboard shortcuts ====================
document.addEventListener('keydown', (e) => {
  if (e.key === 'h' && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
    doHint();
  }
  if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
    initGame();
    loadRanking();
    loadMyScores();
  }
});

// Prevent context menu on board
boardEl.addEventListener('contextmenu', e => e.preventDefault());

// ==================== Start ====================
updateAuthUI();
initGame();
loadRanking();
loadMyScores();
