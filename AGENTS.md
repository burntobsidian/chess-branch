# Working on Branch

Single-screen, local-first chess opening trainer. Preserve the small scope.

## Tooling

- Use Vite+ (`vp`) for installation, development, tests, checks, and builds.
- Bun is the package manager selected in package.json. Commit bun.lock; do not introduce npm or pnpm lockfiles.
- `vp install` prepares the local Stockfish assets through postinstall.
- Verify changes with `vp check`, `vp test run`, and `vp build`.
- Browser smoke tests: `vp exec playwright test` (uses installed Google Chrome in an isolated headless profile).

## Architecture

- `src/core/store.ts` is the single application action/state boundary. Components dispatch actions, never mutate the repertoire or implement practice rules.
- Pure domain operations live beside the store: `repertoire.ts` and `practice.ts`.
- IndexedDB and Stockfish are behind `storage.ts` and `engine.ts`.
- The sidebar explorer owns only UI expansion/focus state. Expand/collapse must not change board selection; opening selection chooses whole-opening scope and variation selection chooses line scope. Support keyboard tree navigation.
- React-local state is only for presentation/input drafts, never authoritative chess state.
- Derive chess positions from move sequences; do not store a second authoritative Chess instance or FEN.
- Keep saved repertoire, exploration drafts, and practice attempts separate. Never automatically add a mistake or engine suggestion to saved lines.
- Practice supports a selected variation or an entire opening (a queue that visits each eligible saved variation once). Each drill follows its selected move path. A legal unsaved move is not necessarily a bad chess move.
- Do not expose future moves or engine analysis while recalling a line.
- Preserve PGN branches and validate imports/backups before replacing anything.
- Never infer opening ownership from shared moves. Preserve explicit user grouping in v2. Legacy migration may group only original explicit imported variation names with their matching main line. Recovery of already-saved mixed groups must be previewed and explicitly applied.
- Persistence schema changes require a migration and round-trip tests. Keep queued writes ordered. Schema v2 adds openings; validateLibrary migrates v1 backups without deleting line IDs or practice history.

## Scope

- One home screen, no routing, accounts, server, cloud sync, or telemetry.
- Openings own named variations through openingId. Variations store complete move paths for simplicity; common prefixes are currently duplicated, not a graph. Do not imply transposition-based training or shared-node edits exist.
- Practice history stores completed and partial sessions, misses and reveals. No spaced-repetition scheduling yet.
- Cover meaningful core behavior changes with tests. Do not expand the product merely to improve test coverage.
