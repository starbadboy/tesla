export interface WrapPreset {
  id: string;
  name: string;
  swatch: string;
  stops: string[];
  angle: number;
}

export const WRAP_PRESETS: WrapPreset[] = [
  { id: 'matte-black',  name: 'Matte Black',     swatch: '#0a0a0a', stops: ['#1a1a1a', '#000000'], angle: 135 },
  { id: 'cyber-silver', name: 'Cyber Silver',    swatch: '#c8ccd1', stops: ['#e8ebee', '#9aa0a6'], angle: 135 },
  { id: 'plasma',       name: 'Plasma Violet',   swatch: '#7b2cff', stops: ['#c34bff', '#3a0a8a'], angle: 135 },
  { id: 'solar',        name: 'Solar Flare',     swatch: '#ff7a00', stops: ['#ffb347', '#d94a00'], angle: 135 },
  { id: 'arctic',       name: 'Arctic Pearl',    swatch: '#e6f4ff', stops: ['#ffffff', '#b8d8f0'], angle: 135 },
  { id: 'forest',       name: 'Forest Carbon',   swatch: '#0f3a2e', stops: ['#1d6b52', '#051e18'], angle: 135 },
  { id: 'blood',        name: 'Crimson Edition', swatch: '#8a0c1a', stops: ['#e0212e', '#3d0308'], angle: 135 },
  { id: 'oil',          name: 'Oil Slick',       swatch: '#2a1a4a', stops: ['#a34bff', '#00ffff', '#ff3df0', '#2a1a4a'], angle: 135 },
];

export function gradientCss(stops: string[], angle: number): string {
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}

/**
 * Render a gradient preset to a PNG data URL so it can be applied to the
 * existing wrap-as-image pipeline (DesignCanvas + ThreeDView).
 */
export function gradientToDataUrl(preset: WrapPreset, size = 1024): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const rad = (preset.angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(dx) + Math.abs(dy)) * size * 0.5;
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  preset.stops.forEach((color, i) => {
    grad.addColorStop(preset.stops.length === 1 ? 0 : i / (preset.stops.length - 1), color);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas.toDataURL('image/png');
}
