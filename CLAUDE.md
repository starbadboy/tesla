# Tesla Studio

React + Vite client in `src/`, Express + Mongoose API in `server/` (one process serves both in production).

## Commands

- `npm run build` — type-check and bundle the client (`tsc -b && vite build`). The syntax gate for any client change.
- `npm run lint` — ESLint over `src/`. Baseline on main: 27 pre-existing problems; a change must not add to it.
- `npm test` — Vitest over `server/**/*.test.js` (pure server logic only).
- `node --check server/index.js` — syntax gate for server changes; the server has no bundler.
- `npm run dev` + `node server/index.js` — Vite on 5173 proxying `/api` to the API on 5001.

## Conventions

- In a React effect, put the state update after an `await` inside an inner async function; the `set-state-in-effect` lint rule flags any setter reached synchronously from the effect body, including through a `useCallback`.
- Build every URL that leaves the server (emailed links, payment return URLs) from `APP_PUBLIC_URL`; never from the request's `Origin` or `Host` header.
- Mint login tokens only through `generateToken` in `server/routes/auth.js`, so every token carries the same claims (`id`, `username`, `isAdmin`).
- Server files are CommonJS; client files are TypeScript modules. Server tests import CommonJS modules from ESM test files, which Vitest handles.
