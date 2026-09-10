import { useSyncExternalStore } from 'react';
import { PAGE_PATHS, parseRoute, type AppPage, type Route } from '../../shared/seo';

export { PAGE_PATHS, type AppPage };

/** The path a fresh load should show: checkout returns go to AI creation, old #/x links become /x. */
export function initialPath(pathname: string, search: string, hash: string): string {
    if (new URLSearchParams(search).has('checkout')) return PAGE_PATHS.create;
    if (hash.startsWith('#/')) return hash.slice(1);
    return pathname;
}

/** Canonicalizes the first URL and turns in-app links into history pushes instead of reloads. */
export function initializeNavigation() {
    const { location, history } = window;
    const path = initialPath(location.pathname, location.search, location.hash);
    const route = parseRoute(path);
    const canonical = route.wrapId ? path : PAGE_PATHS[route.page];
    history.replaceState(history.state, '', `${canonical}${location.search}`);
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

export function navigateTo(path: string) {
    if (window.location.pathname + window.location.search === path) return;
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
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
const SERVER_ROUTE: Route = { page: 'preview', wrapId: null };

export function useRoute() {
    return useSyncExternalStore(subscribe, getRoute, () => SERVER_ROUTE);
}

export function useAppPage() {
    return useRoute().page;
}
