import { useState, type ChangeEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { CAR_MODELS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShareSuccess?: () => void; // Called after successful share to refresh data
    imageUrl: string | null; // The generated wrap image (blob URL or base64)
    language?: 'en' | 'zh';
    type?: 'car' | 'plate' | 'sound';
}

export function ShareModal({ isOpen, onClose, onShareSuccess, imageUrl, language = 'en', type = 'car' }: ShareModalProps) {
    const [name, setName] = useState('');
    const [author, setAuthor] = useState('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const { user, token } = useAuth();

    useEffect(() => {
        if (user && isOpen) {
            setAuthor(user.username);
        }
    }, [user, isOpen]);

    const t = TRANSLATIONS[language];

    if (!isOpen) return null;

    const handleModelChange = (model: string) => {
        setSelectedModel(model);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setUploadedFiles(files);

            // If single file selected, pre-fill name with filename (no extension)
            if (files.length === 1) {
                const fileName = files[0].name.replace(/\.[^/.]+$/, "");
                setName(fileName);
            } else {
                // If multiple files, clear name as we'll use individual filenames
                setName('');
            }
        }
    };

    const handleSubmit = async () => {
        // Validation:
        // - Single upload/Canvas: requires 'name'
        // - Bulk upload: doesn't require 'name' (uses filenames)
        const isBulk = uploadedFiles.length > 1;
        if ((!isBulk && !name) || (!imageUrl && uploadedFiles.length === 0)) return;

        // If car, require model. If plate, model is optional (or we set default).
        if (type === 'car' && !selectedModel) {
            alert(t.selectModel);
            return;
        }

        setIsSubmitting(true);

        try {
            const uploadSingleFile = async (file: File) => {
                const formData = new FormData();

                // Determine name: use input name for single/canvas, or filename for bulk
                const wrapName = isBulk ? file.name.replace(/\.[^/.]+$/, "") : name;

                formData.append('name', wrapName);
                formData.append('author', author || 'Anonymous');
                // For plates, we can send empty models or 'Universal'? Let's send empty if not selected.
                formData.append('models', JSON.stringify(selectedModel ? [selectedModel] : []));
                formData.append('type', type);
                if (type === 'sound') {
                    formData.append('audio', file);
                } else {
                    formData.append('image', file);
                }

                const headers: Record<string, string> = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const uploadUrl = type === 'sound' ? '/api/sounds' : '/api/wraps';
                const apiResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formData,
                    headers // Fetch will parse headers object
                });


                if (!apiResponse.ok) {
                    throw new Error(`Failed to upload wrap ${file.name}`);
                }

                return await apiResponse.json();
            };

            if (uploadedFiles.length > 0) {
                // Bulk upload (or single file upload)
                await Promise.all(uploadedFiles.map((file) => uploadSingleFile(file)));
            } else if (imageUrl) {
                // Single image from canvas
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const file = new File([blob], "wrap.png", { type: "image/png" });
                await uploadSingleFile(file);
            } else {
                throw new Error("No image to upload");
            }

            // Success
            onClose();
            onShareSuccess?.();
            alert("Wrap(s) shared successfully!");

        } catch (error) {
            console.error('Error sharing wrap:', error);
            alert("Failed to share wrap. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isBulk = uploadedFiles.length > 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-transparent dark:border-zinc-800">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold font-serif dark:text-white">{type === 'car' ? t.shareYourWrap : t.shareYourPlate}</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400 mb-1">
                                {type === 'car' ? t.wrapName : type === 'sound' ? t.soundName : t.plateName} *
                            </label>
                            <input
                                type="text"
                                value={isBulk ? "" : name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={isBulk ? "Original filenames will be used" : t.wrapNamePlaceholder}
                                disabled={isBulk}
                                className={`w-full bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-black dark:focus:border-white transition-colors dark:text-white dark:placeholder-zinc-600 ${isBulk ? 'cursor-not-allowed text-gray-400 dark:text-zinc-600' : ''}`}
                                autoFocus={!isBulk}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400 mb-1">
                                {t.credit}
                            </label>
                            <input
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                placeholder={t.creditPlaceholder}
                                disabled={!!user} // Disable editing if logged in
                                title={user ? "Author name linked to your account" : ""}
                                className={`w-full bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-black dark:focus:border-white transition-colors dark:text-white dark:placeholder-zinc-600 ${user ? 'text-gray-500 dark:text-zinc-500 cursor-not-allowed' : ''}`}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400 mb-1">
                                {type === 'sound' ? "Upload Audio" : t.uploadImageOptional}
                            </label>
                            <input
                                type="file"
                                accept={type === 'sound' ? "audio/wav, audio/mpeg, audio/*" : "image/png, image/jpeg, image/jpg"}
                                onChange={handleFileChange}
                                multiple
                                className="w-full text-sm text-gray-500 dark:text-zinc-400
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-xs file:font-semibold
                                  file:bg-black file:text-white
                                  dark:file:bg-white dark:file:text-black
                                  hover:file:bg-gray-800 dark:hover:file:bg-zinc-200
                                "
                            />
                            {uploadedFiles.length > 0 && (
                                <div className="mt-1">
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                        {uploadedFiles.length} file(s) selected
                                    </p>
                                    <ul className="text-[10px] text-gray-500 dark:text-zinc-500 max-h-16 overflow-y-auto">
                                        {uploadedFiles.map((f, i) => (
                                            <li key={i} className="truncate">{f.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {type === 'car' && (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400 mb-2">
                                    {t.models} * <span className="text-gray-400 dark:text-zinc-600 font-normal normal-case">{t.selectOne}</span>
                                </label>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar border border-gray-100 dark:border-zinc-800 rounded-lg p-2">
                                    {Object.keys(CAR_MODELS).map(model => (
                                        <label key={model} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 p-1 rounded transition-colors">
                                            <input
                                                type="radio"
                                                name="carModel"
                                                checked={selectedModel === model}
                                                onChange={() => handleModelChange(model)}
                                                className="rounded-full border-gray-300 dark:border-zinc-600 text-black dark:text-white focus:ring-black dark:focus:ring-white dark:bg-zinc-900"
                                            />
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            <span className="text-sm text-gray-700 dark:text-zinc-300">{(t as any)[model] || model}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-gray-400 dark:text-zinc-600 text-center pt-2">
                            {type === 'car' ? t.maxSize : t.maxSizePlate}
                        </p>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button variant="outline" onClick={onClose} fullWidth className="dark:text-white dark:border-zinc-700 dark:hover:bg-zinc-800">
                                {t.cancel}
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={(!isBulk && !name) || isSubmitting || (type === 'car' && !selectedModel)}
                                fullWidth
                                className="bg-blue-600 hover:bg-blue-700 text-white border-0 dark:bg-blue-600 dark:hover:bg-blue-700"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin mr-2" />
                                        {t.sharing}
                                    </>
                                ) : (
                                    type === 'car' ? t.submitWraps : type === 'sound' ? t.submitSounds : t.submitPlates
                                )}
                            </Button>
                        </div>


                    </div>
                </div>
            </div>
        </div>
    );
}
