import { J } from './etat.js';

// ================= Écran : basse résolution, agrandie en pixels nets =================
export const cvs = document.getElementById('ecran');
export const ctx = cvs.getContext('2d');
export const jeu = document.getElementById('jeu');
J.W = 400; J.H = 224; J.SOL = 200; J.ECHELLE = 3;   // SOL : ligne du sol à l'écran quand le dragon est posé
export function disposer() {
  const vw = innerWidth, vh = innerHeight;
  const portrait = vh > vw * 1.05;
  jeu.className = portrait ? 'portrait' : 'paysage';
  const zoneH = portrait ? Math.min(Math.round(vw * 0.82), vh - 250) : vh;
  J.ECHELLE = Math.max(1, Math.round(zoneH / 232));
  J.H = Math.floor(zoneH / J.ECHELLE);
  J.W = Math.min(560, Math.floor(vw / J.ECHELLE));
  cvs.width = J.W; cvs.height = J.H;
  cvs.style.width = J.W * J.ECHELLE + 'px'; cvs.style.height = J.H * J.ECHELLE + 'px';
  ctx.imageSmoothingEnabled = false;
  J.SOL = J.H - 24;
}
addEventListener('resize', disposer);
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
