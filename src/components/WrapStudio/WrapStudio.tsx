import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { ArrowDownToLine, Heart, Sparkles, Flame, Pencil } from 'lucide-react';
import { OptionMenu } from '../ui/OptionMenu';
import { DesignCanvas, type DesignCanvasHandle, type LayerTransform } from '../DesignCanvas';
import { ThreeDView } from '../ThreeDView';
import { CAR_3D_MODELS, CAR_MODELS } from '../../constants';
import { TRANSLATIONS } from '../../translations';
import { UserMenu } from '../Auth/UserMenu';
import { fetchWraps, wrapFlags, type SortOption } from '../../utils/wrapApi';
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
    onOpenGarage: () => void;
    onOpen3DGallery: () => void;
    onOpenEditor: () => void;
    /**
     * Set while a full-screen surface (editor, gallery) is open. Two ThreeDViews share one
     * cached GLTF scene, so both rewrite the same meshes' materials and the visible car
     * ends up half painted by the hidden one. Only one 3D stage may live at a time.
     */
    suspended?: boolean;
    onLoadCommunityWrap: (url: string, wrap?: { model?: string; name?: string }) => void | Promise<void>;
    communityRefreshTrigger?: number;
    children?: ReactNode;
}

// Six fit the strip; the rest scroll. Beyond this, the gallery ('View all') is
// the better surface than a very long horizontal scroller.
const SHELF_SIZE = 24;

/** Shelf thumbnail: the sheet, swapping to the car under the pointer. Same trade as the
 *  gallery — the render is only fetched once a card is actually hovered. */
function ShelfThumb({ wrap }: { wrap: Wrap }) {
    const [wanted, setWanted] = useState(false);
    const [ready, setReady] = useState(false);
    return (
        <span className={`ws-shot ${ready ? 'is-ready' : ''}`} onMouseEnter={() => setWanted(true)}>
            <img className="ws-sheet" src={wrap.imageUrl} alt={wrap.name} loading="lazy" />
            {wanted && wrap.renderUrl && (
                <img className="ws-on-car" src={wrap.renderUrl} alt="" aria-hidden="true" onLoad={() => setReady(true)} />
            )}
        </span>
    );
}

export function WrapStudio({
    language, onToggleLanguage,
    currentModelName, onModelChange,
    singleLayer, loadedWrapName, isWrapVisible, onIsWrapVisibleChange,
    canvasRef, layerTransforms, onLayerTransformsChange,
    selectedLayerId, onSelectedLayerIdChange,
    onShare, onExport, onOpenGallery, onOpenGarage, onOpen3DGallery, onOpenEditor, onLoadCommunityWrap,
    suspended = false,
    communityRefreshTrigger = 0,
    children,
}: WrapStudioProps) {
    const t = TRANSLATIONS[language];

    const [shelf, setShelf] = useState<Wrap[]>([]);
    const [activeWrap, setActiveWrap] = useState<Wrap | null>(null);
    const [autoRotate, setAutoRotate] = useState(true);
    const [shelfSort, setShelfSort] = useState<SortOption>('popular');

    const model3dPath = CAR_3D_MODELS[currentModelName] ?? null;

    // The server filters to this model (universal wraps included) and caps the rows, so
    // the shelf no longer downloads the whole collection to show a strip of it.
    useEffect(() => {
        let cancelled = false;
        fetchWraps('car', shelfSort, { limit: SHELF_SIZE, model: currentModelName })
            .then(({ items }) => { if (!cancelled) setShelf(items); })
            .catch(error => {
                console.error('Failed to fetch community wraps', error);
                if (!cancelled) setShelf([]);
            });
        return () => { cancelled = true; };
    }, [communityRefreshTrigger, currentModelName, shelfSort]);

    const visible = shelf;

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
                {/* No 3D asset for this model: show the wrap sheet flat instead of an
                    empty stage. The sheet is drawn for a light background, so the card
                    stays light even here. */}
                {!model3dPath && (
                    <div className="ws-flat">
                        {singleLayer && (
                            <div className="ws-flat-card">
                                <img src={singleLayer} alt={loadedWrapName ?? t.no3dPreview} />
                            </div>
                        )}
                        <div className="ws-flat-title">{t.no3dPreview}</div>
                        {!singleLayer && <div className="ws-flat-sub">{t.pick2dPreview}</div>}
                    </div>
                )}
                {model3dPath && !suspended && (
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

            {/* Hidden 2D canvas — ThreeDView samples the wrap texture off it. Unmounted
                along with the stage so the open surface owns the shared canvas ref. */}
            {!suspended && <div className="ws-texture-src" aria-hidden="true">
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
            </div>}

            <div className="ws-head">
                <div className="ws-wm">TESLA<span> STUDIO</span></div>
                <nav className="ws-nav">
                    <span className="ws-on">{t.preview3d}</span>
                    <button type="button" onClick={onOpen3DGallery}>{t.gallery3d}</button>
                    <button type="button" onClick={onOpenGallery}>{t.community}</button>
                    <button type="button" onClick={onToggleLanguage}>{language === 'en' ? '中文' : 'EN'}</button>
                    {/* Sign in / account. UserMenu carries its own AuthModal. */}
                    <UserMenu onOpenGarage={onOpenGarage} language={language} />
                </nav>
            </div>

            <div className="ws-title">
                <OptionMenu
                    className="ws-model"
                    ariaLabel={t.modelSelection}
                    align="center"
                    value={currentModelName}
                    options={Object.keys(CAR_MODELS).map(name => ({ value: name, label: name }))}
                    onChange={onModelChange}
                />
                <span className="ws-sub">{subtitle}</span>
            </div>
            {model3dPath && <div className="ws-hint">{t.dragHint}</div>}

            {model3dPath && <div className="ws-seg">
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
            </div>}

            <div className="ws-shelf">
                <h2>
                    <span>{t.communityWraps}</span>
                    <span className="ws-shelf-tools">
                        <OptionMenu
                            className="ws-sort"
                            ariaLabel={t.sortBy}
                            align="right"
                            value={shelfSort}
                            onChange={next => setShelfSort(next as SortOption)}
                            options={[
                                { value: 'popular', label: t.popular },
                                { value: 'newest', label: t.newest },
                                { value: 'downloads', label: t.mostDownloaded },
                            ]}
                        />
                        <button type="button" onClick={onOpenGallery}>{t.viewAll} →</button>
                    </span>
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
                                    <ShelfThumb wrap={wrap} />
                                    {(() => {
                                        const { isNew, isHot } = wrapFlags(wrap);
                                        return (
                                            <span className="ws-badges">
                                                {isNew && <span className="ws-badge ws-new"><Sparkles size={9} /> NEW</span>}
                                                {isHot && <span className="ws-badge ws-hot"><Flame size={9} /> HOT</span>}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="ws-nm">{wrap.name}</div>
                                <div className="ws-meta">
                                    <span className="ws-by">@{wrap.author}</span>
                                    <span className="ws-stats">
                                        <span><Heart size={11} /> {wrap.likes ?? 0}</span>
                                        <span><ArrowDownToLine size={11} /> {wrap.downloads ?? 0}</span>
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="ws-foot">
                <button
                    type="button"
                    className={`ws-rotate ${autoRotate && model3dPath ? 'ws-on' : ''}`}
                    onClick={() => setAutoRotate(v => !v)}
                    disabled={!model3dPath}
                    style={!model3dPath ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                    aria-label="Auto-rotate"
                    title="Auto-rotate"
                >
                    <span className="ws-dot" />
                    <span className="ws-rotate-label">AUTO-ROTATE</span>
                </button>
                <div>
                    <button
                        type="button"
                        className="ws-btn ws-ghost"
                        onClick={onOpenEditor}
                        title={t.uploadHint}
                    >
                        <Pencil size={14} /> {t.designStudio}
                    </button>
                    <button type="button" className="ws-btn ws-ghost" onClick={onShare}>{t.share}</button>
                    <button type="button" className="ws-btn" onClick={onExport}>{t.export} ↓</button>
                </div>
            </div>

            {children}
        </div>
    );
}
