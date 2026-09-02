import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { TRANSLATIONS } from '../../translations';
import { fetchPacks, startCheckout, type CreditPack } from '../../utils/wrapApi';

interface BuyCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: 'en' | 'zh';
}

/** Three packs; each hands the designer to Stripe's hosted checkout. */
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

    return (
        <div className="we-modal-backdrop" onClick={onClose}>
            <div className="we-modal" role="dialog" aria-label={t.buyCredits} onClick={e => e.stopPropagation()}>
                <header>
                    <h2>{t.buyCredits}</h2>
                    <button type="button" aria-label={t.cancel} onClick={onClose}><X size={16} /></button>
                </header>
                <p className="we-empty">{t.buyCreditsHint}</p>
                <div className="we-packs">
                    {packs.map(pack => (
                        <button key={pack.id} type="button" className="we-pack" disabled={busy !== null} onClick={() => buy(pack.id)}>
                            <b>{pack.credits} {t.credits}</b>
                            <span>{pack.name}</span>
                            <em>{busy === pack.id ? t.generating : formatPrice(pack)}</em>
                        </button>
                    ))}
                </div>
                {error && <p className="we-error">{error}</p>}
            </div>
        </div>
    );
}

function formatPrice(pack: CreditPack): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: pack.currency.toUpperCase() }).format(pack.amount / 100);
}
