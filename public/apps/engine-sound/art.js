// art.js — side-view car illustrations, drawn as SVG from each car's outline points (cars.js `art`).
// Cars face right in a 400×160 box with the road at y=140. `tall` stretches the body (not the
// wheels) up from the road, so outlines can be sketched low and set to the real height:length.

const ART_ROAD = 140;

const fmt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

// Closed outline. Smooth: Catmull-Rom through the points (the closing edge, the underside,
// stays straight). Sharp: straight edges, for angular cars and windows.
function outline(pts, sharp) {
  if (sharp) return `M${pts.map(fmt).join('L')}Z`;
  let d = `M${fmt(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }
  return `${d}Z`;
}

// Mix two #rrggbb colors, t=0 → a, t=1 → b.
function mix(a, b, t) {
  const n = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function wheelSvg(x, r, whitewall, id) {
  const cy = ART_ROAD - r;
  const spokes = [0, 72, 144, 216, 288].map(a => {
    const t = a * Math.PI / 180;
    return `<line x1="${x}" y1="${cy}" x2="${(x + Math.cos(t) * r * 0.58).toFixed(1)}" y2="${(cy + Math.sin(t) * r * 0.58).toFixed(1)}"/>`;
  }).join('');
  return `<g class="wheel">
    <circle cx="${x}" cy="${cy}" r="${r}" fill="#141414"/>
    ${whitewall ? `<circle cx="${x}" cy="${cy}" r="${r * 0.78}" fill="none" stroke="#e8e8e8" stroke-width="${r * 0.16}"/>` : ''}
    <circle cx="${x}" cy="${cy}" r="${r * 0.62}" fill="url(#${id}rim)"/>
    <g class="spin" data-cx="${x}" data-cy="${cy}" stroke="#2a2a2a" stroke-width="${(r * 0.12).toFixed(1)}" stroke-linecap="round">${spokes}</g>
    <circle cx="${x}" cy="${cy}" r="${r * 0.16}" fill="#3a3a3a"/>
  </g>`;
}

// uid keeps gradient ids unique when several cars are on the page.
function carSvg(art, uid) {
  const id = `a${uid}`, r = art.wheels.r;
  const extra = (list = []) => list.map(e => (e.circle
    ? `<circle cx="${e.circle[0]}" cy="${e.circle[1]}" r="${e.circle[2]}" fill="${e.fill}"/>`
    : `<path d="${outline(e.pts, e.sharp)}" fill="${e.fill}"/>`)).join('');
  const arches = art.open ? '' : art.wheels.x.map(x => `<circle cx="${x}" cy="${ART_ROAD - r}" r="${r + 3}" fill="#0b0b0d"/>`).join('');
  const light = (p, fill, w) => (p ? `<ellipse cx="${p[0]}" cy="${p[1]}" rx="${w}" ry="3" fill="${fill}"/>` : '');
  return `<svg viewBox="0 0 400 160" class="car-art" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${mix(art.color, '#ffffff', 0.4)}"/>
        <stop offset="0.5" stop-color="${art.color}"/>
        <stop offset="1" stop-color="${mix(art.color, '#000000', 0.5)}"/>
      </linearGradient>
      <linearGradient id="${id}glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a9c1d6"/><stop offset="1" stop-color="#18222d"/>
      </linearGradient>
      <radialGradient id="${id}rim"><stop offset="0" stop-color="#d9d9d9"/><stop offset="1" stop-color="#7a7a7a"/></radialGradient>
    </defs>
    <ellipse cx="200" cy="${ART_ROAD + 1}" rx="175" ry="6" fill="#000" opacity=".5"/>
    <g class="whole">
      <g class="body">
        <g transform="translate(0 ${ART_ROAD}) scale(1 ${art.tall || 1}) translate(0 ${-ART_ROAD})">
          ${extra(art.under)}
          <path d="${outline(art.body, art.sharp)}" fill="url(#${id})"/>
          ${art.window ? `<path d="${outline(art.window, true)}" fill="url(#${id}glass)"/>` : ''}
          ${extra(art.over)}
          ${light(art.head, '#fff4c8', 7)}${light(art.tail, '#ff2525', 5)}
        </g>
        ${arches}
      </g>
      ${art.wheels.x.map(x => wheelSvg(x, r, art.wheels.whitewall, id)).join('')}
    </g>
  </svg>`;
}

if (typeof module !== 'undefined') module.exports = { carSvg, outline, mix };
