import { useState, useEffect } from 'react';
import { Search, Heart, Download } from 'lucide-react';
import officialWrapsData from '../data/officialWraps.json';
import { WRAP_FOLDER_MAP, CDN_BASE } from '../constants';

const officialWraps: Wrap[] = officialWrapsData as Wrap[];
interface Wrap {
    _id: string;
    name: string;
    author: string;
    imageUrl: string;
    models: string[];
    likes: number;
    downloads: number;
}

export interface GalleryProps {
    onLoadWrap: (imageUrl: string) => void;
    selectedModel?: string;
    refreshTrigger?: number; // Increment this to trigger a refetch of community wraps
}

export function Gallery({ onLoadWrap, selectedModel, refreshTrigger }: GalleryProps) {
    const [wraps, setWraps] = useState<Wrap[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'official' | 'community'>('official');

    // Filter official wraps based on selected model
    const filteredOfficialWraps = officialWraps.filter(w => {
        if (!selectedModel) return true;

        const targetFolder = WRAP_FOLDER_MAP[selectedModel];
        if (!targetFolder) return true; // Fallback if no map found

        // Check if the image url uses the target folder
        // Format: /official_wraps/<folder>/filename.png
        return w.imageUrl.includes(`/${targetFolder}/`);
    });

    const officialWrapCount = filteredOfficialWraps.length;

    // Auto-apply logic removed as per user request


    // Fetch community wraps on mount and when refreshTrigger changes
    useEffect(() => {
        fetchWraps();
    }, [refreshTrigger]);

    const fetchWraps = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/wraps');
            if (res.ok) {
                const data = await res.json();
                setWraps(data);
            }
        } catch (error) {
            console.error("Failed to fetch wraps", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/wraps/${id}/like`, { method: 'POST' });
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
            const imageUrl = activeTab === 'official' ? `${CDN_BASE}${wrap.imageUrl}` : wrap.imageUrl;
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
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

    const handleLoad = (wrap: Wrap) => {
        // Fix image URL to include host if relative
        // Proxy handles /uploads path
        const url = activeTab === 'official' ? `${CDN_BASE}${wrap.imageUrl}` : wrap.imageUrl;
        onLoadWrap(url);
        // We don't track download stats on simple view anymore, only on explicit download
    }

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
        <div className="h-full flex flex-col bg-gray-50">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
                <button
                    onClick={() => setActiveTab('official')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'official' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Official <span className="ml-1 bg-gray-100 rounded-full px-2 py-0.5 text-[10px]">{officialWrapCount}</span>
                </button>
                <button
                    onClick={() => setActiveTab('community')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'community' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Community <span className="ml-1 bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 text-[10px]">{communityWrapsByModel.length}</span>
                </button>
            </div>

            {/* Search */}
            <div className="p-4 bg-white border-b border-gray-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search wraps..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-gray-100 border-none rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-black/5"
                    />
                </div>

            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'official' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredOfficialWraps.map(wrap => (
                            <div
                                key={wrap._id}
                                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                onClick={() => handleLoad(wrap)}
                            >
                                <div className="aspect-square bg-gray-50 relative overflow-hidden">
                                    <img
                                        src={`${CDN_BASE}${wrap.imageUrl}`}
                                        alt={wrap.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                <div className="p-3">
                                    <h3 className="font-bold text-xs truncate mb-0.5">{wrap.name}</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 truncate">
                                        {wrap.models.length > 0 ? wrap.models.join(', ') : 'Universal'} • by {wrap.author}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        {/* Likes (Static for official) */}
                                        <button
                                            className="flex items-center gap-1.5 text-gray-400 cursor-default bg-gray-50 px-2 py-1 rounded-full"
                                        >
                                            <Heart size={12} />
                                            <span className="text-[10px] font-medium">{wrap.likes}</span>
                                        </button>

                                        <div className="flex gap-1 items-center">
                                            <button
                                                onClick={(e) => handleDownload(e, wrap)}
                                                className="flex items-center gap-1 text-gray-400 hover:text-black transition-colors bg-gray-50 px-2 py-1 rounded-full cursor-pointer hover:bg-gray-200"
                                                title="Download Wrap Image"
                                            >
                                                <Download size={12} />
                                                <span className="text-[10px] font-medium">{wrap.downloads}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {loading ? (
                            <div className="col-span-2 flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                            </div>
                        ) : filteredWraps.length === 0 ? (
                            <div className="col-span-2 text-center py-8 text-gray-400 text-sm">
                                No wraps found.
                            </div>
                        ) : (
                            filteredWraps.map(wrap => (
                                <div
                                    key={wrap._id}
                                    className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                                    onClick={() => handleLoad(wrap)}
                                >
                                    <div className="aspect-square bg-gray-50 relative overflow-hidden">
                                        <img
                                            src={wrap.imageUrl}
                                            alt={wrap.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>

                                    <div className="p-3">
                                        <h3 className="font-bold text-xs truncate mb-0.5">{wrap.name}</h3>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 truncate">
                                            {wrap.models.length > 0 ? wrap.models.join(', ') : 'Universal'} • by {wrap.author}
                                        </p>

                                        <div className="flex items-center justify-between">
                                            <button
                                                onClick={(e) => handleLike(e, wrap._id)}
                                                className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 px-2 py-1 rounded-full"
                                            >
                                                <Heart size={12} className={wrap.likes > 0 ? "fill-current" : ""} />
                                                <span className="text-[10px] font-medium">{wrap.likes}</span>
                                            </button>

                                            <div className="flex gap-1 items-center">
                                                <button className="p-1.5 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-full transition-colors hidden">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                                </button>
                                                <button
                                                    onClick={(e) => handleDownload(e, wrap)}
                                                    className="flex items-center gap-1 text-gray-400 hover:text-black transition-colors bg-gray-50 px-2 py-1 rounded-full cursor-pointer hover:bg-gray-200"
                                                    title="Download Wrap Image"
                                                >
                                                    <Download size={12} />
                                                    <span className="text-[10px] font-medium">{wrap.downloads}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

