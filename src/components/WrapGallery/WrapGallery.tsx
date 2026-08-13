import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft, Box, Calendar, ChevronDown, Download, Flame, Heart,
    MessageCircle, Search, Sparkles, Trash2,
} from 'lucide-react';
import { CAR_MODELS } from '../../constants';
import { TRANSLATIONS } from '../../translations';
import { useAuth } from '../../contexts/AuthContext';
import {
    deleteWrap, downloadWrap, fetchWraps, likeWrap, nextTagValue, updateWrapTags,
    type SortOption, type WrapType,
} from '../../utils/wrapApi';
import type { Wrap } from '../Gallery';
import { WrapDetailModal } from '../WrapDetailModal';
import '../../styles/wrap-gallery.css';

const ALL_MODELS = '__all__';

export interface WrapGalleryProps {
    type: WrapType;
    selectedModel?: string;
    refreshTrigger?: number;
    language?: 'en' | 'zh';
    /** Load the wrap into the studio (and close this page), switching car if given. */
    onLoadWrap: (url: string, wrap?: { model?: string; name?: string }) => void | Promise<void>;
    onClose: () => void;
}

function ownerId(wrap: Wrap): string | undefined {
    if (!wrap.user) return undefined;
    return typeof wrap.user === 'string' ? wrap.user : wrap.user._id;
}

function isRecent(dateStr?: string): boolean {
    if (!dateStr) return false;
    const time = new Date(dateStr).getTime();
    if (Number.isNaN(time)) return false;
    return Date.now() - time < 24 * 60 * 60 * 1000;
}

export function WrapGallery({
    type, selectedModel, refreshTrigger = 0, language = 'en', onLoadWrap, onClose,
}: WrapGalleryProps) {
    const t = TRANSLATIONS[language];
    const { user } = useAuth();
    const [wraps, setWraps] = useState<Wrap[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('downloads');
    const [modelFilter, setModelFilter] = useState(selectedModel ?? ALL_MODELS);
    const [openId, setOpenId] = useState<string | null>(null);
    const [likedIds, setLikedIds] = useState<string[]>([]);
    const [commentsFor, setCommentsFor] = useState<Wrap | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchWraps(type, sortBy)
            .then(list => { if (!cancelled) setWraps(list); })
            .catch(error => {
                console.error('Failed to fetch community wraps', error);
                if (!cancelled) setWraps([]);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [type, sortBy, refreshTrigger]);

    // Escape closes the detail view first, then the page.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || commentsFor) return;
            if (openId) setOpenId(null);
            else onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [openId, commentsFor, onClose]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return wraps.filter(w => {
            const modelOk = type !== 'car'
                || modelFilter === ALL_MODELS
                || !w.models || w.models.length === 0
                || w.models.includes(modelFilter);
            const searchOk = !q
                || w.name.toLowerCase().includes(q)
                || w.author.toLowerCase().includes(q)
                || (w.models ?? []).some(m => m.toLowerCase().includes(q));
            return modelOk && searchOk;
        });
    }, [wraps, search, modelFilter, type]);

    const open = openId ? wraps.find(w => w._id === openId) ?? null : null;

    const mediaOf = (wrap: Wrap) => (type === 'sound' ? wrap.audioUrl : wrap.imageUrl);
    const modelLabel = (wrap: Wrap) =>
        !wrap.models || wrap.models.length === 0 ? t.universal : wrap.models.join(', ');
    const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
    };

    const handleLike = async (wrap: Wrap) => {
        try {
            const likes = await likeWrap(wrap._id, type);
            setWraps(prev => prev.map(w => (w._id === wrap._id ? { ...w, likes } : w)));
            setLikedIds(prev => (prev.includes(wrap._id) ? prev : [...prev, wrap._id]));
        } catch (error) {
            console.error('Failed to like wrap', error);
        }
    };

    const handleDownload = async (wrap: Wrap) => {
        try {
            await downloadWrap(wrap, type);
            setWraps(prev => prev.map(w => (w._id === wrap._id ? { ...w, downloads: w.downloads + 1 } : w)));
        } catch (error) {
            console.error('Failed to download wrap', error);
        }
    };

    const handleDelete = async (wrap: Wrap) => {
        if (!confirm(t.confirmDelete)) return;
        try {
            await deleteWrap(wrap._id, type);
            setWraps(prev => prev.filter(w => w._id !== wrap._id));
            if (openId === wrap._id) setOpenId(null);
        } catch (error) {
            console.error('Failed to delete wrap', error);
            alert(error instanceof Error ? error.message : t.deleteError);
        }
    };

    const handleToggleTag = async (wrap: Wrap, field: 'forceNew' | 'forceHot') => {
        try {
            const updated = await updateWrapTags(wrap._id, field, nextTagValue(wrap[field]));
            setWraps(prev => prev.map(w => (w._id === wrap._id ? { ...w, ...updated } : w)));
        } catch (error) {
            console.error('Failed to update tags', error);
        }
    };

    /**
     * A wrap is drawn against one model's template, so the studio has to show that
     * car. Prefer the wrap's own tag, else whatever model the list is filtered to.
     */
    const targetModel = (wrap: Wrap): string | undefined => {
        const tagged = wrap.models?.find(m => m in CAR_MODELS);
        if (tagged) return tagged;
        return modelFilter !== ALL_MODELS && modelFilter in CAR_MODELS ? modelFilter : undefined;
    };

    const handleLoad = async (wrap: Wrap) => {
        const media = mediaOf(wrap);
        if (!media) return;
        await onLoadWrap(media, { model: targetModel(wrap), name: wrap.name });
        onClose();
    };

    const renderThumb = (wrap: Wrap) => {
        if (type === 'sound') {
            return wrap.audioUrl
                ? <audio controls src={wrap.audioUrl} onClick={e => e.stopPropagation()} />
                : null;
        }
        return <img src={wrap.imageUrl} alt={wrap.name} loading="lazy" />;
    };

    const canManage = (wrap: Wrap) => Boolean(user?.isAdmin || (user?.id && user.id === ownerId(wrap)));

    return (
        <div className="wg-app" role="dialog" aria-modal="true" aria-label={t.community}>
            <div className="wg-head">
                <div className="wg-wm">TESLA<span> STUDIO</span></div>
                <nav className="wg-nav">
                    <button type="button" onClick={onClose}>{t.design}</button>
                    <span className="wg-on">{t.community}</span>
                </nav>
            </div>

            <div className="wg-wrap">
                {open ? (
                    <>
                        <button type="button" className="wg-back" onClick={() => setOpenId(null)}>
                            <ArrowLeft size={16} /> {t.back}
                        </button>
                        <div className="wg-dwrap">
                            <div className="wg-dimg">
                                {type === 'sound'
                                    ? <audio controls src={open.audioUrl} style={{ width: '100%' }} />
                                    : <img src={open.imageUrl} alt={open.name} />}
                                <button type="button" className="wg-view3d" onClick={() => handleLoad(open)}>
                                    <Box size={15} /> {t.viewIn3D}
                                </button>
                            </div>
                            <div className="wg-dinfo">
                                <div className="wg-tag">{modelLabel(open)}</div>
                                <h2>{open.name}</h2>
                                <p>
                                    {language === 'zh'
                                        ? `这个 ${modelLabel(open)} 设计由 ${open.author} 于 ${formatDate(open.createdAt)} 分享。免费下载，或直接载入 3D 工作室预览。`
                                        : `This ${modelLabel(open)} design was shared on ${formatDate(open.createdAt)} by ${open.author}. Download it for free, or load it straight into the 3D studio to preview it on your car.`}
                                </p>
                                <div className="wg-drow">
                                    <button
                                        type="button"
                                        className={`wg-ghost ${likedIds.includes(open._id) ? 'is-liked' : ''}`}
                                        onClick={() => handleLike(open)}
                                        title={t.like}
                                    >
                                        <Heart size={15} className={likedIds.includes(open._id) ? 'fill-current' : ''} />
                                        {open.likes}
                                    </button>
                                    <button type="button" className="wg-dl" onClick={() => handleDownload(open)}>
                                        <Download size={15} /> {t.download} <span>({open.downloads ?? 0})</span>
                                    </button>
                                    {type !== 'sound' && (
                                        <button type="button" className="wg-ghost" onClick={() => setCommentsFor(open)}>
                                            <MessageCircle size={15} /> {t.comments}
                                        </button>
                                    )}
                                </div>
                                <div className="wg-dcard">
                                    <div className="wg-crow">
                                        <div className="wg-av2">{initial(open.author)}</div>
                                        <div>
                                            <div className="wg-lbl">{t.createdBy}</div>
                                            <div className="wg-who">{open.author}</div>
                                        </div>
                                    </div>
                                    <div className="wg-date"><Calendar size={14} /> {formatDate(open.createdAt)}</div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <h1>{type === 'sound' ? t.galleryTitleSound : type === 'plate' ? t.galleryTitlePlate : t.galleryTitle}</h1>
                        <div className="wg-bar">
                            <label className="wg-search">
                                <Search size={15} />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={type === 'sound' ? t.searchSounds : type === 'plate' ? t.searchPlates : t.searchWraps}
                                />
                            </label>
                            {type === 'car' && (
                                <div className="wg-sel">
                                    <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} aria-label={t.allModels}>
                                        <option value={ALL_MODELS}>{t.allModels}</option>
                                        {Object.keys(CAR_MODELS).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="wg-caret" size={12} />
                                </div>
                            )}
                            <div className="wg-sel">
                                <Download size={13} />
                                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} aria-label={t.sortBy}>
                                    <option value="downloads">{t.mostDownloaded}</option>
                                    <option value="popular">{t.popular}</option>
                                    <option value="newest">{t.newest}</option>
                                </select>
                                <ChevronDown className="wg-caret" size={12} />
                            </div>
                        </div>

                        {loading && wraps.length === 0 ? (
                            <div className="wg-note">{t.connecting}</div>
                        ) : visible.length === 0 ? (
                            <div className="wg-note">
                                {type === 'sound' ? t.noSoundsFound : type === 'plate' ? t.noPlatesFound : t.noWrapsFound}
                            </div>
                        ) : (
                            <div className="wg-grid">
                                {visible.map(wrap => {
                                    const showNew = wrap.forceNew === true || (wrap.forceNew !== false && isRecent(wrap.createdAt));
                                    const showHot = wrap.forceHot === true || (wrap.forceHot !== false && (wrap.likes + wrap.downloads) > 30);
                                    return (
                                        <div
                                            key={wrap._id}
                                            className="wg-card"
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setOpenId(wrap._id)}
                                            onKeyDown={e => { if (e.key === 'Enter') setOpenId(wrap._id); }}
                                        >
                                            <div className="wg-thumb">{renderThumb(wrap)}</div>
                                            <div className="wg-badges">
                                                {showNew && <span className="wg-badge wg-new"><Sparkles size={10} /> NEW</span>}
                                                {showHot && <span className="wg-badge wg-hot"><Flame size={10} /> HOT</span>}
                                            </div>
                                            {canManage(wrap) && (
                                                <div className="wg-admin">
                                                    {user?.isAdmin && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className={`wg-new-btn ${wrap.forceNew === true ? 'is-on' : ''} ${wrap.forceNew === false ? 'is-off' : ''}`}
                                                                onClick={e => { e.stopPropagation(); handleToggleTag(wrap, 'forceNew'); }}
                                                                title={`NEW: ${wrap.forceNew === true ? 'forced on' : wrap.forceNew === false ? 'forced off' : 'auto'}`}
                                                            >
                                                                <Sparkles size={12} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`wg-hot-btn ${wrap.forceHot === true ? 'is-on' : ''} ${wrap.forceHot === false ? 'is-off' : ''}`}
                                                                onClick={e => { e.stopPropagation(); handleToggleTag(wrap, 'forceHot'); }}
                                                                title={`HOT: ${wrap.forceHot === true ? 'forced on' : wrap.forceHot === false ? 'forced off' : 'auto'}`}
                                                            >
                                                                <Flame size={12} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="wg-del-btn"
                                                        onClick={e => { e.stopPropagation(); handleDelete(wrap); }}
                                                        title={t.delete}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="wg-meta">
                                                <div className="wg-nm">{wrap.name}</div>
                                                <div className="wg-md">{modelLabel(wrap)}</div>
                                                <div className="wg-by"><span className="wg-av">{initial(wrap.author)}</span>{wrap.author}</div>
                                                <div className="wg-stats">
                                                    <span><Heart size={13} /> {wrap.likes}</span>
                                                    <span><Download size={13} /> {wrap.downloads ?? 0}</span>
                                                    {type === 'car' && <span className="wg-b3d">3D</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            <WrapDetailModal
                isOpen={Boolean(commentsFor)}
                onClose={() => setCommentsFor(null)}
                wrap={commentsFor}
                onLoadWrap={url => {
                    if (commentsFor) void onLoadWrap(url, { model: targetModel(commentsFor), name: commentsFor.name });
                    onClose();
                }}
                onUpdate={updated => setWraps(prev => prev.map(w => (w._id === updated._id ? { ...w, ...updated } : w)))}
            />
        </div>
    );
}
