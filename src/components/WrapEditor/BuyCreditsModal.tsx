import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { TRANSLATIONS } from '../../translations';
import { fetchPacks, startCheckout, type CreditPack } from '../../utils/wrapApi';

interface BuyCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: 'en' | 'zh';
}

/** Three packs; each hands the designer to Stripe's hosted checkout. Same shell as AuthModal. */
export function BuyCreditsModal({ isOpen, onClose, language }: BuyCreditsModalProps) {
    const t = TRANSLATIONS[language];
    const [packs, setPacks] = useState<CreditPack[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            try {
                setPacks(await fetchPacks());
            } catch (err) {
                setError(err instanceof Error ? err.message : t.error);
            }
        };
        load();
    }, [isOpen, t.error]);

    if (!isOpen) return null;

    const buy = async (packId: string) => {
        setBusy(packId);
        setError(null);
        try {
            window.location.assign(await startCheckout(packId));
        } catch (err) {
            setError(err instanceof Error ? err.message : t.error);
            setBusy(null);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-transparent dark:border-zinc-800 p-6"
                role="dialog"
                aria-label={t.buyCredits}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-serif text-xl font-bold dark:text-white">{t.buyCredits}</h2>
                    <button type="button" aria-label={t.cancel} onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-black dark:text-white">
                        <X size={20} />
                    </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">{t.buyCreditsHint}</p>
                <div className="grid gap-3">
                    {packs.map(pack => (
                        <button
                            key={pack.id}
                            type="button"
                            disabled={busy !== null}
                            onClick={() => buy(pack.id)}
                            className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-left hover:border-blue-500 disabled:opacity-60 disabled:cursor-wait transition-colors"
                        >
                            <span className="grid">
                                <b className="text-sm font-semibold dark:text-white">{pack.credits} {t.credits}</b>
                                <span className="text-[11px] text-gray-500 dark:text-zinc-400">{pack.name}</span>
                            </span>
                            <span className="text-sm font-semibold text-blue-500">{busy === pack.id ? t.redirecting : formatPrice(pack)}</span>
                        </button>
                    ))}
                </div>
                {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            </div>
        </div>,
        document.body,
    );
}

function formatPrice(pack: CreditPack): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: pack.currency.toUpperCase() }).format(pack.amount / 100);
}
