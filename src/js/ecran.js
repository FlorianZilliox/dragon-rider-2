import { J } from './etat.js';

// ================= Écran : basse résolution, agrandie en pixels nets =================
// Le jeu se joue en paysage. L'image fait environ 232 pixels de haut ; chaque pixel du jeu couvre un nombre
// ENTIER de pixels physiques de l'écran (5 × 5 sur un iPhone, 4 × 4 sur beaucoup d'Android) : des pixels
// tous égaux, même quand l'agrandissement en pixels CSS n'est pas entier.
export const cvs = document.getElementById('ecran');
export const ctx = cvs.getContext('2d', { alpha: false });
export const jeu = document.getElementById('jeu');
J.W = 400; J.H = 224; J.SOL = 200; J.ECHELLE = 3;   // SOL : ligne du sol à l'écran quand le dragon est posé
J.bordG = 0; J.bordD = 0;                           // encoche et coins arrondis (en pixels du jeu) : l'interface s'en écarte
const HAUTEUR_VISEE = 232, LARGEUR_MAX = 560;
const sonde = document.createElement('div');        // lit env(safe-area-inset-*) tel que le navigateur le calcule
sonde.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
document.body.appendChild(sonde);

export function disposer() {
  const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const parPixel = Math.max(1, Math.round(vh * dpr / HAUTEUR_VISEE));   // pixels physiques par pixel du jeu
  J.ECHELLE = parPixel / dpr;
  J.H = Math.floor(vh * dpr / parPixel);
  J.W = Math.min(LARGEUR_MAX, Math.floor(vw * dpr / parPixel));
  if (cvs.width !== J.W || cvs.height !== J.H) { cvs.width = J.W; cvs.height = J.H; }
  // taille et position calées sur la grille des pixels physiques
  const l = J.W * parPixel / dpr, h = J.H * parPixel / dpr;
  Object.assign(cvs.style, {
    width: l + 'px', height: h + 'px',
    left: Math.round((vw - l) / 2 * dpr) / dpr + 'px', top: Math.round((vh - h) / 2 * dpr) / dpr + 'px',
  });
  ctx.imageSmoothingEnabled = false;
  J.SOL = J.H - 24;
  const cs = getComputedStyle(sonde), marge = Math.max(0, (vw - l) / 2);
  J.bordG = Math.max(0, Math.ceil((parseFloat(cs.paddingLeft) - marge) / J.ECHELLE));
  J.bordD = Math.max(0, Math.ceil((parseFloat(cs.paddingRight) - marge) / J.ECHELLE));
}
addEventListener('resize', disposer);
window.visualViewport?.addEventListener('resize', disposer);
screen.orientation?.addEventListener?.('change', disposer);
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
