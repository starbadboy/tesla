import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown, Upload } from 'lucide-react';
import { DesignCanvas, type DesignCanvasHandle, type LayerTransform } from '../DesignCanvas';
import { ThreeDView } from '../ThreeDView';
import { CAR_3D_MODELS, CAR_MODELS } from '../../constants';
import { TRANSLATIONS } from '../../translations';
import { UserMenu } from '../Auth/UserMenu';
import { fetchWraps } from '../../utils/wrapApi';
import type { Wrap } from '../Gallery';
import '../../styles/wrap-studio.css';

export interface WrapStudioProps {
    language: 'en' | 'zh';
    onToggleLanguage: () => void;
    currentModelName: string;
    onModelChange: (name: string) => void;
    /** Wrap texture currently loaded into the canvas, if any. */
    singleLayer: string | null;
    /** Name of that wrap, whichever surface loaded it. */
    loadedWrapName?: string | null;
    isWrapVisible: boolean;
    onIsWrapVisibleChange: (v: boolean) => void;
    canvasRef: RefObject<DesignCanvasHandle | null>;
    layerTransforms: Record<string, LayerTransform>;
    onLayerTransformsChange: (t: Record<string, LayerTransform>) => void;
    selectedLayerId: string | null;
    onSelectedLayerIdChange: (id: string | null) => void;
    onShare: () => void;
    onExport: () => void;
    onOpenGallery: () => void;
    onLoadCommunityWrap: (url: string, wrap?: { model?: string; name?: string }) => void | Promise<void>;
    communityRefreshTrigger?: number;
    children?: ReactNode;
}

// Six fit the strip; the rest scroll. Beyond this, the gallery ('View all') is
// the better surface than a very long horizontal scroller.
const SHELF_SIZE = 24;

export function WrapStudio({
    language, onToggleLanguage,
    currentModelName, onModelChange,
    singleLayer, loadedWrapName, isWrapVisible, onIsWrapVisibleChange,
    canvasRef, layerTransforms, onLayerTransformsChange,
    selectedLayerId, onSelectedLayerIdChange,
    onShare, onExport, onOpenGallery, onLoadCommunityWrap,
    communityRefreshTrigger = 0,
    children,
}: WrapStudioProps) {
    const t = TRANSLATIONS[language];

    const [shelf, setShelf] = useState<Wrap[]>([]);
    const [activeWrap, setActiveWrap] = useState<Wrap | null>(null);
    const [autoRotate, setAutoRotate] = useState(true);

    const model3dPath = CAR_3D_MODELS[currentModelName] ?? null;

    useEffect(() => {
        let cancelled = false;
        fetchWraps('car', 'popular')
            .then(list => { if (!cancelled) setShelf(list); })
            .catch(error => {
                console.error('Failed to fetch community wraps', error);
                if (!cancelled) setShelf([]);
            });
        return () => { cancelled = true; };
    }, [communityRefreshTrigger]);

    // ThreeDView binds a newly loaded wrap to its materials only after showTexture
    // cycles — the texture uploads (verified: 1024x1024, version climbing) and the
    // shader compiles, yet the car keeps its base paint until the materials are
    // rebuilt by that transition. Driving the cycle here makes a fresh wrap appear.
    // ponytail: workaround, not the root cause — remove once ThreeDView rebinds on its own.
    useEffect(() => {
        if (!singleLayer) return;
        onIsWrapVisibleChange(false);
        const settle = window.setTimeout(() => onIsWrapVisibleChange(true), 60);
        return () => window.clearTimeout(settle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [singleLayer]);

    // Wraps tagged for this model come first; universal ones fill the shelf.
    const visible = useMemo(() => {
        const forModel = shelf.filter(w => w.models?.includes(currentModelName));
        const universal = shelf.filter(w => !w.models || w.models.length === 0);
        return [...forModel, ...universal].slice(0, SHELF_SIZE);
    }, [shelf, currentModelName]);

    const fileRef = useRef<HTMLInputElement>(null);

    /** Preview a sheet from disk. DesignCanvas fits it to the template canvas. */
    const handleUpload = async (file: File | undefined) => {
        if (!file) return;
        setActiveWrap(null);
        onLayerTransformsChange({});
        onIsWrapVisibleChange(true);
        await onLoadCommunityWrap(URL.createObjectURL(file), { name: file.name.replace(/\.[^.]+$/, '') });
    };

    const handlePick = async (wrap: Wrap) => {
        if (!wrap.imageUrl) return;
        setActiveWrap(wrap);
        onIsWrapVisibleChange(true);
        await onLoadCommunityWrap(wrap.imageUrl, { name: wrap.name, model: wrap.models?.[0] });
    };

    const subtitle = !singleLayer
        ? (language === 'zh' ? '未载入车衣 · 从下方选择' : 'No wrap loaded · pick one below')
        : !isWrapVisible
            ? `${t.basePaint} · Midnight`
            : `${loadedWrapName ?? activeWrap?.name ?? t.importWrap} · ${language === 'zh' ? '全车贴膜' : 'Full wrap'}`;

    return (
        <div className="ws-app">
            <div className="ws-stage">
                {!model3dPath && (
                    <div className="ws-empty">
                        <div className="ws-empty-title">{t.no3DModel}</div>
                        <div className="ws-empty-sub">{t.selectDifferentVehicle}</div>
                    </div>
                )}
                {model3dPath && (
                    <ThreeDView
                        stageRef={canvasRef}
                        modelPath={model3dPath}
                        isActive
                        showTexture={isWrapVisible}
                        onToggleWrap={onIsWrapVisibleChange}
                        language={language}
                        autoRotate={autoRotate}
                        autoRotateSpeed={0.8}
                        hideWrapToggle
                    />
                )}
            </div>

            {/* Hidden 2D canvas — ThreeDView samples the wrap texture off it. */}
            <div className="ws-texture-src" aria-hidden="true">
                <DesignCanvas
                    ref={canvasRef}
                    modelPath={CAR_MODELS[currentModelName]}
                    layers={singleLayer ? { 'Full Wrap': singleLayer } : {}}
                    transforms={layerTransforms}
                    onTransformChange={(id, transform) => onLayerTransformsChange({ ...layerTransforms, [id]: transform })}
                    selectedId={selectedLayerId}
                    onSelect={onSelectedLayerIdChange}
                    onExport={() => undefined}
                    mode="select"
                    brushColor="#000000"
                    brushSize={5}
                    canvasType="car"
                    plateSize="420x200"
                />
            </div>

            <div className="ws-head">
                <div className="ws-wm">TESLA<span> STUDIO</span></div>
                <nav className="ws-nav">
                    <span className="ws-on">{t.preview3d}</span>
                    <button type="button" onClick={onOpenGallery}>{t.community}</button>
                    <button type="button" onClick={onToggleLanguage}>{language === 'en' ? '中文' : 'EN'}</button>
                    {/* Sign in / account. UserMenu carries its own AuthModal. */}
                    <UserMenu onOpenGarage={onOpenGallery} language={language} />
                </nav>
            </div>

            <div className="ws-title">
                <label className="ws-model">
                    <select
                        value={currentModelName}
                        onChange={e => onModelChange(e.target.value)}
                        aria-label={t.modelSelection}
                    >
                        {Object.keys(CAR_MODELS).map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <ChevronDown className="ws-model-caret" size={16} />
                </label>
                <span className="ws-sub">{subtitle}</span>
            </div>
            {model3dPath && <div className="ws-hint">{t.dragHint}</div>}

            <div className="ws-seg">
                <button
                    type="button"
                    className={isWrapVisible ? 'ws-on' : ''}
                    onClick={() => onIsWrapVisibleChange(true)}
                >
                    {t.wrapOn}
                </button>
                <button
                    type="button"
                    className={!isWrapVisible ? 'ws-on' : ''}
                    onClick={() => onIsWrapVisibleChange(false)}
                >
                    {t.basePaint}
                </button>
            </div>

            <div className="ws-shelf">
                <h2>
                    <span>{t.community.toUpperCase()} · COMMUNITY WRAPS</span>
                    <button type="button" onClick={onOpenGallery}>{t.viewAll} →</button>
                </h2>
                {visible.length === 0 ? (
                    <div className="ws-shelf-empty">{t.noWrapsFound}</div>
                ) : (
                    <div className="ws-cards">
                        {visible.map(wrap => (
                            <button
                                key={wrap._id}
                                type="button"
                                className={`ws-card ${activeWrap?._id === wrap._id ? 'ws-on' : ''}`}
                                onClick={() => handlePick(wrap)}
                            >
                                <div className="ws-thumb">
                                    <img src={wrap.imageUrl} alt={wrap.name} loading="lazy" />
                                </div>
                                <div className="ws-nm">{wrap.name}</div>
                                <div className="ws-by">@{wrap.author}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="ws-foot">
                <button
                    type="button"
                    className={`ws-rotate ${autoRotate ? 'ws-on' : ''}`}
                    onClick={() => setAutoRotate(v => !v)}
                >
                    <span className="ws-dot" />
                    <span>AUTO-ROTATE</span>
                </button>
                <div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        onChange={e => { void handleUpload(e.target.files?.[0]); e.target.value = ''; }}
                    />
                    <button
                        type="button"
                        className="ws-btn ws-ghost"
                        onClick={() => fileRef.current?.click()}
                        title={t.uploadHint}
                    >
                        <Upload size={14} /> {t.upload}
                    </button>
                    <button type="button" className="ws-btn ws-ghost" onClick={onShare}>{t.share}</button>
                    <button type="button" className="ws-btn" onClick={onExport}>{t.export} ↓</button>
                </div>
            </div>

            {children}
        </div>
    );
}
