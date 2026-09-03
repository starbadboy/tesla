import { Sparkles } from 'lucide-react';
import { UserMenu } from '../Auth/UserMenu';
import { TRANSLATIONS } from '../../translations';
import { navigate, PAGE_PATHS, type AppPage } from '../../utils/navigation';
import '../../styles/site-header.css';

interface SiteHeaderProps {
    page: AppPage;
    language: 'en' | 'zh';
    onToggleLanguage: () => void;
}

export function SiteHeader({ page, language, onToggleLanguage }: SiteHeaderProps) {
    const t = TRANSLATIONS[language];
    const active = page === 'explore3d' ? 'explore' : page === 'edit' ? 'create' : page;
    return (
        <header className="site-header">
            <a className="site-brand" href={PAGE_PATHS.home} aria-label={t.home} aria-current={page === 'home' ? 'page' : undefined}>
                TESLA<span>STUDIO</span>
            </a>
            <nav className="site-nav" aria-label={t.mainNavigation}>
                <a href={PAGE_PATHS.create} className="site-nav__link site-nav__link--ai" aria-current={active === 'create' ? 'page' : undefined}>
                    <Sparkles size={15} aria-hidden="true" />
                    <span>{t.aiCreate}</span>
                    <span className="site-hot" aria-hidden="true">HOT</span>
                </a>
                <a href={PAGE_PATHS.explore} className="site-nav__link" aria-current={active === 'explore' ? 'page' : undefined}>{t.exploreWraps}</a>
                <a href={PAGE_PATHS.preview} className="site-nav__link" aria-current={active === 'preview' ? 'page' : undefined}>{t.previewPage}</a>
            </nav>
            <div className="site-utilities">
                <button type="button" className="site-language" onClick={onToggleLanguage}>{language === 'en' ? '中文' : 'EN'}</button>
                <UserMenu onOpenGarage={() => navigate('garage')} language={language} />
            </div>
        </header>
    );
}
