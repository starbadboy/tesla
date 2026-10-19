import { useSyncExternalStore } from 'react';
import { PAGE_PATHS, localizePath, parseRoute, splitLang, type AppPage, type Route, type SeoLanguage } from '../../shared/seo';

export { PAGE_PATHS, type AppPage };

/** The path a fresh load should show: checkout returns go to AI creation, old #/x links become /x. */
export function initialPath(pathname: string, search: string, hash: string): string {
    if (new URLSearchParams(search).has('checkout')) return PAGE_PATHS.create;
    if (hash.startsWith('#/')) return hash.slice(1);
    return pathname;
}

const LANGUAGE_KEY = 'lang';

/** The language a visitor picked with the toggle, else their browser's. */
function preferredLanguage(): SeoLanguage {
    try {
        const saved = localStorage.getItem(LANGUAGE_KEY);
        if (saved === 'en' || saved === 'zh') return saved;
    } catch {
        // Storage can be blocked; the browser language still applies.
    }
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/**
 * Canonicalizes the first URL and turns in-app links into history pushes instead of reloads.
 * A /zh link keeps its language; an English one moves to /zh for a visitor who prefers Chinese.
 */
export function initializeNavigation() {
    const { location, history } = window;
    const path = initialPath(location.pathname, location.search, location.hash);
    const route = parseRoute(path);
    const pagePath = route.wrapId || route.model ? splitLang(path).path : PAGE_PATHS[route.page];
    const lang = splitLang(path).lang === 'zh' ? 'zh' : preferredLanguage();
    history.replaceState(history.state, '', `${localizePath(pagePath, lang)}${location.search}`);
    document.addEventListener('click', interceptLinks);
}

function interceptLinks(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || /^\/(api|uploads)\//.test(url.pathname) || /\.\w+$/.test(url.pathname)) return;
    event.preventDefault();
    navigateTo(url.pathname + url.search);
}

/** Goes to a page in the current language unless the path already names /zh. */
export function navigateTo(path: string, lang: SeoLanguage = splitLang(window.location.pathname).lang) {
    const target = splitLang(path).lang === 'zh' ? path : localizePath(path, lang);
    if (window.location.pathname + window.location.search === target) return;
    window.history.pushState(null, '', target);
    window.dispatchEvent(new Event('popstate'));
}

/** Shows the current page in the other language and remembers the choice for the next visit. */
export function switchLanguage(lang: SeoLanguage) {
    try {
        localStorage.setItem(LANGUAGE_KEY, lang);
    } catch {
        // Not remembered; the URL still carries the language.
    }
    const { pathname, search } = window.location;
    navigateTo(splitLang(pathname).path + search, lang);
}

export function navigate(page: AppPage) {
    navigateTo(PAGE_PATHS[page]);
}

function subscribe(onChange: () => void) {
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
}

// useSyncExternalStore needs the same object back while the URL is unchanged.
let cached: { key: string; route: Route } | null = null;
const getRoute = () => {
    const key = window.location.pathname;
    if (!cached || cached.key !== key) cached = { key, route: parseRoute(key) };
    return cached.route;
};
const SERVER_ROUTE: Route = { page: 'preview', wrapId: null, model: null, lang: 'en' };

export function useRoute() {
    return useSyncExternalStore(subscribe, getRoute, () => SERVER_ROUTE);
}

export function useAppPage() {
    return useRoute().page;
}
