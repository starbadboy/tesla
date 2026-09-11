import { useEffect, useRef, useState } from 'react';
import { DesignCanvas, type DesignCanvasHandle, type LayerTransform } from './components/DesignCanvas';
import { ThreeDView } from './components/ThreeDView';
import { CAR_3D_MODELS, CAR_MODELS } from './constants';
import type { Wrap } from './components/Gallery';
import { fetchWrap, proxiedMediaUrl } from './utils/wrapApi';
import { SITE_URL, wrapPath } from '../shared/seo';

const FRESH_LAYER: Record<string, LayerTransform> = {
    'Full Wrap': { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
};

export const EMBED_ROUTE = /^\/embed\/wrap\/([0-9a-f]{24})$/i;

/**
 * The bare 3D viewer for one wrap, mounted instead of App for /embed/wrap/:id so other
 * sites can iframe it. Same wrap pipeline as RenderStage, plus a link back to the page.
 */
export function EmbedStage({ wrapId }: { wrapId: string }) {
    const canvasRef = useRef<DesignCanvasHandle>(null);
    const [wrap, setWrap] = useState<Wrap | null>(null);
    const [layer, setLayer] = useState<string | null>(null);
    const [transforms, setTransforms] = useState<Record<string, LayerTransform>>({});
    const [visible, setVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const model = wrap?.models?.find(name => CAR_3D_MODELS[name]) ?? null;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const found = await fetchWrap(wrapId);
                if (cancelled) return;
                if (!found.imageUrl) throw new Error('no image');
                const blob = await (await fetch(proxiedMediaUrl(found.imageUrl))).blob();
                if (cancelled) return;
                document.title = `${found.name} | Tesla Studio`;
                setWrap(found);
                setTransforms(FRESH_LAYER);
                setLayer(URL.createObjectURL(blob));
                // ThreeDView binds a new sheet only when showTexture cycles; see App.
                await new Promise(resolve => window.setTimeout(resolve, 60));
                if (!cancelled) setVisible(true);
            } catch (err) {
                console.error('Embed load failed', err);
                if (!cancelled) setError('This wrap is not available.');
            }
        })();
        return () => { cancelled = true; };
    }, [wrapId]);

    const pageUrl = wrap ? SITE_URL + wrapPath(wrap) : SITE_URL;

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {model && (
                <ThreeDView
                    stageRef={canvasRef}
                    modelPath={CAR_3D_MODELS[model]}
                    isActive
                    showTexture={visible}
                    language="en"
                    autoRotate
                    hideWrapToggle
                />
            )}
            {wrap && !model && (
                <p style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', margin: 0, fontSize: 14, opacity: 0.7 }}>
                    No 3D model for this car yet.
                </p>
            )}
            {error && (
                <p style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', margin: 0, fontSize: 14, opacity: 0.7 }}>{error}</p>
            )}
            {model && (
                <div style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
                    <DesignCanvas
                        ref={canvasRef}
                        modelPath={CAR_MODELS[model]}
                        layers={layer ? { 'Full Wrap': layer } : {}}
                        transforms={transforms}
                        onTransformChange={(id, transform) => setTransforms(current => ({ ...current, [id]: transform }))}
                        selectedId={null}
                        onSelect={() => undefined}
                        onExport={() => undefined}
                        mode="select"
                        brushColor="#000000"
                        brushSize={5}
                        canvasType="car"
                        plateSize="420x200"
                    />
                </div>
            )}
            <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    position: 'absolute', left: 12, bottom: 12, padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 600,
                }}
            >
                {wrap ? `${wrap.name} · ` : ''}Tesla Studio ↗
            </a>
        </div>
    );
}
