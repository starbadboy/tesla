import { useEffect, useEffectEvent, useRef, useState } from 'react';
import axios from 'axios';
import { Loader } from 'lucide-react';
import { loadGoogleIdentity } from '../../utils/googleIdentity';

interface GoogleSignInProps {
    disabled: boolean;
    loading: boolean;
    onCredential: (credential: string) => Promise<void>;
}

export function GoogleSignIn({ disabled, loading, onCredential }: GoogleSignInProps) {
    const container = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'hidden' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);
    const receiveCredential = useEffectEvent((credential: string) => {
        if (!disabled) void onCredential(credential);
    });

    useEffect(() => {
        let cancelled = false;
        let observer: ResizeObserver | undefined;
        const target = container.current;
        const controller = new AbortController();

        async function setup() {
            try {
                const { data } = await axios.get<{ clientId: string | null }>('/api/auth/google/config', {
                    signal: controller.signal,
                    timeout: 10000,
                });
                if (cancelled) return;
                if (!data.clientId) { setStatus('hidden'); return; }

                const google = await loadGoogleIdentity();
                if (cancelled || !target) return;
                google.initialize({
                    client_id: data.clientId,
                    ux_mode: 'popup',
                    auto_select: false,
                    callback: ({ credential }) => {
                        // A popup opened before the dialog was dismissed cannot sign in later.
                        if (!cancelled) receiveCredential(credential);
                    },
                });
                let previousWidth = 0;
                const render = () => {
                    const width = Math.min(400, Math.floor(target.getBoundingClientRect().width));
                    if (cancelled || width <= 0 || width === previousWidth) return;
                    previousWidth = width;
                    google.renderButton(target, {
                        type: 'standard',
                        theme: 'outline',
                        size: 'large',
                        text: 'continue_with',
                        shape: 'rectangular',
                        width,
                    });
                };
                render();
                observer = new ResizeObserver(render);
                observer.observe(target);
                setStatus('ready');
            } catch {
                if (!cancelled) setStatus('error');
            }
        }
        void setup();
        return () => {
            cancelled = true;
            controller.abort();
            observer?.disconnect();
            target?.replaceChildren();
        };
    }, [attempt]);

    if (status === 'hidden') return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-zinc-500">
                <span className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
                <span>or</span>
                <span className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
            </div>
            {status === 'loading' && (
                <div role="status" className="flex h-10 items-center justify-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                    <Loader size={16} className="animate-spin" /> Loading Google sign-in…
                </div>
            )}
            <div ref={container} inert={disabled} className={`flex w-full min-w-0 justify-center ${disabled ? 'opacity-50' : ''}`} />
            {loading && <p role="status" className="text-center text-sm text-gray-500 dark:text-zinc-400">Signing in with Google…</p>}
            {status === 'error' && (
                <div role="status" className="text-center text-xs text-gray-500 dark:text-zinc-400">
                    Google sign-in could not load. Use email or{' '}
                    <button type="button" disabled={disabled} className="underline hover:text-black dark:hover:text-white" onClick={() => {
                        setStatus('loading');
                        setAttempt(value => value + 1);
                    }}>try again</button>.
                </div>
            )}
        </div>
    );
}
