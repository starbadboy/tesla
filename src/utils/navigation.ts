import { useSyncExternalStore } from 'react';

export const PAGE_PATHS = {
    home: '#/home',
    preview: '#/preview',
    create: '#/create',
    edit: '#/create/manual',
    explore: '#/explore',
    explore3d: '#/explore/3d',
    garage: '#/garage',
} as const;

export type AppPage = keyof typeof PAGE_PATHS;

export function pageFromHash(hash: string): AppPage {
    const normalized = hash.replace(/\/+$/, '');
    return (Object.entries(PAGE_PATHS).find(([, path]) => path === normalized)?.[0] as AppPage) ?? 'preview';
}

export function initialPage(hash: string, search: string): AppPage {
    return new URLSearchParams(search).has('checkout') ? 'create' : pageFromHash(hash);
}

/** Hash routes work on the existing static host without server rewrite rules. */
export function initializeNavigation() {
    const page = initialPage(window.location.hash, window.location.search);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${PAGE_PATHS[page]}`);
}

export function navigate(page: AppPage) {
    if (window.location.hash !== PAGE_PATHS[page]) window.location.hash = PAGE_PATHS[page];
}

function subscribe(onChange: () => void) {
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
        window.removeEventListener('hashchange', onChange);
        window.removeEventListener('popstate', onChange);
    };
}

const getPage = () => pageFromHash(window.location.hash);

export function useAppPage() {
    return useSyncExternalStore(subscribe, getPage, () => 'preview' as AppPage);
}
