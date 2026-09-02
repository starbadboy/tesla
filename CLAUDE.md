# Tesla Studio

React + Vite client in `src/`, Express + Mongoose API in `server/` (one process serves both in production).

## Commands

- `npm run build` — type-check and bundle the client (`tsc -b && vite build`). The syntax gate for any client change.
- `npm run lint` — ESLint over `src/`. Baseline on main: 27 pre-existing problems; a change must not add to it.
- `npm test` — Vitest over `server/**/*.test.js` (pure server logic: packs, settlement, visibility).
- `node --check server/index.js` — syntax gate for server changes; the server has no bundler.
- `npm run dev` + `node server/index.js` — Vite on 5173 proxying `/api` to the API on 5001.

## Conventions

- Server files are CommonJS; client files are TypeScript modules. Server tests import CommonJS modules from ESM test files, which Vitest handles.
- Money and credit movements go through `server/utils/credits.js` and leave a row in `CreditTransaction`.
- Public wrap listings spread `publicMatch()` from `server/utils/visibility.js` so private generations never leak.
