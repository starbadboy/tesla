import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { CAR_MODELS } from '../constants';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null; // The generated wrap image (blob URL or base64)
}

export function ShareModal({ isOpen, onClose, imageUrl }: ShareModalProps) {
    const [name, setName] = useState('');
    const [author, setAuthor] = useState('');
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleModelToggle = (model: string) => {
        setSelectedModels(prev =>
            prev.includes(model)
                ? prev.filter(m => m !== model)
                : [...prev, model]
        );
    };

    const handleSubmit = async () => {
        if (!name || !imageUrl) return;

        setIsSubmitting(true);

        try {
            // Convert blob URL to File object if necessary, or just fetch the blob
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], "wrap.png", { type: "image/png" });

            const formData = new FormData();
            formData.append('name', name);
            formData.append('author', author || 'Anonymous');
            formData.append('models', JSON.stringify(selectedModels)); // Send as JSON string
            formData.append('image', file);

            // Sending to /api/wraps (proxy handles forwarding to localhost:5000)
            const apiResponse = await fetch('/api/wraps', {
                method: 'POST',
                body: formData,
            });

            if (!apiResponse.ok) {
                throw new Error('Failed to upload wrap');
            }

            const data = await apiResponse.json();
            console.log('Wrap uploaded:', data);
            onClose();
            // Ideally show a success toast here
            alert("Wrap shared successfully!");

        } catch (error) {
            console.error('Error sharing wrap:', error);
            alert("Failed to share wrap. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold font-serif">Share Your Wrap</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                Wrap Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Lightning McQueen"
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                Credit (optional)
                            </label>
                            <input
                                type="text"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                placeholder="Your name or @twitter"
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                                Models * <span className="text-gray-400 font-normal normal-case">(check all that apply)</span>
                            </label>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar border border-gray-100 rounded-lg p-2">
                                {Object.keys(CAR_MODELS).map(model => (
                                    <label key={model} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedModels.includes(model)}
                                            onChange={() => handleModelToggle(model)}
                                            className="rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">{model}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <p className="text-[10px] text-gray-400 text-center pt-2">
                            Max 2MB per file • PNG only • 1024x1024 recommended
                        </p>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="outline" onClick={onClose} fullWidth>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={!name || isSubmitting}
                                fullWidth
                                className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin mr-2" />
                                        Sharing...
                                    </>
                                ) : (
                                    "Submit Wraps"
                                )}
                            </Button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
