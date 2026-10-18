// vehicle.js — virtual drivetrain. Turns road speed (GPS, or test-drive pedals through a small
// physics model) into what the car would be doing: gear, rpm, load, overrun, ignition cut.

const clamp01 = x => Math.max(0, Math.min(1, x));

class Vehicle {
  constructor(car) {
    this.e = car.engine; this.v = car.vehicle;
    this.speed = 0;      // m/s
    this.thr = 0;        // estimated accelerator, 0..1
    this.gear = 0; this.inGear = false; this.shift = null;
    this.rpm = this.e.idle || 0; this.cutT = 0; this.heat = 0;
  }

  // input: { source: 'gps' | 'test', speed, accel (gps, m/s and m/s²), gas, brake (test, 0..1),
  //          rev (0..1, free-rev pedal at a standstill), intensity (0..1, how eager the driver is) }
  step(dt, inp) {
    let accel, thr;
    if (inp.source === 'test') {
      const s = this.speed, v = this.v;
      accel = inp.gas * v.accel0 * Math.max(0, 1 - (s / v.vmax) ** 2) - inp.brake * 8 - (s > 0 ? 0.3 + 0.0004 * s * s : 0);
      this.speed = Math.max(0, s + accel * dt);
      thr = inp.gas;
    } else {
      accel = inp.accel; this.speed = inp.speed;
      // How hard would the driver press to get this acceleration? Holding speed is light throttle.
      thr = clamp01(accel / (this.v.accel0 * (1.1 - 0.9 * inp.intensity)));
      if (this.speed > 2 && thr < 0.15 && accel > -0.3) thr = 0.15;
    }
    this.thr += (thr - this.thr) * Math.min(1, dt * 8);
    const kmh = this.speed * 3.6;
    const out = this.v.type === 'ev' ? this.electric(kmh, accel) : this.combustion(dt, kmh, inp.rev);
    return { ...out, speed: kmh, rev: inp.rev };
  }

  electric(kmh, accel) {
    // One fixed gear straight to the wheels; regen instead of overrun.
    return { rpm: kmh * this.v.rpmPerKmh, load: this.thr, overrun: clamp01(-accel / 3), cut: 0, heat: 0, gear: 'D', click: 0 };
  }

  combustion(dt, kmh, rev) {
    const e = this.e, v = this.v, n = v.gears.length, manual = v.type === 'manual';
    const rpmIn = g => kmh / v.gears[g] * 1000;
    let click = 0, load = this.thr, target, k = 12;

    if (kmh < 1) {
      // Standstill: neutral (manual), free revving on the REV pedal.
      if (manual && this.inGear) { this.inGear = false; click = 0.6; }
      this.gear = 0; this.shift = null;
      load = Math.max(rev, this.thr);
      target = load > 0.05 ? e.idle + load * (e.redline * 1.05 - e.idle) : e.idle;
      k = target > this.rpm ? 5 : 2;        // quick to spin up, slower to fall
    } else {
      if (manual && !this.inGear) { this.inGear = true; this.gear = 0; click = 1; }
      if (!this.shift) this.shift = this.pickGear(kmh, rpmIn, n);
      const slip = this.gear === 0 ? e.idle + this.thr * 0.35 * (e.redline - e.idle) : e.idle; // clutch slip pulling away
      target = Math.max(rpmIn(this.gear), slip);

      const sh = this.shift;
      if (sh) {
        sh.t += dt;
        if (manual) {
          // Lift off, clutch down (revs fall away), lever in (blip on the way down), clutch out.
          load = sh.up ? 0 : 0.5;
          target = sh.up ? e.idle : rpmIn(sh.to) * 1.05;
          k = sh.up ? 2.5 : 8;
          if (!sh.clicked && sh.t > v.shiftTime * 0.6) { sh.clicked = true; click = 1; }
          if (sh.t >= v.shiftTime) { this.gear = sh.to; this.shift = null; }
        } else {
          // Auto / dual clutch: the gear goes straight in; a full-throttle upshift cuts the ignition.
          this.gear = sh.to;
          if (sh.up && this.thr > 0.6 && sh.t < v.shiftTime) this.cutT = Math.max(this.cutT, dt);
          target = Math.max(rpmIn(this.gear), e.idle);
          k = v.type === 'dct' ? 25 : 6;    // a torque converter slurs the change
          if (sh.t >= v.shiftTime) this.shift = null;
        }
      }
    }

    this.rpm += (target - this.rpm) * Math.min(1, dt * k);
    // Rev limiter: the ignition cuts and the revs bounce off it.
    if (this.rpm >= e.redline) { this.rpm = e.redline - 250; this.cutT = 0.05; }
    const cut = this.cutT > 0 ? 1 : 0;
    this.cutT = Math.max(0, this.cutT - dt);

    const shifting = manual && this.shift;
    const overrun = !cut && !shifting && this.thr < 0.05 && this.rpm > e.idle * 1.5 ? 1 : 0;
    // Afterfire needs a hot exhaust: builds with hard driving, cools within a few seconds.
    this.heat = clamp01(this.heat + dt * (load > 0.5 && this.rpm > 0.5 * e.redline ? 0.6 : -0.25));

    return {
      rpm: this.rpm, load: cut ? 0 : load, overrun, cut, heat: this.heat, click,
      gear: manual && !this.inGear ? 'N' : this.gear + 1,
    };
  }

  pickGear(kmh, rpmIn, n) {
    const v = this.v, g = this.gear;
    const up = v.shiftGentle + (v.shiftFull - v.shiftGentle) * this.thr;
    let to = g;
    // Lifting off holds the gear (keeps the revs up for the overrun crackle); braking skips
    // straight down to the gear that suits the speed.
    if (g < n - 1 && this.thr > 0.05 && rpmIn(g) > up) to = g + 1;
    else if (g > 0 && rpmIn(g) < v.downRpm) while (to > 0 && rpmIn(to) < v.downRpm) to--;
    else if (this.thr > 0.9) while (to > 0 && rpmIn(to - 1) < 0.7 * this.e.redline) to--; // kickdown
    return to === g ? null : { to, up: to > g, t: 0, clicked: false };
  }
}

if (typeof module !== 'undefined') module.exports = { Vehicle };
