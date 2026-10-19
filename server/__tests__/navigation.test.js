import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialPath, initializeNavigation, navigate, navigateTo, switchLanguage } from '../../src/utils/navigation';
import { parseRoute } from '../../shared/seo.js';

// Node's own navigator follows the machine's locale; pin it so English stays the default here.
beforeEach(() => vi.stubGlobal('navigator', { language: 'en-US' }));
afterEach(() => vi.unstubAllGlobals());

describe('page navigation', () => {
    it('keeps direct links to AI creation, manual editing and gallery views distinct', () => {
        expect(parseRoute('/create').page).toBe('create');
        expect(parseRoute('/create/manual').page).toBe('edit');
        expect(parseRoute('/explore/3d/').page).toBe('explore3d');
        expect(parseRoute('/explore').page).toBe('explore');
    });

    it('opens preview for the root and unknown destinations', () => {
        expect(parseRoute('/')).toEqual({ page: 'preview', wrapId: null, model: null, lang: 'en' });
        expect(parseRoute('/missing')).toEqual({ page: 'preview', wrapId: null, model: null, lang: 'en' });
        expect(parseRoute('/wrap/not-an-id/slug')).toEqual({ page: 'preview', wrapId: null, model: null, lang: 'en' });
        expect(parseRoute('/wraps/not-a-car')).toEqual({ page: 'preview', wrapId: null, model: null, lang: 'en' });
    });

    it('opens the gallery filtered to one car from its collection URL', () => {
        expect(parseRoute('/wraps/model-3-2024-base')).toEqual({ page: 'explore', wrapId: null, model: 'Model 3 (2024 Base)', lang: 'en' });
        expect(parseRoute('/wraps/cybertruck/')).toEqual({ page: 'explore', wrapId: null, model: 'Cybertruck', lang: 'en' });
    });

    it('opens the same pages in Chinese under /zh', () => {
        expect(parseRoute('/zh')).toEqual({ page: 'preview', wrapId: null, model: null, lang: 'zh' });
        expect(parseRoute('/zh/explore/3d/')).toEqual({ page: 'explore3d', wrapId: null, model: null, lang: 'zh' });
        expect(parseRoute('/zh/wraps/model-y')).toEqual({ page: 'explore', wrapId: null, model: 'Model Y', lang: 'zh' });
        expect(parseRoute('/zh/wrap/507f1f77bcf86cd799439011/red')).toEqual({ page: 'explore', wrapId: '507f1f77bcf86cd799439011', model: null, lang: 'zh' });
    });

    it('opens a wrap inside the gallery from its own URL, with or without the slug', () => {
        expect(parseRoute('/wrap/507f1f77bcf86cd799439011/red-bull-livery')).toEqual({ page: 'explore', wrapId: '507f1f77bcf86cd799439011', model: null, lang: 'en' });
        expect(parseRoute('/wrap/507f1f77bcf86cd799439011')).toEqual({ page: 'explore', wrapId: '507f1f77bcf86cd799439011', model: null, lang: 'en' });
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

    it('sends a Chinese-speaking browser to the /zh copy on load unless it chose English, and keeps /zh links as they are', () => {
        const load = (pathname, { language = 'zh-CN', saved = null } = {}) => {
            const replaceState = vi.fn();
            vi.stubGlobal('navigator', { language });
            vi.stubGlobal('localStorage', { getItem: () => saved });
            vi.stubGlobal('window', { location: { pathname, search: '', hash: '' }, history: { state: null, replaceState } });
            vi.stubGlobal('document', { addEventListener: vi.fn() });
            initializeNavigation();
            return replaceState.mock.calls[0][2];
        };
        expect(load('/explore')).toBe('/zh/explore');
        expect(load('/')).toBe('/zh');
        expect(load('/explore', { saved: 'en' })).toBe('/explore');
        expect(load('/zh/wraps/model-y', { language: 'en-US' })).toBe('/zh/wraps/model-y');
        expect(load('/zh/missing', { language: 'en-US' })).toBe('/zh');
    });

    it('stays in Chinese while navigating and switches language on the same page', () => {
        const pushState = vi.fn();
        const setItem = vi.fn();
        const location = { pathname: '/zh/explore', search: '?q=1' };
        vi.stubGlobal('localStorage', { setItem });
        vi.stubGlobal('window', { location, history: { pushState }, dispatchEvent: vi.fn() });
        navigate('create');
        expect(pushState).toHaveBeenLastCalledWith(null, '', '/zh/create');
        navigateTo('/zh/wraps/model-y');
        expect(pushState).toHaveBeenLastCalledWith(null, '', '/zh/wraps/model-y');
        switchLanguage('en');
        expect(pushState).toHaveBeenLastCalledWith(null, '', '/explore?q=1');
        expect(setItem).toHaveBeenCalledWith('lang', 'en');
        location.pathname = '/';
        location.search = '';
        switchLanguage('zh');
        expect(pushState).toHaveBeenLastCalledWith(null, '', '/zh');
    });
});
