import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RenderStage } from './RenderStage.tsx'

// `?render=1` mounts the headless render surface that scripts/render-wraps.mjs drives.
// StrictMode is skipped there: its double effects would fire the wrap load twice.
const isRender = new URLSearchParams(window.location.search).get('render') === '1'

createRoot(document.getElementById('root')!).render(
  isRender ? <RenderStage /> : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
)
