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
- **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

Flow: `init()` → `createBoard()`, pick `next`, `spawn()` (promotes `next` to `current`, generates a new `next`), start `loop` via rAF. `spawn()` calling `collide` immediately (piece spawns into existing blocks) triggers `endGame()`.

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).
