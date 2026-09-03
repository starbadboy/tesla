import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialPage, initializeNavigation, navigate, pageFromHash } from '../../src/utils/navigation';

afterEach(() => vi.unstubAllGlobals());

describe('page navigation', () => {
    it('keeps direct links to AI creation, manual editing and gallery views distinct', () => {
        expect(pageFromHash('#/create')).toBe('create');
        expect(pageFromHash('#/create/manual')).toBe('edit');
        expect(pageFromHash('#/explore/3d/')).toBe('explore3d');
        expect(pageFromHash('#/explore')).toBe('explore');
    });

    it('opens preview for old root links and unknown destinations', () => {
        expect(initialPage('', '')).toBe('preview');
        expect(initialPage('#/missing', '?campaign=launch')).toBe('preview');
    });

    it('returns checkout customers to AI creation regardless of their previous page', () => {
        expect(initialPage('#/explore', '?checkout=success&orderId=123')).toBe('create');
        expect(initialPage('#/home', '?checkout=cancel')).toBe('create');
        expect(initialPage('#/garage', '?reset=reset-token')).toBe('garage');
    });

    it('canonicalizes the initial route without losing payment or reset parameters or adding history', () => {
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { pathname: '/', search: '?checkout=success&orderId=123&reset=test', hash: '#/home' },
            history: { state: { existing: true }, replaceState },
        });
        initializeNavigation();
        expect(replaceState).toHaveBeenCalledWith(
            { existing: true }, '', '/?checkout=success&orderId=123&reset=test#/create',
        );
    });

    it('uses native hash navigation and does not add duplicate entries for the current page', () => {
        let hash = '#/preview';
        const location = { get hash() { return hash; }, set hash(value) { hash = value; } };
        const setHash = vi.spyOn(location, 'hash', 'set');
        vi.stubGlobal('window', { location });
        navigate('preview');
        expect(setHash).not.toHaveBeenCalled();
        navigate('explore');
        expect(setHash).toHaveBeenCalledWith('#/explore');
    });
});
