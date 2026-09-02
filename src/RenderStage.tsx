import { useCallback, useEffect, useRef, useState } from 'react';
import { DesignCanvas, type DesignCanvasHandle, type LayerTransform } from './components/DesignCanvas';
import { ThreeDView } from './components/ThreeDView';
import { CAR_3D_MODELS, CAR_MODELS } from './constants';
import { proxiedMediaUrl } from './utils/wrapApi';

const FRESH_LAYER: Record<string, LayerTransform> = {
    'Full Wrap': { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
};

declare global {
    interface Window {
        /** Loads a wrap sheet and resolves once it has been drawn onto the car. */
        __loadWrap?: (imageUrl: string) => Promise<void>;
        /** Returns the current frame cropped to the car, as a PNG data URL. */
        __captureWrap?: () => string | null;
        /** True once the car model itself is on screen. */
        __stageReady?: boolean;
    }
}

/** Breathing room around the car, as a share of its longest side. */
const CROP_PADDING = 0.03;

/**
 * Alpha below this counts as empty stage. The GL buffer comes back with a faint wash
 * (~2% grey) over the whole frame instead of clean zeroes, so a plain "alpha > 0" test
 * finds the car nowhere and everywhere at once.
 */
const ALPHA_FLOOR = 24;

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
        const response = await fetch(proxiedMediaUrl(imageUrl));
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        setVisible(false);
        setTransforms(FRESH_LAYER);
        setLayer(objectUrl);
        await new Promise(resolve => window.setTimeout(resolve, 60));
        setVisible(true);
        await new Promise(resolve => window.setTimeout(resolve, 900));
    }, []);

    /**
     * Crops the frame to the car before handing it over. A plain screenshot keeps all the
     * empty stage around it, which leaves the car small inside a gallery card, and the
     * margin cannot be trimmed later in CSS because it is inside the PNG.
     */
    const capture = useCallback(() => {
        const gl = document.querySelector<HTMLCanvasElement>('#render-stage canvas');
        if (!gl) return null;

        const flat = document.createElement('canvas');
        flat.width = gl.width;
        flat.height = gl.height;
        const flatCtx = flat.getContext('2d');
        if (!flatCtx) return null;
        flatCtx.drawImage(gl, 0, 0);

        // One pass: clear the wash so the PNG is genuinely transparent (and compresses,
        // instead of storing 2MB of near-invisible noise) while measuring the car's bounds.
        const frame = flatCtx.getImageData(0, 0, flat.width, flat.height);
        const data = frame.data;
        let minX = flat.width, minY = flat.height, maxX = -1, maxY = -1;
        for (let y = 0; y < flat.height; y++) {
            for (let x = 0; x < flat.width; x++) {
                const at = (y * flat.width + x) * 4;
                if (data[at + 3] < ALPHA_FLOOR) {
                    data[at] = data[at + 1] = data[at + 2] = data[at + 3] = 0;
                    continue;
                }
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
        if (maxX < 0) return null;
        flatCtx.putImageData(frame, 0, 0);

        const pad = Math.round(Math.max(maxX - minX, maxY - minY) * CROP_PADDING);
        const left = Math.max(0, minX - pad);
        const top = Math.max(0, minY - pad);
        const width = Math.min(flat.width - left, maxX - minX + 1 + pad * 2);
        const height = Math.min(flat.height - top, maxY - minY + 1 + pad * 2);

        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const outCtx = out.getContext('2d');
        if (!outCtx) return null;
        outCtx.drawImage(flat, left, top, width, height, 0, 0, width, height);
        return out.toDataURL('image/png');
    }, []);

    useEffect(() => {
        window.__loadWrap = loadWrap;
        window.__captureWrap = capture;
        return () => { delete window.__loadWrap; delete window.__captureWrap; };
    }, [loadWrap, capture]);

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
                    // Framed loose on purpose: the capture crops to the car, so spare
                    // margin costs nothing while a tight fov clipped the front bumper.
                    fov={54}
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
