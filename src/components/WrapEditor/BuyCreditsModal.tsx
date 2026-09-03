import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { TRANSLATIONS } from '../../translations';
import { fetchPacks, startCheckout, type CreditPack } from '../../utils/wrapApi';

const GENERATION_COST = 10;

interface BuyCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: 'en' | 'zh';
}

/** One card per pack; each hands the designer to Stripe's hosted checkout. Same shell as AuthModal. */
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

    // The cheapest credit is the best value, whichever pack that turns out to be.
    const bestValueId = packs.reduce<CreditPack | null>((best, pack) => (!best || pack.amount / pack.credits < best.amount / best.credits ? pack : best), null)?.id;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative bg-white dark:bg-zinc-950 w-full max-w-4xl max-h-full overflow-y-auto rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 border border-transparent dark:border-zinc-800 px-6 py-8 sm:px-10"
                role="dialog"
                aria-label={t.buyCredits}
                onClick={e => e.stopPropagation()}
            >
                <button type="button" aria-label={t.cancel} onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-black dark:text-white">
                    <X size={20} />
                </button>
                <h2 className="text-center text-3xl font-bold dark:text-white">{t.buyCredits}</h2>
                <p className="mx-auto mt-3 max-w-xl text-center text-sm text-gray-500 dark:text-zinc-400">{t.purchaseIntro}</p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {packs.map(pack => {
                        const featured = pack.id === bestValueId;
                        return (
                            <div
                                key={pack.id}
                                className={`relative flex flex-col rounded-2xl border p-6 text-center ${featured
                                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white'
                                    : 'bg-gray-50 text-black border-gray-200 dark:bg-zinc-900 dark:text-white dark:border-zinc-800'}`}
                            >
                                {featured && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">{t.bestValue}</span>
                                )}
                                <h3 className="text-xl font-semibold">{pack.name}</h3>
                                <p className={`mt-1 text-sm ${featured ? 'opacity-70' : 'text-gray-500 dark:text-zinc-400'}`}>{t.packTagline[pack.id] ?? ''}</p>
                                <p className="mt-6 text-4xl font-bold tracking-tight">{formatPrice(pack)}</p>
                                <p className={`mt-1 text-sm ${featured ? 'opacity-70' : 'text-gray-500 dark:text-zinc-400'}`}>{pack.credits} {t.credits}</p>
                                <ul className="mt-6 space-y-3 text-left text-sm">
                                    {[`${pack.credits / GENERATION_COST} ${t.aiGenerations}`, t.creditsNeverExpire, t.unlimitedExports].map(line => (
                                        <li key={line} className="flex items-center gap-2">
                                            <Check size={16} className="shrink-0 text-green-500" />
                                            <span>{line}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="button"
                                    disabled={busy !== null}
                                    onClick={() => buy(pack.id)}
                                    className={`mt-8 w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-wait ${featured
                                        ? 'bg-white text-black hover:bg-gray-100 dark:bg-black dark:text-white dark:hover:bg-zinc-800'
                                        : 'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-gray-100'}`}
                                >
                                    {busy === pack.id ? t.redirecting : `${t.getCredits} ${pack.credits} ${t.credits}`}
                                </button>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-6 text-center text-xs text-gray-500 dark:text-zinc-400">{t.buyCreditsHint}</p>
                {error && <p className="mt-3 text-center text-xs text-red-500">{error}</p>}
            </div>
        </div>,
        document.body,
    );
}

function formatPrice(pack: CreditPack): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: pack.currency.toUpperCase() }).format(pack.amount / 100);
}
