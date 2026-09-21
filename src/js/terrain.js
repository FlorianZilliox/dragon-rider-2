import { J } from './etat.js';
import { ACTES } from './config.js';
import { IMAGES_ART } from './decor.js';
import { ctx } from './ecran.js';
import { CORNICHE, FRAGILE, PICS, ROC, TP, bloque, caseA, porteOuverte } from './niveau.js';
import { clamp, hash, toile } from './outils.js';
import { coeur } from './rendu-monde.js';
import { flamme } from './titre.js';

// ---------- terrain et objets : textures et objets peints par Pixel Artist (art/recettes/terrain.json, objets.json) ----------
// roc : texture raccordable (128 px), crete : bordure posée sur les sols, dessous : roche qui pend sous les îles
// par clé d'acte (voir ACTES) ; sousLeCiel : la crête seulement à l'air libre, et au plafond d'une salle le dessous
// n'est qu'une corniche (pas de créneaux sur le sol d'une salle de tour, pas de culs-de-lampe qui pendent dans la salle)
export const TERRAIN = {
  terres: { roc: 'terrain/roc-terres', crete: 'terrain/crete-terres', dessous: 'terrain/dessous' },
  cimetiere: { roc: 'terrain/roc-cimetiere', crete: 'terrain/crete-cimetiere', dessous: 'terrain/dessous' },
  tours: { roc: 'terrain/roc-tours', crete: 'terrain/crete-tours', dessous: 'terrain/dessous-tours', sousLeCiel: true },
  cryptes: { roc: 'terrain/roc-cryptes', crete: null, dessous: null },
};
J.TUILES = null; J.ACCESSOIRES = null;
export const mod = (a, n) => ((a % n) + n) % n;
// position de dessin sans tressautement : l'écart à la caméra est arrondi d'un bloc (le monde est translaté de round(cam))
export const auPixel = (x, c) => Math.round(x - c) + Math.round(c);
// profondeur d'une roche ou d'une arche qui pend, à « bord » pixels de l'extrémité : épaules arrondies, bord irrégulier
export const effile = (bord, mini, maxi, x) => Math.min(maxi, Math.round(mini + (maxi - mini) * Math.min(1, bord / 44) ** 0.55 + (hash(x * 1.7) - 0.5) * 5));
export function ligneOpaque(img) {             // première ligne presque pleine : là où la crête rejoint le sol
  const c = toile(img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  for (let y = 0; y < img.height; y++) {
    let n = 0;
    for (let x = 0; x < img.width; x++) if (d[(y * img.width + x) * 4 + 3] > 0) n++;
    if (n > img.width * 0.9) return y;
  }
  return img.height >> 1;
}
export function construireTuiles() {
  const fissures = toile(TP, TP), g = fissures.getContext('2d');   // le mur fissuré : la roche de l'acte, zébrée de fentes claires
  g.fillStyle = '#9a9a96';
  [[3, 2], [4, 3], [5, 4], [5, 5], [6, 6], [7, 7], [8, 6], [9, 7], [10, 8], [10, 9], [11, 10], [6, 8], [5, 9], [4, 10], [4, 11], [12, 11], [12, 12], [8, 12], [7, 13]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  g.fillStyle = '#060606';
  [[4, 2], [5, 3], [6, 5], [7, 6], [9, 6], [10, 7], [11, 9], [5, 8], [4, 9], [3, 11], [11, 11], [7, 12]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  return Object.fromEntries(Object.entries(TERRAIN).map(([cle, t]) => [cle, {
    roc: IMAGES_ART[t.roc], dessous: t.dessous && IMAGES_ART[t.dessous],
    crete: t.crete && IMAGES_ART[t.crete], sol: t.crete ? ligneOpaque(IMAGES_ART[t.crete]) : 0, sousLeCiel: !!t.sousLeCiel,
    passerelle: IMAGES_ART['terrain/passerelle'], tablier: ligneOpaque(IMAGES_ART['terrain/passerelle']), pointes: IMAGES_ART['terrain/pointes'], fissures,
  }]));
}
// les objets de décor posés sur la carte, par lettre (voir DECOR dans niveau.js) ; g : la gargouille tournée vers la gauche
export function construireAccessoires() {
  const gargouille = IMAGES_ART['objets/gargouille'], miroir = toile(gargouille.width, gargouille.height), g = miroir.getContext('2d');
  g.translate(gargouille.width, 0); g.scale(-1, 1); g.drawImage(gargouille, 0, 0);
  return { T: IMAGES_ART['objets/arbre'], t: IMAGES_ART['objets/tombe'], '+': IMAGES_ART['objets/croix'],
           G: gargouille, g: miroir, B: IMAGES_ART['objets/etendard'] };
}
// ---------- le terrain, peint une fois par niveau en bandes verticales ----------
// Le terrain ne bouge pas (sauf un mur fissuré qui s'effondre) : le repeindre à chaque image coûtait des centaines
// d'appels de dessin (roche qui pend et arches, colonne de pixels par colonne). Il est peint dans des bandes de
// BANDE px de large à l'entrée du niveau ; chaque image n'en recopie que les deux ou trois visibles.
const BANDE = 256, MARGE_HAUT = 32, MARGE_BAS = 64;   // marges : pinacles et crêtes au-dessus, roche qui pend en dessous
const cache = { niv: null, visuel: -1, bandes: [] };
function peindreBande(i) {
  const b = cache.bandes[i];
  if (!b.toile) b.toile = toile(BANDE, J.NIV.hauteur + MARGE_HAUT + MARGE_BAS);
  const g = b.toile.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, b.toile.width, b.toile.height);
  g.translate(-i * BANDE, MARGE_HAUT);
  peindreTerrain(g, i * BANDE, (i + 1) * BANDE);
  b.propre = true;
}
// un mur s'est effondré entre les colonnes gauche et droite : les bandes qu'il touche, roche qui pend
// et arches voisines comprises (elles s'effilent sur ~3 cases), sont repeintes à l'image suivante
export function retoucherTerrain(gauche, droite) {
  const x0 = (gauche - 4) * TP, x1 = (droite + 5) * TP;
  cache.bandes.forEach((b, i) => { if ((i + 1) * BANDE > x0 && i * BANDE < x1) b.propre = false; });
}
export function dessinerTuiles() {
  if (cache.niv !== J.NIV || cache.visuel !== J.acteVisuel) {            // nouveau niveau : tout repeindre
    for (const b of cache.bandes) if (b.toile) b.toile.width = 0;         // libère la mémoire tout de suite (Safari)
    cache.niv = J.NIV; cache.visuel = J.acteVisuel;
    cache.bandes = Array.from({ length: Math.ceil(J.NIV.largeur / BANDE) }, () => ({ toile: null, propre: false }));
    cache.bandes.forEach((_, i) => peindreBande(i));
  }
  const y0 = Math.max(0, Math.floor(J.camY) - 2 + MARGE_HAUT), y1 = Math.min(J.NIV.hauteur + MARGE_HAUT + MARGE_BAS, Math.ceil(J.camY + J.H) + 2 + MARGE_HAUT);
  if (y1 <= y0) return;
  for (let i = Math.max(0, Math.floor(J.cam / BANDE)); i <= Math.min(cache.bandes.length - 1, Math.floor((J.cam + J.W) / BANDE)); i++) {
    if (!cache.bandes[i].propre) peindreBande(i);
    ctx.drawImage(cache.bandes[i].toile, 0, y0, BANDE, y1 - y0, i * BANDE, y0 - MARGE_HAUT, BANDE, y1 - y0);
  }
}
// peint tout le terrain des colonnes [x0, x1[ (coordonnées de la carte), sur toute la hauteur du niveau
function peindreTerrain(g, x0, x1) {
  const T = J.TUILES[ACTES[J.acteVisuel].cle], plein = (tx, ty) => bloque(caseA(tx, ty)), L = J.NIV.l, H = J.NIV.h;
  const tx0 = Math.max(0, Math.floor(x0 / TP) - 1), tx1 = Math.min(L - 1, Math.floor(x1 / TP) + 1);
  // une suite de cases (même rangée) qui vérifient « est », prise en entier même si elle déborde de la bande
  const suites = (ty, est, marge, faire) => {
    let tx = Math.max(0, tx0 - marge);
    while (tx > 0 && est(tx - 1, ty) && est(tx, ty)) tx--;
    while (tx <= Math.min(L - 1, tx1 + marge)) {
      if (!est(tx, ty)) { tx++; continue; }
      let fin = tx;
      while (fin + 1 < L && est(fin + 1, ty)) fin++;
      faire(tx * TP, (fin + 1) * TP);
      tx = fin + 1;
    }
  };
  // sousLeCiel : un sol est abrité (le sol d'une salle) s'il a un plafond dans la carte à moins de 10 rangées au-dessus ;
  // un plafond couvre une salle s'il y a un sol à moins de 10 rangées en dessous (le bas de la carte est le vide).
  // Dix rangées : les salles des tours s'empilent, une trappe dans un plancher ne doit pas ouvrir le ciel.
  const abrite = (tx, ty) => { for (let k = 2; k <= 10 && ty - k >= 0; k++) if (plein(tx, ty - k)) return true; return false; };
  const salle = (tx, ty) => { for (let k = 4; k <= 10 && ty + k < H; k++) if (plein(tx, ty + k)) return true; return false; };
  // 1. la roche qui pend sous les îles (derrière la roche elle-même) : pleine profondeur au milieu,
  //    elle s'effile vers les bords de chaque île au lieu d'être coupée net
  if (T.dessous) {
    const d = T.dessous, pend = (tx, ty) => plein(tx, ty) && !plein(tx, ty + 1) && !plein(tx, ty + 2) && !plein(tx, ty + 3);
    for (let ty = 0; ty < H; ty++) suites(ty, pend, 0, (X0, X1) => {
      const y = ty * TP + TP - 4;
      for (let x = Math.max(X0, x0); x < Math.min(X1, x1); x++) {
        // sousLeCiel : au plafond d'une salle, seulement le haut des consoles (une corniche), pas les culs-de-lampe
        const h = effile(Math.min(x - X0, X1 - 1 - x), 3, T.sousLeCiel && salle(Math.floor(x / TP), ty) ? 7 : d.height, x);
        g.drawImage(d, mod(x, d.width), 0, 1, h, x, y, 1, h);
      }
    });
  }
  // 2. la roche, les murs fissurés, les pointes
  for (let ty = 0; ty < H; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = caseA(tx, ty), x = tx * TP, y = ty * TP;
    if (t === ROC || t === FRAGILE) {
      g.drawImage(T.roc, mod(x, T.roc.width), mod(y, T.roc.height), TP, TP, x, y, TP, TP);
      if (t === FRAGILE) g.drawImage(T.fissures, x, y);
      g.fillStyle = '#060606';
      if (!plein(tx - 1, ty)) g.fillRect(x, y, 1, TP);
      if (!plein(tx + 1, ty)) g.fillRect(x + TP - 1, y, 1, TP);
      if (!plein(tx, ty + 1) && ty < H - 1) g.fillRect(x, y + TP - 1, TP, 1);
      if (!T.crete && ty > 0 && !plein(tx, ty - 1)) { g.fillStyle = '#9a9a96'; g.fillRect(x, y, TP, 1); g.fillStyle = '#5e5e5b'; g.fillRect(x, y + 1, TP, 1); }
    } else if (t === PICS) {
      const p = T.pointes;
      g.drawImage(p, mod(x, p.width), 0, TP, p.height, x, y + TP - p.height, TP, p.height);
    }
  }
  // 3. les passerelles d'aqueduc (corniches) : le tablier d'un bout à l'autre, les arches s'effilent vers les extrémités
  const p = T.passerelle, haut = T.tablier, tablier = 10;   // haut : où commence le tablier dans la bande (au-dessus : pinacles)
  for (let ty = 0; ty < H; ty++) suites(ty, (tx, y) => caseA(tx, y) === CORNICHE, 0, (X0, X1) => {
    const y = ty * TP;
    for (let x = Math.max(X0, x0); x < Math.min(X1, x1); x++) {
      const bord = Math.min(x - X0, X1 - 1 - x), h = effile(bord, tablier, p.height - haut, x);
      const pinacle = bord > 6 ? haut : 0;                  // pas de pinacle coupé au ras d'un bout
      g.drawImage(p, mod(x, p.width), haut - pinacle, 1, h + pinacle, x, y - pinacle, 1, h + pinacle);
    }
    g.fillStyle = '#060606'; g.fillRect(X0, y + 1, 1, tablier - 2); g.fillRect(X1 - 1, y + 1, 1, tablier - 2);   // bouts du tablier nets
  });
  // 4. la crête posée sur chaque sol à l'air libre (herbe morte, gravats, dalles, créneaux)
  if (T.crete) {
    const c = T.crete;
    for (let ty = 1; ty < H; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!plein(tx, ty) || plein(tx, ty - 1)) continue;
      if (T.sousLeCiel && abrite(tx, ty)) {            // le sol d'une salle : l'arête claire d'une dalle, pas de créneaux
        g.fillStyle = '#9a9a96'; g.fillRect(tx * TP, ty * TP, TP, 1); g.fillStyle = '#5e5e5b'; g.fillRect(tx * TP, ty * TP + 1, TP, 1);
      } else g.drawImage(c, mod(tx * TP, c.width), 0, TP, c.height, tx * TP, ty * TP - T.sol, TP, c.height);
    }
  }
}
export function dessinerCourants() {           // colonnes de cendre qui montent : on voit où le vent porte
  ctx.fillStyle = '#c8c7c2';
  for (const c of J.NIV.courants) {
    if (c.x + TP < J.cam || c.x > J.cam + J.W || c.y1 < J.camY || c.y0 > J.camY + J.H) continue;
    for (let i = 0; i < 3; i++) {
      const x = c.x + 3 + i * 5, dec = (J.temps * (70 + i * 14) + hash(c.x + i) * 30) % 22;
      for (let y = c.y1 - dec; y > c.y0; y -= 22) { ctx.globalAlpha = 0.3 + 0.25 * Math.sin(y * 0.1 + i + J.temps); ctx.fillRect(x, Math.round(y), 1, 6); }
    }
  }
  ctx.globalAlpha = 1;
}
export function dessinerObjets() {
  const au = (img, x, y) => ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height));   // posé sur le sol
  for (const o of J.NIV.objets) {
    if (o.x < J.cam - 70 || o.x > J.cam + J.W + 70 || o.y < J.camY - 90 || o.y > J.camY + J.H + 90) continue;
    if (o.genre === 'decor') au(J.ACCESSOIRES[o.type], o.x, o.y + 1);
    else if (o.genre === 'autel') {
      const img = IMAGES_ART['objets/autel'], x = Math.round(o.x), y = o.y;
      au(img, x, y + 1);
      if (o.allume) {                   // la seule lumière chaude du monde : le feu
        const f = Math.sin(J.temps * 12 + x) > 0, h = y - img.height + 4;
        ctx.drawImage(J.HALOS[f ? 1 : 0], x - (J.HALOS[0].width >> 1), h - 8 - (J.HALOS[0].height >> 1));
        flamme(x, h, x);
      }
    } else if ((o.genre === 'relique' || o.genre === 'coeur') && !o.pris) {
      const y = Math.round(o.y + Math.sin(J.temps * 3 + o.x) * 2);
      if (o.genre === 'coeur') { coeur(Math.round(o.x) - 3, y - 3, true); continue; }
      const img = IMAGES_ART['objets/reliquaire'];
      ctx.drawImage(img, Math.round(o.x - img.width / 2), y - (img.height >> 1));
      if (Math.sin(J.temps * 5 + o.x) > 0.85) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(o.x) + 5, y - 9, 1, 3); ctx.fillRect(Math.round(o.x) + 4, y - 8, 3, 1); }
    }
  }
  const s = J.NIV.sortie;
  if (s && porteOuverte() && s.x > J.cam - 60 && s.x < J.cam + J.W + 60) {
    const u = s.revele === undefined ? 1 : clamp((J.temps - s.revele) / 1.2, 0, 1);   // elle monte de la brume
    if (u < 1) ctx.globalAlpha = u;
    au(IMAGES_ART['objets/porte'], s.x, s.y + 1);
    ctx.globalAlpha = 1;
  }
}
