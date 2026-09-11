// Social share targets and the watermark stamped on images that leave the site.
import { SITE_URL, embedPath, wrapPath } from '../../shared/seo';

export interface ShareSubject { _id: string; name: string; models?: string[] }

/** Absolute URL of a wrap's page, for share intents and the clipboard. */
export function wrapUrl(wrap: ShareSubject): string {
    return SITE_URL + wrapPath(wrap);
}

export function shareText(wrap: ShareSubject): string {
    const model = wrap.models?.[0] ?? 'Tesla';
    return `${wrap.name} — a ${model} wrap on Tesla Studio`;
}

/** Web intents for the networks that have one; Instagram and TikTok take the image itself. */
export function shareLinks(wrap: ShareSubject): { x: string; reddit: string } {
    const url = wrapUrl(wrap);
    const text = shareText(wrap);
    return {
        x: `https://x.com/intent/post?${new URLSearchParams({ text, url })}`,
        reddit: `https://www.reddit.com/submit?${new URLSearchParams({ url, title: text })}`,
    };
}

const escapeAttr = (value: string) => value.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

/** The iframe snippet for the bare 3D viewer of one wrap. */
export function embedSnippet(wrap: ShareSubject): string {
    const src = SITE_URL + embedPath(wrap);
    return `<iframe src="${src}" width="640" height="400" style="border:0;border-radius:12px" loading="lazy" allowfullscreen title="${escapeAttr(wrap.name)} on Tesla Studio"></iframe>`;
}

const WATERMARK = 'teslastudio.online';

/**
 * Stamps the site name in the corner of a share image. Only renders of the car get
 * this: the flat wrap sheet is what goes onto the real car, so it must stay clean.
 */
export async function stampWatermark(blob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0);
    const size = Math.max(14, Math.round(bitmap.width * 0.028));
    const pad = Math.round(size * 0.9);
    ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.4;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(WATERMARK, bitmap.width - pad, bitmap.height - pad);
    return new Promise(resolve => canvas.toBlob(out => resolve(out ?? blob), 'image/png'));
}
