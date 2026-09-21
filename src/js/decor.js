import { J } from './etat.js';
import { NIVEAUX, BRUME, CENDRE, FEU } from './config.js';
import { BAYER, ctx } from './ecran.js';
import { hash, rand, toile } from './outils.js';
import { sfx } from './son.js';

// ================= Décors : plans peints par Pixel Artist, en parallaxe =================
// Les images viennent de art/ : pixel_artist/generer.py (d'après la référence d'ambiance) puis pixeliser.py
// (recettes art/recettes/*.json). Chaque plan tourne en boucle ; plus il est loin, moins il défile.

export const T = 512;
export let IMAGES_ART = {}; J.HALOS = null;
// f / v : part du défilement horizontal / vertical de la caméra ; haut : y du haut du plan (px) ;
// bas : le bas du plan tombe à tant de pixels sous la ligne de sol ; x : plan fixe, centré à cette fraction de l'écran ;
// monde : le haut du plan à cette hauteur de la carte (px) : il suit la caméra verticalement et couvre tout ce qui est dessous
export const CIEL = [{ el: 'commun/ciel', f: 0.03, v: 0.05, haut: -70 }, { el: 'commun/lune', f: 0.01, v: 0.04, haut: 34, x: 0.72 },
              { el: 'objets/ile', f: 0.06, v: 0.08, haut: 58, pas: 620 }];
// les plans de chaque décor, par clé de niveau (voir NIVEAUX)
export const PLANS = {
  terres: { dehors: true, plans: [...CIEL, { el: 'terres/lointain', f: 0.1, v: 0.12, bas: -14 }, { el: 'commun/nuages', f: 0.16, v: 0.3, bas: 150 },
                          { el: 'terres/milieu', f: 0.3, v: 0.3, bas: 12 }, { el: 'terres/proche', f: 0.55, v: 0.55, bas: 34 }] },
  cimetiere: { dehors: true, orage: true, plans: [...CIEL, { el: 'cimetiere/lointain', f: 0.1, v: 0.12, bas: -10 }, { el: 'commun/nuages', f: 0.16, v: 0.3, bas: 150 },
                          { el: 'cimetiere/milieu', f: 0.3, v: 0.3, bas: 12 }, { el: 'cimetiere/proche', f: 0.55, v: 0.55, bas: 34 }] },
  // les tours du château plongent dans la brume : quand on pique vers le fond, la mer de nuages monte devant leurs pieds.
  // Le plan proche descend assez bas (bas ≥ 108) pour que son bord inférieur ne se voie jamais, même caméra au fond.
  // Sous la brume (rangée 24 de la carte), les fondations : le mur du fond des souterrains, dans la pénombre.
  tours: { dehors: true, orage: true, plans: [...CIEL, { el: 'tours/lointain', f: 0.1, v: 0.12, bas: -10 }, { el: 'commun/nuages', f: 0.16, v: 0.3, bas: 150 },
                          { el: 'tours/milieu', f: 0.3, v: 0.3, bas: 20 }, { el: 'tours/proche', f: 0.55, v: 0.55, bas: 112 },
                          { el: 'commun/nuages', f: 0.7, v: 0.7, bas: 240 }, { el: 'tours/soubassements', f: 0.6, monde: 24 * 16 + 4 }] },
  cryptes: { dehors: false, plans: [{ el: 'cryptes/fond', f: 0.15, v: 0.2, haut: -40 }, { el: 'cryptes/arcades', f: 0.45, v: 0.45, haut: -30 }] },
};
export const decorNiveau = () => PLANS[NIVEAUX[J.niveauVisuel].cle];
export function construireHalo(r, graine) {
  const c = toile(r * 2 + 1, r * 2 + 1), g = c.getContext('2d');
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y) / r;
    if (d > 1) continue;
    const seuil = BAYER[((y + r) & 3) * 4 + ((x + r) & 3)] / 16;
    if ((1 - d) * 0.9 > seuil + (hash(x * 7 + y * 13 + graine) - 0.5) * 0.15) {
      g.fillStyle = d < 0.35 ? FEU[2] : d < 0.65 ? FEU[3] : '#404040';
      g.fillRect(x + r, y + r, 1, 1);
    }
  }
  return c;
}
export const partout = (x, dessin) => { for (const dx of [0, -T, T]) dessin(x + dx); };   // motif sans couture

export function trait(g, x0, y0, x1, y1, ep, couleur) {
  g.fillStyle = couleur;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n) - (ep >> 1), Math.round(y0 + (y1 - y0) * i / n) - (ep >> 1), ep, ep);
}
export function arbreMort(g, x, base, h, couleur, graine) {
  partout(x, (X) => {
    const branche = (bx, by, a, l, p) => {
      const x1 = bx + Math.cos(a) * l, y1 = by - Math.sin(a) * l;
      trait(g, bx, by, x1, y1, p > 2 ? 2 : 1, couleur);
      if (p <= 0) return;
      const s = hash(graine * 7 + p * 3.3 + a);
      branche(x1, y1, a + 0.3 + s * 0.5, l * (0.6 + s * 0.15), p - 1);
      branche(x1, y1, a - 0.3 - (1 - s) * 0.55, l * (0.55 + (1 - s) * 0.2), p - 1);
    };
    trait(g, X, base, X + (hash(graine) - 0.5) * 4, base - h * 0.42, 3, couleur);
    branche(X, base - h * 0.42, Math.PI / 2 + (hash(graine + 1) - 0.5) * 0.5, h * 0.28, 4);
  });
}
export function croix(g, x, base, h, c, penche) {
  partout(x, (X) => {
    trait(g, X, base, X + penche, base - h, 2, c);
    const yb = base - h * 0.7, xb = X + penche * 0.7;
    trait(g, xb - h * 0.3, yb + penche * 0.15, xb + h * 0.3, yb - penche * 0.15, 2, c);
  });
}
export function tombe(g, x, base, w, h, c) {
  partout(x, (X) => {
    g.fillStyle = c;
    for (let r = 0; r < h; r++) { const retrait = r >= h - 2 ? (h - r) : 0; g.fillRect(X + retrait, base - r, w - retrait * 2, 1); }
  });
}
export function disque(cx, cy, r, teinte) {
  ctx.fillStyle = teinte;
  for (let y = -r; y <= r; y++) {
    const hw = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
    ctx.fillRect(Math.round(cx) - hw, Math.round(cy) + y, hw * 2 + 1, 1);
  }
}

J.eclair = 0; J.prochainEclair = 8;
// l'instant où l'éclair blanchit le ciel (deux coups rapprochés, comme un vrai éclair)
export const eclairVisible = () => J.eclair > 0.16 || (J.eclair > 0.04 && J.eclair < 0.1);
// la caméra monte et descend : chaque plan du décor suit d'autant moins qu'il est loin
export const monte = (f) => Math.round((J.NIV.depart[1] - J.camY - J.SOL) * f);
export function decor() {
  const A = decorNiveau();
  ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, J.W, J.H);
  let fond = 0;
  A.plans.forEach((p, k) => {
    if (p.monde !== undefined) return;                                   // (les plans du monde viennent après la mer de nuages)
    const img = IMAGES_ART[p.el];
    const y = p.haut !== undefined ? p.haut + monte(p.v) : J.SOL + p.bas + monte(p.v) - img.height;
    if (p.x !== undefined) ctx.drawImage(img, Math.round(J.W * p.x - img.width / 2 - J.cam * p.f), y);
    else {
      const w = p.pas || img.width, x0 = -((Math.round(J.cam * p.f) % w) + w) % w;
      for (let x = x0; x < J.W; x += w) ctx.drawImage(img, x, y);
    }
    if (p.bas !== undefined) fond = Math.max(fond, y + img.height);
    // l'orage : l'éclair blanchit le ciel, les silhouettes restent noires devant
    if (A.orage && k === 2 && eclairVisible()) { ctx.fillStyle = 'rgba(236,235,230,0.32)'; ctx.fillRect(0, 0, J.W, J.H); }
  });
  if (A.dehors && fond < J.H) { ctx.fillStyle = '#b3b2ad'; ctx.fillRect(0, fond, J.W, J.H - fond); }   // sous les îles : la mer de nuages
  // monde : un plan accroché à une hauteur de la carte (px), qui suit la caméra verticalement (les profondeurs d'un niveau :
  // au-dessus de cette hauteur le ciel, en dessous ce plan-là, jusqu'en bas de l'écran)
  for (const p of A.plans) {
    if (p.monde === undefined) continue;
    const img = IMAGES_ART[p.el], y = p.monde - Math.round(J.camY);
    if (y >= J.H || y + img.height <= 0) continue;
    const w = img.width, x0 = -((Math.round(J.cam * p.f) % w) + w) % w;
    for (let x = x0; x < J.W; x += w) ctx.drawImage(img, x, y);
    if (y + img.height < J.H) { ctx.fillStyle = '#060606'; ctx.fillRect(0, y + img.height, J.W, J.H - y - img.height); }
  }
}
// cendres qui tombent dehors, poussière qui flotte dans les cryptes
J.flocons = [];
export function majMeteo(dt) {
  if (!J.flocons.length) J.flocons = Array.from({ length: 28 }, () => ({ x: rand(0, 600), y: rand(0, 300), v: rand(5, 14), d: rand(-10, -3), t: rand(0, 6) }));
  const dedans = !decorNiveau().dehors;
  for (const f of J.flocons) {
    f.t += dt;
    f.y += (dedans ? -0.35 : 1) * f.v * dt;
    f.x += (f.d + Math.sin(f.t) * 4) * dt;
    if (f.y > J.H) f.y -= J.H; if (f.y < 0) f.y += J.H;
    if (f.x < 0) f.x += J.W; if (f.x > J.W) f.x -= J.W;
  }
  if (decorNiveau().orage && J.etat !== 'titre') {
    J.eclair -= dt; J.prochainEclair -= dt;
    if (J.prochainEclair <= 0) { J.eclair = 0.24; J.prochainEclair = rand(8, 15); sfx('tonnerre', 0.45); }
  }
}
export function dessinerMeteo() {
  const dedans = !decorNiveau().dehors;
  J.flocons.forEach((f, i) => { ctx.fillStyle = dedans ? '#3a3a3a' : (i % 3 ? CENDRE : BRUME); ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); });
}
