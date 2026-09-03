import { Box, LayoutGrid } from 'lucide-react';
import { TRANSLATIONS } from '../../translations';
import { PAGE_PATHS } from '../../utils/navigation';
import '../../styles/gallery-view-switch.css';

export function GalleryViewSwitch({ view, language }: { view: 'grid' | '3d'; language: 'en' | 'zh' }) {
    const t = TRANSLATIONS[language];
    return (
        <nav className="gallery-views" aria-label={t.galleryView}>
            <a href={PAGE_PATHS.explore} aria-current={view === 'grid' ? 'page' : undefined}>
                <LayoutGrid size={15} aria-hidden="true" />{t.gridView}
            </a>
            <a href={PAGE_PATHS.explore3d} aria-current={view === '3d' ? 'page' : undefined}>
                <Box size={15} aria-hidden="true" />{t.tryOnView}
            </a>
        </nav>
    );
}
