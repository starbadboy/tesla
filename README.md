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
| `STRIPE_SECRET_KEY` | Stripe Checkout for credit packs; without it purchases answer 503 |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the webhook endpoint below |
| `APP_PUBLIC_URL` | Where Stripe sends the designer back (defaults to the request origin) |
| `JWT_SECRET` | Signs login tokens |

**Stripe setup.** In the Stripe dashboard add a webhook endpoint at `https://<your-domain>/api/credits/webhook` for the events `checkout.session.completed` and `checkout.session.expired`, then paste its signing secret into `STRIPE_WEBHOOK_SECRET`. Locally, `stripe listen --forward-to localhost:5001/api/credits/webhook` prints a temporary secret. Packs and the per-generation cost are defined in `server/utils/packs.js`; nothing needs creating in the dashboard.

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
