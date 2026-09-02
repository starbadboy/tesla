// Shared community-wrap API calls used by the Gallery panel and the Wrap Gallery page.
import type { Wrap } from '../components/Gallery';
import { CAR_3D_MODELS } from '../constants';
import { compressBlob } from './imageProcessor';

export type WrapType = 'car' | 'plate' | 'sound';
export type SortOption = 'popular' | 'downloads' | 'newest';

export function authHeaders(): Record<string, string> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface WrapQuery {
    /** Rows per request. Omit to get the whole list (what /api/sounds still does). */
    limit?: number;
    skip?: number;
    /** Server-side search over name and author. */
    q?: string;
    /** Server-side model filter; wraps with no models listed count as universal. */
    model?: string;
}

export interface WrapPage {
    items: Wrap[];
    /** Size of the full match, from X-Total-Count. */
    total: number;
}

/** Community wraps (or lock sounds) for a type, filtered and sorted server-side. */
export async function fetchWraps(
    type: WrapType,
    sort: SortOption,
    query: WrapQuery = {},
): Promise<WrapPage> {
    const params = new URLSearchParams({ sort });
    if (type !== 'sound') params.set('type', type);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.skip) params.set('skip', String(query.skip));
    if (query.q) params.set('q', query.q);
    if (query.model) params.set('model', query.model);

    const base = type === 'sound' ? '/api/sounds' : '/api/wraps';
    const res = await fetch(`${base}?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    const counted = Number(res.headers.get('X-Total-Count'));
    return { items, total: Number.isFinite(counted) && counted > 0 ? counted : items.length };
}

/**
 * Whether this wrap's own car can be shown in 3D.
 *
 * The renderer falls back to a default car for wraps it cannot place, so a Model Y L
 * design has a render of itself on a Model 3 — fine as a thumbnail source, misleading as
 * a claim. The hover swap and the 3D badge both hang off this.
 */
export function hasThreeD(wrap: Wrap): boolean {
    return (wrap.models ?? []).some(name => Boolean(CAR_3D_MODELS[name]));
}

/** Shared badge rules so the studio shelf and the gallery agree. */
export function wrapFlags(wrap: Wrap): { isNew: boolean; isHot: boolean } {
    const posted = wrap.createdAt ? new Date(wrap.createdAt).getTime() : NaN;
    const recent = Number.isFinite(posted) && Date.now() - posted < 24 * 60 * 60 * 1000;
    return {
        isNew: wrap.forceNew === true || (wrap.forceNew !== false && recent),
        isHot: wrap.forceHot === true || (wrap.forceHot !== false && wrap.likes + wrap.downloads > 30),
    };
}

export interface GenerationToSave {
    /** The generated image, as a data URL or a URL the browser can fetch. */
    url: string;
    prompt: string;
    model: string;
    isPublic: boolean;
}

/**
 * Keep a signed-in designer's generation as one of their wraps, through the same
 * upload the share dialog uses. Anonymous callers have nowhere to attach it.
 */
export async function saveGeneration({ url, prompt, model, isPublic }: GenerationToSave): Promise<Wrap> {
    const blob = await (await fetch(url)).blob();
    const form = new FormData();
    form.append('image', blob, 'generation.png');
    form.append('name', prompt.slice(0, 100));
    form.append('models', JSON.stringify([model]));
    form.append('type', 'car');
    form.append('source', 'ai');
    form.append('prompt', prompt);
    form.append('isPublic', String(isPublic));
    const res = await fetch('/api/wraps', { method: 'POST', headers: authHeaders(), body: form });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/** The signed-in designer's saved generations, newest first. */
export async function fetchMyGenerations(): Promise<Wrap[]> {
    const res = await fetch('/api/user/garage?type=my-uploads&source=ai', { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export interface CreditPack {
    id: string;
    name: string;
    credits: number;
    /** Smallest currency unit, e.g. cents. */
    amount: number;
    currency: string;
}

export async function fetchPacks(): Promise<CreditPack[]> {
    const res = await fetch('/api/credits/packs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).packs ?? [];
}

/** Opens an order and returns the hosted checkout URL to send the browser to. */
export async function startCheckout(packId: string): Promise<string> {
    const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (!res.ok || !data.checkoutUrl) throw new Error(data.error || `HTTP ${res.status}`);
    return data.checkoutUrl;
}

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'failed';

export async function fetchOrder(orderId: string): Promise<{ status: OrderStatus; credits: number }> {
    const res = await fetch(`/api/credits/orders/${orderId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export type GarageTab = 'my-uploads' | 'liked';

/** The signed-in user's own uploads, or the wraps they liked. Requires a token. */
export async function fetchGarage(tab: GarageTab): Promise<Wrap[]> {
    const res = await fetch(`/api/user/garage?type=${tab}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

/** Toggles the like and returns the new count plus whether this client now likes it. */
export async function likeWrap(id: string, type: WrapType): Promise<{ likes: number; liked: boolean }> {
    const url = type === 'sound' ? `/api/sounds/${id}/like` : `/api/wraps/${id}/like`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { likes: data.likes as number, liked: Boolean(data.liked) };
}

/** Images on our storage hosts (r2.dev, the CDN) send no CORS headers, so any cross-origin URL goes through the server proxy. */
export function proxiedMediaUrl(url: string): string {
    const crossOrigin = /^https?:\/\//.test(url) && !url.startsWith(window.location.origin);
    return crossOrigin ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url;
}

/** Tracks the download server-side, then saves the file locally. */
export async function downloadWrap(wrap: Wrap, type: WrapType): Promise<void> {
    const trackUrl = type === 'sound' ? `/api/sounds/${wrap._id}/download` : `/api/wraps/${wrap._id}/download`;
    await fetch(trackUrl, { method: 'POST' });

    const mediaUrl = type === 'sound' ? wrap.audioUrl : wrap.imageUrl;
    if (!mediaUrl) throw new Error('Wrap has no downloadable media');

    const response = await fetch(proxiedMediaUrl(mediaUrl));
    const blob = await response.blob();
    const finalBlob = type === 'sound' ? blob : await compressBlob(blob, 1);

    const url = window.URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wrap.name.replace(/\s+/g, '_')}_${type}.${type === 'sound' ? mediaUrl.split('.').pop() : 'png'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

export async function deleteWrap(id: string, type: WrapType): Promise<void> {
    const url = type === 'sound' ? `/api/sounds/${id}` : `/api/wraps/${id}`;
    const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
    }
}

/** Admin badge overrides: true = forced on, false = forced off, null = auto. */
export async function updateWrapTags(
    id: string,
    field: 'forceNew' | 'forceHot',
    value: boolean | null,
): Promise<Partial<Wrap>> {
    const res = await fetch(`/api/wraps/${id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/** Cycle order for the admin badge override. */
export function nextTagValue(current: boolean | null | undefined): boolean | null {
    if (current === null || current === undefined) return true;
    if (current === true) return false;
    return null;
}
