import { useState } from 'react';
import { Check, Code2, Image as ImageIcon, Link2, Share2 } from 'lucide-react';
import type { Wrap } from '../Gallery';
import { TRANSLATIONS } from '../../translations';
import { proxiedMediaUrl } from '../../utils/wrapApi';
import { embedSnippet, shareLinks, shareText, stampWatermark, wrapUrl } from '../../utils/share';

interface ShareRowProps { wrap: Wrap; language: 'en' | 'zh' }

type Copied = 'link' | 'embed' | null;

/** X and Reddit intents, the native share sheet where there is one, copy link, embed code, and a watermarked render. */
export function ShareRow({ wrap, language }: ShareRowProps) {
    const t = TRANSLATIONS[language];
    const [copied, setCopied] = useState<Copied>(null);
    const [busy, setBusy] = useState(false);
    const links = shareLinks(wrap);
    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const copy = async (text: string, which: Copied) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(which);
            window.setTimeout(() => setCopied(null), 1800);
        } catch (error) {
            console.error('Clipboard write failed', error);
        }
    };

    const nativeShare = async () => {
        try {
            await navigator.share({ title: wrap.name, text: shareText(wrap), url: wrapUrl(wrap) });
        } catch (error) {
            if ((error as Error).name !== 'AbortError') console.error('Share failed', error);
        }
    };

    // The render on the car, stamped, handed to the share sheet or saved: Instagram and
    // TikTok have no web intent, so the picture itself is the share.
    const shareImage = async () => {
        const source = wrap.renderUrl || wrap.imageUrl;
        if (!source) return;
        setBusy(true);
        try {
            const raw = await (await fetch(proxiedMediaUrl(source))).blob();
            const stamped = await stampWatermark(raw);
            const file = new File([stamped], `${wrap.name.replace(/\s+/g, '_')}_teslastudio.png`, { type: 'image/png' });
            if (canNativeShare && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: wrap.name, text: shareText(wrap), url: wrapUrl(wrap) });
                return;
            }
            const href = URL.createObjectURL(stamped);
            const a = document.createElement('a');
            a.href = href;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(href);
        } catch (error) {
            if ((error as Error).name !== 'AbortError') console.error('Share image failed', error);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="wg-drow wg-share" aria-label={t.share}>
            <a className="wg-ghost" href={links.x} target="_blank" rel="noopener noreferrer">
                <span className="wg-x" aria-hidden="true">𝕏</span> {t.shareOnX}
            </a>
            <a className="wg-ghost" href={links.reddit} target="_blank" rel="noopener noreferrer">
                {t.shareOnReddit}
            </a>
            {canNativeShare && (
                <button type="button" className="wg-ghost" onClick={nativeShare}>
                    <Share2 size={15} /> {t.share}
                </button>
            )}
            <button type="button" className="wg-ghost" onClick={() => copy(wrapUrl(wrap), 'link')}>
                {copied === 'link' ? <Check size={15} /> : <Link2 size={15} />} {copied === 'link' ? t.linkCopied : t.copyLink}
            </button>
            <button type="button" className="wg-ghost" onClick={shareImage} disabled={busy}>
                <ImageIcon size={15} /> {t.shareImage}
            </button>
            <button type="button" className="wg-ghost" onClick={() => copy(embedSnippet(wrap), 'embed')}>
                {copied === 'embed' ? <Check size={15} /> : <Code2 size={15} />} {copied === 'embed' ? t.embedCopied : t.embed}
            </button>
        </div>
    );
}
