import { ArrowUpRight, Sparkles } from 'lucide-react';
import { TRANSLATIONS } from '../../translations';
import '../../styles/ai-create-button.css';

interface AiCreateButtonProps {
    language: 'en' | 'zh';
    onClick: () => void;
    variant?: 'nav' | 'hero';
}

export function AiCreateButton({ language, onClick, variant = 'nav' }: AiCreateButtonProps) {
    const t = TRANSLATIONS[language];
    return (
        <button
            type="button"
            className={`ai-create-button ai-create-button--${variant}`}
            onClick={onClick}
            title={t.aiCreateHint}
        >
            <Sparkles size={variant === 'hero' ? 18 : 15} aria-hidden="true" />
            <span>{t.aiCreate}</span>
            <span className="ai-create-button__badge" aria-hidden="true">HOT</span>
            {variant === 'hero' && <ArrowUpRight size={17} aria-hidden="true" />}
        </button>
    );
}
