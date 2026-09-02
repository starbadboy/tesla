# Intent — AI generation on GPT Image 2 with paid credits

## 0. Intent

- **Problem:** The editor's AI wrap generator offers three providers. Gemini is unwanted. The OpenAI path runs an older model and ignores the wrap template, so it does not lay the design on the real panels. Paid generation costs the site owner real money per image with no way for users to pay for it, and generated results vanish when the session ends.

- **Proposed outcome:** The AI panel offers two tiers: Free (Puter, unchanged, anonymous) and Pro (GPT Image 2, template sent as the input image, 10 credits per generation). Logged-in users buy credit packs through Stripe Checkout, see their balance in the editor and user menu, and their generations are saved to the gallery. Users who have ever purchased may keep a generation private. Gemini is gone from server, client, dependencies, and env.

- **Affected systems:**
  - `server/index.js` image generation routes; new credits/payments routes; new Mongo collections (credit ledger, payment order); `User` gains a balance and a purchased flag; `Wrap` gains source/visibility/prompt fields; public wrap listings exclude private wraps.
  - `src/utils/gemini.ts` provider client; `src/components/WrapEditor/WrapEditor.tsx` AI panel, My Generations panel, new Buy Credits modal; `src/components/Auth/UserMenu.tsx` balance; `src/contexts/AuthContext.tsx` user shape; translations.
  - `package.json` (drop `@google/generative-ai`, add `stripe`, add `vitest`), `.env` keys, Railway env, Stripe dashboard webhook.

- **Constraints:**
  - Puter free tier stays anonymous, free, and behaviourally unchanged.
  - Anonymous generations are never written to the server (no open write path).
  - Credits are reserved before the paid call and refunded on failure; the decrement is atomic so a double click cannot overspend.
  - Webhook crediting is idempotent per Stripe session; amount and currency are checked against the order.
  - Generated images go to R2, never as data URLs in Mongo.
  - Reuse the partner project's payment design (order record → Checkout session with inline price → webhook marks paid → ledger entry). Same Stripe account unless the user says otherwise.
  - Existing wrap upload, gallery, like, and comment behaviour must not change.
  - No test infrastructure exists; add vitest for server credit and pricing logic only.

- **Resolved decisions:**
  - Gemini → removed entirely (route, dependency, env key, both UI unions).
  - OpenAI model → `gpt-image-2`, image edit endpoint with the template PNG as input, quality high, 1024x1024.
  - Free tier → Puter, 0 credits, no login.
  - Dead `src/components/TeslaStudio/` → untouched.
  - Payment processor → Stripe Checkout hosted page, packs defined in one server constant, inline `price_data`.
  - Pricing → 10 credits per Pro generation; packs 50/$5, 120/$10, 300/$20 USD.
  - Starter credits → none.
  - Failure → reserve then refund.
  - Persistence → every logged-in generation (free or Pro) saved as a Wrap; public by default; private allowed only for users with `hasPurchased`.
  - Private-mode rule → boolean on User set by first paid order.
  - Gallery → private wraps excluded from all public listings; no AI badge.
  - My Generations → logged in loads own AI wraps from server; anonymous keeps session-only list.
  - Provider selector → two-way Free / Pro toggle; Generate button shows cost.
  - Not logged in and Pro → open existing login modal. Insufficient credits → Generate disabled, Buy Credits highlighted.
  - Balance shown → AI panel and user menu.
  - After checkout → redirect back to editor, poll order, refresh balance, inline success message. Stripe sends the receipt.
  - Ledger → `credits` on User plus a transactions collection (purchase / consume / refund) with balance-after.
  - Tests → vitest on server credit ledger and pricing logic.

- **Out of scope:**
  - Reference-image tab (img2img from a user upload).
  - AI badge on gallery cards.
  - Deleting or refactoring `TeslaStudio.tsx`.
  - Starter or promotional credits, admin credit grants, refunds or dispute handling.
  - PayPal or any second processor.
  - Subscriptions.
  - Persisting anonymous generations.

- **Open questions:**
  - Stripe account and keys (test first, live later) — owner: user, supplied as Railway env before go-live.
  - Webhook registration in the Stripe dashboard after deploy — owner: user, steps handed over at the end.
