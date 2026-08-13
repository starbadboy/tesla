import { useCallback, useEffect, useRef, useState } from 'react';
import { DesignCanvas, type DesignCanvasHandle, type LayerTransform } from './components/DesignCanvas';
import { ThreeDView } from './components/ThreeDView';
import { CAR_3D_MODELS, CAR_MODELS } from './constants';

const FRESH_LAYER: Record<string, LayerTransform> = {
    'Full Wrap': { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
};

declare global {
    interface Window {
        /** Loads a wrap sheet and resolves once it has been drawn onto the car. */
        __loadWrap?: (imageUrl: string) => Promise<void>;
        /** True once the car model itself is on screen. */
        __stageReady?: boolean;
    }
}

/**
 * The surface `scripts/render-wraps.mjs` drives to produce the gallery thumbnails.
 *
 * It reuses ThreeDView and DesignCanvas rather than reimplementing the wrap pipeline,
 * so a render is exactly what a visitor sees — including the trim rules, per-model UV
 * overrides and the wheels. Mounted instead of App when the URL carries `?render=1`,
 * with a transparent background so thumbnails composite anywhere.
 */
export function RenderStage() {
    const params = new URLSearchParams(window.location.search);
    const model = params.get('model') ?? 'Model 3 (2024 Base)';
    const size = Number(params.get('size') ?? 640);

    const canvasRef = useRef<DesignCanvasHandle>(null);
    const [layer, setLayer] = useState<string | null>(null);
    const [transforms, setTransforms] = useState<Record<string, LayerTransform>>({});
    const [visible, setVisible] = useState(false);

    const modelPath = CAR_3D_MODELS[model] ?? '';

    // Playwright's omitBackground only yields alpha if nothing behind the canvas paints.
    useEffect(() => {
        const previous = [document.documentElement.style.background, document.body.style.background];
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
        const root = document.getElementById('root');
        if (root) root.style.background = 'transparent';
        return () => {
            document.documentElement.style.background = previous[0];
            document.body.style.background = previous[1];
        };
    }, []);

    // A fresh sheet needs the wrap toggled off and on for ThreeDView to rebind it, the
    // same cycle the studio drives; the settle delay covers the texture upload.
    const loadWrap = useCallback(async (imageUrl: string) => {
        const proxied = imageUrl.includes('.r2.dev/')
            ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
            : imageUrl;
        const response = await fetch(proxied);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        setVisible(false);
        setTransforms(FRESH_LAYER);
        setLayer(objectUrl);
        await new Promise(resolve => window.setTimeout(resolve, 60));
        setVisible(true);
        await new Promise(resolve => window.setTimeout(resolve, 900));
    }, []);

    useEffect(() => {
        window.__loadWrap = loadWrap;
        return () => { delete window.__loadWrap; };
    }, [loadWrap]);

    useEffect(() => {
        if (!modelPath) return;
        // The model is fetched and parsed before the first frame lands; the script waits
        // on this flag rather than a fixed sleep.
        const timer = window.setTimeout(() => { window.__stageReady = true; }, 2500);
        return () => window.clearTimeout(timer);
    }, [modelPath]);

    return (
        <div id="render-stage" style={{ width: size, height: size, background: 'transparent' }}>
            {modelPath && (
                <ThreeDView
                    stageRef={canvasRef}
                    modelPath={modelPath}
                    isActive
                    showTexture={visible}
                    language="en"
                    autoRotate={false}
                    hideWrapToggle
                    transparent
                    fov={42}
                />
            )}
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
        </div>
    );
}
