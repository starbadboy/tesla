// Shared community-wrap API calls used by the Gallery panel and the Wrap Gallery page.
import type { Wrap } from '../components/Gallery';
import { compressBlob } from './imageProcessor';

export type WrapType = 'car' | 'plate' | 'sound';
export type SortOption = 'popular' | 'downloads' | 'newest';

function authHeaders(): Record<string, string> {
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

/** Returns the new like count. */
export async function likeWrap(id: string, type: WrapType): Promise<number> {
    const url = type === 'sound' ? `/api/sounds/${id}/like` : `/api/wraps/${id}/like`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.likes as number;
}

/** R2 CDN URLs need the server proxy or the fetch trips CORS. */
export function proxiedMediaUrl(url: string): string {
    return url.includes('.r2.dev/') ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url;
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
