import { J } from './etat.js';
import { PIXEL } from './donnees.js';
import { toile } from './outils.js';
import { chargerPantin, silhouette } from '../../pixel_artist/pantin/pantin.js';

// ================= Le dragon : la marionnette de Pixel Artist, animée par Pantin =================
J.PANTIN = null;   // PANTIN.poses[pose] : les os (pièces), leurs jeux de teintes, les membres ; voir pixel_artist/pantin
J.PL = null;       // PL[jeu de teintes] = planche propre (course, décollage, atterrissage, chute)
export const JEUX = { blanc: '#ffffff', fantome: '#646464', contour: '#3e3e3e' };   // flash du coup, sillage de la ruée, contour
export function construirePantin(atlas) {
  const p = chargerPantin(PIXEL, atlas, { teintes: JEUX, reteintes: { loin: 0.55, dessous: 1.2 } });   // l'aile du fond, le dessous de l'aile
  for (const pose of Object.values(p.poses)) {
    const tete = pose.parNom.tete;
    if (tete) tete.oeil = boiteClaire(tete.jeux.normal.img);     // l'œil, pour la paupière
  }
  return p;
}
export function boiteClaire(img) {             // la boîte des pixels presque blancs (l'œil), pour la paupière
  const g = toile(img.width, img.height).getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4;
    if (d[i + 3] && d[i] > 185) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x1 >= 0 && x1 - x0 < 10 && y1 - y0 < 10 ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null;
}
export function construirePlanche(img) {
  const c = toile(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  return { normal: c, ...Object.fromEntries(Object.entries(JEUX).map(([j, t]) => [j, silhouette(c, t)])) };
}
