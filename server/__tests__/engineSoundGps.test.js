import { beforeAll, describe, expect, it } from 'vitest';

// gps.js is a plain browser script for the engine-sound page; it publishes GpsSpeed on globalThis.
let GpsSpeed;
beforeAll(async () => {
    await import('../../public/apps/engine-sound/gps.js');
    ({ GpsSpeed } = globalThis);
});

const M_PER_DEG_LAT = 111195;   // haversine's metres per degree of latitude
const fix = (metresNorth, extra = {}) => ({ latitude: 1.3 + metresNorth / M_PER_DEG_LAT, longitude: 103.8, accuracy: 20, speed: null, ...extra });

describe('engine sound GPS speed', () => {
    it('uses the speed the device reports', () => {
        expect(new GpsSpeed().update(fix(0, { speed: 12 }), 0)).toBe(12);
    });

    it('derives speed from positions when coords.speed is null or -1, even under the accuracy radius per fix', () => {
        const gps = new GpsSpeed();
        let speed;
        // 14 m/s (~50 km/h) at 1 Hz: each step is under the 20 m accuracy, so a fix pair alone reads 0.
        for (let t = 0; t <= 4; t++) speed = gps.update(fix(14 * t, { speed: t % 2 ? -1 : null }), t);
        expect(speed).toBeCloseTo(14, 0);
    });

    it('reads a parked car drifting inside the accuracy circle as stopped', () => {
        const gps = new GpsSpeed();
        let speed;
        for (let t = 0; t <= 10; t++) speed = gps.update(fix(t % 2 ? 8 : -8), t);
        expect(speed).toBe(0);
    });
});
