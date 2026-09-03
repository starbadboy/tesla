import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Download } from 'lucide-react';
import { DesignCanvas, type DesignCanvasHandle, type LayerTransform } from '../DesignCanvas';
import { ThreeDView } from '../ThreeDView';
import { OptionMenu } from '../ui/OptionMenu';
import { GalleryViewSwitch } from '../ui/GalleryViewSwitch';
import { CAR_3D_MODELS, CAR_MODELS } from '../../constants';
import { TRANSLATIONS } from '../../translations';
import { downloadWrap, fetchWraps } from '../../utils/wrapApi';
import type { Wrap } from '../Gallery';
import '../../styles/gallery-3d.css';

const PAGE_SIZE = 24;

export interface Gallery3DProps {
    language: 'en' | 'zh';
    currentModelName: string;
    onModelChange: (name: string) => void;
    singleLayer: string | null;
    loadedWrapName?: string | null;
    isWrapVisible: boolean;
    onIsWrapVisibleChange: (v: boolean) => void;
    canvasRef: RefObject<DesignCanvasHandle | null>;
    layerTransforms: Record<string, LayerTransform>;
    onLayerTransformsChange: (t: Record<string, LayerTransform>) => void;
    selectedLayerId: string | null;
    onSelectedLayerIdChange: (id: string | null) => void;
    onLoadCommunityWrap: (url: string, wrap?: { model?: string; name?: string }) => void | Promise<void>;
    refreshTrigger?: number;
}

/**
 * A browsing surface built around the 3D car: a rail of wraps on the left, the selected
 * one on the car filling the rest. The studio is for working on one wrap; this is for
 * looking through many.
 *
 * Cards prefer `renderUrl` — a pre-rendered shot of the wrap already on this car — and
 * fall back to the flat sheet until the render pipeline has produced one.
 */
export function Gallery3D({
    language, currentModelName, onModelChange,
    singleLayer, loadedWrapName, isWrapVisible, onIsWrapVisibleChange,
    canvasRef, layerTransforms, onLayerTransformsChange,
    selectedLayerId, onSelectedLayerIdChange,
    onLoadCommunityWrap, refreshTrigger = 0,
}: Gallery3DProps) {
    const t = TRANSLATIONS[language];
    const model3dPath = CAR_3D_MODELS[currentModelName] ?? null;

    // This page is the car, so only cars that have one belong in the picker.
    const models3d = useMemo(() => Object.keys(CAR_MODELS).filter(name => CAR_3D_MODELS[name]), []);

    // Arriving from the studio on a car with no 3D would leave an empty stage, so move to
    // its closest sibling — same family where there is one, the default otherwise.
    useEffect(() => {
        if (model3dPath) return;
        const family = currentModelName.split(' ').slice(0, 2).join(' ');
        onModelChange(models3d.find(name => name.startsWith(family)) ?? models3d[0]);
    }, [model3dPath, currentModelName, models3d, onModelChange]);

    const [wraps, setWraps] = useState<Wrap[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchWraps('car', 'popular', { limit: PAGE_SIZE, model: currentModelName })
            .then(({ items, total: count }) => {
                if (cancelled) return;
                setWraps(items);
                setTotal(count);
            })
            .catch(error => {
                console.error('Failed to fetch wraps', error);
                if (!cancelled) { setWraps([]); setTotal(0); }
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [currentModelName, refreshTrigger]);

    // More wraps as the rail scrolls towards its end.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || loading || wraps.length === 0 || wraps.length >= total) return;
        let done = false;
        const observer = new IntersectionObserver(entries => {
            if (!entries[0]?.isIntersecting || done) return;
            done = true;
            setLoading(true);
            fetchWraps('car', 'popular', { limit: PAGE_SIZE, skip: wraps.length, model: currentModelName })
                .then(({ items, total: count }) => {
                    setWraps(current => {
                        const seen = new Set(current.map(w => w._id));
                        return [...current, ...items.filter(w => !seen.has(w._id))];
                    });
                    setTotal(count);
                })
                .catch(error => console.error('Failed to fetch more wraps', error))
                .finally(() => setLoading(false));
        }, { rootMargin: '400px' });
        observer.observe(sentinel);
        return () => { done = true; observer.disconnect(); };
    }, [wraps, total, loading, currentModelName]);

    const active = wraps.find(w => w._id === activeId) ?? null;

    const handlePick = async (wrap: Wrap) => {
        if (!wrap.imageUrl) return;
        setActiveId(wrap._id);
        onIsWrapVisibleChange(true);
        await onLoadCommunityWrap(wrap.imageUrl, { name: wrap.name });
    };

    return (
        <div className="g3-app">
            <header className="g3-heading">
                <h1>{t.exploreWraps}</h1>
                <GalleryViewSwitch view="3d" language={language} />
            </header>
            <aside className="g3-rail">
                <div className="g3-vehicle">
                    <span className="g3-label">{t.modelSelection}</span>
                    <OptionMenu
                        className="g3-picker"
                        ariaLabel={t.modelSelection}
                        value={currentModelName}
                        onChange={onModelChange}
                        options={models3d.map(name => ({ value: name, label: name }))}
                    />
                </div>

                <div className="g3-list">
                    {wraps.map(wrap => (
                        <button
                            key={wrap._id}
                            type="button"
                            className={`g3-card ${activeId === wrap._id ? 'is-active' : ''}`}
                            onClick={() => handlePick(wrap)}
                        >
                            <span className="g3-thumb">
                                <img src={wrap.renderUrl || wrap.imageUrl} alt={wrap.name} loading="lazy" />
                            </span>
                            <span className="g3-meta">
                                <span className="g3-nm">{wrap.name}</span>
                                <span className="g3-by">@{wrap.author}</span>
                            </span>
                        </button>
                    ))}
                    {wraps.length === 0 && !loading && <p className="g3-empty">{t.noWrapsFound}</p>}
                    <div ref={sentinelRef} aria-hidden="true" />
                    {total > 0 && <p className="g3-count">{wraps.length} / {total}</p>}
                </div>
            </aside>

            <main className="g3-stage">
                {model3dPath ? (
                    <ThreeDView
                        stageRef={canvasRef}
                        modelPath={model3dPath}
                        isActive
                        showTexture={isWrapVisible}
                        onToggleWrap={onIsWrapVisibleChange}
                        language={language}
                        autoRotate={false}
                        hideWrapToggle
                    />
                ) : (
                    <div className="g3-flat">
                        {singleLayer && <img src={singleLayer} alt={loadedWrapName ?? ''} />}
                        <span>{t.no3dPreview}</span>
                    </div>
                )}

                <div className="g3-caption">
                    <span className="g3-caption-name">{loadedWrapName ?? t.pick2dPreview}</span>
                    {active && (
                        <>
                            <span className="g3-caption-by">@{active.author}</span>
                            <button
                                type="button"
                                className="g3-download"
                                onClick={() => downloadWrap(active, 'car').catch(e => console.error(e))}
                            >
                                <Download size={14} /> {t.download}
                            </button>
                        </>
                    )}
                </div>
            </main>

            {/* Hidden 2D canvas — ThreeDView samples the wrap texture off it. */}
            <div className="g3-texture-src" aria-hidden="true">
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
        </div>
    );
}
