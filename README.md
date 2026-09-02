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
| `OPENAI_API_KEY` | AI image generation |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 media storage |
| `RESEND_API_KEY` | Password-reset email through Resend; without it the link is logged (never sent) outside production |
| `MAIL_FROM` | Sender for reset email, e.g. `Tesla Studio <noreply@your-verified-domain>`; defaults to Resend's onboarding sender, which reaches only the account owner |
| `APP_PUBLIC_URL` | Public site URL used in emailed links (defaults to the request origin outside production) |
| `JWT_SECRET` | Signs login tokens |

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
