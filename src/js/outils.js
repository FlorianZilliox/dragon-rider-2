// ================= Outils =================
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const approche = (v, c, k) => v + (c - v) * Math.min(1, k);
export const rand = (a, b) => a + Math.random() * (b - a);
export const frac = (x) => x - Math.floor(x);
export const hash = (n) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
export const toile = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const melange = (a, b, t) => '#' + hexRgb(a).map((v, i) => Math.round(mix(v, hexRgb(b)[i], t)).toString(16).padStart(2, '0')).join('');
export const pad = (n, l) => String(n).padStart(l, '0');
export const romain = (n) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
