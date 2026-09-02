# Intent — Forgot password / reset by email

## 0. Intent

- **Problem:** A designer who forgets their password has no way back into their account. The login modal has only Login and Register, the server has only register, login, and me, and the app cannot send email at all. Accounts now hold purchased credits, so being locked out has a cost.

- **Proposed outcome:** The login tab offers "Forgot password?". Entering an email always yields the same "if an account exists, a link is on its way" message. The email carries a one-hour, single-use link back to the app, which opens a "Set new password" view. A valid new password signs the designer in immediately. Expired or reused links explain themselves and offer a fresh request. Mail goes out through Resend's HTTPS API; without an API key the server logs the link outside production.

- **Affected systems:**
  - Server: auth routes gain forgot and reset endpoints; User gains a reset token hash, expiry, and a password-changed timestamp is not added (see out of scope); a small mail helper calling Resend; an in-memory throttle on the forgot endpoint.
  - Client: AuthModal gains forgot and reset views; App opens the modal when a reset token is in the URL; translations.
  - Environment: `RESEND_API_KEY`, `MAIL_FROM`; existing `APP_PUBLIC_URL` reused. README environment table.

- **Constraints:**
  - The forgot endpoint never reveals whether an address is registered (same response, same timing shape).
  - Tokens are stored only as a SHA-256 hash; the raw token appears only in the email and the URL.
  - One hour lifetime, single use, a new request replaces the old token.
  - No new dependency: Node fetch for Resend, crypto for tokens.
  - Registration and login behaviour unchanged.
  - Throttle: three forgot requests per address and per IP per 15 minutes, in memory.
  - Vitest on the pure decisions only, as in the credits feature.

- **Resolved decisions:**
  - Delivery → email link via Resend HTTPS API (`RESEND_API_KEY`), not nodemailer.
  - Sender → `MAIL_FROM` env, fallback `Tesla Studio <onboarding@resend.dev>` for development.
  - Token storage → two fields on User (hash, expiry), no new collection.
  - Entry → "Forgot password?" link on the login tab; email only, not username.
  - Landing → app root with `?reset=<token>`, modal opens in reset mode, URL cleaned after use.
  - New password rule → at least 8 characters, confirm field must match.
  - After reset → signed in with a fresh login token, modal closes.
  - No mail key → outside production log the link; in production log an error, still answer generically.
  - Side effects → clear token, replace hash, nothing else.
  - Email → English, plain text plus one HTML link.

- **Out of scope:**
  - Invalidating existing 7-day login sessions on password change (password-version check) — recorded as a follow-up because accounts hold credits.
  - Email verification at registration.
  - Changing password while logged in (account settings).
  - Username-based recovery, SMS, or security questions.
  - Rate limiting on any other endpoint.
  - Registration password rules.

- **Open questions:**
  - Whether `teslastudio.online` is verified in Resend — owner: user. Until then the development fallback sender reaches only the account owner's own address.
  - `RESEND_API_KEY` and `MAIL_FROM` on Railway — owner: user, at deploy.
