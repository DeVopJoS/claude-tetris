# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris implemented in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no build step, no package.json.

## Running

No build/install needed. Either open `index.html` directly in a browser, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There are no tests and no linter configured.

## Architecture

Three files, all logic lives in `game.js` (~300 lines):

- `index.html` — DOM shell: `<canvas id="board">` (300×600, i.e. COLS×BLOCK by ROWS×BLOCK), a `<canvas id="next-canvas">` for the preview piece, HUD spans (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`.
- `style.css` — dark/retro arcade visuals.
- `game.js` — all game logic, organized around global mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`) reset by `init()`.

Key mechanics in `game.js`:

- **Board model**: `ROWS × COLS` matrix; each cell is `0` (empty) or a piece color index `1–7`.
- **Pieces**: square matrices in `PIECES`; rotation is transpose+reverse via `rotateCW`.
- **Collision** (`collide`): bounds + overlap check against `board`.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns before giving up.
- **Game loop** (`loop`): `requestAnimationFrame`-driven; accumulates elapsed time in `dropAccum` and drops one row once it exceeds `dropInterval`.
- **Line clearing** (`clearLines`): scans bottom-up, splices full rows out and unshifts empty rows at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × current level; hard drop adds 2 pts/cell dropped, soft drop adds 1 pt/row.
- **Leveling/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Bomb piece** (type `BOMB = 8`, 1×1): spawns with probability `BOMB_CHANCE` (10%) in `randomPiece`. On lock, `lockPiece` calls `explode` instead of `merge`: clears the 3×3 area (`BOMB_RADIUS = 1`) centered on the bomb, scoring `BOMB_POINTS` (10) × blocks destroyed × level. Drawn with a 💣 emoji in `drawBlock`.
- **Gravity power-up** (type `GRAVITY = 9`, 1×1, 🧲): random special piece (`GRAVITY_CHANCE` 6%, rolled after the bomb in `randomPiece`). On lock, `lockPiece` calls `applyGravity` instead of `merge`: every column is compacted downward (no holes), then `clearLines` runs, so compaction can complete rows. Power-up icons live in `POWERUP_ICONS`.
- **Slow-time ability**: `charge` (0–100) grows `CHARGE_PER_LINE` (25) per cleared line in `clearLines` (not while active). At 100, key `S` calls `activateSlow`: `slowRemaining = SLOW_DURATION` (10 s of game time, so pause doesn't consume it) and `loop` multiplies the drop interval by `SLOW_FACTOR` (3). HUD bar `#ability-fill` shows charge, then remaining time.
- **Skins**: `SKINS = {retro, neon, pastel, pixel}`, each `{dark, light, draw}` (palettes per theme + `draw(context, x, y, color, size)`). `drawBlock` is the single draw path (board, ghost, current, next): resolves color from active `skin`/`theme`, dispatches to `skin.draw`, then draws power-up emoji. `applySkin(name)` saves localStorage `skin`, sets `data-skin` on `<html>` (early inline script in `<head>` avoids flash), updates `gridColor` from CSS `--grid` and redraws. Selector `#skin-select` in header. Neon uses `shadowBlur` (reset after each block) and CSS forces black board bg; skin is orthogonal to light/dark theme.
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

Flow: `init()` → `createBoard()`, pick `next`, `spawn()` (promotes `next` to `current`, generates a new `next`), start `loop` via rAF. `spawn()` calling `collide` immediately (piece spawns into existing blocks) triggers `endGame()`.

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).
