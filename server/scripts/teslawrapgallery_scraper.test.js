import { describe, it, expect } from 'vitest';
import { extractOfficialSkins } from './teslawrapgallery_scraper.js';

describe('extractOfficialSkins', () => {
    it('reads the JSON-style skin map', () => {
        const src = 'OFFICIAL_SKINS = {"models-2021":["Stealth_Grey","Deep_Blue"],"modelx-2021":["X"]}';
        expect(extractOfficialSkins(src, 'models-2021')).toEqual(['Stealth_Grey', 'Deep_Blue']);
    });

    it('still reads the old single-quoted map with starter spread', () => {
        const src = "const SX_STARTER_SKINS = ['A']; 'modelx-2021': [...SX_STARTER_SKINS, 'B']";
        expect(extractOfficialSkins(src, 'modelx-2021')).toEqual(['A', 'B']);
    });
});
