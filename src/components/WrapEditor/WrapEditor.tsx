import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
    ArrowLeft, BringToFront, Circle, FolderOpen, History, Layers, Maximize2,
    MousePointer2, PaintBucket, Pencil, Redo2, RotateCcw, SendToBack, Share2,
    Sparkles, Square, Trash2, Type, Undo2, Upload, ZoomIn, ZoomOut,
} from 'lucide-react';
import {
    DesignCanvas,
    type CanvasObject, type DesignCanvasHandle, type DrawnLine, type FillOp, type LayerTransform,
} from '../DesignCanvas';
import { ThreeDView } from '../ThreeDView';
import { OptionMenu } from '../ui/OptionMenu';
import { WRAP_PRESETS, gradientCss, gradientToDataUrl } from '../TeslaStudio/wraps';
import { CAR_3D_MODELS, CAR_MODELS } from '../../constants';
import { TRANSLATIONS } from '../../translations';
import { generateImage } from '../../utils/gemini';
import { fetchMyGenerations, saveGeneration } from '../../utils/wrapApi';
import type { Wrap } from '../Gallery';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/wrap-editor.css';

const LAYER_ID = 'Full Wrap';

const FLAT_LAYER: LayerTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

/** Starting points that read as a wrap brief rather than a bare noun. */
const THEMES = ['Police', 'Ambulance', 'Fire Truck', 'Chrome', 'Camouflage', 'Racing Livery'];

const COLORS = [
    { id: 'red', hex: '#ef4444' },
    { id: 'blue', hex: '#3b82f6' },
    { id: 'green', hex: '#22c55e' },
    { id: 'yellow', hex: '#eab308' },
    { id: 'purple', hex: '#a855f7' },
    { id: 'white', hex: '#f8fafc' },
    { id: 'black', hex: '#111827' },
];

export interface WrapEditorProps {
    language: 'en' | 'zh';
    currentModelName: string;
    onModelChange: (name: string) => void;
    singleLayer: string | null;
    loadedWrapName?: string | null;
    layerTransforms: Record<string, LayerTransform>;
    onLayerTransformsChange: (t: Record<string, LayerTransform>) => void;
    selectedLayerId: string | null;
    onSelectedLayerIdChange: (id: string | null) => void;
    isWrapVisible: boolean;
    onIsWrapVisibleChange: (v: boolean) => void;
    /** Factory paint chosen in the studio, so the preview card agrees with it. */
    paintColor?: string;
    canvasRef: RefObject<DesignCanvasHandle | null>;
    onLoadWrap: (url: string, wrap?: { model?: string; name?: string }) => void | Promise<void>;
    onRemoveWrap: () => void;
    onExport: () => void;
    onShare: () => void;
    onClose: () => void;
}

type Panel = 'library' | 'ai' | 'generations' | 'layers';

type Generation = { url: string; prompt: string };

const toGenerations = (wraps: Wrap[]): Generation[] =>
    wraps.map(w => ({ url: w.imageUrl ?? '', prompt: w.prompt ?? w.name }));

type Tool = 'select' | 'draw' | 'fill' | 'text' | 'rect' | 'ellipse';

/** Everything an edit can change, and therefore everything undo restores. */
interface Doc {
    objects: CanvasObject[];
    lines: DrawnLine[];
    fills: FillOp[];
}

const EMPTY_DOC: Doc = { objects: [], lines: [], fills: [] };

const ZOOM_STEP = 1.25;
const ZOOM_RANGE = { min: 0.25, max: 4 };

const PREVIEW_DEFAULT = { width: 340, height: 232 };
const PREVIEW_MIN = { width: 220, height: 150 };
const PREVIEW_MAX = { width: 720, height: 560 };

/**
 * The design surface: the wrap sheet itself, editable, with the car alongside it.
 *
 * The studio and the galleries are for looking at finished wraps; this is where one is
 * made. It drives the same DesignCanvas the rest of the app samples for its 3D texture,
 * so what is edited here is what the car shows.
 */
export function WrapEditor({
    language, currentModelName, onModelChange,
    singleLayer, loadedWrapName,
    layerTransforms, onLayerTransformsChange,
    selectedLayerId, onSelectedLayerIdChange,
    isWrapVisible, onIsWrapVisibleChange, paintColor = '#000000',
    canvasRef, onLoadWrap, onRemoveWrap, onExport, onShare, onClose,
}: WrapEditorProps) {
    const t = TRANSLATIONS[language];
    const model3dPath = CAR_3D_MODELS[currentModelName] ?? null;

    const [panel, setPanel] = useState<Panel | null>('library');
    const [tool, setTool] = useState<Tool>('select');
    const [brushColor, setBrushColor] = useState('#ff3b30');
    const [brushSize, setBrushSize] = useState(8);
    const [fillColor, setFillColor] = useState('#3b82f6');

    const [doc, setDoc] = useState<Doc>(EMPTY_DOC);
    const [past, setPast] = useState<Doc[]>([]);
    const [future, setFuture] = useState<Doc[]>([]);
    const [objectId, setObjectId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [scale, setScale] = useState(1);
    const [preview, setPreview] = useState(PREVIEW_DEFAULT);

    /**
     * Drag the card's inner corner to resize it. The card is pinned top right, so pulling
     * left and down grows it; the stage reserves whatever width it ends up with, which is
     * why this is state rather than plain CSS resize.
     */
    const startResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
        event.preventDefault();
        const origin = { x: event.clientX, y: event.clientY, ...preview };
        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

        const onMove = (move: PointerEvent) => setPreview({
            width: clamp(origin.width - (move.clientX - origin.x), PREVIEW_MIN.width, PREVIEW_MAX.width),
            height: clamp(origin.height + (move.clientY - origin.y), PREVIEW_MIN.height, PREVIEW_MAX.height),
        });
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    /** Every content change goes through here, which is what makes undo complete. */
    const commit = useCallback((next: Doc) => {
        setPast(stack => [...stack.slice(-40), doc]);
        setFuture([]);
        setDoc(next);
    }, [doc]);

    const undo = () => {
        const previous = past[past.length - 1];
        if (!previous) return;
        setPast(stack => stack.slice(0, -1));
        setFuture(stack => [doc, ...stack]);
        setDoc(previous);
    };

    const redo = () => {
        const next = future[0];
        if (!next) return;
        setFuture(stack => stack.slice(1));
        setPast(stack => [...stack, doc]);
        setDoc(next);
    };

    const selectedObject = doc.objects.find(o => o.id === objectId) ?? null;

    /** Moves the selected object one step through the stack, or to either end. */
    const reorder = (direction: 'front' | 'forward' | 'backward' | 'back') => {
        if (!selectedObject) return;
        const rest = doc.objects.filter(o => o.id !== selectedObject.id);
        const at = doc.objects.indexOf(selectedObject);
        const to = direction === 'front' ? rest.length
            : direction === 'back' ? 0
                : direction === 'forward' ? Math.min(rest.length, at + 1)
                    : Math.max(0, at - 1);
        commit({ ...doc, objects: [...rest.slice(0, to), selectedObject, ...rest.slice(to)] });
    };

    const { user, isAuthenticated } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [provider, setProvider] = useState<'puter' | 'openai'>('puter');
    const [generating, setGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    // Only designers who have bought credits may keep a generation out of the gallery.
    const canGoPrivate = Boolean(user?.hasPurchased);
    const [shareToGallery, setShareToGallery] = useState(true);
    // Signed in: the server's copy of their generations. Anonymous: this session only —
    // a generation is a data URL of a megabyte or more, far past what localStorage holds.
    const [generations, setGenerations] = useState<Generation[]>([]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const load = async () => {
            try {
                setGenerations(toGenerations(await fetchMyGenerations()));
            } catch (error) {
                console.warn('Could not load generations:', error);
            }
        };
        load();
    }, [isAuthenticated]);

    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const transform = layerTransforms[LAYER_ID] ?? FLAT_LAYER;

    const updateTransform = (patch: Partial<LayerTransform>) => {
        onLayerTransformsChange({ ...layerTransforms, [LAYER_ID]: { ...transform, ...patch } });
    };

    const handleUpload = async (file: File | undefined) => {
        if (!file) return;
        await onLoadWrap(URL.createObjectURL(file), { name: file.name.replace(/\.[^.]+$/, '') });
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || generating) return;
        setGenerating(true);
        setAiError(null);
        try {
            // The template goes along as the input image so the generator lays the design
            // out on the real panels instead of inventing its own sheet.
            const response = await fetch(CAR_MODELS[currentModelName]);
            const blob = await response.blob();
            const templateBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            const url = await generateImage(prompt, templateBase64, currentModelName, provider, 'gpt-image-1.5');
            setGenerations(current => [{ url, prompt }, ...current]);
            await onLoadWrap(url, { name: prompt.slice(0, 40) });
            if (isAuthenticated) {
                // Best effort: a save that fails leaves the generation in this session's
                // list, which is what an anonymous designer gets anyway.
                try {
                    await saveGeneration({
                        url, prompt, model: currentModelName,
                        isPublic: canGoPrivate ? shareToGallery : true,
                    });
                    setGenerations(toGenerations(await fetchMyGenerations()));
                } catch (error) {
                    console.warn('Could not save generation:', error);
                }
            }
        } catch (error) {
            setAiError(error instanceof Error ? error.message : t.error);
        } finally {
            setGenerating(false);
        }
    };

    const RAIL: { id: Panel; label: string; icon: typeof FolderOpen }[] = [
        { id: 'library', label: t.library, icon: FolderOpen },
        { id: 'ai', label: t.aiGenerate, icon: Sparkles },
        { id: 'generations', label: t.myGenerations, icon: History },
        { id: 'layers', label: t.layersPanel, icon: Layers },
    ];

    return (
        <div
            className={`we-app ${panel ? 'is-panel-open' : ''}`}
            // The stage centres the sheet in what is left over, so it has to know how much
            // room the floating card takes; otherwise the sheet slides under it.
            style={{ '--we-preview-w': `${preview.width + 32}px` } as import('react').CSSProperties}
        >
            <header className="we-top">
                <button type="button" className="we-back" onClick={onClose} aria-label={t.preview3d}>
                    <ArrowLeft size={17} />
                </button>
                <span className="we-brand">TESLA<b> STUDIO</b></span>
                <OptionMenu
                    className="we-model"
                    ariaLabel={t.modelSelection}
                    value={currentModelName}
                    onChange={onModelChange}
                    options={Object.keys(CAR_MODELS).map(name => ({ value: name, label: name }))}
                />
                <span className="we-push" />
                <button type="button" className="we-text" onClick={onShare}>
                    <Share2 size={15} /> {t.share}
                </button>
                <button type="button" className="we-text is-primary" onClick={onExport}>
                    {t.export}
                </button>
            </header>

            <aside className="we-rail">
                {RAIL.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        className={`we-rail-btn ${panel === id ? 'is-on' : ''}`}
                        onClick={() => setPanel(current => (current === id ? null : id))}
                    >
                        <Icon size={19} />
                        <span>{label}</span>
                    </button>
                ))}
            </aside>

            {panel && <section className="we-panel">
                {panel === 'library' && (
                    <>
                        <h2>{t.library}</h2>
                        <button type="button" className="we-primary" onClick={() => fileRef.current?.click()}>
                            <Upload size={15} /> {t.importWrap}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={e => { handleUpload(e.target.files?.[0]); e.target.value = ''; }}
                        />
                        <h3>{t.gradientPresets}</h3>
                        <div className="we-swatches">
                            {WRAP_PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className="we-swatch"
                                    title={preset.name}
                                    style={{ background: gradientCss(preset.stops, preset.angle) }}
                                    onClick={() => onLoadWrap(gradientToDataUrl(preset), { name: preset.name })}
                                >
                                    <span>{preset.name}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {panel === 'ai' && (
                    <>
                        <h2>{t.aiGeneration}</h2>
                        <div className="we-chips">
                            {THEMES.map(theme => (
                                <button key={theme} type="button" onClick={() => setPrompt(theme)}>{theme}</button>
                            ))}
                        </div>
                        <label className="we-field">
                            <textarea
                                value={prompt}
                                maxLength={500}
                                placeholder={t.describeStyle}
                                onChange={e => setPrompt(e.target.value)}
                            />
                            <span className="we-count">{prompt.length}/500</span>
                        </label>

                        <h3>{t.colorPreference}</h3>
                        <div className="we-chips">
                            {COLORS.map(color => (
                                <button
                                    key={color.id}
                                    type="button"
                                    onClick={() => setPrompt(current => `${current.trim()} ${color.id}`.trim())}
                                >
                                    <i style={{ background: color.hex }} /> {color.id}
                                </button>
                            ))}
                        </div>

                        <h3>{t.modelProvider}</h3>
                        <OptionMenu
                            className="we-model"
                            ariaLabel={t.modelProvider}
                            value={provider}
                            onChange={next => setProvider(next as typeof provider)}
                            options={[
                                { value: 'puter', label: t.computerAI },
                                { value: 'openai', label: t.openai },
                            ]}
                        />

                        {isAuthenticated && (
                            <>
                                <label className={`we-check ${canGoPrivate ? '' : 'is-locked'}`}>
                                    <input
                                        type="checkbox"
                                        checked={canGoPrivate ? shareToGallery : true}
                                        disabled={!canGoPrivate}
                                        onChange={e => setShareToGallery(e.target.checked)}
                                    />
                                    {t.shareToGallery}
                                </label>
                                {!canGoPrivate && <p className="we-hint">{t.unlockPrivate}</p>}
                            </>
                        )}

                        <button
                            type="button"
                            className="we-primary"
                            disabled={!prompt.trim() || generating}
                            onClick={handleGenerate}
                        >
                            <Sparkles size={15} /> {generating ? t.generating : t.generate}
                        </button>
                        {aiError && <p className="we-error">{aiError}</p>}
                    </>
                )}

                {panel === 'generations' && (
                    <>
                        <h2>{t.myGenerations}</h2>
                        {generations.length === 0 && <p className="we-empty">{t.noGenerations}</p>}
                        <div className="we-gens">
                            {generations.map((item, index) => (
                                <button
                                    key={`${item.prompt}-${index}`}
                                    type="button"
                                    className="we-gen"
                                    onClick={() => onLoadWrap(item.url, { name: item.prompt.slice(0, 40) })}
                                >
                                    <img src={item.url} alt={item.prompt} />
                                    <span>{item.prompt}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {panel === 'layers' && (
                    <>
                        <h2>{t.layersPanel}</h2>
                        {!singleLayer ? (
                            <p className="we-empty">{t.noWrapLoaded}</p>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className={`we-layer ${selectedLayerId === LAYER_ID ? 'is-on' : ''}`}
                                    onClick={() => onSelectedLayerIdChange(LAYER_ID)}
                                >
                                    <img src={singleLayer} alt="" />
                                    <span>{loadedWrapName ?? t.importWrap}</span>
                                </button>

                                <label className="we-slider">
                                    <span>{t.scale}</span>
                                    <input
                                        type="range" min={0.2} max={3} step={0.01}
                                        value={transform.scaleX}
                                        onChange={e => {
                                            const next = parseFloat(e.target.value);
                                            updateTransform({ scaleX: next, scaleY: next });
                                        }}
                                    />
                                    <b>{transform.scaleX.toFixed(2)}×</b>
                                </label>

                                <label className="we-slider">
                                    <span>{t.opacity}</span>
                                    <input
                                        type="range" min={0} max={1} step={0.01}
                                        value={transform.opacity}
                                        onChange={e => updateTransform({ opacity: parseFloat(e.target.value) })}
                                    />
                                    <b>{Math.round(transform.opacity * 100)}%</b>
                                </label>

                                <button type="button" className="we-danger" onClick={onRemoveWrap}>
                                    <Trash2 size={15} /> {t.removeWrap}
                                </button>
                            </>
                        )}
                    </>
                )}
            </section>}

            <main className="we-stage">
                <div className="we-canvas">
                    <DesignCanvas
                        ref={canvasRef}
                        modelPath={CAR_MODELS[currentModelName]}
                        layers={singleLayer ? { [LAYER_ID]: singleLayer } : {}}
                        transforms={layerTransforms}
                        onTransformChange={(id, next) => onLayerTransformsChange({ ...layerTransforms, [id]: next })}
                        selectedId={selectedLayerId}
                        onSelect={onSelectedLayerIdChange}
                        onExport={() => undefined}
                        mode={tool}
                        brushColor={brushColor}
                        brushSize={brushSize}
                        fillColor={fillColor}
                        objects={doc.objects}
                        onObjectsChange={objects => commit({ ...doc, objects })}
                        lines={doc.lines}
                        onLinesChange={lines => commit({ ...doc, lines })}
                        fills={doc.fills}
                        onFillsChange={fills => commit({ ...doc, fills })}
                        selectedObjectId={objectId}
                        onSelectObject={setObjectId}
                        zoom={zoom}
                        onScaleChange={setScale}
                        canvasType="car"
                        plateSize="420x200"
                    />
                </div>

                {/* The car, alongside the sheet rather than instead of it. */}
                <div className="we-preview" style={{ width: preview.width, height: preview.height }}>
                    {model3dPath ? (
                        <ThreeDView
                            stageRef={canvasRef}
                            modelPath={model3dPath}
                            isActive
                            showTexture={isWrapVisible}
                            language={language}
                            paintColor={paintColor}
                            autoRotate={false}
                            hideWrapToggle
                        />
                    ) : (
                        <p className="we-empty">{t.no3dPreview}</p>
                    )}
                    <span
                        className="we-resize"
                        onPointerDown={startResize}
                        role="separator"
                        aria-label={t.resizePreview}
                    />
                    <div className="we-seg">
                        <button
                            type="button"
                            className={isWrapVisible ? 'is-on' : ''}
                            onClick={() => onIsWrapVisibleChange(true)}
                        >
                            {t.wrapOn}
                        </button>
                        <button
                            type="button"
                            className={!isWrapVisible ? 'is-on' : ''}
                            onClick={() => onIsWrapVisibleChange(false)}
                        >
                            {t.basePaint}
                        </button>
                    </div>
                </div>

                <div className="we-tools">
                    {([
                        ['select', MousePointer2, t.selectMode],
                        ['text', Type, t.textTool],
                        ['draw', Pencil, t.drawMode],
                        ['rect', Square, t.rectTool],
                        ['ellipse', Circle, t.ellipseTool],
                        ['fill', PaintBucket, t.fillPanel],
                    ] as [Tool, typeof MousePointer2, string][]).map(([id, Icon, label]) => (
                        <button
                            key={id}
                            type="button"
                            className={tool === id ? 'is-on' : ''}
                            title={label}
                            onClick={() => setTool(id)}
                        >
                            <Icon size={17} />
                        </button>
                    ))}

                    {/* The colour the next stroke, shape or panel fill uses. */}
                    <input
                        type="color"
                        className="we-color"
                        value={tool === 'draw' ? brushColor : fillColor}
                        title={tool === 'draw' ? t.brushColor : t.fillPanel}
                        onChange={e => (tool === 'draw' ? setBrushColor : setFillColor)(e.target.value)}
                    />
                    {tool === 'draw' && (
                        <input
                            type="range" min={1} max={40} step={1}
                            value={brushSize}
                            title={t.brushSize}
                            onChange={e => setBrushSize(parseInt(e.target.value, 10))}
                        />
                    )}

                    {selectedObject && (
                        <>
                            <span className="we-div" />
                            {selectedObject.type === 'text' && (
                                <input
                                    className="we-input"
                                    value={selectedObject.text ?? ''}
                                    onChange={e => commit({
                                        ...doc,
                                        objects: doc.objects.map(o => (o.id === selectedObject.id ? { ...o, text: e.target.value } : o)),
                                    })}
                                />
                            )}
                            <button type="button" title={t.bringToFront} onClick={() => reorder('front')}>
                                <BringToFront size={16} />
                            </button>
                            <button type="button" title={t.sendToBack} onClick={() => reorder('back')}>
                                <SendToBack size={16} />
                            </button>
                            <button
                                type="button"
                                title={t.removeWrap}
                                onClick={() => {
                                    commit({ ...doc, objects: doc.objects.filter(o => o.id !== selectedObject.id) });
                                    setObjectId(null);
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}

                    <span className="we-div" />
                    <button
                        type="button"
                        title={t.zoomOut}
                        onClick={() => setZoom(z => Math.max(ZOOM_RANGE.min, z / ZOOM_STEP))}
                    >
                        <ZoomOut size={17} />
                    </button>
                    <b className="we-zoom">{Math.round(scale * 100)}%</b>
                    <button
                        type="button"
                        title={t.zoomIn}
                        onClick={() => setZoom(z => Math.min(ZOOM_RANGE.max, z * ZOOM_STEP))}
                    >
                        <ZoomIn size={17} />
                    </button>
                    <button type="button" title={t.fitCanvas} onClick={() => setZoom(1)}>
                        <Maximize2 size={16} />
                    </button>

                    <span className="we-div" />
                    <label className="we-rot">
                        <span>{t.rotation}</span>
                        <input
                            type="range" min={-180} max={180} step={1}
                            value={transform.rotation}
                            disabled={!singleLayer}
                            onChange={e => updateTransform({ rotation: parseFloat(e.target.value) })}
                        />
                        <b>{Math.round(transform.rotation)}°</b>
                    </label>
                    <button
                        type="button"
                        title={t.reset}
                        disabled={!singleLayer}
                        onClick={() => updateTransform({ rotation: 0 })}
                    >
                        <RotateCcw size={16} />
                    </button>

                    <span className="we-div" />
                    <button type="button" title={t.undo} disabled={past.length === 0} onClick={undo}>
                        <Undo2 size={17} />
                    </button>
                    <button type="button" title={t.redo} disabled={future.length === 0} onClick={redo}>
                        <Redo2 size={17} />
                    </button>
                </div>
            </main>
        </div>
    );
}
