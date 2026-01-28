// Imports updated
import { useState, useEffect } from 'react';
import { Download, Heart, Search, Trash2, MessageCircle, ChevronDown, Flame, Sparkles } from 'lucide-react';
import { TRANSLATIONS } from '../translations';
import { useAuth } from '../contexts/AuthContext';
import { compressBlob } from '../utils/imageProcessor';
import { WrapDetailModal } from './WrapDetailModal';

export interface Wrap {
    _id: string;
    name: string;
    author: string;
    imageUrl: string;
    models: string[];
    likes: number;
    downloads: number;
    createdAt?: string; // Should be populated now
    forceNew?: boolean | null;
    forceHot?: boolean | null;
}

export interface GalleryProps {
    onLoadWrap: (imageUrl: string) => void;
    selectedModel?: string;
    refreshTrigger?: number; // Increment this to trigger a refetch of community wraps
    language?: 'en' | 'zh';
    viewMode?: 'all' | 'garage';
    type?: 'car' | 'plate';
}

type SortOption = 'popular' | 'downloads' | 'newest';

export function Gallery({ onLoadWrap, selectedModel, refreshTrigger, language = 'en', viewMode = 'all', type = 'car' }: GalleryProps) {
    const [wraps, setWraps] = useState<Wrap[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const [garageTab, setGarageTab] = useState<'my-uploads' | 'liked'>('my-uploads');
    const [selectedWrap, setSelectedWrap] = useState<Wrap | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('popular');

    const t = TRANSLATIONS[language];

    // Fetch community wraps on mount and when refreshTrigger changes
    useEffect(() => {
        const fetchWraps = async () => {
            setLoading(true);
            try {
                let endpoint = `/api/wraps?sort=${sortBy}&type=${type}`;
                if (viewMode === 'garage') {
                    // For garage, we probably want to filter by type too? Or show everything?
                    // User might want to see both. But for now let's keep it simple or user might get confused.
                    // Let's assume Garage shows all tailored to the current view? 
                    // Or let garage be universal. 
                    // Actually, if I am in Plate Mode, I only want to see my Plates in Garage.
                    // But backend garage endpoint returns all. Improve backend? 
                    // Or client side filter. Let's do client side filter for garage if necessary, 
                    // or just show all. 
                    // Let's just append type if backend supports it on garage, but backend only supports type on /wraps.
                    // For now, only filtered for community.
                    endpoint = garageTab === 'liked'
                        ? '/api/user/garage?type=liked'
                        : '/api/user/garage?type=my-uploads';
                }

                const headers: Record<string, string> = {};
                const token = localStorage.getItem('token');
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const res = await fetch(endpoint, { headers });
                if (res.ok) {
                    const data = await res.json();
                    let fetchedWraps: Wrap[] = data;

                    // Client-side filter for Garage if mixed types returned (since backend garage doesn't filter by type yet)
                    if (viewMode === 'garage') {
                        fetchedWraps = fetchedWraps.filter((w: any) => (w.type || 'car') === type);
                    }

                    setWraps(fetchedWraps);
                } else if (res.status === 401) {
                    console.error("Unauthorized access to garage");
                    setWraps([]);
                }
            } catch (error) {
                console.error("Failed to fetch wraps", error);
            } finally {
                setLoading(false);
            }
        };
        fetchWraps();
    }, [refreshTrigger, viewMode, garageTab, sortBy, type]);



    const handleLike = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`/api/wraps/${id}/like`, {
                method: 'POST',
                headers
            });
            if (res.ok) {
                const data = await res.json();
                setWraps(prev => prev.map(w => w._id === id ? { ...w, likes: data.likes } : w));
            }
        } catch (error) {
            console.error("Failed to like wrap", error);
        }
    };

    const handleDownload = async (e: React.MouseEvent, wrap: Wrap) => {
        e.stopPropagation();
        try {
            // 1. Track stats
            await fetch(`/api/wraps/${wrap._id}/download`, { method: 'POST' });
            setWraps(prev => prev.map(w => w._id === wrap._id ? { ...w, downloads: w.downloads + 1 } : w));

            // 2. Trigger download
            const imageUrl = wrap.imageUrl;
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            // Compress if needed
            const compressedBlob = await compressBlob(blob, 1);

            const url = window.URL.createObjectURL(compressedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${wrap.name.replace(/\s+/g, '_')}_wrap.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            console.error("Failed to download wrap", e)
        }
    }

    const handleOpenComments = (e: React.MouseEvent, wrap: Wrap) => {
        e.stopPropagation();
        setSelectedWrap(wrap);
        setIsDetailOpen(true);
    };

    const handleLoad = (wrap: Wrap) => {
        // Fix image URL to include host if relative
        // Proxy handles /uploads path
        const url = wrap.imageUrl;
        onLoadWrap(url);
    }

    const isRecent = (dateStr?: string) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;
        return (Date.now() - date.getTime()) < 24 * 60 * 60 * 1000;
    };

    const handleUpdateTags = async (e: React.MouseEvent, wrapId: string, field: 'forceNew' | 'forceHot', currentValue: boolean | null | undefined) => {
        e.stopPropagation();

        // Cycle: null (Auto) -> true (Force On) -> false (Force Off) -> null (Auto)
        let nextValue: boolean | null = null;
        if (currentValue === null || currentValue === undefined) nextValue = true;
        else if (currentValue === true) nextValue = false;
        else nextValue = null;

        try {
            const token = localStorage.getItem('token');
            const body: any = {};
            body[field] = nextValue;

            const res = await fetch(`/api/wraps/${wrapId}/tags`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const updatedWrap = await res.json();
                setWraps(prev => prev.map(w => w._id === wrapId ? { ...w, ...updatedWrap } : w));
            }
        } catch (error) {
            console.error("Failed to update tags", error);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm(t.confirmDelete)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/wraps/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                setWraps(prev => prev.filter(w => w._id !== id));
            } else {
                const data = await res.json();
                alert(data.error || t.deleteError);
            }
        } catch (error) {
            console.error("Failed to delete wrap", error);
            alert(t.deleteError);
        }
    };

    const communityWrapsByModel = wraps.filter(w => {
        if (!selectedModel) return true;
        // If wrap has no specific models, treat as generic/universal? 
        // Or strictly match? User said "only show selected models".
        // Let's assume strict match or if models array is empty (Universal)
        if (w.models.length === 0) return true;
        return w.models.includes(selectedModel);
    });

    const filteredWraps = communityWrapsByModel.filter(w => {
        const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
            w.author.toLowerCase().includes(search.toLowerCase()) ||
            w.models.some(m => m.toLowerCase().includes(search.toLowerCase()));

        return matchesSearch;
    });

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-zinc-900">
            {/* Tabs (Only show if in garage mode) */}
            {viewMode === 'garage' && (
                <div className="flex border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <button
                        onClick={() => setGarageTab('my-uploads')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${garageTab === 'my-uploads' ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        {t.myUploads} {garageTab === 'my-uploads' && <span className="ml-1 bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5 text-[10px]">{wraps.length}</span>}
                    </button>
                    <button
                        onClick={() => setGarageTab('liked')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${garageTab === 'liked' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        {t.likedWraps} {garageTab === 'liked' && <span className="ml-1 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full px-2 py-0.5 text-[10px]">{wraps.length}</span>}
                    </button>
                </div>
            )}

            {/* Search and Filter */}
            <div className="p-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder={type === 'plate' ? t.searchPlates : t.searchWraps}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-zinc-800 dark:text-white border-none rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10"
                    />
                </div>

                {viewMode === 'all' && (
                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="appearance-none bg-gray-100 dark:bg-zinc-800 dark:text-white border-none rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 cursor-pointer font-medium text-gray-600"
                        >
                            <option value="popular">{t.popular}</option>
                            <option value="downloads">{t.mostDownloaded}</option>
                            <option value="newest">{t.newest}</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                    </div>
                )}

            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {loading ? (
                        <div className="col-span-2 flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                        </div>
                    ) : filteredWraps.length === 0 ? (
                        <div className="col-span-2 text-center py-8 text-gray-400 text-sm">
                            {type === 'plate' ? t.noPlatesFound : t.noWrapsFound}
                        </div>
                    ) : (
                        filteredWraps.map(wrap => (
                            <div
                                key={wrap._id}
                                className="group bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg dark:hover:shadow-zinc-800/50 transition-shadow cursor-pointer"
                                onClick={() => handleLoad(wrap)}
                            >
                                <div className="aspect-square bg-gray-50 dark:bg-black relative overflow-hidden">
                                    <img
                                        src={wrap.imageUrl}
                                        alt={wrap.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Badges for New/Hot */}
                                    <div className="absolute top-2 left-2 flex gap-1 pointer-events-none z-10">
                                        {(wrap.forceNew === true || (wrap.forceNew !== false && isRecent(wrap.createdAt))) && (
                                            <div className="bg-red-600/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm backdrop-blur-sm">
                                                <Sparkles size={10} /> NEW
                                            </div>
                                        )}
                                        {(wrap.forceHot === true || (wrap.forceHot !== false && (wrap.likes + wrap.downloads) > 30)) && (
                                            <div className="bg-orange-500/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm backdrop-blur-sm">
                                                <Flame size={10} /> HOT
                                            </div>
                                        )}
                                    </div>

                                    {/* Owner/Admin Action Overlay */}
                                    {((viewMode === 'garage' && garageTab === 'my-uploads') || (user && user.isAdmin)) && (
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            {user?.isAdmin && (
                                                <>
                                                    <button
                                                        onClick={(e) => handleUpdateTags(e, wrap._id, 'forceNew', wrap.forceNew)}
                                                        className={`p-1.5 rounded-full shadow-sm text-white transition-colors ${wrap.forceNew === true ? 'bg-red-600 ring-1 ring-white' :
                                                            wrap.forceNew === false ? 'bg-gray-500/50' :
                                                                'bg-red-400/80 hover:bg-red-500'
                                                            }`}
                                                        title={`New Tag: ${wrap.forceNew === true ? 'Forced ON' : wrap.forceNew === false ? 'Forced OFF' : 'Auto'}`}
                                                    >
                                                        <Sparkles size={12} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleUpdateTags(e, wrap._id, 'forceHot', wrap.forceHot)}
                                                        className={`p-1.5 rounded-full shadow-sm text-white transition-colors ${wrap.forceHot === true ? 'bg-orange-600 ring-1 ring-white' :
                                                            wrap.forceHot === false ? 'bg-gray-500/50' :
                                                                'bg-orange-400/80 hover:bg-orange-500'
                                                            }`}
                                                        title={`Hot Tag: ${wrap.forceHot === true ? 'Forced ON' : wrap.forceHot === false ? 'Forced OFF' : 'Auto'}`}
                                                    >
                                                        <Flame size={12} />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={(e) => handleDelete(e, wrap._id)}
                                                className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
                                                title={t.delete}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Quick View / Comments Overlay Button */}
                                    <button
                                        onClick={(e) => handleOpenComments(e, wrap)}
                                        className="absolute bottom-2 right-2 p-2 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm text-black dark:text-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-105 z-10"
                                        title="View Details & Comments"
                                    >
                                        <MessageCircle size={14} />
                                    </button>
                                </div>

                                <div className="p-3">
                                    <h3 className="font-bold text-xs truncate mb-0.5 dark:text-white">{wrap.name}</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-3 truncate">
                                        {wrap.models.length > 0 ? wrap.models.join(', ') : t.universal} • {t.by} {wrap.author}
                                    </p>

                                    {/* Clean Action Row */}
                                    <div className="flex items-center justify-between mt-3">
                                        {/* Like Button */}
                                        <button
                                            onClick={(e) => handleLike(e, wrap._id)}
                                            className={`flex items-center gap-1 py-1 px-1.5 rounded-md transition-colors ${wrap.likes > 0
                                                ? 'text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                : 'text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800'
                                                }`}
                                            title={t.like}
                                        >
                                            <Heart size={14} className={wrap.likes > 0 ? "fill-current" : ""} />
                                            <span className="text-xs font-medium">{wrap.likes}</span>
                                        </button>

                                        {/* Download Button - Now has more space */}
                                        <button
                                            onClick={(e) => handleDownload(e, wrap)}
                                            className="flex items-center gap-1 py-1 px-1.5 rounded-md text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                            title={t.download}
                                        >
                                            <Download size={14} />
                                            <span className="text-xs font-medium">{wrap.downloads ?? 0}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <WrapDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                wrap={selectedWrap}
                onLoadWrap={onLoadWrap}
            />
        </div>
    );
}
