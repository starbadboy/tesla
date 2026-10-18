// dsp.js — procedural sound synthesizers, run per sample inside an AudioWorklet.
// Everything lives in one self-contained function so the page can ship its source
// to the worklet as a data: URL (works from file:// too) and Node can run it for check.js.
function dspModule(scope) {
  const TAU = Math.PI * 2;

  // xorshift32: cheap, allocation-free noise.
  let seed = 0x9e3779b9;
  const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const noise = () => rand() * 2 - 1;
  const clamp01 = x => Math.max(0, Math.min(1, x));

  // RBJ biquad. Coefficients are set at block rate, not per sample.
  class Biquad {
    constructor(sr, type, f, q) { this.sr = sr; this.type = type; this.z1 = 0; this.z2 = 0; this.set(f, q); }
    set(f, q) {
      const w = TAU * Math.min(Math.max(f, 10), this.sr * 0.45) / this.sr, c = Math.cos(w), a = Math.sin(w) / (2 * q);
      let b0, b1, b2;
      if (this.type === 'lp') { b1 = 1 - c; b0 = b2 = b1 / 2; }
      else if (this.type === 'hp') { b1 = -(1 + c); b0 = b2 = (1 + c) / 2; }
      else { b0 = a; b1 = 0; b2 = -a; } // bandpass, 0 dB peak
      const a0 = 1 + a;
      this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - a) / a0;
    }
    run(x) {
      const y = this.b0 * x + this.z1;
      this.z1 = this.b1 * x - this.a1 * y + this.z2;
      this.z2 = this.b2 * x - this.a2 * y;
      return y;
    }
  }

  // Parameters the page sends ~50 times a second; each is glided per sample.
  class Params {
    constructor(init) { this.cur = { ...init }; this.target = { ...init }; }
    set(m) { for (const k in m) if (k in this.target) this.target[k] = m[k]; }
    glide(k) { for (const n in this.cur) this.cur[n] += (this.target[n] - this.cur[n]) * k; return this.cur; }
  }
  const BASE = { rpm: 800, load: 0, overrun: 0, cut: 0, heat: 0, speed: 0, rev: 0, character: 0.5, crackle: 0.5 };

  // A short decaying click (gear lever going in): high-passed noise plus a metallic ring.
  class Click {
    constructor(sr) { this.sr = sr; this.env = 0; this.t = 0; this.hp = new Biquad(sr, 'hp', 4000, 0.7); this.k = Math.exp(-1 / (0.006 * sr)); }
    trigger(s) { this.env = s; this.t = 0; }
    run() {
      if (this.env < 1e-4) return 0;
      this.env *= this.k; this.t += 1 / this.sr;
      return this.env * (0.25 * this.hp.run(noise()) + 0.08 * Math.sin(TAU * 5300 * this.t));
    }
  }

  // ---------- Combustion engine ----------

  // One cylinder bank: pool of exhaust pulses → pipe (round-trip delay, lossy inverting
  // reflection at the open end) → exhaust formants.
  const POOL = 16;
  class Bank {
    constructor(sr, s, pipeLen) {
      this.sr = sr; this.s = s;
      this.t = new Float32Array(POOL); this.amp = new Float32Array(POOL); this.w = new Float32Array(POOL); this.next = 0;
      this.buf = new Float32Array(Math.max(2, Math.round(sr * 2 * pipeLen / 343)));
      this.pos = 0; this.lp = 0;
      this.formants = s.formants.map(([f, q]) => new Biquad(sr, 'bp', f, q));
    }
    fire(amp, widthS) {
      const i = this.next; this.next = (i + 1) % POOL;
      this.t[i] = 0; this.amp[i] = amp; this.w[i] = widthS;
    }
    run() {
      let e = 0;
      for (let i = 0; i < POOL; i++) {
        if (this.amp[i] === 0) continue;
        const x = this.t[i] / this.w[i];
        // Smooth pressure pulse peaking at x=1, plus a burst of combustion noise.
        e += this.amp[i] * (x * Math.exp(1 - x) + 0.4 * noise() * Math.exp(-0.6 * x));
        this.t[i] += 1 / this.sr;
        if (x > 10) this.amp[i] = 0;
      }
      const back = this.buf[this.pos];
      this.lp += (back - this.lp) * this.s.pipeDamp;
      const y = e - this.s.pipeFeedback * this.lp;
      this.buf[this.pos] = y; this.pos = (this.pos + 1) % this.buf.length;
      let out = y * 0.5;
      for (let i = 0; i < this.formants.length; i++) out += this.formants[i].run(y) * this.s.formants[i][2];
      return out;
    }
  }

  class EngineDSP {
    constructor(sr, e) {
      this.sr = sr; this.e = e; this.s = e.sound;
      const nBanks = 1 + Math.max(...e.firing.map(f => f[1]));
      this.banks = Array.from({ length: nBanks }, (_, b) => new Bank(sr, this.s, this.s.pipeLen * (1 + 0.06 * b)));
      this.pan = nBanks > 1 ? [0.3, 0.7] : [0.5];
      this.p = new Params({ ...BASE, rpm: e.idle });
      this.phase = 0; this.whinePh = 0; this.n = 0;
      this.intake = new Biquad(sr, 'bp', 400, 1.2);
      this.mufL = new Biquad(sr, 'lp', 2000, 0.7); this.mufR = new Biquad(sr, 'lp', 2000, 0.7);
      this.click = new Click(sr);
      this.glide = 1 - Math.exp(-1 / (0.015 * sr));
    }
    message(m) { if (m.click) this.click.trigger(m.click); else this.p.set(m); }

    fireCylinder(bank, p) {
      const s = this.s, width = s.pulseDeg / (6 * p.rpm);
      if (p.cut > 0.5) {
        // Ignition cut: unburnt fuel reaches the hot exhaust and sometimes bangs.
        if (rand() < 0.15 * p.crackle * s.pops / 8) this.banks[bank].fire(2.5 * (0.6 + rand()), 0.0012);
        return;
      }
      let amp = (0.3 + 0.7 * p.load) * (1 + 0.08 * noise());
      if (p.overrun > 0.3) amp *= 0.5 + 0.7 * rand();              // closed-throttle burble
      if (rand() < s.lumpy * p.crackle * (1 - p.load) * clamp01(2 - p.rpm / this.e.idle)) amp *= 0.3; // lumpy-cam misfire
      this.banks[bank].fire(amp, width);
    }

    process(L, R, len) {
      const s = this.s, firing = this.e.firing, redline = this.e.redline;
      for (let i = 0; i < len; i++) {
        if (this.n++ % 128 === 0) this.block(this.p.cur);
        const p = this.p.glide(this.glide);

        // Crank: one 4-stroke cycle is 720°. Fire each cylinder as its angle passes.
        const prev = this.phase, next = prev + 6 * p.rpm / this.sr;
        for (let f = 0; f < firing.length; f++) {
          const a = firing[f][0];
          if ((a > prev && a <= next) || (a + 720 > prev && a + 720 <= next)) this.fireCylinder(firing[f][1], p);
        }
        this.phase = next % 720;

        // Afterfire: strongest just after lifting off from hard driving, while the exhaust is hot.
        if (rand() < s.pops * p.crackle * p.overrun * p.heat / this.sr) {
          this.banks[(rand() * this.banks.length) | 0].fire(2 + 2.5 * rand(), 0.0008 + 0.001 * rand());
        }

        let l = 0, r = 0;
        for (let b = 0; b < this.banks.length; b++) {
          const v = this.banks[b].run();
          l += v * (1 - this.pan[b]); r += v * this.pan[b];
        }
        const rpmFrac = p.rpm / redline;
        const roar = this.intake.run(noise()) * s.intake * p.load * rpmFrac;
        this.whinePh = (this.whinePh + p.rpm / 60 * (s.whine ? s.whine.ratio : 0) / this.sr) % 1;
        const whine = s.whine ? s.whine.gain * (0.25 + 0.75 * p.load) * rpmFrac * Math.sin(TAU * this.whinePh) : 0;
        const c = this.click.run();

        l = this.mufL.run(l) + roar + whine + c;
        r = this.mufR.run(r) + roar + whine + c;
        L[i] = s.gain * Math.tanh(s.drive * l) / s.drive;
        R[i] = s.gain * Math.tanh(s.drive * r) / s.drive;
      }
    }

    block(p) {
      const cut = this.s.muffler * (0.5 + p.character) * (0.7 + 0.6 * p.load);
      this.mufL.set(cut, 0.7); this.mufR.set(cut, 0.7);
      this.intake.set(300 + 3 * p.rpm / 60 * (this.e.firing.length / 2), 1.2);
    }
  }

  // ---------- Electric motor ----------

  class ElectricDSP {
    constructor(sr, e) {
      this.sr = sr; this.s = e.sound; this.n = 0;
      this.p = new Params({ ...BASE, rpm: 0 });
      this.ph = new Float64Array(this.s.orders.length); this.invPh = 0;
      this.lp = new Biquad(sr, 'lp', 3000, 0.7); this.hum = new Biquad(sr, 'lp', 120, 0.7);
      this.glide = 1 - Math.exp(-1 / (0.02 * sr));
    }
    message(m) { if (!m.click) this.p.set(m); }
    process(L, R, len) {
      const s = this.s;
      for (let i = 0; i < len; i++) {
        if (this.n++ % 128 === 0) this.lp.set(s.bright * (0.5 + this.p.cur.character), 0.7);
        const p = this.p.glide(this.glide);
        const turn = p.rpm / 60;
        // Motor orders (slot/pole harmonics) rise with motor speed; louder under power,
        // a little under regen, near silent coasting.
        const drive = (0.12 + 0.88 * Math.max(p.load, 0.5 * p.overrun)) * clamp01(turn / 4);
        let v = 0;
        for (let o = 0; o < s.orders.length; o++) {
          this.ph[o] = (this.ph[o] + turn * s.orders[o][0] / this.sr) % 1;
          v += s.orders[o][1] * Math.sin(TAU * this.ph[o]);
        }
        // Inverter switching tone, heard pulling away and fading out with speed.
        this.invPh = (this.invPh + s.inverter / this.sr) % 1;
        const inv = s.inverterGain * p.load * clamp01(1 - turn / 50) * Math.sin(TAU * this.invPh);
        const hum = 0.02 * this.hum.run(noise()); // never digital silence
        const out = s.gain * Math.tanh(this.lp.run(v * drive + inv) + hum);
        L[i] = out; R[i] = out;
      }
    }
  }

  // ---------- Simple Schroeder reverb (haunted car) ----------

  class Reverb {
    constructor(sr) {
      const sc = sr / 44100;
      this.combs = [1557, 1617, 1491, 1422].map(n => ({ b: new Float32Array(Math.round(n * sc)), i: 0, lp: 0 }));
      this.aps = [225, 556].map(n => ({ b: new Float32Array(Math.round(n * sc)), i: 0 }));
    }
    run(x) {
      let y = 0;
      for (const c of this.combs) {
        const o = c.b[c.i]; c.lp += (o - c.lp) * 0.3;
        c.b[c.i] = x + c.lp * 0.84; c.i = (c.i + 1) % c.b.length; y += o;
      }
      y *= 0.25;
      for (const a of this.aps) {
        const o = a.b[a.i]; const v = y + o * 0.5;
        a.b[a.i] = v; a.i = (a.i + 1) % a.b.length; y = o - v * 0.5;
      }
      return y;
    }
  }

  // ---------- Haunted car: no engine, only Halloween sounds ----------

  class HauntedDSP {
    constructor(sr, e) {
      this.sr = sr; this.s = e.sound; this.root = this.s.rootHz;
      this.p = new Params(BASE); this.glide = 1 - Math.exp(-1 / (0.05 * sr)); this.n = 0; this.t = 0;
      this.beatPh = 0; this.thump = [];               // heartbeat
      this.wind = new Biquad(sr, 'bp', 300, 6); this.windLfo = 0;
      // Choir: [pitch ratio, speed fraction (of 180 km/h) where the voice joins].
      this.voices = [[0.5, 0], [1, 0.08], [1.189, 0.25], [1.414, 0.4], [1.5, 0.6], [2, 0.8]].map(([r, at]) => ({ r, at, ph: rand(), g: 0 }));
      this.vowel = [[700, 8, 1], [1220, 10, 0.5], [2600, 12, 0.25]].map(([f, q, g]) => ({ f: new Biquad(sr, 'bp', f, q), g }));
      this.moan = { env: 0, f: 0, ph: 0, ff: new Biquad(sr, 'bp', 400, 4) };
      // Bell partials on the root: [ratio, gain, decay s] — hum, prime, tierce, quint, nominal, bright.
      this.bell = [[0.5, 0.6, 6], [1, 0.8, 4], [1.2, 0.5, 3], [1.5, 0.35, 2.5], [2, 0.5, 2], [2.66, 0.25, 1.2], [3.2, 0.2, 0.8]]
        .map(([r, g, d]) => ({ r, g, k: Math.exp(-1 / (d * sr)), env: 0, ph: 0 }));
      this.tolls = 0; this.tollT = 0;
      this.growlPh = 0; this.growlLp = new Biquad(sr, 'lp', 400, 2);
      this.scream = { env: 0, ph: 0, f: 900, ff: new Biquad(sr, 'bp', 2500, 3) };
      this.lastLoad = 0; this.verb = new Reverb(sr);
    }
    message(m) { if (m.bell) { this.tolls = 3; this.tollT = 0; } else if (!m.click) this.p.set(m); }

    process(L, R, len) {
      const dt = 1 / this.sr, root = this.root;
      for (let i = 0; i < len; i++) {
        const p = this.p.glide(this.glide);
        this.t += dt;
        const pace = clamp01(p.speed / 180), push = Math.max(p.load, p.rev);
        let out = 0;

        // Heartbeat: lub-dub, racing with the pedal.
        const bpm = 55 + 110 * push;
        const prevB = this.beatPh; this.beatPh = (this.beatPh + bpm / 60 * dt) % 1;
        if (prevB > this.beatPh) this.thump.push({ t: 0, a: 1 });
        if (prevB < 0.28 && this.beatPh >= 0.28) this.thump.push({ t: 0, a: 0.65 });
        for (let k = this.thump.length - 1; k >= 0; k--) {
          const th = this.thump[k]; th.t += dt;
          out += 0.5 * th.a * Math.exp(-th.t / 0.07) * Math.sin(TAU * (60 * th.t - 40 * th.t * th.t));
          if (th.t > 0.4) this.thump.splice(k, 1);
        }
        out *= 1 - 0.6 * pace; // the heart fades under the speed sounds

        // Cold wind, louder and whistling higher with speed.
        if (this.n % 128 === 0) {
          this.windLfo += 0.02;
          this.wind.set(250 + p.speed * 9 + 120 * Math.sin(this.windLfo), 5 + p.speed / 20);
          this.growlLp.set(250 + 400 * p.load, 2);
        }
        out += 1.2 * clamp01(p.speed / 120) * this.wind.run(noise());

        // Ghost choir: one chord, higher voices join as the car speeds up.
        let choir = 0;
        for (const v of this.voices) {
          v.g += ((pace >= v.at && p.speed > 3 ? 1 : 0) - v.g) * 0.00005;
          v.ph = (v.ph + root * v.r * (1 + 0.004 * Math.sin(TAU * 5 * this.t + v.r)) * dt) % 1;
          choir += v.g * (2 * v.ph - 1);
        }
        let sung = 0;
        for (const f of this.vowel) sung += f.f.run(choir) * f.g;
        out += 0.35 * sung;

        // Moan sliding down on lift-off.
        if (this.lastLoad > 0.4 && p.load < 0.1 && p.speed > 20) { this.moan.env = 1; this.moan.f = root * 3; }
        this.lastLoad = p.load;
        if (this.moan.env > 1e-3) {
          const m = this.moan; m.env *= Math.exp(-dt / 1.2); m.f *= Math.exp(-dt * 0.5);
          m.ph = (m.ph + m.f * dt) % 1;
          out += 0.3 * m.env * m.ff.run(Math.sin(TAU * m.ph) + 0.3 * Math.sin(TAU * 2 * m.ph));
        }

        // Distant church bell when the car comes to a stop.
        if (this.tolls > 0) {
          this.tollT -= dt;
          if (this.tollT <= 0) { for (const b of this.bell) b.env = b.g; this.tolls--; this.tollT = 2.4; }
        }
        for (const b of this.bell) {
          if (b.env < 1e-4) continue;
          b.env *= b.k; b.ph = (b.ph + root * 2 * b.r * dt) % 1;
          out += 0.2 * b.env * Math.sin(TAU * b.ph);
        }

        // Monster growl at full throttle.
        const growl = clamp01((p.load - 0.85) / 0.15);
        if (growl > 0) {
          this.growlPh = (this.growlPh + (55 + 15 * noise()) * dt) % 1;
          out += 0.5 * growl * Math.tanh(4 * this.growlLp.run(2 * this.growlPh - 1 + 0.5 * noise()));
        }

        // Scream on REV.
        const sc = this.scream;
        sc.env += ((p.rev > 0.5 ? 1 : 0) - sc.env) * (p.rev > 0.5 ? 0.0008 : 0.0002);
        if (sc.env > 1e-3) {
          sc.f += ((p.rev > 0.5 ? 1500 : 700) - sc.f) * 0.00005;
          sc.ph = (sc.ph + sc.f * (1 + 0.03 * Math.sin(TAU * 7 * this.t)) * dt) % 1;
          out += 0.25 * sc.env * (Math.sin(TAU * sc.ph) + 0.5 * sc.ff.run(2 * sc.ph - 1));
        }

        this.n++;
        const wet = this.verb.run(out);
        L[i] = R[i] = Math.tanh(this.s.gain * (out * 0.7 + wet * 0.6));
      }
    }
  }

  // ---------- Cold-gas thrusters: silent until a heavy foot fires the jets ----------

  class ThrusterDSP {
    constructor(sr, e) {
      this.sr = sr; this.s = e.sound; this.p = new Params(BASE); this.n = 0;
      this.glide = 1 - Math.exp(-1 / (0.03 * sr));
      this.level = 0; this.wasShut = true;
      this.roar = new Biquad(sr, 'bp', 800, 0.8); this.rumble = new Biquad(sr, 'lp', 90, 0.9);
      this.hiss = new Biquad(sr, 'bp', 2200, 1.5); this.cabin = new Biquad(sr, 'lp', 2000, 0.7);
      this.whump = 0; this.whumpT = 0; this.crack = new Biquad(sr, 'hp', 1500, 0.7);
    }
    message(m) { if (!m.click) this.p.set(m); }
    process(L, R, len) {
      const s = this.s, dt = 1 / this.sr;
      for (let i = 0; i < len; i++) {
        const p = this.p.glide(this.glide);
        const pedal = Math.max(p.load, p.rev);
        const target = Math.pow(clamp01((pedal - s.onset) / (1 - s.onset)), s.curve);
        // Valves open fast and shut a little slower.
        this.level += (target - this.level) * (target > this.level ? 0.004 : 0.0015);
        if (this.wasShut && this.level > 0.15) { this.whump = 1; this.whumpT = 0; }
        this.wasShut = this.level < 0.02;
        if (this.n++ % 128 === 0) {
          this.roar.set(s.roarHz * (1.3 - 0.5 * this.level), 0.8);
          this.cabin.set(1200 + 2500 * p.character, 0.7);
        }
        const nz = noise();
        let out = this.level * (this.roar.run(nz) * 1.4 + this.rumble.run(nz) * 2 + this.hiss.run(nz) * 0.3);
        this.whump *= Math.exp(-dt / 0.12); this.whumpT += dt;
        out += this.whump * 0.8 * Math.sin(TAU * 45 * this.whumpT);   // soft low whump as the valves open
        if (rand() < s.cracks * p.crackle * this.level * dt) out += 0.6 * this.crack.run(1); // valve cracks
        out += 0.004 * nz;  // a barely-there hiss with the valves shut
        L[i] = R[i] = s.gain * Math.tanh(this.cabin.run(out));
      }
    }
  }

  const create = (sr, engine) => new ({ electric: ElectricDSP, haunted: HauntedDSP, thruster: ThrusterDSP }[engine.type] || EngineDSP)(sr, engine);

  if (scope.registerProcessor) {
    scope.registerProcessor('engine', class extends scope.AudioWorkletProcessor {
      constructor(opts) {
        super();
        this.dsp = create(scope.sampleRate, opts.processorOptions.engine);
        this.port.onmessage = e => this.dsp.message(e.data);
      }
      process(_, [out]) { this.dsp.process(out[0], out[1] || out[0], out[0].length); return true; }
    });
  }
  return { create };
}
