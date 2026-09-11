import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialPath, initializeNavigation, navigate, navigateTo } from '../../src/utils/navigation';
import { parseRoute } from '../../shared/seo.js';

afterEach(() => vi.unstubAllGlobals());

describe('page navigation', () => {
    it('keeps direct links to AI creation, manual editing and gallery views distinct', () => {
        expect(parseRoute('/create').page).toBe('create');
        expect(parseRoute('/create/manual').page).toBe('edit');
        expect(parseRoute('/explore/3d/').page).toBe('explore3d');
        expect(parseRoute('/explore').page).toBe('explore');
    });

    it('opens preview for the root and unknown destinations', () => {
        expect(parseRoute('/')).toEqual({ page: 'preview', wrapId: null, model: null });
        expect(parseRoute('/missing')).toEqual({ page: 'preview', wrapId: null, model: null });
        expect(parseRoute('/wrap/not-an-id/slug')).toEqual({ page: 'preview', wrapId: null, model: null });
        expect(parseRoute('/wraps/not-a-car')).toEqual({ page: 'preview', wrapId: null, model: null });
    });

    it('opens the gallery filtered to one car from its collection URL', () => {
        expect(parseRoute('/wraps/model-3-2024-base')).toEqual({ page: 'explore', wrapId: null, model: 'Model 3 (2024 Base)' });
        expect(parseRoute('/wraps/cybertruck/')).toEqual({ page: 'explore', wrapId: null, model: 'Cybertruck' });
    });

    it('opens a wrap inside the gallery from its own URL, with or without the slug', () => {
        expect(parseRoute('/wrap/507f1f77bcf86cd799439011/red-bull-livery')).toEqual({ page: 'explore', wrapId: '507f1f77bcf86cd799439011', model: null });
        expect(parseRoute('/wrap/507f1f77bcf86cd799439011')).toEqual({ page: 'explore', wrapId: '507f1f77bcf86cd799439011', model: null });
    });

    it('returns checkout customers to AI creation and folds old hash links into paths', () => {
        expect(initialPath('/explore', '?checkout=success&orderId=123', '')).toBe('/create');
        expect(initialPath('/', '', '#/explore/3d')).toBe('/explore/3d');
        expect(initialPath('/garage', '?reset=reset-token', '')).toBe('/garage');
    });

    it('canonicalizes the initial route without losing payment or reset parameters or adding history', () => {
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { pathname: '/', search: '?checkout=success&orderId=123&reset=test', hash: '#/home' },
            history: { state: { existing: true }, replaceState },
        });
        vi.stubGlobal('document', { addEventListener: vi.fn() });
        initializeNavigation();
        expect(replaceState).toHaveBeenCalledWith(
            { existing: true }, '', '/create?checkout=success&orderId=123&reset=test',
        );
    });

    it('keeps a wrap URL as it is on load', () => {
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { pathname: '/wrap/507f1f77bcf86cd799439011/red', search: '', hash: '' },
            history: { state: null, replaceState },
        });
        vi.stubGlobal('document', { addEventListener: vi.fn() });
        initializeNavigation();
        expect(replaceState).toHaveBeenCalledWith(null, '', '/wrap/507f1f77bcf86cd799439011/red');
    });

    it('keeps a collection URL as it is on load', () => {
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { pathname: '/wraps/model-y', search: '', hash: '' },
            history: { state: null, replaceState },
        });
        vi.stubGlobal('document', { addEventListener: vi.fn() });
        initializeNavigation();
        expect(replaceState).toHaveBeenCalledWith(null, '', '/wraps/model-y');
    });

    it('pushes history for a new page and does not add duplicate entries for the current one', () => {
        const pushState = vi.fn();
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', {
            location: { pathname: '/', search: '' },
            history: { pushState },
            dispatchEvent,
        });
        navigate('preview');
        expect(pushState).not.toHaveBeenCalled();
        navigate('explore');
        expect(pushState).toHaveBeenCalledWith(null, '', '/explore');
        navigateTo('/wrap/507f1f77bcf86cd799439011/red');
        expect(pushState).toHaveBeenLastCalledWith(null, '', '/wrap/507f1f77bcf86cd799439011/red');
        expect(dispatchEvent).toHaveBeenCalledTimes(2);
    });
});
