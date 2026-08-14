import { useEffect, useState, type RefObject } from 'react';
import { ArrowRight, Download, Layers, Palette, Sparkles, Wand2 } from 'lucide-react';
import { ThreeDView } from '../ThreeDView';
import { UserMenu } from '../Auth/UserMenu';
import { WrapWall } from './WrapWall';
import type { DesignCanvasHandle } from '../DesignCanvas';
import { CAR_3D_MODELS, CAR_MODELS } from '../../constants';
import { TRANSLATIONS } from '../../translations';
import { SEO_COPY } from '../../seo';
import { fetchWraps } from '../../utils/wrapApi';
import type { Wrap } from '../Gallery';
import '../../styles/home.css';

export interface HomeProps {
    language: 'en' | 'zh';
    onToggleLanguage: () => void;
    currentModelName: string;
    /** Opens the studio, on the given car when one is named. */
    onStart: (model?: string) => void;
    onOpenGallery: () => void;
    onOpenGarage: () => void;
    onOpen3DGallery: () => void;
    onOpenEditor: () => void;
    onLoadWrap: (url: string, wrap?: { model?: string; name?: string }) => void | Promise<void>;
    canvasRef: RefObject<DesignCanvasHandle | null>;
    refreshTrigger?: number;
}

/**
 * The landing page: what the site is, what it holds, and the way in.
 *
 * The car in the hero is the real 3D view rather than a picture — it is the thing being
 * sold, and it is already built. The studio stays the default surface; this is reached
 * from the nav.
 */
export function Home({
    language, onToggleLanguage, currentModelName,
    onStart, onOpenGallery, onOpenGarage, onOpen3DGallery, onOpenEditor,
    onLoadWrap, canvasRef, refreshTrigger = 0,
}: HomeProps) {
    const t = TRANSLATIONS[language];
    const seo = SEO_COPY[language];
    const [total, setTotal] = useState(0);

    const model3dPath = CAR_3D_MODELS[currentModelName] ?? CAR_3D_MODELS['Model 3 (2024 Base)'];

    useEffect(() => {
        fetchWraps('car', 'popular', { limit: 1 })
            .then(({ total: count }) => setTotal(count))
            .catch(error => console.error('Failed to count wraps', error));
    }, [refreshTrigger]);

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
            <header className="hm-head">
                <button type="button" className="hm-wm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    TESLA<span> STUDIO</span>
                </button>
                <nav className="hm-nav">
                    <button type="button" onClick={() => onStart()}>{t.preview3d}</button>
                    <button type="button" onClick={onOpenEditor}>{t.designStudio}</button>
                    <button type="button" onClick={onOpen3DGallery}>{t.gallery3d}</button>
                    <button type="button" onClick={onOpenGallery}>{t.community}</button>
                    <button type="button" onClick={onToggleLanguage}>{language === 'en' ? '中文' : 'EN'}</button>
                    <UserMenu onOpenGarage={onOpenGarage} language={language} />
                </nav>
            </header>

            <section className="hm-hero">
                <div className="hm-hero-copy">
                    <span className="hm-pill"><i /> {t.heroBadge}</span>
                    <h1>{seo.heading}</h1>
                    <p>{total > 0 ? t.heroLead.replace('{count}', total.toLocaleString()) : seo.intro}</p>
                    <button type="button" className="hm-cta" onClick={() => onStart()}>
                        {t.heroCta} <ArrowRight size={16} />
                    </button>
                    <span className="hm-fine">{t.heroFine}</span>
                </div>
                <div className="hm-hero-car">
                    <ThreeDView
                        stageRef={canvasRef}
                        modelPath={model3dPath}
                        isActive
                        showTexture={false}
                        language={language}
                        autoRotate
                        autoRotateSpeed={0.5}
                        hideWrapToggle
                    />
                </div>
            </section>

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
                    <button type="button" className="hm-cta" onClick={() => onStart()}>
                        <Sparkles size={16} /> {t.heroCta}
                    </button>
                    <button type="button" className="hm-ghost" onClick={onOpenGallery}>{t.community}</button>
                </div>
                <p className="hm-fine">© {new Date().getFullYear()} Tesla Studio · {t.heroFine}</p>
            </section>
        </div>
    );
}
