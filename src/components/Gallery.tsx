// Imports updated
import { useState, useEffect, useMemo } from 'react';
import { Download, Heart, Search, Trash2, ArrowUpDown } from 'lucide-react';
import { TRANSLATIONS } from '../translations';
import { useAuth } from '../contexts/AuthContext';
import { compressBlob } from '../utils/imageProcessor';

interface Wrap {
    _id: string;
    name: string;
    author: string;
    imageUrl: string;
    models: string[];
    likes: number;
    downloads: number;
    isOfficial?: boolean;
    createdAt?: string;
}

export interface GalleryProps {
    onLoadWrap: (imageUrl: string) => void;
    selectedModel?: string;
    refreshTrigger?: number; // Increment this to trigger a refetch of community wraps
    language?: 'en' | 'zh';
    viewMode?: 'all' | 'garage';
}

export function Gallery({ onLoadWrap, selectedModel, refreshTrigger, language = 'en', viewMode = 'all' }: GalleryProps) {
    const [communityWraps, setCommunityWraps] = useState<Wrap[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    // Garage Tab State: 'my-uploads' | 'liked' (only relevant if viewMode === 'garage')
    const [garageTab, setGarageTab] = useState<'my-uploads' | 'liked'>('my-uploads');

    // Sorting State
    const [sortBy, setSortBy] = useState<'popularity' | 'latest' | 'downloads'>('popularity');

    const t = TRANSLATIONS[language];

    // Fetch Wraps
    useEffect(() => {
        if (viewMode === 'all') {
            fetchCommunityWraps();
        } else if (viewMode === 'garage') {
            fetchGarageWraps();
        }
    }, [refreshTrigger, viewMode, garageTab, sortBy]);


    const fetchCommunityWraps = async () => {
        setLoading(true);
        try {
            let endpoint = `/api/wraps?sort=${sortBy}`;
            const headers: Record<string, string> = {};
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(endpoint, { headers });
            if (res.ok) {
                const data = await res.json();
                setCommunityWraps(data);
            }
        } catch (error) {
            console.error("Failed to fetch wraps", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGarageWraps = async () => {
        setLoading(true);
        try {
            const endpoint = garageTab === 'liked'
                ? '/api/user/garage?type=liked'
                : '/api/user/garage?type=my-uploads';

            const headers: Record<string, string> = {};
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(endpoint, { headers });
            if (res.ok) {
                const data = await res.json();
                setCommunityWraps(data); // Reusing communityWraps state for garage items
            } else if (res.status === 401) {
                setCommunityWraps([]);
            }
        } catch (error) {
            console.error("Failed to fetch garage wraps", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();

        try {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/wraps/${id}/like`, { method: 'POST', headers });
            if (res.ok) {
                const data = await res.json();
                setCommunityWraps(prev => prev.map(w => w._id === id ? { ...w, likes: data.likes } : w));
            }
        } catch (error) {
            console.error("Failed to like wrap", error);
        }
    };

    const handleDownload = async (e: React.MouseEvent, wrap: Wrap) => {
        e.stopPropagation();
        try {
            // 1. Track stats (only for community wraps)
            if (!wrap.isOfficial) {
                await fetch(`/api/wraps/${wrap._id}/download`, { method: 'POST' });
                setCommunityWraps(prev => prev.map(w => w._id === wrap._id ? { ...w, downloads: w.downloads + 1 } : w));
            }

            // 2. Trigger download
            const imageUrl = wrap.imageUrl;
            const response = await fetch(imageUrl);
            const blob = await response.blob();
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

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm(t.confirmDelete)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/wraps/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setCommunityWraps(prev => prev.filter(w => w._id !== id));
            } else {
                const data = await res.json();
                alert(data.error || t.deleteError);
            }
        } catch (error) {
            console.error("Failed to delete wrap", error);
            alert(t.deleteError);
        }
    };

    // Helper to filter wraps based on current selection
    const filterWraps = (sourceWraps: Wrap[]) => {
        return sourceWraps.filter(w => {
            // Model Filter
            const modelMatch = !selectedModel || w.models.length === 0 ||
                w.models.some(m => selectedModel.includes(m) || m.includes(selectedModel) || m === 'Universal');

            if (!modelMatch) return false;

            // Search Filter
            const searchMatch = !search ||
                w.name.toLowerCase().includes(search.toLowerCase()) ||
                w.author.toLowerCase().includes(search.toLowerCase()) ||
                w.models.some(m => m.toLowerCase().includes(search.toLowerCase()));

            return searchMatch;
        });
    };

    const communityCount = useMemo(() => filterWraps(communityWraps).length, [communityWraps, selectedModel, search]);

    // Filter Wraps for Display
    const displayedWraps = useMemo(() => {
        let sourceWraps: Wrap[] = [];

        if (viewMode === 'garage') {
            sourceWraps = communityWraps;
        } else {
            // viewMode === 'all', only community wraps now
            sourceWraps = communityWraps;
        }

        return filterWraps(sourceWraps);
    }, [communityWraps, viewMode, selectedModel, search]);


    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Top Navigation: Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
                {viewMode === 'garage' ? (
                    <>
                        <button
                            onClick={() => setGarageTab('my-uploads')}
                            className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${garageTab === 'my-uploads' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            {t.myUploads} <span className="ml-1 bg-gray-100 rounded-full px-2 py-0.5 text-[10px]">{communityWraps.length}</span>
                        </button>
                        <button
                            onClick={() => setGarageTab('liked')}
                            className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${garageTab === 'liked' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            {t.likedWraps} <span className="ml-1 bg-red-50 text-red-600 rounded-full px-2 py-0.5 text-[10px]">{communityWraps.length}</span>
                        </button>
                    </>
                ) : (
                    <>
                        {/* Main Gallery Header (Static) */}
                        <div className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-center border-b-2 border-black text-black">
                            {t.community} <span className="ml-1 bg-gray-100 rounded-full px-2 py-0.5 text-[10px]">{communityCount}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Toolbar: Search & Sort */}
            <div className="p-4 bg-white border-b border-gray-200 space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder={t.searchWraps}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-gray-100 border-none rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-black/5"
                        />
                    </div>
                    {/* Sort Dropdown */}
                    {(viewMode === 'all') && (
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-gray-100 border-none rounded-lg pl-3 pr-8 py-2 text-xs font-bold uppercase tracking-widest text-gray-600 focus:ring-2 focus:ring-black/5 appearance-none h-full cursor-pointer"
                            >
                                <option value="popularity">Popular</option>
                                <option value="downloads">Downloads</option>
                                <option value="latest">Latest</option>
                            </select>
                            <ArrowUpDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {loading ? (
                        <div className="col-span-2 flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                        </div>
                    ) : displayedWraps.length === 0 ? (
                        <div className="col-span-2 text-center py-8 text-gray-400 text-sm">
                            {t.noWrapsFound}
                        </div>
                    ) : (
                        displayedWraps.map(wrap => (
                            <div
                                key={wrap._id}
                                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                onClick={() => onLoadWrap(wrap.imageUrl)}
                            >
                                <div className="aspect-square bg-gray-50 relative overflow-hidden">
                                    <img
                                        src={wrap.imageUrl}
                                        alt={wrap.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Admin/Owner Delete Button */}
                                    {((viewMode === 'garage' && garageTab === 'my-uploads') || (user && user.isAdmin)) && !wrap.isOfficial && (
                                        <button
                                            onClick={(e) => handleDelete(e, wrap._id)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                                            title={t.delete}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="p-3">
                                    <h3 className="font-bold text-xs truncate mb-0.5">{wrap.name}</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-3 truncate">
                                        {wrap.isOfficial ? t.official : (wrap.models.length > 0 ? wrap.models.join(', ') : t.universal)} • {t.by} {wrap.author}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        {/* Like Button */}
                                        <button
                                            onClick={(e) => handleLike(e, wrap._id)}
                                            disabled={!!wrap.isOfficial} // Disable liking official wraps? Or allow local liking? Backend doesn't support it for static files easily unless mirrored.
                                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors ${wrap.likes > 0
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-black'
                                                } ${wrap.isOfficial ? 'cursor-default opacity-50' : ''}`}
                                            title={t.like}
                                        >
                                            <Heart size={14} className={wrap.likes > 0 ? "fill-current" : ""} />
                                            <span className="text-xs font-medium">{wrap.likes}</span>
                                        </button>

                                        {/* Download Button */}
                                        <button
                                            onClick={(e) => handleDownload(e, wrap)}
                                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-black transition-colors"
                                            title={t.download}
                                        >
                                            <Download size={14} />
                                            <span className="text-xs font-medium">{wrap.downloads}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
