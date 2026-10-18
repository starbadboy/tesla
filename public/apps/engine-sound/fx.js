// fx.js — the hero stage. Wheels turn with road speed, the road scrolls, the body shakes with the
// engine and squats under acceleration. A car with thrusters (art.nozzle) blasts a white-hot jet
// with shock diamonds and leaves billowing vapour behind; picking it makes it backflip on its jets.
// Vapour is drawn on one full-page canvas over everything, so REV can fill the whole screen.

const FLIP_S = 1.7;

const PIVOT = [200, 120];   // the flip turns round the middle of the car (svg units)
const PHOTO_ORIGIN = [0.5, 0.6];   // the same for a picture, as fractions; matches .car-photo's CSS transform-origin

// Where the backflip is at t seconds: lift (svg units), turn (degrees), squash, size, jet level.
// The car shrinks as it leaps (away from the viewer), so a car standing on its tail still fits.
function flipPose(t) {
  if (t < 0.3) { const q = t / 0.3; return { lift: 0, turn: 0, squash: 1 - 0.1 * Math.sin(Math.PI * q), size: 1, jet: 0.4 * q }; }
  if (t < 1.35) {
    const q = (t - 0.3) / 1.05, ease = q * q * (3 - 2 * q), arc = Math.sin(Math.PI * q);
    // sqrt: shrink early, before the car stands up on its tail (check.js keeps it on screen).
    return { lift: 40 * arc, turn: -360 * ease, squash: 1, size: 1 - 0.6 * Math.sqrt(arc), jet: q < 0.55 ? 1 : Math.max(0, 1 - (q - 0.55) * 3) };
  }
  const q = (t - 1.35) / (FLIP_S - 1.35);
  return { lift: 6 * Math.sin(Math.PI * q), turn: 0, squash: 1 - 0.06 * Math.sin(Math.PI * Math.min(1, q * 2)), size: 1, jet: 0 };
}
const REST = { lift: 0, turn: 0, squash: 1, size: 1, jet: 0 };

class Stage {
  constructor(host, road, canvas) {
    this.host = host; this.road = road; this.canvas = canvas; this.g = canvas.getContext('2d');
    this.puffs = []; this.angle = 0; this.roadX = 0; this.t = 0; this.jet = 0; this.flipT = null;
    // Soft puffs, drawn once and stamped for every particle: white vapour and brown dust.
    this.sprite = Stage.puffSprite([255, 255, 255]);
    this.dustSprite = Stage.puffSprite([170, 145, 110]);
    addEventListener('resize', () => this.resize()); this.resize();
  }

  static puffSprite([r, g, b]) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const s = c.getContext('2d'), grad = s.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`); grad.addColorStop(0.45, `rgba(${r},${g},${b},.55)`); grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    s.fillStyle = grad; s.fillRect(0, 0, 128, 128);
    return c;
  }

  resize() {
    const dpr = devicePixelRatio || 1;
    this.canvas.width = innerWidth * dpr; this.canvas.height = innerHeight * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Shows the car's picture when it has one, else its drawing (also when the picture fails to load).
  setCar(car, uid) {
    this.car = car; this.art = car.art; this.flipT = null; this.photo = null; this.spins = [];
    const ready = () => { if (this.car === car && car.art.nozzle) { this.flipT = 0; this.burst(15); } };
    const drawing = () => {
      this.photo = null;
      this.host.innerHTML = carSvg(car.art, uid);
      this.whole = this.host.querySelector('.whole');
      this.body = this.host.querySelector('.body');
      this.spins = [...this.host.querySelectorAll('.spin')];
      ready();
    };
    if (!car.photo) { drawing(); return; }
    this.host.innerHTML = `<img class="car-photo" src="${car.photo}" alt="">`;
    this.photo = this.host.firstChild;
    this.photo.onload = ready;   // the flip needs the picture's size
    this.photo.onerror = () => this.car === car && drawing();
  }

  // Is the flip firing the jets right now (for the boost sound)?
  flipping() { return this.flipT !== null && flipPose(this.flipT).jet > 0.2; }

  // state: { speed km/h, rpm, load, rev, running }
  frame(dt, state) {
    this.t += dt;
    const art = this.art, mps = state.speed / 3.6;

    // Wheels: 1 svg unit ≈ 1.2 cm, so a wheel of radius r turns mps / (r * 0.012) rad/s.
    this.angle = (this.angle + mps / (art.wheels.r * 0.012) * dt * 180 / Math.PI) % 360;
    for (const s of this.spins) s.setAttribute('transform', `rotate(${this.angle.toFixed(1)} ${s.dataset.cx} ${s.dataset.cy})`);
    this.roadX = (this.roadX + mps * dt * 40) % 120;
    this.road.style.backgroundPositionX = `${-this.roadX}px`;

    // Engine shake and squat under load, only with the engine running.
    const shake = state.running && state.rpm ? Math.sin(this.t * state.rpm / 60 * Math.PI) * (0.25 + 0.5 * state.load) : 0;
    const squat = -1.2 * state.load * (state.speed > 1);

    let pose = REST;
    if (this.flipT !== null) {
      const before = this.flipT; this.flipT += dt; pose = flipPose(this.flipT);
      if (before < 1.35 && this.flipT >= 1.35) this.dust();
      if (this.flipT >= FLIP_S) this.flipT = null;
    }
    if (this.photo) {
      // A picture moves as one piece round its CSS transform-origin (PHOTO_ORIGIN).
      const k = this.host.clientWidth / 400;
      this.photo.style.transform = `translate(0px, ${((shake - pose.lift) * k).toFixed(1)}px) rotate(${(pose.turn + squat).toFixed(2)}deg) scale(${pose.size}, ${(pose.size * pose.squash).toFixed(3)})`;
    } else {
      const [px, py] = PIVOT;
      this.body.setAttribute('transform', `rotate(${squat.toFixed(2)} 60 140) translate(0 ${shake.toFixed(2)})`);
      this.whole.setAttribute('transform', `translate(${px} ${py - pose.lift}) rotate(${pose.turn}) scale(${pose.size}) translate(${-px} ${-py}) translate(0 140) scale(1 ${pose.squash}) translate(0 -140)`);
    }

    if (art.nozzle) this.jets(dt, state, pose);
    this.draw(dt, mps);
  }

  jets(dt, state, pose) {
    const s = this.car.engine.sound;
    const pedal = Math.max(state.running ? state.load : 0, state.running ? state.rev : 0);
    const target = Math.max(pose.jet, Math.pow(Math.max(0, (pedal - s.onset) / (1 - s.onset)), s.curve));
    const wasShut = this.jet < 0.05;
    this.jet += (target - this.jet) * Math.min(1, dt * (target > this.jet ? 14 : 5)); // open fast, shut slower
    if (wasShut && this.jet > 0.15) this.burst(15);
    if (this.jet < 0.02) return;

    const { o, dir, k } = this.nozzle(pose);
    const len = (40 + 170 * this.jet) * k * (0.92 + 0.16 * Math.random());
    this.plume = { o, dir, len, w: (5 + 7 * this.jet) * k, lv: this.jet };
    // Vapour: a little along the jet, most where it ends and blooms into a cloud.
    for (let n = 40 * this.jet * dt; n > 0; n--) {
      if (Math.random() > n) break;
      const along = Math.random() < 0.75 ? 0.8 + 0.4 * Math.random() : Math.random();
      this.puff(o.x + dir.x * len * along, o.y + dir.y * len * along, dir.x * 120 * this.jet * k, dir.y * 120 * this.jet * k - 10 * k, (6 + 16 * this.jet) * k);
    }
    // REV held: gas rolls in over the whole screen.
    if (state.rev && Math.random() < dt * 30) this.puff(Math.random() * innerWidth, innerHeight * (0.3 + 0.7 * Math.random()), -60, -10, 120 + 120 * Math.random(), 3.5);
  }

  // Nozzle position (page px), jet direction and svg→px scale, following the flip.
  nozzle(pose) {
    const rect = this.host.getBoundingClientRect(), k = rect.width / 400;
    if (this.photo) {
      // Picture: nozzle as a fraction of the untransformed picture box, moved like the CSS transform.
      const b = this.photoBox(rect), [fx, fy] = this.car.photoNozzle;
      const ox = b.x + b.w * PHOTO_ORIGIN[0], oy = b.y + b.h * PHOTO_ORIGIN[1];
      const a = pose.turn * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const dx = (b.x + fx * b.w - ox) * pose.size, dy = (b.y + fy * b.h - oy) * pose.size * pose.squash;
      return { o: { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c - pose.lift * k }, dir: { x: -c, y: -s }, k: k * pose.size };
    }
    // Same steps as the transform in frame(): squash, then scale and turn round the pivot, then lift.
    const [nx, ny0] = this.art.nozzle, ny = ART_ROAD - (ART_ROAD - ny0) * (this.art.tall || 1) * pose.squash;
    const [px, py] = PIVOT, a = pose.turn * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = (nx - px) * pose.size, dy = (ny - py) * pose.size;
    const x = px + dx * c - dy * s, y = py + dx * s + dy * c - pose.lift;
    return { o: { x: rect.left + x * k, y: rect.top + y * k }, dir: { x: -c, y: -s }, k: k * pose.size };
  }

  puff(x, y, vx, vy, r, life = 2.5 + 1.5 * Math.random()) {
    if (this.puffs.length > 450) this.puffs.shift();
    this.puffs.push({ x, y, vx: vx + 20 * (Math.random() - 0.5), vy: vy + 20 * (Math.random() - 0.5), r, grow: r * 1.2, age: 0, life, tint: null });
  }

  // A burst of vapour each time the valves open.
  burst(n) {
    if (!this.art || !this.art.nozzle) return;
    const { o, dir, k } = this.nozzle(REST);
    for (let i = 0; i < n; i++) this.puff(o.x + dir.x * 40 * k * Math.random(), o.y, dir.x * 180 * k * Math.random(), -30 * k * Math.random(), (8 + 14 * Math.random()) * k);
  }

  // The picture's page box before any transform (offsets are relative to the host).
  photoBox(rect) {
    return { x: rect.left + this.photo.offsetLeft, y: rect.top + this.photo.offsetTop, w: this.photo.offsetWidth, h: this.photo.offsetHeight };
  }

  // Touching down: dust rolls out from under the tyres both ways.
  dust() {
    const rect = this.host.getBoundingClientRect(), k = rect.width / 400;
    let tyres;
    if (this.photo) {   // a picture's wheels sit roughly a fifth in from each end
      const b = this.photoBox(rect);
      tyres = [0.2, 0.8].map(f => [b.x + f * b.w, b.y + b.h]);
    } else tyres = this.art.wheels.x.map(wx => [rect.left + wx * k, rect.top + ART_ROAD * k]);
    for (const [tx, ty] of tyres) {
      for (let i = 0; i < 12; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.puff(tx, ty, side * (60 + 120 * Math.random()) * k, -20 * k * Math.random(), 12 * k, 1.2);
        this.puffs[this.puffs.length - 1].tint = 'dust';
      }
    }
  }

  draw(dt, mps) {
    const g = this.g;
    g.clearRect(0, 0, innerWidth, innerHeight);
    // The car leaves its vapour behind as it speeds up.
    const drift = mps * 6;
    this.puffs = this.puffs.filter(p => (p.age += dt) < p.life);
    for (const p of this.puffs) {
      p.vx *= 1 - dt * 1.2; p.vy = p.vy * (1 - dt * 1.2) - 12 * dt;   // slows in the air, rises
      p.x += (p.vx - drift) * dt; p.y += p.vy * dt; p.r += p.grow * dt / p.life;
      const fade = 1 - p.age / p.life;
      g.globalAlpha = (p.tint ? 0.35 : 0.4) * fade * fade;
      g.drawImage(p.tint ? this.dustSprite : this.sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    g.globalAlpha = 1;

    const pl = this.plume;
    if (pl && this.jet >= 0.02) {
      const { o, dir, len, w, lv } = pl, nx = -dir.y, ny = dir.x;
      const end = { x: o.x + dir.x * len, y: o.y + dir.y * len };
      g.globalCompositeOperation = 'lighter';
      // Pale core widening into the plume.
      const grad = g.createLinearGradient(o.x, o.y, end.x, end.y);
      grad.addColorStop(0, `rgba(255,255,255,${0.95 * lv})`); grad.addColorStop(0.6, `rgba(210,225,255,${0.45 * lv})`); grad.addColorStop(1, 'rgba(200,215,255,0)');
      g.fillStyle = grad; g.beginPath();
      g.moveTo(o.x + nx * w * 0.5, o.y + ny * w * 0.5); g.lineTo(end.x + nx * w * 2.2, end.y + ny * w * 2.2);
      g.lineTo(end.x - nx * w * 2.2, end.y - ny * w * 2.2); g.lineTo(o.x - nx * w * 0.5, o.y - ny * w * 0.5); g.fill();
      // Shock diamonds: bright pinches spaced along the core, fading downstream.
      for (let i = 0; i < 5; i++) {
        const d = len * (0.12 + 0.15 * i), size = w * (1.1 - 0.15 * i), cx = o.x + dir.x * d, cy = o.y + dir.y * d;
        g.fillStyle = `rgba(255,250,235,${(0.85 - 0.15 * i) * lv})`; g.beginPath();
        g.moveTo(cx + dir.x * size * 1.6, cy + dir.y * size * 1.6); g.lineTo(cx + nx * size * 0.55, cy + ny * size * 0.55);
        g.lineTo(cx - dir.x * size * 1.6, cy - dir.y * size * 1.6); g.lineTo(cx - nx * size * 0.55, cy - ny * size * 0.55); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    this.plume = null;
  }
}

if (typeof module !== 'undefined') module.exports = { flipPose, FLIP_S, PIVOT };
