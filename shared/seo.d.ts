export type AppPage = 'preview' | 'home' | 'create' | 'edit' | 'explore' | 'explore3d' | 'garage' | 'engineSound';
export type SeoLanguage = 'en' | 'zh';

export interface PageMeta {
    title: string;
    description: string;
}

export interface Route {
    page: AppPage;
    wrapId: string | null;
    /** Set on a collection page such as /wraps/model-3-2024-base. */
    model: string | null;
    lang: SeoLanguage;
}

export interface CollectionMeta extends PageMeta {
    heading: string;
    path: string;
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
export function splitLang(pathname: string): { lang: SeoLanguage; path: string };
export function localizePath(path: string, lang: SeoLanguage): string;
export function alternateUrls(path: string): Record<SeoLanguage, string>;
export function slugify(name: string): string;
export function wrapPath(wrap: Pick<WrapLike, '_id' | 'name'>): string;
export function wrapMeta(wrap: WrapLike, lang?: SeoLanguage): PageMeta & { image: string; path: string };
export const WRAP_MODELS: readonly string[];
export function modelFromSlug(slug: string): string | null;
export function collectionPath(model: string): string;
export function collectionMeta(model: string, count?: number, lang?: SeoLanguage): CollectionMeta;
export function embedPath(wrap: Pick<WrapLike, '_id'>): string;
