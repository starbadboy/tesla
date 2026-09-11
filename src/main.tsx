import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RenderStage } from './RenderStage.tsx'
import { EMBED_ROUTE, EmbedStage } from './EmbedStage.tsx'
import { initializeNavigation } from './utils/navigation'

// `?render=1` mounts the headless render surface that scripts/render-wraps.mjs drives,
// and /embed/wrap/:id the bare viewer other sites iframe. StrictMode is skipped for
// both: its double effects would fire the wrap load twice.
const isRender = new URLSearchParams(window.location.search).get('render') === '1'
const embedId = EMBED_ROUTE.exec(window.location.pathname)?.[1]
if (!isRender && !embedId) initializeNavigation()

createRoot(document.getElementById('root')!).render(
  isRender ? <RenderStage /> : embedId ? <EmbedStage wrapId={embedId} /> : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
)
