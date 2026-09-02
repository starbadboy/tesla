# Tesla Wrap Studio

A premium web-based application for designing and visualizing custom car wraps for Tesla vehicles.

![Tesla Wrap Studio Preview](public/preview.png)
 
## Features

-   **Interactive Design Canvas**: specialized 2D editor for precise wrap placement and customization.
-   **AI Generation**: Generate unique wrap designs using AI prompts.
-   **Multi-Part Support**: Upload separate designs for different car parts (Front, Rear, Sides).
-   **Real-time 3D Preview**: Visualize designs on high-fidelity 3D models with:
    -   **Tesla Gallery Studio Lighting**: professional 5-point lighting setup.
    -   **Physically Based Rendering (PBR)**: Realistic car paint materials with custom roughness/clearcoat.
    -   **Custom Shader Integration**: Seamless blending of wrap designs with the base car model using UV mapping and alpha blending.
    -   Optimized with **Draco compression** for fast loading.
    -   Includes error handling and fallback states.
-   **Internationalization**: Full support for English and Traditional Chinese.
-   **Export**: High-quality export of your wrap designs.

## Environment

Server settings live in `.env` at the repo root (see `server/index.js`):

| Variable | Purpose |
|---|---|
| `MONGO_URL` | MongoDB connection string |
| `OPENAI_API_KEY` | Pro tier image generation (`gpt-image-2`) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 media storage |
| `RESEND_API_KEY` | Password-reset email through Resend. Without it nothing is sent; the link is logged only when `NODE_ENV=development` |
| `MAIL_FROM` | Sender for reset email, e.g. `Tesla Studio <noreply@your-verified-domain>`; defaults to Resend's onboarding sender, which reaches only the account owner |
| `STRIPE_SECRET_KEY` | Stripe Checkout for credit packs; without it purchases answer 503 |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the webhook endpoint below |
| `APP_PUBLIC_URL` | Public site URL used in emailed links and Stripe return URLs, e.g. `https://teslastudio.online`. Required for reset emails; never taken from the request |
| `JWT_SECRET` | Signs login tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth **Web application** client ID for Google/Gmail sign-in. Read at runtime by both the browser and the server; no client secret is needed |

**Stripe setup.** In the Stripe dashboard add a webhook endpoint at `https://<your-domain>/api/credits/webhook` for the events `checkout.session.completed` and `checkout.session.expired`, then paste its signing secret into `STRIPE_WEBHOOK_SECRET`. Locally, `stripe listen --forward-to localhost:5001/api/credits/webhook` prints a temporary secret. Packs and the per-generation cost are defined in `server/utils/packs.js`; nothing needs creating in the dashboard.

### Google / Gmail sign-in

1. In [Google Auth Platform](https://console.cloud.google.com/auth/clients), configure the app's branding/audience and create a **Web application** OAuth client. While the app is in testing, add the Google accounts that will test it to the test-user list.
2. Add the site's exact origins under **Authorized JavaScript origins**, for example `https://teslastudio.online`, `http://localhost`, and `http://localhost:5173`. Add any other actual development port or production hostname separately. Use `localhost` when testing locally.
3. Set `GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com` in the root `.env` locally and in the deployment's environment variables. Restart the API. This popup flow uses a JavaScript callback, so it needs no redirect URI, Google client secret, or Gmail API access. See [Google's setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
4. Open Login or Register and choose **Continue with Google**. A new Google account creates a regular user with zero credits. Existing Gmail or verified Google Workspace accounts with the same email keep their username, designs, likes, credits, and privileges. Other third-party email accounts are never automatically linked to existing password accounts. See [Google's verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

The button is hidden when `GOOGLE_CLIENT_ID` is unset. If the Google script fails to load, the dialog offers a retry and email sign-in stays available. Google users can add a password through the existing **Forgot password?** flow. Signing out ends the site's session without signing out of Google.

The server verifies the Google token before issuing the same seven-day app session used by password login. Only the public client ID is exposed by `/api/auth/google/config`; credentials are posted as JSON to `/api/auth/google` and never placed in URLs. If you add a Content Security Policy, allow Google's Identity Services script and frames as described in its setup guide. If you set `Cross-Origin-Opener-Policy`, use `same-origin-allow-popups` for the popup flow.

## Tech Stack

-   **Frontend**: React 19, TypeScript
-   **Build Tool**: Vite
-   **Styling**: TailwindCSS 4
-   **3D Rendering**: Three.js, React Three Fiber, Draco Compression
-   **Canvas**: Konva.js, React Konva

## Getting Started

1.  **Install dependencies**
    ```bash
    npm install
    ```

2.  **Start the development server**
    ```bash
    npm run dev
    ```

3.  **Build for production**
    ```bash
    npm run build
    ```

## Code Quality

Run the linter to ensure code standards:

```bash
npm run lint
```

## 3D Models Optimization

The project uses **Draco compression** for all `.glb` assets to minimize file size (~90% reduction).
If you need to add new models, ensure they are compressed first:

```bash
npx gltf-pipeline -i original.glb -o compressed-draco.glb -d
```

**CDN Hosting**:
Models are currently hosted via **jsDelivr** (GitHub CDN) to ensure fast global delivery and reduce server bandwidth.
Base URL: `https://cdn.jsdelivr.net/gh/starbadboy/tesla@main/public/models/`

## Contributing

1.  Fork the repository.
2.  Create your feature branch.
3.  Commit your changes.
4.  Push to the branch.
5.  Open a Pull Request.

## License

[MIT](LICENSE)
