import { J } from './etat.js';
import { NIVEAUX, AN, G } from './config.js';
import { CARTES } from './donnees.js';
import { rand } from './outils.js';
import { particule } from './partie.js';
import { sfx } from './son.js';
import { retoucherTerrain } from './terrain.js';

// ================= Niveaux : cases, collisions, objets (fichiers niveaux/acteN.txt) =================

export const TP = 16;                                           // une case = 16 × 16 pixels
export const VIDE = 0, ROC = 1, CORNICHE = 2, PICS = 3, FRAGILE = 4, COURANT = 5, HERSE = 6, TOUR = 7;
// | : maçonnerie de tour, qui bloque comme la roche mais se dessine avec les pièces peintes du niveau (TERRAIN[…].pieces)
export const CASES = { '#': ROC, '=': CORNICHE, '^': PICS, 'x': FRAGILE, '~': COURANT, 'H': HERSE, '|': TOUR };
export const ENNEMIS_CARTE = { c: 'charognard', a: 'ame', b: 'chauve', s: 'spectre', k: 'crane' };
// objets de décor, posés sur le sol, sans collision (images : construireAccessoires dans terrain.js) :
// arbre mort, tombe, croix, gargouille tournée vers la droite (G) ou vers la gauche (g), étendard en lambeaux (B), clocheton (I)
export const DECOR = 'Tt+GgBI';
// zone de collision du dragon, autour de son corps ; en vol, le bas s'arrête là où l'atterrissage commence
export const LARG = 24, HAUT = 12, BAS = G - AN.land.bodyY[0], CORPS_SOL = 44;
J.NIV = null;
// les herses : chaque groupe de cases H qui se touchent se lève d'un bloc quand un levier l'actionne
function herses(niv) {
  const vus = new Set(), groupes = [];
  for (let i = 0; i < niv.cases.length; i++) {
    if (niv.cases[i] !== HERSE || vus.has(i)) continue;
    const g = { cases: [], x0: 1e9, y0: 1e9, x1: -1, y1: -1, ouverture: null, levee: false }, pile = [i];
    vus.add(i);
    while (pile.length) {
      const k = pile.pop(), tx = k % niv.l, ty = Math.floor(k / niv.l);
      g.cases.push(k); g.x0 = Math.min(g.x0, tx); g.x1 = Math.max(g.x1, tx); g.y0 = Math.min(g.y0, ty); g.y1 = Math.max(g.y1, ty);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = tx + dx, y = ty + dy, j = y * niv.l + x;
        if (x >= 0 && x < niv.l && y >= 0 && y < niv.h && niv.cases[j] === HERSE && !vus.has(j)) { vus.add(j); pile.push(j); }
      }
    }
    groupes.push(g);
  }
  return groupes;
}
export const MONTEE_HERSE = 0.9;                     // secondes pour qu'une herse remonte dans la voûte
// un levier actionné (feu ou ruée) lève la herse la plus proche de lui
export function tirerLevier(o) {
  if (o.tire) return;
  o.tire = true;
  let meilleure = null, dmin = Infinity;
  for (const g of J.NIV.herses) {
    if (g.ouverture !== null) continue;
    const d = Math.hypot((g.x0 + g.x1 + 1) / 2 * TP - o.x, (g.y0 + g.y1 + 1) / 2 * TP - o.y);
    if (d < dmin) { dmin = d; meilleure = g; }
  }
  sfx('touche');
  if (meilleure) { meilleure.ouverture = J.temps; sfx('boum', 0.1); sfx('chute', 0.15); }
}
export function majHerses() {                        // la herse bloque jusqu'à ce qu'elle soit remontée
  for (const g of J.NIV.herses) if (g.ouverture !== null && !g.levee && J.temps - g.ouverture > MONTEE_HERSE) {
    g.levee = true;
    for (const k of g.cases) J.NIV.cases[k] = VIDE;
  }
}
export function lireNiveau(n) {
  const lignes = CARTES[NIVEAUX[n].cle].split('\n').filter((l) => !l.startsWith(';')).map((l) => l.replace(/\s+$/, ''));
  while (lignes.length && !lignes[lignes.length - 1]) lignes.pop();
  const h = lignes.length, l = Math.max(...lignes.map((x) => x.length));
  const niv = { niveau: n, l, h, cases: new Uint8Array(l * h), objets: [], courants: [], largeur: l * TP, hauteur: h * TP,
                depart: [TP * 3, TP * (h - 2)], reprise: null, veilleur: null, sortie: null, arene: null, reliques: 0, prises: 0 };
  lignes.forEach((ligne, ty) => [...ligne.padEnd(l, '.')].forEach((ch, tx) => {
    const x = tx * TP + TP / 2, y = ty * TP + TP / 2, sol = (ty + 1) * TP;
    if (CASES[ch] !== undefined) niv.cases[ty * l + tx] = CASES[ch];
    else if (ENNEMIS_CARTE[ch]) niv.objets.push({ genre: 'ennemi', type: ENNEMIS_CARTE[ch], x, y });
    else if (ch === 'h') niv.objets.push({ genre: 'coeur', x, y });
    else if (ch === 'r') { niv.objets.push({ genre: 'relique', x, y }); niv.reliques++; }
    else if (ch === 'f') niv.objets.push({ genre: 'autel', x, y: sol });
    else if (ch === 'l') niv.objets.push({ genre: 'levier', x, y: sol, tire: false });
    else if (DECOR.includes(ch)) niv.objets.push({ genre: 'decor', type: ch, x, y: sol });
    else if (ch === 'P') niv.depart = [x, sol];
    else if (ch === 'E') niv.sortie = { x, y: sol };
    else if (ch === 'V') niv.veilleur = { x, y };
  }));
  niv.herses = herses(niv);
  for (let tx = 0; tx < l; tx++) {                        // colonnes de courant ascendant, pour l'effet visuel
    let debut = -1;
    for (let ty = 0; ty <= h; ty++) {
      const c = ty < h && niv.cases[ty * l + tx] === COURANT;
      if (c && debut < 0) debut = ty;
      if (!c && debut >= 0) { niv.courants.push({ x: tx * TP, y0: debut * TP, y1: ty * TP }); debut = -1; }
    }
  }
  return niv;
}
// hors de la carte : roc sur les côtés et au-dessus (on ne sort pas), vide en dessous (le gouffre)
// la porte de sortie n'apparaît qu'une fois toutes les reliques de l'acte ramassées
export const porteOuverte = () => J.NIV.prises >= J.NIV.reliques;
export const caseA = (tx, ty) => (tx < 0 || tx >= J.NIV.l || ty < 0 ? ROC : ty >= J.NIV.h ? VIDE : J.NIV.cases[ty * J.NIV.l + tx]);
export const bloque = (t) => t === ROC || t === FRAGILE || t === HERSE || t === TOUR;
export function briser(tx, ty) {               // un mur fissuré s'effondre d'un bloc : toutes les cases fragiles qui se touchent
  const pile = [[tx, ty]];
  let gauche = tx, droite = tx;
  while (pile.length) {
    const [x, y] = pile.pop();
    if (caseA(x, y) !== FRAGILE || y >= J.NIV.h) continue;
    J.NIV.cases[y * J.NIV.l + x] = VIDE;
    gauche = Math.min(gauche, x); droite = Math.max(droite, x);
    for (let i = 0; i < 9; i++) particule({ x: x * TP + rand(2, 14), y: y * TP + rand(2, 14), vx: rand(-90, 90), vy: rand(-130, -20), vie: rand(0.5, 0.9), max: 0.9, t: 2, rot: rand(0, 6), genre: 'gravat' });
    pile.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  retoucherTerrain(gauche, droite);
  sfx('boum'); J.secousse = Math.max(J.secousse, 0.15);
}
export function toucheCase(type, x0, y0, x1, y1) {
  for (let ty = Math.floor(y0 / TP); ty <= Math.floor(y1 / TP); ty++)
    for (let tx = Math.floor(x0 / TP); tx <= Math.floor(x1 / TP); tx++) if (caseA(tx, ty) === type) return true;
  return false;
}
// en vol : la boîte du dragon glisse contre le roc, se pose sur le sol et les corniches, brise ce qui est fragile en ruée
export function deplacerVol(dx, dy) {
  const r = { sol: null, plafond: false, mur: false };
  if (dx) {
    J.P.x += dx;
    const tx = Math.floor((dx > 0 ? J.P.x + LARG : J.P.x - LARG) / TP), ty0 = Math.floor((J.P.y - HAUT) / TP), ty1 = Math.floor((J.P.y + BAS - 1) / TP);
    if (J.P.ruee >= 0) for (let ty = ty0; ty <= ty1; ty++) if (caseA(tx, ty) === FRAGILE) briser(tx, ty);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (bloque(caseA(tx, ty))) { J.P.x = dx > 0 ? tx * TP - LARG - 0.01 : (tx + 1) * TP + LARG + 0.01; r.mur = true; break; }
    }
  }
  if (dy) {
    const basAvant = J.P.y + BAS;
    J.P.y += dy;
    const x0 = Math.floor((J.P.x - LARG + 1) / TP), x1 = Math.floor((J.P.x + LARG - 1) / TP);
    if (dy > 0) {
      const ty = Math.floor((J.P.y + BAS) / TP);
      for (let tx = x0; tx <= x1; tx++) {
        const t = caseA(tx, ty);
        if (bloque(t) || (t === CORNICHE && basAvant <= ty * TP + 0.5)) { J.P.y = ty * TP - BAS; r.sol = ty * TP; break; }
      }
    } else {
      const ty = Math.floor((J.P.y - HAUT) / TP);
      for (let tx = x0; tx <= x1; tx++) {
        const t = caseA(tx, ty);
        if (t === FRAGILE && J.P.ruee >= 0) { briser(tx, ty); continue; }
        if (bloque(t)) { J.P.y = (ty + 1) * TP + HAUT; r.plafond = true; break; }
      }
    }
  }
  return r;
}
// au sol : on avance contre les murs ; le sol continue-t-il sous les pattes ?
export function deplacerSol(dx) {
  if (!dx) return false;
  J.P.x += dx;
  const tx = Math.floor((dx > 0 ? J.P.x + LARG : J.P.x - LARG) / TP), ty0 = Math.floor((J.P.sol - CORPS_SOL) / TP), ty1 = Math.floor((J.P.sol - 2) / TP);
  if (J.P.ruee >= 0) for (let ty = ty0; ty <= ty1; ty++) if (caseA(tx, ty) === FRAGILE) briser(tx, ty);
  for (let ty = ty0; ty <= ty1; ty++) {
    if (!bloque(caseA(tx, ty))) continue;
    if (ty === ty1 && marcheLibre(tx, ty1 * TP)) { J.P.sol = ty1 * TP; return false; }   // une marche d'une case : on l'enjambe
    J.P.x = dx > 0 ? tx * TP - LARG - 0.01 : (tx + 1) * TP + LARG + 0.01; return true;
  }
  return false;
}
export function marcheLibre(tx, sol) {          // la place pour le corps au-dessus de la marche
  const x0 = Math.floor((J.P.x - LARG) / TP), x1 = Math.floor((J.P.x + LARG) / TP);
  for (let ty = Math.floor((sol - CORPS_SOL) / TP); ty < sol / TP; ty++)
    for (let x = Math.min(x0, tx); x <= Math.max(x1, tx); x++) if (bloque(caseA(x, ty))) return false;
  return true;
}
export function appuiOuMarche() {               // le sol continue, ou descend d'une marche
  if (appuiSous()) return true;
  J.P.sol += TP;
  if (appuiSous()) return true;
  J.P.sol -= TP;
  return false;
}
export function appuiSous() {                   // le sol porte-t-il le centre de gravité (entre les pattes, un peu vers la tête) ?
  const ty = Math.floor(J.P.sol / TP), cg = J.P.x + J.P.face * 4;
  for (let tx = Math.floor((cg - 6) / TP); tx <= Math.floor((cg + 6) / TP); tx++) {
    const t = caseA(tx, ty);
    if (bloque(t) || t === CORNICHE) return true;
  }
  return false;
}
export function solSous(x, y) {
  const tx = Math.floor(x / TP);
  for (let ty = Math.max(0, Math.floor(y / TP)); ty < J.NIV.h; ty++) { const t = caseA(tx, ty); if (bloque(t) || t === CORNICHE) return ty * TP; }
  return null;
}
