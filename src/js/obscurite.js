import { J } from './etat.js';
import { NIVEAUX } from './config.js';
import { BAYER, ctx } from './ecran.js';
import { TP } from './niveau.js';
import { toile } from './outils.js';

// ================= La pénombre des profondeurs =================
// Un niveau peut s'assombrir en profondeur : NIVEAUX[…].obscurite = { debut, plein, max } (rangées de la carte ;
// max : l'opacité de l'ombre au plus profond, 0 à 1). Au-dessus de « debut », rien ; l'ombre s'épaissit jusqu'à « plein ».
// La lumière y perce des trous tramés, comme le reste du jeu : le dragon (un halo modeste), son feu, les autels
// allumés, les explosions, les crânes ardents, et la lueur faible des âmes, des spectres et des reliques.
const OMBRE = [4, 4, 7];                                   // noir à peine bleuté
const voile = { niv: null, degrade: null, toile: null };
const HALOS = new Map();
function halo(r) {                                         // un disque de lumière tramé : plein au centre, qui s'effiloche au bord
  let t = HALOS.get(r);
  if (t) return t;
  t = toile(r * 2 + 1, r * 2 + 1);
  const g = t.getContext('2d'), img = g.createImageData(t.width, t.height);
  for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) {
    const d = Math.hypot(x - r, y - r) / r;
    if (d < 1 && (1 - d) * 1.7 > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16) img.data[(y * t.width + x) * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  HALOS.set(r, t);
  return t;
}
// l'opacité de l'ombre, rangée de pixels par rangée de pixels, sur toute la hauteur du niveau (une colonne d'un pixel)
function degrade(o) {
  const c = toile(1, J.NIV.hauteur), g = c.getContext('2d'), y0 = o.debut * TP, y1 = Math.max(y0 + 1, o.plein * TP);
  for (let y = y0; y < J.NIV.hauteur; y++) {
    const a = o.max * Math.min(1, (y - y0) / (y1 - y0));
    g.fillStyle = `rgba(${OMBRE[0]},${OMBRE[1]},${OMBRE[2]},${a.toFixed(3)})`;
    g.fillRect(0, y, 1, 1);
  }
  return c;
}
const vacille = (r, graine) => r + Math.round(Math.sin(J.temps * 9 + graine) * 1.5 + Math.sin(J.temps * 23 + graine * 3));   // le feu tremble
function lumieres() {
  const L = [];
  if (J.P && J.P.pv > 0) L.push([J.P.x + J.P.face * 8, J.P.y, 58]);
  for (const b of J.boules) L.push([b.x, b.y, vacille(26, b.x)]);
  for (const p of J.particules) if (p.genre === 'explosion') L.push([p.x, p.y, 40]);
  for (const e of J.ennemis) {
    if (!e.visible || e.alpha < 0.3) continue;
    if (e.type === 'crane') L.push([e.x, e.y, 28]);
    else if (e.type === 'ame' || e.type === 'spectre') L.push([e.x, e.y, 16]);
  }
  for (const o of J.NIV.objets) {
    if (o.genre === 'autel' && o.allume) L.push([o.x, o.y - 18, vacille(70, o.x)]);
    else if (o.genre === 'relique' && !o.pris) L.push([o.x, o.y, 14]);
  }
  if (J.veilleur) L.push([J.veilleur.x, J.veilleur.y, 60]);
  return L;
}
export function dessinerObscurite() {
  const o = NIVEAUX[J.niveauVisuel].obscurite;
  if (!o || !J.NIV || J.etat === 'titre') return;
  if (J.camY + J.H <= o.debut * TP) return;                // tout l'écran est au-dessus de l'ombre
  if (voile.niv !== J.NIV) { voile.niv = J.NIV; voile.degrade = degrade(o); }
  if (!voile.toile || voile.toile.width !== J.W || voile.toile.height !== J.H) voile.toile = toile(J.W, J.H);
  const g = voile.toile.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'copy';
  g.drawImage(voile.degrade, 0, Math.round(J.camY), 1, J.H, 0, 0, J.W, J.H);
  g.globalCompositeOperation = 'destination-out';           // la lumière perce l'ombre
  const cx = Math.round(J.cam), cy = Math.round(J.camY);
  for (const [x, y, r] of lumieres()) {
    if (x + r < J.cam || x - r > J.cam + J.W || y + r < J.camY || y - r > J.camY + J.H) continue;
    g.drawImage(halo(r), Math.round(x) - cx - r, Math.round(y) - cy - r);
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(voile.toile, 0, 0);
}
