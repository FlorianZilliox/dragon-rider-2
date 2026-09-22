import { J } from './etat.js';
import { BRUME, CENDRE, FEU, OS2, SANG, SANG_VIF } from './config.js';
import { disque } from './decor.js';
import { ART } from './donnees.js';
import { ctx } from './ecran.js';
import { TYPES } from './ennemis.js';
import { SPR } from './ennemis-sprites.js';
import { clamp, rand, toile } from './outils.js';
import { particule } from './partie.js';
import { auPixel } from './terrain.js';
import { texte } from './texte.js';
import { imagePlanche } from './titre.js';

// ---------- dessin des ennemis, du Veilleur et des effets (coordonnées du monde) ----------
export const COEUR = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const COEURS = {};                                // les deux cœurs (plein, vide), peints une fois
function peindreCoeur(plein) {
  const t = toile(9, 8), g = t.getContext('2d');   // 7×6 et un pixel de contour tout autour
  g.fillStyle = '#060606';
  COEUR.forEach((l, r) => [...l].forEach((c, k) => { if (c === 'X') { g.fillRect(k, r + 1, 3, 1); g.fillRect(k + 1, r, 1, 3); } }));
  COEUR.forEach((l, r) => [...l].forEach((c, k) => {
    if (c !== 'X') return;
    g.fillStyle = plein ? (r === 1 && k < 3 ? '#ffffff' : r > 3 ? '#b9b8b3' : '#e6e5e0') : '#2a2a29';
    g.fillRect(k + 1, r + 1, 1, 1);
  }));
  return t;
}
export function coeur(x, y, plein) {            // blanc d'os cerclé de noir (vide : un creux sombre)
  const k = plein ? 'plein' : 'vide';
  ctx.drawImage(COEURS[k] || (COEURS[k] = peindreCoeur(plein)), x - 1, y - 1);
}

export function dessinerEnnemis() {
  for (const c of J.coeurs) if (c.t < 7 || Math.floor(J.temps * 12) % 2) coeur(Math.round(c.x) - 3, Math.round(c.y + Math.sin(c.t * 4) * 2) - 3, true);
  for (const e of J.ennemis) {
    const S = SPR[TYPES[e.type].sprite], im = S.images[e.image % S.images.length], img = e.flash > 0 ? im.b : im.n;
    if (e.alpha <= 0.02) continue;
    ctx.globalAlpha = e.alpha;
    ctx.save(); ctx.translate(auPixel(e.x, J.cam), auPixel(e.y, J.camY));
    if ((e.face < 0) === S.droite) ctx.scale(-1, 1);          // la planche regarde d'un côté : on la retourne au besoin
    if (e.type === 'ame' || e.type === 'spectre') ctx.rotate((e.type === 'spectre' ? 0.035 : 0.07) * Math.sin(e.t * 1.4 + e.ph));   // les spectres se balancent
    if (e.tilt) ctx.rotate(e.tilt);
    ctx.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2));
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  const v = J.veilleur;
  if (v) {
    const x = Math.round(v.x), y = Math.round(v.y);
    if (!(v.mort >= 0 && Math.floor(J.temps * 20) % 2)) {
      if (Math.random() < 0.5) particule({ x: v.x + rand(-24, 24), y: v.y + rand(-10, 20), vx: rand(-5, 5), vy: rand(-30, -12), vie: 0.8, max: 0.8, t: 1, genre: 'ecto' });
      const blanc = v.flash > 0;
      const M = blanc ? J.MACHOIRE_IMG.b : J.MACHOIRE_IMG.n, S = blanc ? J.VEILLEUR_IMG.b : J.VEILLEUR_IMG.n;
      const haut = y - (S.height >> 1);
      ctx.drawImage(M, x - (M.width >> 1), haut + S.height - 12 + Math.round(v.machoire * 10));
      ctx.drawImage(S, x - (S.width >> 1), haut);
      const lueur = 0.5 + 0.5 * Math.sin(J.temps * 7), oy = haut + Math.round(S.height * 0.55);   // deux braises au fond des orbites
      for (const ex of [-0.21, 0.21]) { const ox = x + Math.round(S.width * ex); disque(ox, oy, 3, SANG); disque(ox, oy, 2, SANG_VIF); ctx.fillStyle = lueur > 0.5 ? '#ffb09a' : '#ff6a3a'; ctx.fillRect(ox, oy, 1, 1); }
    }
  }
}
export function dessinerEffets() {
  for (const b of J.boules) {                       // la boule de feu peinte, tournée dans le sens de sa course
    const sens = b.vx < 0 ? -1 : 1;
    imagePlanche('feu/boule-feu', Math.floor(J.temps * 16 + b.x * 0.01), b.x - sens * 6, b.y, sens, 'centre', Math.atan2(b.vy, Math.abs(b.vx)) * sens);
  }
  for (const o of J.orbes) imagePlanche('sang/orbe', Math.floor(J.temps * 10 + o.x * 0.05), o.x, o.y);
  for (const p of J.particules) {
    const x = Math.round(p.x), y = Math.round(p.y), k = clamp(p.vie / p.max, 0, 1);
    if (p.genre === 'explosion') { imagePlanche('feu/explosion', Math.floor((1 - k) * ART['feu/explosion'].images), x, y); continue; }
    if (p.genre === 'braise') { ctx.fillStyle = FEU[Math.min(6, Math.floor((1 - k) * 7))]; ctx.fillRect(x, y, p.t, p.t); }
    else if (p.genre === 'plume' || p.genre === 'os') {
      ctx.fillStyle = p.genre === 'os' ? (k > 0.3 ? OS2 : CENDRE) : (k > 0.3 ? '#333333' : '#4d4d4d');
      const l = Math.cos(p.rot) > 0 ? 3 : 1;
      ctx.fillRect(x - l, y, l * 2, 1); ctx.fillRect(x, y - 1, 1, 1);
    } else if (p.genre === 'gravat') { ctx.fillStyle = k > 0.4 ? '#333333' : '#202020'; ctx.fillRect(x, y, Math.cos(p.rot) > 0 ? 2 : 1, 2); }
    else if (p.genre === 'fumee') {           // la bouffée peinte de la poussière, qui grossit et pâlit en montant
      ctx.globalAlpha = 0.25 + 0.55 * k;
      imagePlanche('objets/poussiere', Math.min(3, Math.floor((1 - k) * 4)), x, y, p.t, 'centre');
      ctx.globalAlpha = 1;
    }
    else if (p.genre === 'ecto') { ctx.fillStyle = k > 0.5 ? BRUME : '#3a3a3a'; ctx.fillRect(x, y, 1, 1); }
    else if (p.genre === 'poussiere') imagePlanche('objets/poussiere', Math.min(3, Math.floor((1 - k) * 4)), x, y + 1, p.t, 'bas');
    else if (p.genre === 'eclair') disque(x, y, 9, '#ffffff');
    else if (p.genre === 'bouche') { disque(x, y, 5, FEU[3]); disque(x, y, 3, FEU[1]); disque(x, y, 1, FEU[0]); }
    else if (p.genre === 'onde') {
      const r = Math.round(4 + (1 - k) * 16);
      ctx.fillStyle = k > 0.5 ? FEU[0] : FEU[2];
      for (let a = 0; a < 6.28; a += 1 / r) ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
  }
  for (const p of J.popups) if (p.vie > 0.25 || Math.floor(J.temps * 20) % 2) texte(p.txt, Math.round(p.x), Math.round(p.y), p.teinte, p.k, 'ombre', 'centre');
}
