# AI generation on GPT Image 2 with paid credits — Implementation Plan

> **For Agent:** Execute task-by-task; verify before proceeding; commit after each task.
> **TDD Rule:** No production code without a failing test first (where a test point exists; UI and glue are verified by build, lint, and the running app).

**Goal:** Two-tier AI panel (Free Puter, Pro GPT Image 2 with template), Gemini removed, credits bought via Stripe Checkout and spent per Pro generation, generations persisted with a private option for purchasers.
**Architecture:** Express + Mongoose server (`server/`), React + Vite client (`src/`). Payments ported from the partner project's order → Checkout → webhook → ledger shape.
**Complexity Path:** `Simplified TDD path` — no E2E infrastructure in this repo.
**Status:** In Progress

## Architecture Review

Reused as-is:
- `server/utils/r2.js` `uploadToR2` for generated images.
- `authenticateOptional` middleware in `server/index.js` (sets `req.user` from the bearer token).
- `POST /api/wraps` multipart upload for Free-tier saves from the client (as `ShareModal.tsx` does).
- `GET /api/user/garage?type=my-uploads` for My Generations (gains a `source` filter).
- `AuthModal` (`src/components/Auth/AuthModal.tsx`) for the sign-in prompt inside the editor.
- `OptionMenu` is replaced by a two-button toggle using the existing `.we-chips` style.

Files that change:
- Server: `server/index.js`, `server/routes/auth.js`, `server/models/User.js`, `server/models/Wrap.js`, new `server/models/CreditTransaction.js`, new `server/models/PaymentOrder.js`, new `server/routes/credits.js`, new `server/utils/packs.js`, new `server/utils/credits.js`, new `server/utils/visibility.js`, `scripts/render-wraps.mjs`.
- Client: `src/utils/gemini.ts` → renamed `src/utils/aiImage.ts`, `src/components/WrapEditor/WrapEditor.tsx`, new `src/components/WrapEditor/BuyCreditsModal.tsx`, `src/components/Auth/UserMenu.tsx`, `src/contexts/AuthContext.tsx`, `src/App.tsx`, `src/translations.ts`, `src/styles/wrap-editor.css`, `src/components/Gallery.tsx` (Wrap type).
- Root: `package.json`, `package-lock.json`, `.env` (local only), `vitest.config.ts`, new `server/__tests__/*.test.js`, `README.md` env section, `CLAUDE.md` Commands.

## Shape — Ladder Pass

| Candidate | Rung reached | Kept / Skipped | Reason (one line) |
|---|---|---|---|
| Separate credits balance collection (partner design) | 2 | Skipped | `User` already exists; a `credits` field is one line and one fewer join. |
| Credit ops as an injectable service/factory | 1 | Skipped | One implementation; plain functions requiring the models. |
| Ledger collection | 7 | Kept | Idempotency and history need a record; money path. |
| Order collection | 7 | Kept | Webhook must find the order and check amount; money path. |
| Stripe products in dashboard | 5 | Skipped | Inline `price_data` from one constant, no dashboard state. |
| Raw body via separate `express.raw` route ordering | 6 | Skipped | `bodyParser.json({ verify })` keeps the raw buffer in one line. |
| Server fetching car templates itself | 2 | Skipped | Client already fetches the template for Puter; reuse the same base64 path. |
| New endpoint to save Free generations | 2 | Skipped | `POST /api/wraps` already uploads a wrap; add three optional body fields. |
| Separate My Generations endpoint | 2 | Skipped | Garage endpoint plus a `source` query filter. |
| Visibility filter copied into each listing | 3 | Skipped | One helper returning the match object, used by `/api/wraps` and the render script. |
| Own receipt/success page | 1 | Skipped | Stripe emails the receipt; inline message in the panel suffices. |
| React Router for `?checkout=` handling | 4 | Skipped | `URLSearchParams` + `history.replaceState`. |
| Rename `gemini.ts` | 6 | Kept | File would be misnamed after the change; one import moves. |
| DB-level tests (mongodb-memory-server) | 1 | Skipped | Adds a binary download; reserve/refund are single conditional updates, exercised in the UI loop. `skipped: DB tests, add when a second money path lands.` |
| `input_fidelity: 'high'` on edit call | 7 | Kept | Template adherence is the point of the change; one field. |
| AI badge, reference tab, starter credits | 1 | Skipped | Out of scope per intent. |

Skipped work, in the plan's words:
- `skipped: DB-level tests, add when a second money path lands or a bug shows in reserve/refund.`
- `skipped: rate limit on the checkout endpoint, add when abuse shows in Stripe (orders are pending until paid; no cost to us).`

## Prefactoring
**Task 0** fixes the `/me` envelope mismatch in `AuthContext.tsx` (client stores `{user:{...}}` as the user) and adds `refreshUser()`. Behaviour-neutral for a fresh login; fixes reload. Committed separately before feature work.

## Implementation Steps

Each task is a vertical slice and demoable alone. Blocking edges are listed.

### Task 0 — Prefactor: current-user shape and refresh
- `AuthContext.tsx`: `setUser(res.data.user ?? res.data)`; expose `refreshUser()` that re-fetches `/api/auth/me` and sets the user.
- Verify: `npm run build`; reload the app while signed in and the avatar shows the initial, not `?`.
- Blocked by: none.

### Task 1 — Remove Gemini end to end
- Server: delete the `GoogleGenerativeAI` import and init and the `/api/generate-image-gemini` route.
- Client: delete the gemini branch and union member in the provider util; remove the option from `WrapEditor.tsx`; drop the `'gemini'` member from the type. Leave `TeslaStudio.tsx` untouched (dead, compiles on its own union).
- `package.json`: remove `@google/generative-ai`; `npm install` to update the lockfile. `.env`: remove `GEMINI_API_KEY`. README env list.
- Verify: `grep -ri gemini src server package.json` returns only the soon-to-be-renamed filename and `TeslaStudio.tsx`; `npm run build` passes; the panel shows two providers.
- Blocked by: none.

### Task 2 — Persist generations with visibility
- `Wrap.js`: add `source` (enum upload/ai, default upload), `isPublic` (default true), `prompt` (string, max 500).
- `server/utils/visibility.js`: `publicMatch()` returns `{ isPublic: { $ne: false } }`. Test point 3: unit test that the match excludes `false` and includes missing/true when applied to sample docs via a tiny in-memory predicate helper exported beside it (`isPublicDoc(doc)`).
- `/api/wraps` GET: unshift `publicMatch()` into the pipeline. `scripts/render-wraps.mjs`: spread `publicMatch()` into the query.
- `/api/wraps` POST: accept optional `source`, `prompt`, `isPublic` (string `'false'` → false). `isPublic:false` only honoured when the user has `hasPurchased` (field added in Task 4; until then any signed-in user may set it — Task 4 tightens it).
- Garage GET: optional `source` query narrows `Wrap.find`.
- Client: `Wrap` type gains `source?`, `isPublic?`, `prompt?`. `WrapEditor.tsx`: after a Free generation, if signed in, convert the data URL to a Blob and POST it through the existing upload path with `source=ai`, `prompt`, `models=[currentModelName]`, `isPublic`. Add the Share to Gallery checkbox (locked on until Task 4 adds `hasPurchased`). My Generations: when signed in, load `garage?type=my-uploads&source=ai`; anonymous keeps the session list.
- Verify: test passes; build passes; sign in, Free-generate, reload, My Generations lists it; gallery shows it; set `isPublic:false` in Mongo and it disappears from gallery but not My Generations.
- Blocked by: none (touches `WrapEditor.tsx` like Task 1, so run sequentially after Task 1).

### Task 3 — Pro tier on GPT Image 2 with the template
- Rename `src/utils/gemini.ts` → `src/utils/aiImage.ts`. Provider union `'puter' | 'openai'`. The openai branch sends `{ prompt, image: templateBase64, model: currentModelName, isPublic }` with the bearer token and returns `{ url, balance }`.
- Server `/api/generate-image`: require `req.user` (401 otherwise); decode the data URL to a Buffer; `openai.images.edit({ model: 'gpt-image-2', image: await toFile(buffer, 'template.png', { type: 'image/png' }), prompt, quality: 'high', input_fidelity: 'high', n: 1 })`; take `b64_json`; upload to R2 under `wraps/ai-<ts>.png`; create the Wrap (`source:'ai'`, `user`, `author`, `prompt`, `models:[model]`, `isPublic`); respond `{ url, wrapId }`. Credits are added in Task 4.
- Client: replace the `OptionMenu` with a Free / Pro two-button toggle (`.we-chips` style, `aria-pressed`). Selecting Pro while signed out opens `AuthModal` and stays on Free. Pro generation appends to My Generations from the response.
- Verify: build passes; signed-in Pro generation lands on the car and appears in the gallery; the request log shows `gpt-image-2`. Time the real call once and record it on the PR.
- Blocked by: Task 1, Task 2.

### Task 4 — Credits ledger and cost enforcement
- `server/utils/packs.js`: `GENERATION_COST = 10`, `PACKS` (50/$5, 120/$10, 300/$20, usd, amounts in cents), `findPack(id)`. Test point 1.
- `User.js`: `credits` (Number, default 0, min 0), `hasPurchased` (Boolean, default false). `auth.js`: include both in register, login, and `/me` responses.
- `CreditTransaction.js`: `user`, `type` (purchase/consume/refund), `amount` (signed int), `balanceAfter`, `order` (optional ref), `note`, `createdAt`.
- `server/utils/credits.js`: `reserve(userId, amount, note)` → `User.findOneAndUpdate({ _id, credits: { $gte: amount } }, { $inc: { credits: -amount } }, { new: true })`, null when insufficient, ledger `consume`; `refund(userId, amount, note)` → `$inc` plus ledger `refund`; `addPurchase(userId, credits, orderId)` → `$inc` and `$set hasPurchased`, ledger `purchase`.
- `/api/generate-image`: `reserve` first → 402 `{ error, balance }` when null; wrap the model call and upload in try/catch → `refund` on failure; include `balance` in the success body. `/api/wraps` POST: honour `isPublic:false` only when the user's `hasPurchased` is true (look up the user).
- `GET /api/credits/balance` (auth) → `{ credits, hasPurchased }` — or rely on `/me`; choose `/me` (already fetched by `refreshUser`). No new endpoint.
- Client: `AuthContext` `User` gains `credits`, `hasPurchased`. `WrapEditor.tsx`: cost label on Generate (`Generate — 10 credits`), balance line, Generate disabled on Pro when `credits < 10` with Buy Credits highlighted (button exists, modal arrives in Task 5), Share to Gallery unlocked only when `hasPurchased`; after any Pro generation call `refreshUser()`. `UserMenu.tsx`: one line with the balance.
- Verify: `npm test` passes (packs); build passes; with `credits` set to 10 in Mongo a Pro generation succeeds and balance shows 0, a second is blocked with 402 and the UI disables Generate; forcing a model error (bad key) refunds to 10.
- Blocked by: Task 3.

### Task 5 — Buy credits through Stripe Checkout
- `npm i stripe`. `PaymentOrder.js`: `user`, `packId`, `amount`, `currency`, `credits`, `status` (pending/paid/expired/failed), `stripeSessionId` (unique, sparse), `paidAt`, timestamps.
- `server/utils/credits.js`: pure `settle(order, session)` → `'paid' | 'duplicate' | 'mismatch'` from `order.status`, `session.amount_total`, `session.currency`. Test point 2.
- `server/routes/credits.js`: `GET /api/credits/packs` (public, from `packs.js`); `POST /api/credits/checkout` (auth) creates the pending order, then `stripe.checkout.sessions.create({ mode:'payment', customer_email, client_reference_id: order.id, line_items:[{ price_data:{ currency, product_data:{ name }, unit_amount }, quantity:1 }], metadata:{ orderId, userId, packId }, success_url: `${base}/?checkout=success&orderId=…`, cancel_url: `${base}/?checkout=cancel` })` where `base = APP_PUBLIC_URL || req.get('origin')`; stores the session id; returns `{ checkoutUrl }`. `GET /api/credits/orders/:id` (auth, own order) → `{ status, credits }`. `POST /api/credits/webhook`: `stripe.webhooks.constructEvent(req.rawBody, sig, secret)`; on `checkout.session.completed` find the order by `metadata.orderId`, run `settle`; `paid` → mark paid and `addPurchase`; `mismatch` → mark failed; `duplicate` → no-op. On `checkout.session.expired` mark expired if pending. Always 200 on handled events, 400 on bad signature.
- `server/index.js`: `bodyParser.json({ limit, verify: (req, _res, buf) => { req.rawBody = buf; } })`; mount `/api/credits`.
- Client: `BuyCreditsModal.tsx` lists packs from `/api/credits/packs`, each button POSTs checkout and sets `window.location.href`. `App.tsx`: initial `isEditorOpen` true when `location.search` has `checkout`. `WrapEditor.tsx`: on mount read `checkout`/`orderId`, poll the order up to 4 times at 1.2 s, `refreshUser()`, show success/cancel line, `history.replaceState` to clean the URL, and open the AI panel.
- `.env` (local): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_PUBLIC_URL`. README env section documents all three and the dashboard webhook step.
- Verify: `npm test` passes (settle); build passes; with test keys and `stripe listen --forward-to localhost:5001/api/credits/webhook`, buy the 50 pack with card 4242, return to the editor, balance shows +50 and `hasPurchased` unlocks Share to Gallery; replay the event with `stripe events resend` and the balance does not change.
- Blocked by: Task 4.

### Task 6 — Commands and hand-over
- Add `test` script (`vitest run`) and `vitest.config.ts` (node environment, `server/**/*.test.js`). Create `CLAUDE.md` Commands section naming `npm run build`, `npm run lint`, `npm test`. Done in Task 2 when the first test lands; this task only confirms and writes the deploy steps into the PR description.
- Blocked by: Task 5.

## Testing Strategy
- Unit (vitest, node): `packs.test.js` (pack table, cost, lookup), `credits.test.js` (`settle` decisions), `visibility.test.js` (public match predicate).
- Syntax gate at every GREEN: `npm run build` (tsc + vite) for client work; `node --check server/index.js server/routes/credits.js server/utils/*.js` for server work.
- UI loop: sign in on a throwaway account created through the app, seed credits by buying the 50 pack in Stripe test mode, screenshot each changed view: AI panel Free, AI panel Pro (enough credits), AI panel Pro (insufficient), Buy Credits modal, post-checkout success line, My Generations, user menu balance, gallery with a private wrap absent. Cleanup checkbox on the PR: delete the throwaway user, its wraps, ledger rows, and orders.
- Slowest live path: time one `gpt-image-2` edit call and post it on the PR.

## Risks & Mitigations
- **Riskiest task: 5 (webhook).** Signature verification needs the raw body; the `verify` hook must run for the webhook path (it will, JSON content type). Mitigation: test with the Stripe CLI before pushing; log the event id on every webhook.
- **Puter result is not a data URL.** Free-tier save fails silently and stays session-only (spec Further Notes). Mitigation: catch and `console.warn`, never surface as an error.
- **Body size.** Template base64 already flows today at 50 MB limit; unchanged.
- **Cost exposure.** Pro requires auth and a successful reserve before any model call; the free tier has no server cost.
- **Legacy wraps** have no `isPublic`; `$ne: false` keeps them public.
- **`/me` prefactor** changes what the client stores; `login()` already stores the plain user, so shapes now agree.

## Success Criteria
- [ ] AC1–AC16 in `spec.md` demonstrably met or listed unmet on the PR.
- [ ] `npm test`, `npm run build`, `npm run lint` pass; output on the PR.
- [ ] Screenshots of every changed view on the PR; cleanup box ticked.
- [ ] Tri-axis review findings and fix-pass verdict on the PR.

## Record
- **Branch:** `feat/ai-credits-gpt-image-2` · **PR:** pending (opened after first implementation commit)
- **Interrogation pass:** 4 findings fixed — (1) Task 2 originally let any signed-in user set `isPublic:false` before `hasPurchased` existed; noted as temporary and tightened in Task 4. (2) A separate `/api/credits/balance` endpoint duplicated `/me`; removed. (3) Task 3 verify step said "credits deducted" before credits existed; moved to Task 4. (4) Task ordering put Task 2 parallel with Task 1 though both edit `WrapEditor.tsx`; made sequential.
- **Departures:** (none yet)
- **Declined review findings:** (none yet)
- **Follow-ups:** (none yet)
