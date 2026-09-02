# Forgot password / reset by email — Implementation Plan

> **For Agent:** Execute task-by-task; verify before proceeding; commit after each task.
> **TDD Rule:** No production code without a failing test first, where a test point exists; glue and UI are gated by build, lint, syntax check, and the running app.

**Goal:** A designer can request a one-hour, single-use reset link by email and set a new password that signs them in; nothing reveals which emails exist.
**Architecture:** Express + Mongoose auth router gains two endpoints backed by a pure token helper, a pure throttle, and a Resend mail helper; the React login dialog gains forgot and reset views; the user menu opens it from a URL token.
**Complexity Path:** `Simplified TDD path` — no E2E infrastructure in this repo.
**Status:** In Progress

## Architecture Review

Reused as-is:
- `server/routes/auth.js` router, `generateToken(user)` helper, bcrypt hashing at cost 10.
- `server/models/User.js` — two fields added.
- `AuthModal.tsx` shell, inputs, error box, `Button`; `useAuth().login(token, user)`.
- URL-parameter-at-load pattern (read once, clean with `history.replaceState`).
- `APP_PUBLIC_URL` already documented in README for checkout.

Files that change:
- Server: `server/routes/auth.js`, `server/models/User.js`, new `server/utils/resetToken.js`, new `server/utils/throttle.js`, new `server/utils/mail.js`, new tests `server/__tests__/{resetToken,throttle,mail}.test.js`.
- Client: `src/components/Auth/AuthModal.tsx`, `src/components/Auth/UserMenu.tsx`.
- Docs/env: `README.md` environment table, `.env` (local only).

## Shape — Ladder Pass

| Candidate | Rung reached | Kept / Skipped | Reason (one line) |
|---|---|---|---|
| nodemailer over Resend SMTP (partner pattern) | 3 | Skipped | Node fetch to Resend's HTTPS API is ~15 lines and no dependency. |
| Separate reset-token collection (partner pattern) | 2 | Skipped | Two fields on `User`; a new request overwrites, which also gives "only newest link works" for free. |
| `express-rate-limit` dependency | 6 | Skipped | One Map with pruning, ~20 lines, injected clock for the test. `skipped: distributed limiter, add when the server runs more than one process.` |
| Reset page / router | 2 | Skipped | Same `?param` at load pattern as checkout; dialog opens in reset mode. |
| Translation keys for the dialog | 2 | Skipped | `AuthModal.tsx` is English-only today; match the file. Recorded as a departure from Round 1 item 9. |
| Password-version check on login tokens | 1 | Skipped (out of scope) | Follow-up; recorded in intent. |
| Constant-time response for forgot | 1 | Skipped | Throttle bounds probing; recorded in spec Further Notes. |
| Email templating library | 6 | Skipped | One template literal for text and one for HTML. |
| Storing raw token | — | Never | SHA-256 hash only (security floor). |

Skipped work, in the plan's words:
- `skipped: distributed rate limiter, add when the server runs more than one process.`
- `skipped: invalidating existing sessions on reset, add with a password-version claim when credits balances justify it (follow-up).`

## Prefactoring
None. The auth router and dialog take the additions without untangling.

## Implementation Steps

### Task 1 — Server: request and perform a reset (token, throttle, mail)
- RED: `server/__tests__/resetToken.test.js` — `issue()` returns `{ token, hash, expiresAt }` with a 64-hex token, hash = sha256(token), expiry one hour ahead of an injected `now`; `hashToken(token)` equals `hash`; `isLive(expiresAt, now)` false at and after expiry. `server/__tests__/throttle.test.js` — `createThrottle({ limit: 3, windowMs, now })`: three allowed, fourth refused, allowed again after the window, keys independent, pruning drops stale keys. `server/__tests__/mail.test.js` — `resetEmail(link)` returns subject, text and html each containing the link verbatim.
- GREEN: `server/utils/resetToken.js` (`issue`, `hashToken`, `isLive`), `server/utils/throttle.js` (`createThrottle`), `server/utils/mail.js` (`resetEmail(link)`, `sendMail({ to, subject, text, html })` → POST `https://api.resend.com/emails` with `Authorization: Bearer RESEND_API_KEY`; when no key: outside production `console.warn` the text body and return `{ sent: false }`, in production `console.error` and return `{ sent: false }`).
- `User.js`: `resetTokenHash: String`, `resetTokenExpires: Date` (both `select: false`).
- `auth.js`: `POST /forgot` `{ email }` → 400 if not a string with `@`; throttle by lowercased email and by `req.ip` → 429 `{ error: 'Too many reset requests, try again later' }`; find user by email; if found, `issue()`, store hash and expiry, build link `${base}/?reset=${token}` with `base = APP_PUBLIC_URL || (NODE_ENV !== 'production' && req.get('origin'))`, `sendMail`; always respond 200 `{ message: 'If an account exists for that address, a reset link is on its way.' }`. `POST /reset` `{ token, password }` → 400 unless token is a string and password is a string of at least 8; `hashToken(token)`, find `{ resetTokenHash: hash, resetTokenExpires: { $gt: new Date() } }`; none → 400 `{ error: 'This reset link is no longer valid', code: 'RESET_INVALID' }`; else set `passwordHash`, unset both reset fields, save, respond `{ token: generateToken(user), user: {...same shape as login} }`.
- Verify: `npm test` green; `node --check` on the four server files; with the server running and no `RESEND_API_KEY`, curl `/forgot` for the throwaway account prints the link in the server log, curl `/reset` with it and a new password returns a token, a second `/reset` with the same token returns `RESET_INVALID`, login with the new password succeeds and with the old fails, a fourth `/forgot` within the window returns 429.
- Blocked by: none.

### Task 2 — Client: forgot and reset views, URL-driven open
- `AuthModal.tsx`: view state widens to `'login' | 'register' | 'forgot' | 'reset'`; module-level `RESET_TOKEN` read once from `?reset=`; initial view `'reset'` when present; first render with a token calls `history.replaceState` to clean the URL. Login tab gets a "Forgot password?" text button under the password field. Forgot view: email input, submit → `/api/auth/forgot`, on 200 show the message in place of the form with a "Back to login" button; on 429 show the error. Reset view: password and confirm inputs, client check (≥ 8, equal) with inline error, submit → `/api/auth/reset`; success → `login(token, user)`, `onClose()`; `RESET_INVALID` → message plus "Request a new link" button that switches to the forgot view. Tabs row hidden on forgot and reset views; header title per view.
- `UserMenu.tsx`: `useState(() => Boolean(RESET_TOKEN))` for the dialog open state.
- Verify: `npm run build`, `npm run lint` at baseline (27), then the browser loop: forgot link visible; forgot view; generic message; open `/?reset=<token>` → reset view, URL cleaned; short password refused; mismatch refused; success signs in (avatar initial shows); reopen with the used token → invalid view → "Request a new link" returns to forgot view. Screenshots of each on the PR.
- Blocked by: Task 1.

### Task 3 — Docs and hand-over
- README environment table gains `RESEND_API_KEY` and `MAIL_FROM`; a sentence on the onboarding sender's limit. `.env` gains empty placeholders. CLAUDE.md unchanged unless a mistake repeats.
- Verify: README renders; PR description lists the owner steps.
- Blocked by: Task 2.

## Testing Strategy
- Unit (vitest, node): three pure modules as above.
- Syntax gate at every GREEN: `node --check` for server files, `npm run build` for client.
- UI loop on a throwaway account registered through the API; cleanup checkbox on the PR; screenshots per view and state.
- Slowest live path: one real Resend send timed, once a key is available; otherwise listed unverified.

## Risks & Mitigations
- **Riskiest task: 1's `/forgot` handler.** Any branch that answers differently for unknown emails leaks existence. Mitigation: one response object, built before the lookup; the lookup only decides whether to send.
- **Throttle keyed by `req.ip` behind Railway's proxy** sees the proxy address unless `trust proxy` is set; the email key still limits per-account abuse. Mitigation: use the first `X-Forwarded-For` hop as the existing anonymous-like code does.
- **Resend onboarding sender** only reaches the account owner. Mitigation: documented; `MAIL_FROM` with a verified domain before launch.
- **Token in the URL** lands in browser history and server access logs. Mitigation: one hour, single use, cleaned from the address bar on first render.

## Success Criteria
- [ ] AC1–AC12 met or listed unmet on the PR.
- [ ] `npm test`, `npm run build`, `npm run lint` output on the PR.
- [ ] Screenshots of every dialog view and state on the PR; cleanup ticked.
- [ ] Tri-axis review and fix-pass verdict on the PR.

## Record
- **Branch:** `feat/password-reset` (cut from `main`) · **PR:** pending
- **Interrogation pass:** 3 findings fixed — (1) the throttle test needed an injected clock or it could not test the window; added `now` to the factory. (2) Task 2's "first render cleans the URL" must run once, not on every render; specified as a module-level read plus a one-shot effect. (3) `req.ip` behind the proxy would collapse all clients to one key; specified the forwarded-for hop, as the existing anonymous fingerprint does.
- **Departures:**
  - Dialog strings stay English (Round 1 item 9 said both languages) — `AuthModal.tsx` has no translation keys today; matching the file.
- **Review fixes (one commit):** link base comes only from `APP_PUBLIC_URL` (the Origin fallback let a request header aim a real reset email at another host); `generateToken` carries `isAdmin` and register/login use it; `trust proxy` set and throttles key on `req.ip`; throttle map capped at 5000 keys; `/forgot` answers before the lookup and send so timing says nothing; `/reset` throttled per client and `resetTokenHash` indexed; dead `isLive`/`LIFETIME_MS` removed with their test; Resend fetch has a 10 s timeout, the link is HTML-escaped, the Resend id is logged; the dialog's views are explicit (`forgot-sent`, `reset-invalid`) with one button map; register's email input stays `text`; other query params survive the URL clean.
- **Departures:**
  - AC4 changed on security grounds: the link is logged only when `NODE_ENV` is explicitly `development`, never merely "not production" — Railway does not guarantee `NODE_ENV`, so the old rule could have written live tokens to production logs. Local `.env` sets `NODE_ENV=development` and `APP_PUBLIC_URL=http://localhost:5173`.
  - `RESET_TOKEN` lives in `src/utils/resetLink.ts` rather than inside `AuthModal.tsx` — fast-refresh lint forbids non-component exports from component files, and `UserMenu` needs the same value.
  - Throttle is a fixed window, not rolling: six requests can land within fifteen minutes across a window edge. Accepted; the plan's test wording already described the fixed window.
- **Declined review findings:**
  - Route tests on `mongodb-memory-server` — DB-level tests are a recorded skip for this repo (a binary download); the routes were exercised against the real database with curl and the browser, transcript on the PR.
  - Extracting the forgot and reset views into separate components — the explicit `View` union plus the button map removed the compound conditions; a split can follow when a third dialog variant arrives.
  - Using `req.ip` in `anonFingerprint` too — adjacent code outside this feature's scope; it still reads the first forwarded hop by hand and stays spoofable (follow-up).
- **Verification:** round 1 → *New problems* (throttle eviction could drop the key being counted; fixed in round 2 with a test that fails on the old code); round 2 verdict recorded on the PR.
- **Follow-ups:**
  - `anonFingerprint` in `server/index.js` should use `req.ip` now that `trust proxy` is set; the hand-parsed first hop is forgeable.
  - Invalidate existing login sessions on password change (password-version claim in the JWT), because accounts hold credits.
  - `/register` enforces no password minimum; the reset path requires 8. Align at registration (out of scope here).
  - PR #1 (`feat/ai-credits-gpt-image-2`) builds Stripe return URLs from the Origin header outside production — same class of issue as the one fixed here; tighten to `APP_PUBLIC_URL` only.
