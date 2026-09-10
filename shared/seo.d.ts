export type AppPage = 'preview' | 'home' | 'create' | 'edit' | 'explore' | 'explore3d' | 'garage';
export type SeoLanguage = 'en' | 'zh';

export interface PageMeta {
    title: string;
    description: string;
}

export interface Route {
    page: AppPage;
    wrapId: string | null;
}

export interface WrapLike {
    _id: string;
    name: string;
    author?: string;
    models?: string[];
    imageUrl?: string;
    renderUrl?: string;
}

export const SITE_URL: string;
export const PAGE_PATHS: Readonly<Record<AppPage, string>>;
export const PAGE_META: Readonly<Record<SeoLanguage, Readonly<Record<AppPage, PageMeta>>>>;
export function parseRoute(pathname: string): Route;
export function slugify(name: string): string;
export function wrapPath(wrap: Pick<WrapLike, '_id' | 'name'>): string;
export function wrapMeta(wrap: WrapLike): PageMeta & { image: string; path: string };
