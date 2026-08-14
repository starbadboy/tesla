import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { TRANSLATIONS } from '../../translations';
import { fetchWraps, hasThreeD } from '../../utils/wrapApi';
import type { Wrap } from '../Gallery';

/** Enough to fill two belts on a wide screen without the loop reading as a short cycle. */
const WALL_SIZE = 48;

export interface WrapWallProps {
    language: 'en' | 'zh';
    onPick: (wrap: Wrap) => void;
    onViewAll: () => void;
    refreshTrigger?: number;
}

/**
 * The showcase below the studio: two belts of wraps already on their cars, drifting in
 * opposite directions.
 *
 * It shows the pre-rendered shots rather than the flat sheets — a sheet says nothing to
 * someone who has not seen one before, and the whole point of the section is to make the
 * collection legible at a glance.
 */
export function WrapWall({ language, onPick, onViewAll, refreshTrigger = 0 }: WrapWallProps) {
    const t = TRANSLATIONS[language];
    const [wraps, setWraps] = useState<Wrap[]>([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        let cancelled = false;
        fetchWraps('car', 'popular', { limit: WALL_SIZE })
            .then(({ items, total: count }) => {
                if (cancelled) return;
                // Only wraps whose own car we can show: the rest are rendered on a stand-in.
                setWraps(items.filter(wrap => wrap.renderUrl && hasThreeD(wrap)));
                setTotal(count);
            })
            .catch(error => console.error('Failed to fetch wraps for the wall', error));
        return () => { cancelled = true; };
    }, [refreshTrigger]);

    if (wraps.length === 0) return null;

    const half = Math.ceil(wraps.length / 2);
    const belts = [wraps.slice(0, half), wraps.slice(half)];

    return (
        <section className="hm-wall">
            <h2>
                {t.wallTitle} <b>{total.toLocaleString()}+ {t.designs}</b>
            </h2>
            <p>{t.wallSub}</p>

            {belts.map((belt, row) => (
                <div className="hm-track" key={row}>
                    {/* Listed twice: the belt slides exactly one copy, so the seam never shows. */}
                    <div className={`hm-belt ${row === 1 ? 'is-rev' : ''}`}>
                        {[...belt, ...belt].map((wrap, index) => (
                            <button
                                type="button"
                                className="hm-tile"
                                key={`${wrap._id}-${index}`}
                                onClick={() => onPick(wrap)}
                            >
                                <img src={wrap.renderUrl} alt={wrap.name} loading="lazy" />
                                <span className="hm-tile-meta">
                                    <b>{wrap.models?.[0] ?? wrap.name}</b>
                                    <i>@{wrap.author}</i>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            <button type="button" className="hm-wall-all" onClick={onViewAll}>
                {t.viewAll} <ChevronRight size={15} />
            </button>
        </section>
    );
}
