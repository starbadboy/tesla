// gps.js — road speed from geolocation fixes. Uses coords.speed when the device reports it; many
// don't (null in the Tesla browser and desktop Chrome, -1 on iOS), so it falls back to distance
// over time across the last few seconds of fixes.

const GPS_WINDOW = 8;   // seconds of fixes kept for the distance fallback

function haversine(a, b) {
  const r = Math.PI / 180, dLat = (b.latitude - a.latitude) * r, dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

class GpsSpeed {
  constructor() { this.speed = 0; this.accel = 0; this.fixes = []; }

  // coords: GeolocationCoordinates (or the same fields); t: fix time in seconds. Returns m/s.
  update(coords, t) {
    const prev = this.fixes[this.fixes.length - 1];
    this.fixes = [...this.fixes.filter(f => t - f.t <= GPS_WINDOW), { coords, t }];
    const speed = Number.isFinite(coords.speed) && coords.speed >= 0 ? coords.speed : this.derive(coords, t);
    if (prev) this.accel = (speed - this.speed) / Math.max(0.2, t - prev.t);
    this.speed = speed;
    return speed;
  }

  derive(coords, t) {
    // Jitter inside the accuracy circle is not movement: a parked phone indoors drifts tens of
    // metres. So measure from the newest earlier fix that is clearly further away than that —
    // at 1 Hz a car moves less than the accuracy between two fixes, so a pair alone reads 0.
    const noise = coords.accuracy || 0;
    for (let i = this.fixes.length - 2; i >= 0; i--) {
      const f = this.fixes[i], d = haversine(f.coords, coords);
      if (d > noise) return d / Math.max(0.2, t - f.t);
    }
    // Nothing cleared the noise yet: the car can't be faster than noise / span. Decay towards 0.
    const span = t - this.fixes[0].t;
    const bound = span > 0 ? Math.min(this.speed, noise / span) : 0;
    return bound < 0.5 ? 0 : bound;
  }
}

globalThis.GpsSpeed = GpsSpeed;
