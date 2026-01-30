import { useState, useEffect, useRef } from 'react';
import { X, Heart, Download, Send, Trash2, User, Pencil, Save, ChevronDown } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { type Wrap } from './Gallery'; // Assume Wrap is exported from Gallery
import { CAR_MODELS } from '../constants';

interface Comment {
    _id: string;
    wrap: string;
    user: string;
    username: string;
    text: string;
    createdAt: string;
}

interface WrapDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    wrap: Wrap | null;
    onLoadWrap: (url: string) => void;
    onUpdate?: (updatedWrap: Wrap) => void;
}

export function WrapDetailModal({ isOpen, onClose, wrap, onLoadWrap, onUpdate }: WrapDetailModalProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, token } = useAuth();
    const commentListRef = useRef<HTMLDivElement>(null);

    // Edit Mode State
    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editModels, setEditModels] = useState<string[]>([]);
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && wrap) {
            fetchComments();
            // Reset edit state when opening
            setIsEditing(false);
            setEditName(wrap.name);
            setEditModels(wrap.models || []);
            setIsModelDropdownOpen(false);
        } else {
            setComments([]);
            setNewComment('');
        }
    }, [isOpen, wrap]);

    const handleSave = async () => {
        if (!wrap || !token) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/wraps/${wrap._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: editName,
                    models: editModels
                })
            });

            if (res.ok) {
                const updatedWrap = await res.json();
                setIsEditing(false);
                if (onUpdate) {
                    onUpdate(updatedWrap);
                }
                // Update local edit state in case we stay open? 
                // Actually if onUpdate updates parent state, parent renders with new wrap prop, 
                // causing useEffect to run and reset state anyway.
            } else {
                alert('Failed to update wrap');
            }
        } catch (error) {
            console.error("Failed to update wrap", error);
            alert('Failed to update wrap');
        } finally {
            setIsSaving(false);
        }
    };

    const fetchComments = async () => {
        if (!wrap) return;
        try {
            const res = await fetch(`/api/wraps/${wrap._id}/comments`);
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (error) {
            console.error("Failed to fetch comments", error);
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim() || !wrap || !token) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/wraps/${wrap._id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ text: newComment })
            });

            if (res.ok) {
                const comment = await res.json();
                setComments(prev => [comment, ...prev]);
                setNewComment('');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to post comment');
            }
        } catch (error) {
            console.error("Failed to post comment", error);
            alert('Failed to post comment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm('Are you sure you want to delete this comment?')) return;

        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                setComments(prev => prev.filter(c => c._id !== commentId));
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to delete comment');
            }
        } catch (error) {
            console.error("Failed to delete comment", error);
        }
    };

    // Calculate relative time (simple version)
    const timeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    if (!isOpen || !wrap) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-sans">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Close Button on Mobile (Overlay) - or just rely on top right in Layout */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 text-white/50 hover:text-white md:hidden"
                >
                    <X size={24} />
                </button>

                {/* Left Side: Image */}
                <div className="hidden md:flex flex-col w-2/3 bg-gray-100 dark:bg-zinc-950/50 relative">
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                        <img
                            src={wrap.imageUrl}
                            alt={wrap.name}
                            className="max-w-full max-h-full object-contain shadow-lg"
                        />
                    </div>
                    <div className="absolute bottom-4 right-4 flex gap-2">
                        <Button
                            onClick={() => {
                                onLoadWrap(wrap.imageUrl);
                                onClose();
                            }}
                            className="bg-white/90 hover:bg-white text-black text-xs"
                            size="sm"
                        >
                            Load to Studio
                        </Button>
                    </div>
                </div>

                {/* Right Side: Details & Comments */}
                <div className="w-full md:w-1/3 flex flex-col bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-start">
                        <div className="flex-1 mr-4">
                            {isEditing ? (
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[10px] uppercase text-gray-500 font-bold">Name</label>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full text-sm border rounded px-2 py-1 bg-gray-50 dark:bg-zinc-800 dark:text-white"
                                        />
                                    </div>
                                    <div className="relative">
                                        <label className="text-[10px] uppercase text-gray-500 font-bold">Models</label>
                                        <button
                                            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                            className="w-full text-sm border rounded px-2 py-1 bg-gray-50 dark:bg-zinc-800 dark:text-white flex items-center justify-between text-left h-8"
                                        >
                                            <span className="truncate">
                                                {editModels.length > 0 ? editModels.join(', ') : <span className="text-gray-400">Select Models</span>}
                                            </span>
                                            <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
                                        </button>

                                        {isModelDropdownOpen && (
                                            <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                                                {Object.keys(CAR_MODELS).map(modelKey => (
                                                    <label key={modelKey} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={editModels.includes(modelKey)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setEditModels([...editModels, modelKey]);
                                                                } else {
                                                                    setEditModels(editModels.filter(m => m !== modelKey));
                                                                }
                                                            }}
                                                            className="rounded border-gray-300 text-black focus:ring-black"
                                                        />
                                                        <span className="text-xs dark:text-white">{modelKey}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            size="sm"
                                            className="text-xs py-1 h-auto"
                                        >
                                            <Save size={12} className="mr-1" /> Save
                                        </Button>
                                        <Button
                                            onClick={() => setIsEditing(false)}
                                            variant="outline"
                                            size="sm"
                                            className="text-xs py-1 h-auto"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-lg leading-tight dark:text-white">{wrap.name}</h2>
                                        {(user?.isAdmin || user?.id === wrap.user || user?.id === (wrap.user as any)?._id) && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                                title="Edit Details"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">by <span className="font-semibold text-black dark:text-white">{wrap.author}</span></p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Models: {wrap.models.length > 0 ? wrap.models.join(', ') : 'Universal'}
                                    </p>
                                </>
                            )}
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Stats Row */}
                    <div className="flex px-4 py-3 gap-4 border-b border-gray-100 dark:border-zinc-800 text-xs text-gray-600 dark:text-zinc-400 font-medium">
                        <div className="flex items-center gap-1">
                            <Heart size={14} className={wrap.likes > 0 ? "fill-red-500 text-red-500" : ""} />
                            {wrap.likes} Likes
                        </div>
                        <div className="flex items-center gap-1">
                            <Download size={14} />
                            {wrap.downloads} Downloads
                        </div>
                    </div>

                    {/* Comments List */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50 dark:bg-zinc-950 flex flex-col gap-3" ref={commentListRef}>
                        {comments.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 dark:text-zinc-600 text-sm">
                                No comments yet. Be the first to say something!
                            </div>
                        ) : (
                            comments.map(comment => (
                                <div key={comment._id} className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-100 dark:border-zinc-800 shadow-sm text-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-xs flex items-center gap-1 dark:text-gray-200">
                                            <User size={10} className="text-gray-400" />
                                            {comment.username}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{timeAgo(comment.createdAt)}</span>
                                    </div>
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed break-words">{comment.text}</p>

                                    {/* Delete option for owner or admin */}
                                    {(user && (user.id === comment.user || user.isAdmin)) && (
                                        <div className="flex justify-end mt-1">
                                            <button
                                                onClick={() => handleDeleteComment(comment._id)}
                                                className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-1"
                                            >
                                                <Trash2 size={10} /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Comment Input */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800">
                        {user ? (
                            <div className="flex gap-2 items-end">
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="flex-1 bg-gray-50 dark:bg-zinc-800 border-0 rounded-lg p-2 text-sm focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 resize-none min-h-[40px] max-h-[100px] dark:text-white"
                                    rows={2}
                                />
                                <Button
                                    onClick={handlePostComment}
                                    disabled={!newComment.trim() || isSubmitting}
                                    size="sm"
                                    className="h-10 w-10 p-0 rounded-full flex items-center justify-center shrink-0"
                                >
                                    <Send size={16} className={isSubmitting ? "opacity-50" : ""} />
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-2 text-xs text-gray-500 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                Please <span className="font-bold text-black dark:text-white">login</span> to leave a message.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
