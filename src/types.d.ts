export { };

declare global {
    interface Window {
        puter?: {
            ai?: {
                txt2img: (prompt: string, options?: Record<string, unknown>) => Promise<HTMLImageElement>;
            };
        };
    }
}
