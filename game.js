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

const COLORS_NEON = [
  null,
  '#00f0ff', '#fff200', '#d500f9', '#39ff14', '#ff1744', '#448aff', '#ff9100', '#ff3d00', '#1de9b6',
];
const COLORS_NEON_LIGHT = [
  null,
  '#00b8d4', '#e6c600', '#aa00ff', '#00c853', '#d50000', '#2962ff', '#ff6d00', '#dd2c00', '#00bfa5',
];
const COLORS_PASTEL = [
  null,
  '#a8e6ef', '#fff3b0', '#dcc1f0', '#c5eccb', '#f7c0c0', '#c3dcf7', '#fbd9b0', '#ffb3b3', '#a9e4dc',
];
const COLORS_PASTEL_LIGHT = [
  null,
  '#7fcfdc', '#f2dc7a', '#c39be0', '#9fd8a8', '#ee9a9a', '#9cc4ee', '#f4bb82', '#f28b8b', '#7fd0c4',
];

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawRetro(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawNeon(context, x, y, color, size) {
  const px = x * size + 3, py = y * size + 3, w = size - 6;
  context.shadowColor = color;
  context.shadowBlur = size * 0.5;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px, py, w, w);
  context.fillStyle = color;
  const base = context.globalAlpha;
  context.globalAlpha = base * 0.45;
  context.fillRect(px, py, w, w);
  context.globalAlpha = base;
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
}

function drawPastel(context, x, y, color, size) {
  const r = size * 0.28;
  roundedRectPath(context, x * size + 2, y * size + 2, size - 4, size - 4, r);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.7)';
  context.lineWidth = 1.5;
  context.stroke();
  // soft gloss
  roundedRectPath(context, x * size + 5, y * size + 5, size - 10, (size - 10) / 3, r / 2);
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fill();
}

function drawPixel(context, x, y, color, size) {
  const px = x * size, py = y * size, u = Math.max(2, Math.round(size / 10));
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // dither pattern
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let j = 1; j < size / u - 1; j++)
    for (let i = 1; i < size / u - 1; i++)
      if ((i + j) % 2 === 0) context.fillRect(px + i * u, py + j * u, u, u);
  // bevel: light top/left, dark bottom/right
  context.fillStyle = 'rgba(255,255,255,0.55)';
  context.fillRect(px + 1, py + 1, size - 2, u);
  context.fillRect(px + 1, py + 1, u, size - 2);
  context.fillStyle = 'rgba(0,0,0,0.45)';
  context.fillRect(px + 1, py + size - 1 - u, size - 2, u);
  context.fillRect(px + size - 1 - u, py + 1, u, size - 2);
}

const SKINS = {
  retro:  { dark: COLORS,       light: COLORS_LIGHT,       draw: drawRetro },
  neon:   { dark: COLORS_NEON,  light: COLORS_NEON_LIGHT,  draw: drawNeon },
  pastel: { dark: COLORS_PASTEL, light: COLORS_PASTEL_LIGHT, draw: drawPastel },
  pixel:  { dark: COLORS,       light: COLORS_LIGHT,       draw: drawPixel },
};

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
const skinSelect = document.getElementById('skin-select');

let theme = 'dark';
let skin = 'retro';
let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let charge, slowRemaining;

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
  clearLines();
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
  const sk = SKINS[skin];
  const color = (theme === 'light' ? sk.light : sk.dark)[colorIndex];
  context.globalAlpha = alpha ?? 1;
  sk.draw(context, x, y, color, size);
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
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
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
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  charge = 0;
  slowRemaining = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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

restartBtn.addEventListener('click', init);

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

function applySkin(name) {
  skin = SKINS[name] ? name : 'retro';
  document.documentElement.dataset.skin = skin;
  try { localStorage.setItem('skin', skin); } catch (e) {}
  skinSelect.value = skin;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  if (board && current) { draw(); drawNext(); }
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // keep arrows/Space from changing the selection
});

let savedSkin = 'retro';
try { savedSkin = localStorage.getItem('skin') || 'retro'; } catch (e) {}

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') || 'dark'; } catch (e) {}
applyTheme(savedTheme);
applySkin(savedSkin);

init();
