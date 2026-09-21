import { ENCRE, OS } from './config.js';
import { ctx } from './ecran.js';
import { clamp, toile } from './outils.js';

// ================= Police bitmap 5×7 =================
export const GLYPHES = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12], ' ': [0, 0, 0, 0, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4], '.': [0, 0, 0, 0, 0, 0, 4], ',': [0, 0, 0, 0, 4, 4, 8], ':': [0, 0, 4, 0, 0, 4, 0],
  '-': [0, 0, 0, 14, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '/': [1, 1, 2, 4, 8, 16, 16],
  "'": [4, 4, 8, 0, 0, 0, 0], '×': [0, 17, 10, 4, 10, 17, 0], '·': [0, 0, 0, 4, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], '=': [0, 0, 31, 0, 31, 0, 0],
  '←': [0, 4, 8, 31, 8, 4, 0], '→': [0, 4, 2, 31, 2, 4, 0], '↑': [4, 14, 21, 4, 4, 4, 0], '↓': [0, 4, 4, 4, 21, 14, 4],
};
export const ACCENTS = { 'É': ['E', [2, 4]], 'È': ['E', [8, 4]], 'Ê': ['E', [4, 10]], 'À': ['A', [8, 4]], 'Â': ['A', [4, 10]], 'Ç': ['C', null, [4, 8]] };
export function motifGlyphe(ch) {
  const a = ACCENTS[ch];
  return { base: GLYPHES[a ? a[0] : ch] || GLYPHES['?'], dessus: a && a[1], dessous: a && a[2] };
}
export const cacheTexte = new Map();
// couleur : une teinte, ou 7 teintes (une par ligne du glyphe, pour les titres en dégradé)
export function rendreTexte(s, couleur, k, style) {
  const cle = s + '|' + couleur + '|' + k + '|' + style;
  let c = cacheTexte.get(cle);
  if (c) return c;
  if (cacheTexte.size > 300) cacheTexte.clear();
  const marge = style === 'contour' ? k : 0;
  c = toile(s.length * 6 * k + 2 * marge + k, 12 * k + 2 * marge);
  const g = c.getContext('2d');
  const couleurs = Array.isArray(couleur) ? couleur : null;
  const tracer = (ox, oy, teinte) => {
    [...s].forEach((ch, n) => {
      const { base, dessus, dessous } = motifGlyphe(ch);
      const x0 = ox + n * 6 * k, y0 = oy + 2 * k;
      const ligne = (bits, r) => {
        for (let b = 0; b < 5; b++) if (bits & (16 >> b)) {
          g.fillStyle = teinte || (couleurs ? couleurs[clamp(r, 0, 6)] : couleur);
          g.fillRect(x0 + b * k, y0 + r * k, k, k);
        }
      };
      base.forEach((bits, r) => ligne(bits, r));
      if (dessus) { ligne(dessus[0], -2); ligne(dessus[1], -1); }
      if (dessous) { ligne(dessous[0], 7); ligne(dessous[1], 8); }
    });
  };
  if (style === 'contour') {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1], [1, 2], [0, 2], [-1, 2]])
      tracer(marge + dx * k, marge + dy * k, ENCRE);
  } else if (style === 'ombre') tracer(k, k, ENCRE);
  tracer(marge, marge, null);
  cacheTexte.set(cle, c);
  return c;
}
export function texte(s, x, y, couleur = OS, k = 1, style = 'ombre', aligne = 'gauche') {
  const c = rendreTexte(s, couleur, k, style);
  const lx = aligne === 'centre' ? x - Math.floor(c.width / 2) : aligne === 'droite' ? x - c.width : x;
  ctx.drawImage(c, Math.round(lx), Math.round(y - 2 * k));
}
