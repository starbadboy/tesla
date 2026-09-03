import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, Layers, Palette, Wand2 } from 'lucide-react';
import { ThreeDView } from '../ThreeDView';
import { DesignCanvas, type DesignCanvasHandle, type LayerTransform } from '../DesignCanvas';
import { AiCreateButton } from '../ui/AiCreateButton';
import { WrapWall } from './WrapWall';
import { CAR_3D_MODELS, CAR_MODELS } from '../../constants';
import { TRANSLATIONS } from '../../translations';
import { SEO_COPY } from '../../seo';
import { fetchWraps, proxiedMediaUrl } from '../../utils/wrapApi';
import type { Wrap } from '../Gallery';
import '../../styles/home.css';

/** The sheet is drawn at template size, so it needs no transform of its own. */
const HERO_LAYER: Record<string, LayerTransform> = {
    'Full Wrap': { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
};

export interface HomeProps {
    language: 'en' | 'zh';
    currentModelName: string;
    /** Opens the studio, on the given car when one is named. */
    onStart: (model?: string) => void;
    onOpenGallery: () => void;
    onOpenAICreate: () => void;
    onLoadWrap: (url: string, wrap?: { model?: string; name?: string }) => void | Promise<void>;
    refreshTrigger?: number;
}

/**
 * The landing page: what the site is, what it holds, and the way in.
 *
 * The car in the hero is the real 3D view rather than a picture — it is the thing being
 * sold, and it is already built. The studio stays the default surface; this is reached
 * from the logo.
 */
export function Home({
    language, currentModelName,
    onStart, onOpenGallery, onOpenAICreate,
    onLoadWrap, refreshTrigger = 0,
}: HomeProps) {
    const t = TRANSLATIONS[language];
    const seo = SEO_COPY[language];
    const [total, setTotal] = useState(0);
    const [hero, setHero] = useState<Wrap | null>(null);
    const [heroVisible, setHeroVisible] = useState(false);

    /**
     * The hero drives its own canvas rather than the app's: the preview is unmounted while
     * this page is up, so its canvas — the usual texture source — is not mounted.
     */
    const heroCanvasRef = useRef<DesignCanvasHandle>(null);

    // Shown on the car the wrap was drawn for, so the art lands on the right panels.
    const heroModel = hero?.models?.find(name => CAR_3D_MODELS[name])
        ?? (CAR_3D_MODELS[currentModelName] ? currentModelName : 'Model 3 (2024 Base)');
    const model3dPath = CAR_3D_MODELS[heroModel];

    // A different wrap on every visit: the point of the page is the collection, and a
    // factory-black car says nothing about it.
    useEffect(() => {
        fetchWraps('car', 'popular', { limit: 60 })
            .then(({ items, total: count }) => {
                setTotal(count);
                const usable = items.filter(wrap => wrap.imageUrl && wrap.models?.some(name => CAR_3D_MODELS[name]));
                if (usable.length > 0) setHero(usable[Math.floor(Math.random() * usable.length)]);
            })
            .catch(error => console.error('Failed to fetch wraps for the hero', error));
    }, [refreshTrigger]);

    // ThreeDView binds a wrap as showTexture flips, and the sheet arrives after the scene
    // has mounted, so the flip has to follow the sheet.
    // ponytail: workaround, not the root cause — see the same cycle in App.
    useEffect(() => {
        if (!hero) return;
        setHeroVisible(false);
        const settle = window.setTimeout(() => setHeroVisible(true), 400);
        return () => window.clearTimeout(settle);
    }, [hero]);

    // The raw R2 domain sends no CORS headers, so a canvas cannot read those sheets; the
    // server proxies them, exactly as loading a wrap into the studio does.
    const heroSheet = hero?.imageUrl ? proxiedMediaUrl(hero.imageUrl) : null;

    const steps = [
        { icon: Layers, title: t.stepPick, body: t.stepPickBody },
        { icon: Wand2, title: t.stepDesign, body: t.stepDesignBody },
        { icon: Download, title: t.stepExport, body: t.stepExportBody },
        { icon: Palette, title: t.stepDrive, body: t.stepDriveBody },
    ];

    /** Loading a wrap from the wall lands on the car it was drawn for. */
    const handlePick = async (wrap: Wrap) => {
        if (!wrap.imageUrl) return;
        await onLoadWrap(wrap.imageUrl, { name: wrap.name, model: wrap.models?.[0] });
        onStart();
    };

    return (
        <div className="hm-app">
            <section className="hm-hero">
                <div className="hm-hero-copy">
                    <span className="hm-pill"><i /> {t.heroBadge}</span>
                    <h1>{seo.heading}</h1>
                    <p>{total > 0 ? t.heroLead.replace('{count}', total.toLocaleString()) : seo.intro}</p>
                    <div className="hm-hero-actions">
                        <AiCreateButton language={language} onClick={onOpenAICreate} variant="hero" />
                        <button type="button" className="hm-ghost" onClick={onOpenGallery}>
                            {t.browseWraps} <ArrowRight size={16} aria-hidden="true" />
                        </button>
                    </div>
                    <p className="hm-ai-note">{t.aiCreateHint}</p>
                    <span className="hm-fine">{t.heroFine}</span>
                </div>
                <div className="hm-hero-car">
                    <ThreeDView
                        stageRef={heroCanvasRef}
                        modelPath={model3dPath}
                        isActive
                        showTexture={heroVisible}
                        language={language}
                        autoRotate
                        autoRotateSpeed={0.5}
                        hideWrapToggle
                    />
                    {hero && (
                        <button type="button" className="hm-hero-credit" onClick={() => handlePick(hero)}>
                            {hero.name} <i>@{hero.author}</i>
                        </button>
                    )}
                </div>
            </section>

            {/* Hidden canvas the hero's 3D view samples its wrap from. */}
            <div className="hm-texture-src" aria-hidden="true">
                <DesignCanvas
                    ref={heroCanvasRef}
                    modelPath={CAR_MODELS[heroModel]}
                    layers={heroSheet ? { 'Full Wrap': heroSheet } : {}}
                    transforms={HERO_LAYER}
                    onTransformChange={() => undefined}
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

            <WrapWall
                language={language}
                onPick={handlePick}
                onViewAll={onOpenGallery}
                refreshTrigger={refreshTrigger}
            />

            <section className="hm-section">
                <h2>{t.chooseTesla}</h2>
                <p className="hm-sub">{t.chooseTeslaSub}</p>
                <div className="hm-cars">
                    {Object.keys(CAR_MODELS).map(name => (
                        <button type="button" className="hm-car" key={name} onClick={() => onStart(name)}>
                            <span className={`hm-car-tag ${CAR_3D_MODELS[name] ? 'is-3d' : ''}`}>
                                {CAR_3D_MODELS[name] ? '3D' : '2D'}
                            </span>
                            <b>{name}</b>
                        </button>
                    ))}
                </div>
            </section>

            <section className="hm-section">
                <h2>{t.howTitle}</h2>
                <p className="hm-sub">{t.howSub}</p>
                <div className="hm-steps">
                    {steps.map(({ icon: Icon, title, body }, index) => (
                        <div className="hm-step" key={title}>
                            <span className="hm-step-n">{index + 1}</span>
                            <Icon size={20} />
                            <b>{title}</b>
                            <p>{body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="hm-section">
                <h2>{t.faqTitle}</h2>
                <div className="hm-faq">
                    {seo.faq.map(item => (
                        <details key={item.question}>
                            <summary>{item.question}</summary>
                            <p>{item.answer}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className="hm-end">
                <h2>{t.endTitle}</h2>
                <div className="hm-end-actions">
                    <AiCreateButton language={language} onClick={onOpenAICreate} variant="hero" />
                    <button type="button" className="hm-ghost" onClick={onOpenGallery}>{t.community}</button>
                </div>
                <p className="hm-fine">© {new Date().getFullYear()} Tesla Studio · {t.heroFine}</p>
            </section>
        </div>
    );
}
