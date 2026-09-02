interface GoogleIdentity {
    initialize: (options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode: 'popup';
        auto_select: boolean;
    }) => void;
    renderButton: (container: HTMLElement, options: {
        type: 'standard';
        theme: 'outline';
        size: 'large';
        text: 'continue_with';
        shape: 'rectangular';
        width: number;
    }) => void;
    disableAutoSelect: () => void;
}

declare global {
    interface Window {
        google?: { accounts: { id: GoogleIdentity } };
    }
}

export const getGoogleIdentity = () => window.google?.accounts.id;
let loading: Promise<GoogleIdentity> | undefined;

/** One shared script across modal openings and React's development effect remounts. */
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
    const identity = getGoogleIdentity();
    if (identity) return Promise.resolve(identity);
    if (loading) return loading;

    loading = new Promise<GoogleIdentity>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        const fail = () => {
            window.clearTimeout(timeout);
            script.remove();
            reject(new Error('Google sign-in could not load. Please try again or use email.'));
        };
        const timeout = window.setTimeout(fail, 12000);
        script.onerror = fail;
        script.onload = () => {
            const loaded = getGoogleIdentity();
            if (!loaded) { fail(); return; }
            window.clearTimeout(timeout);
            resolve(loaded);
        };
        document.head.appendChild(script);
    }).catch((error: unknown) => {
        loading = undefined;
        throw error;
    });
    return loading;
}
