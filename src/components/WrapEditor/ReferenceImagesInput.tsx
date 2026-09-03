import { useRef, useState } from 'react';
import { LoaderCircle, Plus, X } from 'lucide-react';
import { REFERENCE_IMAGE_LIMITS } from '../../../shared/wrapGeneration';
import { TRANSLATIONS } from '../../translations';
import { prepareReferenceImage, ReferenceImageError, type ReferenceImage } from '../../utils/referenceImages';

interface Props {
    language: 'en' | 'zh';
    images: ReferenceImage[];
    onChange: (images: ReferenceImage[]) => void;
    processing: boolean;
    onProcessingChange: (processing: boolean) => void;
    disabled: boolean;
}

export function ReferenceImagesInput({ language, images, onChange, processing, onProcessingChange, disabled }: Props) {
    const t = TRANSLATIONS[language];
    const input = useRef<HTMLInputElement>(null);
    const importing = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const locked = disabled || processing;

    const importFiles = async (files: File[]) => {
        if (!files.length || locked || importing.current) return;
        const available = REFERENCE_IMAGE_LIMITS.count - images.length;
        if (files.length > available) {
            setError(t.referenceCountError);
            return;
        }
        importing.current = true;
        onProcessingChange(true);
        setError(null);
        const added: ReferenceImage[] = [];
        const errors: string[] = [];
        try {
            for (const file of files) {
                try {
                    added.push(await prepareReferenceImage(file));
                } catch (error) {
                    errors.push(`${file.name}: ${error instanceof ReferenceImageError ? t[error.key] : t.referenceReadError}`);
                }
            }
            if (added.length) onChange([...images, ...added]);
            if (errors.length) setError(errors.join('\n'));
        } finally {
            importing.current = false;
            onProcessingChange(false);
        }
    };

    return (
        <div className="we-style-references" role="group" aria-label={t.referenceImages}>
            <div className="we-style-references-heading">
                <span>{t.referenceImages} ({images.length}/{REFERENCE_IMAGE_LIMITS.count})</span>
                {processing && <span role="status"><LoaderCircle size={12} className="we-spin" /> {t.referenceProcessing}</span>}
            </div>
            <div className="we-style-references-list">
                {images.map((image, index) => (
                    <div key={image.id} className="we-style-reference" title={image.name}>
                        <img src={image.dataUrl} alt={image.name} />
                        <button
                            type="button"
                            aria-label={`${t.removeReference} ${index + 1}`}
                            disabled={locked}
                            onClick={() => { onChange(images.filter(item => item.id !== image.id)); setError(null); }}
                        ><X size={12} /></button>
                    </div>
                ))}
                {images.length < REFERENCE_IMAGE_LIMITS.count && (
                    <button type="button" className="we-add-reference" aria-label={t.addReference} title={t.addReference} disabled={locked} onClick={() => input.current?.click()}>
                        <Plus size={22} />
                    </button>
                )}
            </div>
            <input
                ref={input}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                disabled={locked}
                onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void importFiles(files); }}
            />
            <p className="we-hint">{t.referenceImagesHint}</p>
            {error && <p className="we-error" role="alert">{error}</p>}
        </div>
    );
}
