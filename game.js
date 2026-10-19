'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#ff5252', // Bomb - red
  '#26c6da', // Gravity - teal
];

// Darker variants for legibility on the light background
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
  '#d32f2f', // Bomb
  '#00838f', // Gravity
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8]],                                       // Bomb
  [[9]],                                       // Gravity
];

const BOMB = 8;
const GRAVITY = 9;
const POWERUP_ICONS = { [BOMB]: '💣', [GRAVITY]: '🧲' };
const BOMB_CHANCE = 0.1;
const GRAVITY_CHANCE = 0.06;
const BOMB_POINTS = 10;
const BOMB_RADIUS = 1; // 1 => 3x3 area

const SLOW_DURATION = 10000;  // ms of game time
const SLOW_FACTOR = 3;        // drop interval multiplier while active
const CHARGE_PER_LINE = 25;   // % of the meter per cleared line

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const abilityFill = document.getElementById('ability-fill');
const abilityStatus = document.getElementById('ability-status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const resumeBtn = document.getElementById('resume-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');
const startLevelSelect = document.getElementById('start-level');

const MAX_START_LEVEL = 15;
let startLevel = 1;

let theme = 'dark';
let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let charge, slowRemaining;
let combo, maxCombo, started = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const roll = Math.random();
  let type;
  if (roll < BOMB_CHANCE) type = BOMB;
  else if (roll < BOMB_CHANCE + GRAVITY_CHANCE) type = GRAVITY;
  else type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (slowRemaining <= 0) charge = Math.min(100, charge + cleared * CHARGE_PER_LINE);
    updateHUD();
  }
  return cleared;
}

function activateSlow() {
  if (charge < 100 || slowRemaining > 0) return;
  charge = 0;
  slowRemaining = SLOW_DURATION;
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function explode(cx, cy) {
  let destroyed = 0;
  for (let dy = -BOMB_RADIUS; dy <= BOMB_RADIUS; dy++) {
    for (let dx = -BOMB_RADIUS; dx <= BOMB_RADIUS; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      if (board[y][x]) {
        board[y][x] = 0;
        destroyed++;
      }
    }
  }
  score += destroyed * BOMB_POINTS * level;
  updateHUD();
}

// Compacts every column downward so no empty cells remain under a block.
function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c]) {
        const v = board[r][c];
        board[r][c] = 0;
        board[write--][c] = v;
      }
    }
  }
}

function lockPiece() {
  if (current.type === BOMB) explode(current.x, current.y);
  else if (current.type === GRAVITY) applyGravity();
  else merge();
  if (clearLines() > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  if (slowRemaining > 0) {
    abilityFill.style.width = `${(slowRemaining / SLOW_DURATION) * 100}%`;
    abilityFill.classList.add('active');
    abilityStatus.textContent = `${Math.ceil(slowRemaining / 1000)}s`;
  } else {
    abilityFill.style.width = `${charge}%`;
    abilityFill.classList.remove('active');
    abilityStatus.textContent = charge >= 100 ? 'LISTO (S)' : `${charge}%`;
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = (theme === 'light' ? COLORS_LIGHT : COLORS)[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (POWERUP_ICONS[colorIndex]) {
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#000';
    context.fillText(POWERUP_ICONS[colorIndex], x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlay.classList.remove('pause');
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showGameOverRecords();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    overlay.classList.remove('pause');
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    controlsList.classList.add('hidden');
    controlsBtn.textContent = 'Ver controles';
    overlay.classList.add('pause');
    overlay.classList.remove('hidden');
  }
}

function toggleControls(show) {
  const visible = show ?? controlsList.classList.contains('hidden');
  controlsList.classList.toggle('hidden', !visible);
  controlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
}

function setStartLevel(n) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, parseInt(n, 10) || 1));
  startLevelSelect.value = startLevel;
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) {}
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  let interval = dropInterval;
  if (slowRemaining > 0) {
    const prev = Math.ceil(slowRemaining / 1000);
    slowRemaining = Math.max(0, slowRemaining - dt);
    interval *= SLOW_FACTOR;
    if (Math.ceil(slowRemaining / 1000) !== prev) updateHUD();
  }
  if (dropAccum >= interval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = (startLevel - 1) * 10;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  charge = 0;
  slowRemaining = 0;
  combo = 0;
  maxCombo = 0;
  started = true;
  recordsGameOver.classList.add('hidden');
  startOverlay.classList.add('hidden');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlay.classList.remove('pause');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (!started) return;
  if ((e.code === 'KeyP' || e.code === 'Escape') && e.repeat) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'Escape') {
    if (paused && !controlsList.classList.contains('hidden')) toggleControls(false);
    else togglePause();
    return;
  }
  if (paused || gameOver) {
    // keep game keys from scrolling/activating focused controls while the menu is open
    if (paused && e.code === 'Space' && e.target !== startLevelSelect) e.preventDefault();
    return;
  }
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'KeyS':
      activateSlow();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { restartBtn.blur(); init(); });
resumeBtn.addEventListener('click', () => { resumeBtn.blur(); if (paused) togglePause(); });
controlsBtn.addEventListener('click', () => { controlsBtn.blur(); toggleControls(); });
startLevelSelect.addEventListener('change', () => {
  setStartLevel(startLevelSelect.value);
  startLevelSelect.blur();
});

for (let i = 1; i <= MAX_START_LEVEL; i++) {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = i;
  startLevelSelect.appendChild(opt);
}
try { setStartLevel(localStorage.getItem('startLevel')); } catch (e) { setStartLevel(1); }

// ---- Records (localStorage 'records') ----
const RECORDS_KEY = 'records';
const MAX_TOP = 5;
const startOverlay = document.getElementById('start-overlay');
const startRecords = document.getElementById('start-records');
const startBtn = document.getElementById('start-btn');
const recordsGameOver = document.getElementById('records-gameover');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsTable = document.getElementById('records-table');
const resetRecordsBtn = document.getElementById('reset-records-btn');
let pendingEntry = null; // score waiting for a player name

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  const rec = emptyRecords();
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.top)) {
      rec.top = data.top
        .filter(e => e && Number.isFinite(e.score))
        .map(e => ({
          name: String(e.name || 'Anónimo').slice(0, 12),
          score: e.score,
          lines: Number(e.lines) || 0,
          date: String(e.date || ''),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_TOP);
      rec.bestCombo = Number(data.bestCombo) || 0;
      rec.maxLines = Number(data.maxLines) || 0;
    }
  } catch (e) {}
  return rec;
}

function saveRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch (e) {}
}

function qualifiesForTop(rec, sc) {
  return sc > 0 && (rec.top.length < MAX_TOP || sc > rec.top[rec.top.length - 1].score);
}

// Draws top-5 table + bests into container (textContent only, no innerHTML).
function renderRecords(container, rec, highlight) {
  container.textContent = '';
  const table = document.createElement('table');
  table.className = 'records-table';
  const head = table.createTHead().insertRow();
  ['#', 'Nombre', 'Puntos', 'Líneas'].forEach(t => {
    const th = document.createElement('th');
    th.textContent = t;
    head.appendChild(th);
  });
  const body = table.createTBody();
  if (!rec.top.length) {
    const td = body.insertRow().insertCell();
    td.colSpan = 4;
    td.textContent = 'Sin récords aún';
    td.className = 'records-empty';
  }
  rec.top.forEach((e, i) => {
    const tr = body.insertRow();
    if (e === highlight) tr.className = 'records-highlight';
    [i + 1, e.name, e.score.toLocaleString(), e.lines].forEach(v => {
      tr.insertCell().textContent = v;
    });
  });
  container.appendChild(table);
  const bests = document.createElement('p');
  bests.className = 'records-bests';
  bests.textContent = `Mejor combo: ${rec.bestCombo} · Máx. líneas: ${rec.maxLines}`;
  container.appendChild(bests);
}

function showStartScreen() {
  renderRecords(startRecords, loadRecords(), null);
  startOverlay.classList.remove('hidden');
}

function showGameOverRecords() {
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, maxCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  recordsGameOver.classList.remove('hidden');
  if (qualifiesForTop(rec, score)) {
    pendingEntry = { name: '...', score, lines, date: new Date().toISOString().slice(0, 10) };
    const preview = {
      top: rec.top.concat(pendingEntry).sort((a, b) => b.score - a.score).slice(0, MAX_TOP),
      bestCombo: rec.bestCombo,
      maxLines: rec.maxLines,
    };
    renderRecords(recordsTable, preview, pendingEntry);
    nameForm.classList.remove('hidden');
    nameInput.value = '';
    overlay.classList.remove('hidden'); // must be visible to take focus
    nameInput.focus();
  } else {
    pendingEntry = null;
    nameForm.classList.add('hidden');
    renderRecords(recordsTable, rec, null);
  }
}

function submitName() {
  if (!pendingEntry) return;
  const rec = loadRecords();
  const entry = {
    name: nameInput.value.trim().slice(0, 12) || 'Anónimo',
    score: pendingEntry.score,
    lines: pendingEntry.lines,
    date: pendingEntry.date,
  };
  pendingEntry = null;
  rec.top.push(entry);
  rec.top.sort((a, b) => b.score - a.score);
  rec.top = rec.top.slice(0, MAX_TOP);
  saveRecords(rec);
  nameForm.classList.add('hidden');
  renderRecords(recordsTable, rec, entry);
  nameInput.blur();
}

nameForm.addEventListener('submit', e => { e.preventDefault(); submitName(); });
// Restarting without saving a name stores the qualifying score as 'Anónimo'.
restartBtn.addEventListener('click', () => { submitName(); restartBtn.blur(); });
startBtn.addEventListener('click', () => { startBtn.blur(); init(); });
resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  pendingEntry = null;
  nameForm.classList.add('hidden');
  renderRecords(recordsTable, emptyRecords(), null);
  renderRecords(startRecords, emptyRecords(), null);
});

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) {}
  themeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  if (board && current) { draw(); drawNext(); }
}

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // keep Space/Enter from re-triggering the toggle
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') || 'dark'; } catch (e) {}
applyTheme(savedTheme);

showStartScreen();
