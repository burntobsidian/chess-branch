# Branch · Learn Chess Tool

A single-screen chess opening trainer. Build openings with named variations, drill White or Black, explore unfamiliar moves, and explicitly save new variations. Data stays in this browser's IndexedDB.

## Run

```sh
vp install
vp dev
```

Open the local URL printed by Vite+. The project uses Vite+ with Bun (pinned in package.json).

```sh
vp check
vp test run
vp build
vp exec playwright test
```

Browser tests use an installed Google Chrome in an isolated headless profile. To use Playwright Chromium instead, remove `channel: "chrome"` from playwright.config.ts and run `vp exec playwright install chromium`.

## On the board

- Play moves by dragging or clicking source and target squares. Promotion asks for a piece.
- Save a named variation, paste notation, or import a PGN with nested variations.
- Click a previous move and play a different move to explore a branch. Saving adds a branch under the current opening; it never overwrites the original. Use New opening to start a separate repertoire.
- Rename openings and variations inline.
- Practice White or Black, choosing an entire opening or one selected variation. Whole-opening sessions visit every eligible variation once using Next variation. The app plays the opposing side. Mistakes and reveals are recorded independently of your repertoire.
- Analyze a position locally with Stockfish. Select a candidate to explore it, then explicitly save it.
- Files menu exports the repertoire, practice attempts, or a complete JSON backup. Restore replaces existing data after confirmation and validation.

## Deliberate limits

Each drill follows its selected variation. Whole-opening practice queues all its variations rather than accepting arbitrary switches between branches during a drill. Named move paths are stored independently; there is no transposition-aware graph or spaced-repetition scheduler yet. PGN exports write one game per variation, with the opening in Event and the branch name in Variation, so reimport preserves grouping. JSON backups preserve all app metadata. Custom starting FENs and chess variants are not supported in this version. Imports with unsupported starting positions fail rather than silently storing invalid moves.

Version 1 data migrates to grouped openings on load/restore. Legacy lines remain separate unless the original explicit “main name · variation N” label identifies their main line. Shared moves never imply shared ownership. Already-saved v2 groups are not automatically changed: use “Separate mixed openings…” to preview a name-based separation, then apply it. Undo is available until the next data edit or reload. IDs, moves, and practice history are preserved.

Storage is local to the browser and origin. Clearing site data removes it; export backups. Stockfish downloads from the same server on demand; core study does not require an external API, but full offline app installation is not implemented.

## Architecture

React + TypeScript, Zustand, chess.js, react-chessboard, IndexedDB (idb), @mliebelt/pgn-parser, Stockfish.js. All application behavior is under `src/core`; see AGENTS.md.

## Engine license

Stockfish.js is GPLv3. Postinstall copies the lightweight single-threaded engine and its license from the locked npm package into public/engine. That output is ignored and recreated on install. The source/build instructions are available at https://github.com/nmrugg/stockfish.js (use the release matching the version in bun.lock). Retain license notices and supply the corresponding source when distributing the engine. This repository has no separately chosen application license yet.
