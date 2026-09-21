import { J } from './etat.js';
import { IMAGES_ART } from './decor.js';
import { ART } from './donnees.js';
import { silhouette } from './dragon-pieces.js';
import { toile } from './outils.js';

// ================= Ennemis : planches peintes par Pixel Artist (art/recettes/ennemis.json) =================
export let SPR = {}; J.VEILLEUR_IMG = null; J.MACHOIRE_IMG = null;
export function decouperPlanche(el) {          // une case par image ; n : l'image, b : sa silhouette blanche (touché)
  const a = ART[el], img = IMAGES_ART[el], [cw, ch] = a.cellule, images = [];
  for (let k = 0; k < a.images; k++) {
    const c = toile(cw, ch); c.getContext('2d').drawImage(img, k * cw, 0, cw, ch, 0, 0, cw, ch);
    images.push({ n: c, b: silhouette(c, '#ffffff') });
  }
  return { images, droite: a.regarde === 'droite' };
}
export function construireEnnemis() {
  for (const nom of ['corbeau', 'chauve', 'ame', 'spectre', 'crane']) SPR[nom] = decouperPlanche('ennemis/' + nom);
  const a = ART['ennemis/veilleur'], img = IMAGES_ART['ennemis/veilleur'];
  const morceau = ([x, y, w, h]) => { const c = toile(w, h); c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h); return { n: c, b: silhouette(c, '#ffffff') }; };
  J.VEILLEUR_IMG = morceau(a.rects[0]); J.MACHOIRE_IMG = morceau(a.rects[1]);
}
