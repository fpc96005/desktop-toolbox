const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'minesweeper-secret-key-2024';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

function readJSON(filepath) {
  if (!fs.existsSync(filepath)) return [];
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// Register
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 16) return res.status(400).json({ error: '用户名需要2-16个字符' });
  if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashed });
  writeJSON(USERS_FILE, users);

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

// Submit score
app.post('/api/scores', authMiddleware, (req, res) => {
  const { difficulty, time, boardSize, mineCount } = req.body;
  if (difficulty == null || time == null) return res.status(400).json({ error: '参数错误' });

  const scores = readJSON(SCORES_FILE);
  // Formula: base score scales by difficulty, less time = higher score
  const baseScore = boardSize * mineCount * 10;
  const timePenalty = Math.max(0, time);
  const score = Math.max(1, Math.floor(baseScore / (1 + timePenalty / 10)));

  scores.push({
    username: req.user.username,
    difficulty,
    time,
    boardSize,
    mineCount,
    score,
    date: new Date().toISOString()
  });

  // Keep top 100 per difficulty
  const filtered = scores.sort((a, b) => b.score - a.score).slice(0, 500);
  writeJSON(SCORES_FILE, filtered);
  res.json({ score, rank: filtered.findIndex(s => s === filtered[filtered.length - 1]) + 1 });
});

// Get leaderboard
app.get('/api/scores', (req, res) => {
  const { difficulty } = req.query;
  let scores = readJSON(SCORES_FILE);
  if (difficulty !== undefined && difficulty !== 'all') {
    scores = scores.filter(s => s.difficulty === Number(difficulty));
  }
  scores.sort((a, b) => b.score - a.score);

  // Deduplicate: keep only the best score per user
  const seen = new Set();
  const unique = [];
  for (const s of scores) {
    if (!seen.has(s.username)) {
      seen.add(s.username);
      unique.push(s);
    }
  }
  res.json(unique.slice(0, 50));
});

// Get current user's best scores
app.get('/api/my-scores', authMiddleware, (req, res) => {
  const scores = readJSON(SCORES_FILE);
  const my = scores.filter(s => s.username === req.user.username);
  my.sort((a, b) => b.score - a.score);
  res.json(my.slice(0, 20));
});

app.listen(PORT, () => {
  console.log(`Minesweeper server running at http://localhost:${PORT}`);
});
