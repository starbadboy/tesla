/** A password-reset link lands on the app root as ?reset=<token>; read once at load. */
export const RESET_TOKEN: string | null = new URLSearchParams(window.location.search).get('reset');
