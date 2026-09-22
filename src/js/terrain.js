import { J } from './etat.js';
import { FEU, NIVEAUX } from './config.js';
import { IMAGES_ART, eclairVisible } from './decor.js';
import { silhouette } from '../../pixel_artist/pantin/pantin.js';
import { ctx } from './ecran.js';
import { CORNICHE, FRAGILE, MONTEE_HERSE, PICS, ROC, TOUR, TP, bloque, caseA, porteOuverte } from './niveau.js';
import { clamp, hash, toile } from './outils.js';
import { coeur } from './rendu-monde.js';
import { flamme } from './titre.js';

// ---------- terrain et objets : textures et objets peints par Pixel Artist (art/recettes/terrain.json, objets.json) ----------
// roc : texture raccordable (128 px), crete : bordure posée sur les sols, dessous : roche qui pend sous les îles
// par clé de niveau (voir NIVEAUX) ; sousLeCiel : la crête seulement à l'air libre, et au plafond d'une alcôve le dessous
// n'est qu'une corniche (pas de créneaux sur le sol d'une alcôve, pas de culs-de-lampe qui la remplissent)
// galerie : l'image des corniches (=) à la place de la passerelle commune, et la ligne où l'on se pose (sol, en px) ;
// pieces : les tours peintes (cases |), par largeur de tour en cases : sommet, fût (répété en hauteur), pied dans la brume ;
//   coeur : où commence la maçonnerie dans l'image (px) ; sol : la ligne du sommet de la tour dans l'image du sommet ;
//   un ^ posé sur une tour est sa flèche : la pointe peinte le remplace. piedSous : la brume du pied déborde d'autant.
export const TERRAIN = {
  terres: { roc: 'terrain/roc-terres', crete: 'terrain/crete-terres', dessous: 'terrain/dessous' },
  cimetiere: { roc: 'terrain/roc-cimetiere', crete: 'terrain/crete-cimetiere', dessous: 'terrain/dessous' },
  tours: { roc: 'terrain/roc-tours', crete: 'terrain/crete-tours', dessous: 'terrain/dessous-tours', sousLeCiel: true,
           galerie: { image: 'tours-pieces/balcon', sol: 25 }, piedSous: 24,
           pieces: {
             4: { sommet: 'tours-pieces/a-sommet', fut: 'tours-pieces/a-fut', pied: 'tours-pieces/a-pied', coeur: 26, sol: 138 },   // à flèche
             5: { sommet: 'tours-pieces/b-sommet', fut: 'tours-pieces/b-fut', pied: 'tours-pieces/b-pied', coeur: 45, sol: 124 },   // terrasse
             6: { sommet: 'tours-pieces/c-sommet', fut: 'tours-pieces/c-fut', pied: 'tours-pieces/c-pied', coeur: 32, sol: 124 },   // donjon
           } },
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
  const fissures = toile(TP, TP), g = fissures.getContext('2d');   // le mur fissuré : la roche du niveau, zébrée de fentes claires
  g.fillStyle = '#9a9a96';
  [[3, 2], [4, 3], [5, 4], [5, 5], [6, 6], [7, 7], [8, 6], [9, 7], [10, 8], [10, 9], [11, 10], [6, 8], [5, 9], [4, 10], [4, 11], [12, 11], [12, 12], [8, 12], [7, 13]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  g.fillStyle = '#060606';
  [[4, 2], [5, 3], [6, 5], [7, 6], [9, 6], [10, 7], [11, 9], [5, 8], [4, 9], [3, 11], [11, 11], [7, 12]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  return Object.fromEntries(Object.entries(TERRAIN).map(([cle, t]) => {
    const passerelle = IMAGES_ART[t.galerie ? t.galerie.image : 'terrain/passerelle'];
    const pieces = t.pieces && Object.fromEntries(Object.entries(t.pieces).map(([larg, p]) =>
      [larg, { ...p, sommet: IMAGES_ART[p.sommet], fut: IMAGES_ART[p.fut], pied: IMAGES_ART[p.pied] }]));
    return [cle, {
      roc: IMAGES_ART[t.roc], dessous: t.dessous && IMAGES_ART[t.dessous],
      crete: t.crete && IMAGES_ART[t.crete], sol: t.crete ? ligneOpaque(IMAGES_ART[t.crete]) : 0, sousLeCiel: !!t.sousLeCiel,
      passerelle, tablier: t.galerie ? t.galerie.sol : ligneOpaque(passerelle), pointes: IMAGES_ART['terrain/pointes'], fissures,
      pieces, piedSous: t.piedSous || 0,
    }];
  }));
}
// les objets de décor posés sur la carte, par lettre (voir DECOR dans niveau.js) ; g : la gargouille tournée vers la gauche
export function construireAccessoires() {
  const gargouille = IMAGES_ART['objets/gargouille'], miroir = toile(gargouille.width, gargouille.height), g = miroir.getContext('2d');
  g.translate(gargouille.width, 0); g.scale(-1, 1); g.drawImage(gargouille, 0, 0);
  // les gargouilles : des silhouettes noires, que seul l'éclair révèle
  return { T: IMAGES_ART['objets/arbre'], t: IMAGES_ART['objets/tombe'], '+': IMAGES_ART['objets/croix'],
           G: gargouille, g: miroir, B: IMAGES_ART['objets/etendard'], I: IMAGES_ART['objets/fleche'],
           ombres: { G: silhouette(gargouille, '#050505'), g: silhouette(miroir, '#050505') } };
}
// ---------- le terrain, peint une fois par niveau en bandes verticales ----------
// Le terrain ne bouge pas (sauf un mur fissuré qui s'effondre) : le repeindre à chaque image coûtait des centaines
// d'appels de dessin (roche qui pend et arches, colonne de pixels par colonne). Il est peint dans des bandes de
// BANDE px de large à l'entrée du niveau ; chaque image n'en recopie que les deux ou trois visibles.
const BANDE = 256, MARGE_HAUT = 32, MARGE_BAS = 64;   // marges : pinacles et crêtes au-dessus, roche qui pend en dessous
const cache = { niv: null, visuel: -1, bandes: [], tours: [], peintes: null };
// les tours de la carte : chaque groupe de cases | qui se touchent ; peinte si le niveau a des pièces pour sa largeur
// (sinon, maçonnerie de roche ordinaire)
function trouverTours(T) {
  const L = J.NIV.l, H = J.NIV.h, vues = new Uint8Array(L * H), peintes = new Uint8Array(L * H), tours = [];
  for (let i = 0; i < L * H; i++) {
    if (J.NIV.cases[i] !== TOUR || vues[i]) continue;
    const g = { x0: 1e9, x1: -1, y0: 1e9, y1: -1, cases: [] }, pile = [i];
    vues[i] = 1;
    while (pile.length) {
      const k = pile.pop(), tx = k % L, ty = Math.floor(k / L);
      g.cases.push(k); g.x0 = Math.min(g.x0, tx); g.x1 = Math.max(g.x1, tx); g.y0 = Math.min(g.y0, ty); g.y1 = Math.max(g.y1, ty);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = tx + dx, y = ty + dy, j = y * L + x;
        if (x >= 0 && x < L && y >= 0 && y < H && J.NIV.cases[j] === TOUR && !vues[j]) { vues[j] = 1; pile.push(j); }
      }
    }
    g.pieces = T.pieces && T.pieces[g.x1 - g.x0 + 1];
    if (g.pieces) for (const k of g.cases) peintes[k] = 1;
    tours.push(g);
  }
  return { tours, peintes };
}
// une tour peinte : le sommet sur sa première rangée, le fût répété jusqu'au pied, le pied qui déborde dans la brume
function peindreTour(g, T, t) {
  const p = t.pieces, X = t.x0 * TP - p.coeur, haut = t.y0 * TP - p.sol, base = (t.y1 + 1) * TP + T.piedSous;
  const s = p.sommet, f = p.fut, pd = p.pied, basSommet = Math.min(base, haut + s.height);
  const place = base - basSommet, hPied = Math.min(pd.height, place);          // une tour courte : le pied, rogné par le haut
  let y = basSommet;
  for (const fin = base - hPied; y < fin; y += f.height) {
    const h = Math.min(f.height, fin - y);
    g.drawImage(f, 0, 0, f.width, h, X, y, f.width, h);
  }
  if (hPied > 0) g.drawImage(pd, 0, pd.height - hPied, pd.width, hPied, X, base - hPied, pd.width, hPied);
  g.drawImage(s, 0, 0, s.width, basSommet - haut, X, haut, s.width, basSommet - haut);
}
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
  if (cache.niv !== J.NIV || cache.visuel !== J.niveauVisuel) {            // nouveau niveau : tout repeindre
    for (const b of cache.bandes) if (b.toile) b.toile.width = 0;         // libère la mémoire tout de suite (Safari)
    cache.niv = J.NIV; cache.visuel = J.niveauVisuel;
    Object.assign(cache, trouverTours(J.TUILES[NIVEAUX[J.niveauVisuel].cle]));
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
  const T = J.TUILES[NIVEAUX[J.niveauVisuel].cle], L = J.NIV.l, H = J.NIV.h;
  // la pierre qu'on peint en roche (une herse n'est pas de la pierre : elle se dessine à part ; une tour peinte non plus)
  const peinte = (tx, ty) => tx >= 0 && tx < L && ty >= 0 && ty < H && cache.peintes && cache.peintes[ty * L + tx] === 1;
  const roche = (tx, ty) => { const t = caseA(tx, ty); return t === ROC || t === FRAGILE || (t === TOUR && !peinte(tx, ty)); };
  // ce qui est massif, pour les bords : une roche contre une tour n'a ni liseré, ni crête, ni roche qui pend
  const plein = (tx, ty) => roche(tx, ty) || caseA(tx, ty) === TOUR;
  // des pics posés sur une tour peinte sont sa flèche : c'est la pointe peinte du sommet qui les montre
  const flecheDeTour = (tx, ty) => { let y = ty; while (caseA(tx, y) === PICS) y++; return caseA(tx, y) === TOUR && peinte(tx, y); };
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
  // sousLeCiel : un sol est abrité (galerie, citerne, alcôve) s'il a de la pierre au-dessus de lui, si haut soit-elle :
  // la crête ne se pose que sous le ciel ; un plafond couvre une salle s'il y a un sol sous lui, si bas soit-il :
  // la roche ne pend en entier qu'au-dessus du vide (le bas de la carte est le vide)
  const abrite = (tx, ty) => { for (let y = ty - 2; y >= 0; y--) if (plein(tx, y)) return true; return false; };
  const salle = (tx, ty) => { for (let y = ty + 4; y < H; y++) if (plein(tx, y)) return true; return false; };
  // 1. la roche qui pend sous les îles (derrière la roche elle-même) : pleine profondeur au milieu,
  //    elle s'effile vers les bords de chaque île au lieu d'être coupée net
  if (T.dessous) {
    const d = T.dessous, pend = (tx, ty) => roche(tx, ty) && !plein(tx, ty + 1) && !plein(tx, ty + 2) && !plein(tx, ty + 3);
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
    if (roche(tx, ty)) {
      g.drawImage(T.roc, mod(x, T.roc.width), mod(y, T.roc.height), TP, TP, x, y, TP, TP);
      if (t === FRAGILE) g.drawImage(T.fissures, x, y);
      g.fillStyle = '#060606';
      if (!plein(tx - 1, ty)) g.fillRect(x, y, 1, TP);
      if (!plein(tx + 1, ty)) g.fillRect(x + TP - 1, y, 1, TP);
      if (!plein(tx, ty + 1) && ty < H - 1) g.fillRect(x, y + TP - 1, TP, 1);
      if (!T.crete && ty > 0 && !plein(tx, ty - 1)) { g.fillStyle = '#9a9a96'; g.fillRect(x, y, TP, 1); g.fillStyle = '#5e5e5b'; g.fillRect(x, y + 1, TP, 1); }
    } else if (t === PICS && !flecheDeTour(tx, ty)) {
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
      if (!roche(tx, ty) || plein(tx, ty - 1)) continue;
      if (T.sousLeCiel && abrite(tx, ty)) {            // le sol d'une salle : l'arête claire d'une dalle, pas de créneaux
        g.fillStyle = '#9a9a96'; g.fillRect(tx * TP, ty * TP, TP, 1); g.fillStyle = '#5e5e5b'; g.fillRect(tx * TP, ty * TP + 1, TP, 1);
      } else g.drawImage(c, mod(tx * TP, c.width), 0, TP, c.height, tx * TP, ty * TP - T.sol, TP, c.height);
    }
  }
  // 5. les tours peintes, par-dessus tout le reste du terrain (leur pied de brume couvre le haut des fondations,
  //    leurs saillies couvrent le bout des galeries qui s'y accrochent)
  for (const t of cache.tours) {
    if (!t.pieces) continue;
    const X = t.x0 * TP - t.pieces.coeur;
    if (X < x1 && X + t.pieces.sommet.width > x0) peindreTour(g, T, t);
  }
}
// ---------- herses et leviers ----------
// Une herse de fer forgé ferme un passage ; un levier (feu ou ruée) la fait remonter dans la voûte : un raccourci.
// Peintes si la planche d'objets les fournit (objets/herse, objets/levier), sinon dessinées en pixels ici.
let MOTIF_HERSE = null;
function motifHerse() {                               // une case de grille : barreaux, traverses, rivets
  if (MOTIF_HERSE) return MOTIF_HERSE;
  const c = toile(TP, TP), g = c.getContext('2d');
  for (const x of [1, 6, 11]) { g.fillStyle = '#141414'; g.fillRect(x, 0, 3, TP); g.fillStyle = '#4a4a48'; g.fillRect(x, 0, 1, TP); }
  for (const y of [4, 12]) { g.fillStyle = '#141414'; g.fillRect(0, y, TP, 2); g.fillStyle = '#5c5c59'; g.fillRect(0, y, TP, 1); }
  g.fillStyle = '#8a8a86'; for (const x of [2, 7, 12]) for (const y of [4, 12]) g.fillRect(x, y, 1, 1);
  return (MOTIF_HERSE = c);
}
function dessinerHerse(g) {
  const X = g.x0 * TP, Y = g.y0 * TP, L = (g.x1 - g.x0 + 1) * TP, H = (g.y1 - g.y0 + 1) * TP;
  if (X + L < J.cam - 8 || X > J.cam + J.W + 8 || Y + H < J.camY - 8 || Y > J.camY + J.H + 8) return;
  const u = g.ouverture === null ? 0 : clamp((J.temps - g.ouverture) / MONTEE_HERSE, 0, 1), monte = Math.round(H * u * u * (3 - 2 * u));
  if (monte >= H) { ctx.fillStyle = '#141414'; for (let x = X + 2; x < X + L; x += 5) ctx.fillRect(x, Y, 2, 3); return; }   // pointes rentrées dans la voûte
  ctx.save(); ctx.beginPath(); ctx.rect(X, Y, L, H); ctx.clip();
  const peinte = IMAGES_ART['objets/herse'];
  for (let y = Y - monte; y < Y + H - monte; y += TP) for (let x = X; x < X + L; x += TP) ctx.drawImage(peinte || motifHerse(), x, y);
  ctx.fillStyle = '#141414';                            // les pointes du bas
  for (let x = X + 1; x < X + L; x += 5) { ctx.fillRect(x, Y + H - monte, 3, 2); ctx.fillRect(x + 1, Y + H - monte + 2, 1, 2); }
  ctx.restore();
}
function dessinerLevier(o) {
  const peint = IMAGES_ART['objets/levier'], x = Math.round(o.x), y = o.y;
  if (peint) {                                          // planche de deux images : relevé, abaissé
    const w = peint.width >> 1;
    ctx.drawImage(peint, o.tire ? w : 0, 0, w, peint.height, x - (w >> 1), y - peint.height + 1, w, peint.height);
    return;
  }
  ctx.fillStyle = '#141414'; ctx.fillRect(x - 5, y - 4, 11, 4);                  // le socle
  ctx.fillStyle = '#5c5c59'; ctx.fillRect(x - 5, y - 4, 11, 1);
  const a = o.tire ? 0.9 : -0.9, lx = Math.round(x + Math.sin(a) * 9), ly = Math.round(y - 4 - Math.cos(a) * 9);
  for (let k = 0; k <= 8; k++) { const px = Math.round(x + (lx - x) * k / 8), py = Math.round(y - 4 + (ly - y + 4) * k / 8); ctx.fillStyle = '#2a2a28'; ctx.fillRect(px, py, 2, 1); }
  ctx.fillStyle = o.tire ? '#8a8a86' : FEU[2]; ctx.fillRect(lx - 1, ly - 1, 3, 3);   // la poignée : une braise tant qu'on ne l'a pas tiré
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
    if (o.genre === 'decor') au(J.ACCESSOIRES.ombres[o.type] && !eclairVisible() ? J.ACCESSOIRES.ombres[o.type] : J.ACCESSOIRES[o.type], o.x, o.y + 1);
    else if (o.genre === 'autel') {
      const img = IMAGES_ART['objets/autel'], x = Math.round(o.x), y = o.y;
      au(img, x, y + 1);
      if (o.allume) {                   // la seule lumière chaude du monde : le feu
        const f = Math.sin(J.temps * 12 + x) > 0, h = y - img.height + 4;
        ctx.drawImage(J.HALOS[f ? 1 : 0], x - (J.HALOS[0].width >> 1), h - 8 - (J.HALOS[0].height >> 1));
        flamme(x, h, x);
      }
    } else if (o.genre === 'levier') dessinerLevier(o);
    else if ((o.genre === 'relique' || o.genre === 'coeur') && !o.pris) {
      const y = Math.round(o.y + Math.sin(J.temps * 3 + o.x) * 2);
      if (o.genre === 'coeur') { coeur(Math.round(o.x) - 3, y - 3, true); continue; }
      const img = IMAGES_ART['objets/reliquaire'];
      ctx.drawImage(img, Math.round(o.x - img.width / 2), y - (img.height >> 1));
      if (Math.sin(J.temps * 5 + o.x) > 0.85) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(o.x) + 5, y - 9, 1, 3); ctx.fillRect(Math.round(o.x) + 4, y - 8, 3, 1); }
    }
  }
  for (const g of J.NIV.herses) dessinerHerse(g);
  const s = J.NIV.sortie;
  if (s && porteOuverte() && s.x > J.cam - 60 && s.x < J.cam + J.W + 60) {
    const u = s.revele === undefined ? 1 : clamp((J.temps - s.revele) / 1.2, 0, 1);   // elle monte de la brume
    if (u < 1) ctx.globalAlpha = u;
    au(IMAGES_ART['objets/porte'], s.x, s.y + 1);
    ctx.globalAlpha = 1;
  }
}
