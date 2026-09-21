import { J } from './etat.js';
import { ACTES, BRUME, ENCRE, EPILOGUE, LOGO, OS, OS2 } from './config.js';
import { IMAGES_ART } from './decor.js';
import { ART } from './donnees.js';
import { ctx } from './ecran.js';
import { hautParleur } from './interface.js';
import { hash, pad, toile } from './outils.js';
import { texte } from './texte.js';

// ================= Écran titre : un menu (COMMENCER, COMMANDES) et l'écran des commandes =================
export const MENU = ['COMMENCER', 'COMMANDES'];
J.choix = 0; J.pageTitre = 'menu';                       // pageTitre : 'menu' ou 'commandes'
export const menuY = (i) => Math.round(J.H * 0.6) + i * 22;
export function voile(a) { ctx.globalAlpha = a; ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, J.W, J.H); ctx.globalAlpha = 1; }
export function imagePlanche(el, k, x, y, sx = 1, ancre = 'centre', rot = 0) {   // la k-ième case d'une planche, centrée (ou posée) en (x, y)
  const a = ART[el], img = IMAGES_ART[el], [cw, ch] = a.cellule, i = ((k % a.images) + a.images) % a.images;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (rot) ctx.rotate(rot); if (sx !== 1) ctx.scale(sx, 1);
  ctx.drawImage(img, i * cw, 0, cw, ch, -Math.floor(cw / 2), ancre === 'bas' ? -ch : -Math.floor(ch / 2), cw, ch);
  ctx.restore();
}
export function flamme(x, y, graine = 0, el = 'feu/flamme') {     // une flamme peinte qui vacille, posée par sa base en (x, y)
  const a = ART[el], img = IMAGES_ART[el], [cw, ch] = a.cellule, k = Math.floor(J.temps * 9 + graine * 3.7) % a.images;
  ctx.drawImage(img, k * cw, 0, cw, ch, Math.round(x - cw / 2), Math.round(y - ch), cw, ch);
}
export function ecranTitre() {
  if (J.pageTitre === 'commandes') { ecranCommandes(); return; }
  const k = J.W >= 310 ? 4 : 3, y = Math.max(18, Math.round(J.H * 0.12));
  const logo = IMAGES_ART['titre/logo'], lx = Math.round(J.W / 2 - logo.width / 2), ly = Math.max(4, Math.round(J.H * 0.06));
  ctx.drawImage(logo, lx, ly);
  texte("LE MONDE S'EST ÉTEINT. IL RESTE LE VOL.", J.W / 2, ly + logo.height + 6, OS2, 1, 'contour', 'centre');
  MENU.forEach((m, i) => {
    const yy = menuY(i), actif = i === J.choix, espace = m.split('').join(' '), demi = espace.length * 3;   // lettres espacées
    texte(espace, J.W / 2, yy, actif ? OS : '#7c7b77', 1, 'contour', 'centre');
    if (actif) {                                           // le curseur : un fer de lance forgé de chaque côté, qui palpite
      const o = Math.round(Math.sin(J.temps * 6) * 1.5), c = IMAGES_ART['objets/curseur'];
      ctx.drawImage(c, Math.round(J.W / 2) - demi - c.width - 8 + o, yy - 2);
      ctx.save(); ctx.translate(Math.round(J.W / 2) + demi + c.width + 8 - o, yy - 2); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); ctx.restore();
    }
  });
  texte('↑ ↓ CHOISIR     X VALIDER', J.W / 2, J.H - 16, '#8c8b87', 1, 'contour', 'centre');
  hautParleur(J.W - 16, 26);
}
export function touche(label, x, y) {                            // une touche de clavier dessinée, renvoie sa largeur
  const w = label.length * 6 + 5;
  ctx.fillStyle = '#060606'; ctx.fillRect(x - 1, y - 1, w + 2, 13);
  ctx.fillStyle = '#2a2a29'; ctx.fillRect(x, y, w, 11);
  ctx.fillStyle = '#6f6e6a'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, 10);
  ctx.fillStyle = '#141414'; ctx.fillRect(x, y + 10, w, 1);
  texte(label, x + 3, y + 2, OS, 1, 'plat');
  return w;
}
export const OUVERTURES = new Map();
export function ouverture(img) {                                  // l'intérieur vide du cadre : on y écrit
  if (!OUVERTURES.has(img)) {
    const c = toile(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data, vide = (x, y) => d[(y * img.width + x) * 4 + 3] === 0;
    const cx = img.width >> 1, cy = img.height >> 1;
    let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
    while (x0 > 0 && vide(x0 - 1, cy)) x0--; while (x1 < img.width - 1 && vide(x1 + 1, cy)) x1++;
    while (y0 > 0 && vide(cx, y0 - 1)) y0--; while (y1 < img.height - 1 && vide(cx, y1 + 1)) y1++;
    OUVERTURES.set(img, { x0, y0, x1, y1 });
  }
  return OUVERTURES.get(img);
}
export function ecranCommandes() {
  voile(0.6);
  const grand = J.W >= 270 && J.H >= 196, c = IMAGES_ART[grand ? 'objets/cadre' : 'objets/cadre-petit'];
  const x0 = Math.round(J.W / 2 - c.width / 2), y0 = Math.round(J.H / 2 - c.height / 2), o = ouverture(c);
  ctx.globalAlpha = 0.88; ctx.fillStyle = '#0a0a0a'; ctx.fillRect(x0 + o.x0 - 2, y0 + o.y0 - 2, o.x1 - o.x0 + 5, o.y1 - o.y0 + 5); ctx.globalAlpha = 1;
  ctx.drawImage(c, x0, y0);
  const cx = Math.round(J.W / 2);
  texte('COMMANDES', cx, y0 + o.y0 - 12, OS, 1, 'contour', 'centre');
  const lignes = [
    [['←', '→'], grand ? 'VOLER, MARCHER' : 'VOLER'],
    [['↑'], grand ? 'MONTER, SAUTER' : 'MONTER'],
    [['↓'], 'PIQUER'],
    [['X'], grand ? 'FEU (TENIR : RAFALE)' : 'FEU'],
    [['C'], grand ? 'RUÉE, BRISE LES MURS' : 'RUÉE'],
    [['↓', 'C'], 'PIQUÉ'],
  ];
  const col = grand ? 56 : 46, larg = col + (grand ? 20 : 6) * 6, gauche = cx - (larg >> 1), pas = grand ? 13 : 12;
  let yy = y0 + o.y0 + 4;
  for (const [ts, action] of lignes) {
    let x = gauche;
    ts.forEach((t, i) => {
      if (i && action === 'PIQUÉ') { texte('+', x + 2, yy + 2, OS2, 1, 'plat'); x += 10; }   // ↓ + C : ensemble
      else if (i) x += 3;                                                                   // ← → : l'un ou l'autre
      x += touche(t, x, yy);
    });
    texte(action, gauche + col, yy + 2, OS2, 1, 'ombre');
    yy += pas;
  }
  if (grand) {
    texte('VOLER USE LE SOUFFLE,', cx, yy + 3, '#9d9c97', 1, 'ombre', 'centre');
    texte('LE SOL ET LA CENDRE LE RENDENT.', cx, yy + 12, '#9d9c97', 1, 'ombre', 'centre');
  }
  const bas = y0 + c.height + 6;                             // sous le cadre s'il y a la place, sinon dans l'ouverture
  if (Math.floor(J.temps * 2) % 2) texte('X : RETOUR', cx, bas + 8 < J.H ? bas : y0 + o.y1 - 8, OS, 1, 'contour', 'centre');
}


export function ecranPause() {
  voile(0.55);
  texte('P A U S E', J.W / 2, Math.round(J.H * 0.42), OS, 1, 'ombre', 'centre');
  texte('FEU : REPRENDRE', J.W / 2, Math.round(J.H * 0.42) + 16, BRUME, 1, 'ombre', 'centre');
}
export function ecranFin(dt) {
  J.finT += dt;
  ctx.fillStyle = 'rgba(7,6,11,0.55)'; ctx.fillRect(0, 0, J.W, J.H);
  const y = Math.round(J.H * 0.3);
  texte('LE DRAGONNIER EST TOMBÉ', J.W / 2, y, LOGO, J.W >= 290 ? 2 : 1, 'contour', 'centre');
  texte('SCORE ' + pad(J.score, 6) + '   RECORD ' + pad(J.record, 6), J.W / 2, y + 30, OS2, 1, 'ombre', 'centre');
  if (Math.floor(J.temps * 2) % 2) texte(J.NIV.reprise ? "FEU : REPRENDRE À L'AUTEL" : "FEU : REPRENDRE L'ACTE " + ACTES[J.acte].num, J.W / 2, y + 50, OS, 1, 'contour', 'centre');
}
export function ecranEpilogue() {
  ctx.fillStyle = ENCRE; ctx.fillRect(0, 0, J.W, J.H);
  for (let i = 0; i < 40; i++) { const x = Math.floor(hash(i * 3.3) * J.W), y = Math.floor(hash(i * 5.1) * J.H); if (Math.sin(J.temps + i) > 0.3) { ctx.fillStyle = '#292929'; ctx.fillRect(x, y, 1, 1); } }
  EPILOGUE.forEach((l, i) => { if (J.epiT > 0.8 + i * 1.5) texte(l, J.W / 2, Math.round(J.H * 0.24) + i * 16, i === 3 ? OS : BRUME, 1, 'ombre', 'centre'); });
  if (J.epiT > 7) {
    texte('SCORE ' + pad(J.score, 6) + '   RECORD ' + pad(J.record, 6), J.W / 2, Math.round(J.H * 0.24) + 82, OS2, 1, 'ombre', 'centre');
    if (Math.floor(J.temps * 2) % 2) texte('FEU : UN NOUVEAU CYCLE', J.W / 2, Math.round(J.H * 0.24) + 100, OS, 1, 'contour', 'centre');
  }
}
