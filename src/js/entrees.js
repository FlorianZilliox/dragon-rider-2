import { J } from './etat.js';
import { cvs, jeu } from './ecran.js';
import { reveillerSon } from './son.js';
import { MENU, menuY } from './titre.js';

// ================= Entrées : clavier, et manette tactile (les lettres des boutons sont les touches du clavier) =================
export const clavier = {}, boutons = {};
export const tenu = (k) => !!(clavier[k] || boutons[k]);
J.appuis = new Set(); J.gestes = new Set();
export const dernierAppui = {};
// un appui neuf ; au clavier, deux appuis rapides sur ← ou → lancent une ruée (au tactile : le bouton C)
export function appui(k, doubleTape = true) {
  reveillerSon();
  if (J.pause) { J.pause = false; return; }          // l'appui qui sort de la pause ne compte pas dans le jeu
  const t = performance.now();
  if (doubleTape && (k === 'left' || k === 'right') && t - (dernierAppui[k] || -1e9) < 260) { J.gestes.add('ruee-' + k); dernierAppui[k] = -1e9; }
  else dernierAppui[k] = t;
  J.appuis.add(k);
}
// une petite vibration (téléphones Android ; ailleurs, rien)
export function vibrer(ms) { if (tactile && navigator.vibrate) try { navigator.vibrate(ms); } catch {} }

export const TOUCHES = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  q: 'left', a: 'left', d: 'right', z: 'up', w: 'up', s: 'down',
  x: 'fire', ' ': 'fire', Spacebar: 'fire', Enter: 'fire', c: 'ruee',
};
J.reperes = false;
addEventListener('keydown', (e) => {
  const t = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (t === 'i') { if (!e.repeat) J.reperes = !J.reperes; return; }
  if (t === 'm') { if (!e.repeat) basculerSon(); return; }
  if ((t === 'p' || t === 'Escape') && !e.repeat) { J.pause = !J.pause && J.etat === 'jeu'; return; }
  const k = TOUCHES[t];
  if (!k) return;
  e.preventDefault();
  if (!e.repeat) appui(k);
  clavier[k] = true;
});
addEventListener('keyup', (e) => { const t = e.key.length === 1 ? e.key.toLowerCase() : e.key; const k = TOUCHES[t]; if (k) clavier[k] = false; });
export function relacher() { for (const k in clavier) clavier[k] = false; for (const k in boutons) boutons[k] = 0; croix.fin(); actions.fin(); }
addEventListener('blur', relacher);

// ---------- manette tactile ----------
// Une seule zone par main, suivie au glissé : le pouce passe d'une direction à l'autre (et d'un bouton à l'autre)
// sans se lever, comme sur une vraie croix. Chaque doigt est suivi à part (plusieurs doigts à la fois).
let tactile = matchMedia('(pointer: coarse)').matches;
const montrerManette = () => jeu.classList.toggle('tactile', tactile);
montrerManette();

// la croix : 8 directions autour du centre, une zone morte au milieu
const DIRECTIONS = ['left', 'right', 'up', 'down'];
const croix = (() => {
  const zone = document.getElementById('croix'), bras = {};
  DIRECTIONS.forEach((k) => { bras[k] = zone.querySelector(`[data-dir="${k}"]`); });
  let doigt = null, actives = new Set(), r = null;   // r : la croix à l'écran, mesurée quand le doigt se pose
  const poser = (nouvelles) => {
    for (const k of DIRECTIONS) {
      const avant = actives.has(k), apres = nouvelles.has(k);
      if (apres && !avant) appui(k, false);
      boutons[k] = apres ? 1 : 0;
      bras[k].classList.toggle('on', apres);
    }
    actives = nouvelles;
  };
  const lire = (e) => {
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy);
    const s = new Set();
    if (d > r.width * 0.12) {                       // zone morte : le pouce au repos au centre ne pousse rien
      const c = dx / d, n = dy / d, SEUIL = 0.383;  // cos 67,5° : huit secteurs de 45°
      if (c < -SEUIL) s.add('left'); if (c > SEUIL) s.add('right');
      if (n < -SEUIL) s.add('up'); if (n > SEUIL) s.add('down');
    }
    poser(s);
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (doigt !== null) return;
    doigt = e.pointerId; zone.setPointerCapture(e.pointerId);
    r = zone.querySelector('.croix-dessin').getBoundingClientRect();
    lire(e);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === doigt) lire(e); });
  const lever = (e) => { if (e.pointerId === doigt) api.fin(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => zone.addEventListener(t, lever));
  const api = { fin() { doigt = null; poser(new Set()); } };
  return api;
})();

// les boutons : le plus proche du doigt, dans un rayon généreux ; glisser de l'un à l'autre change de bouton
const actions = (() => {
  const zone = document.getElementById('actions'), liste = [...zone.querySelectorAll('[data-k]')];
  const doigts = new Map();                         // pointerId → bouton tenu (ou null)
  let centres = [];                                 // les boutons à l'écran, mesurés quand un doigt se pose
  const compter = () => {
    for (const b of liste) {
      let n = 0;
      for (const v of doigts.values()) if (v === b) n++;
      boutons[b.dataset.k] = n;
      b.classList.toggle('on', n > 0);
    }
  };
  const viser = (e) => {
    let meilleur = null, dmin = Infinity;
    for (const { b, x, y, rayon } of centres) {
      const d = Math.hypot(e.clientX - x, e.clientY - y);
      if (d < rayon && d < dmin) { dmin = d; meilleur = b; }
    }
    return meilleur;
  };
  const suivre = (e) => {
    const b = viser(e), avant = doigts.get(e.pointerId);
    if (b !== avant) {
      doigts.set(e.pointerId, b);
      if (b) { appui(b.dataset.k, false); vibrer(8); }
      compter();
    }
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault(); zone.setPointerCapture(e.pointerId);
    centres = liste.map((b) => { const r = b.getBoundingClientRect(); return { b, x: r.left + r.width / 2, y: r.top + r.height / 2, rayon: r.width * 0.95 }; });
    doigts.set(e.pointerId, null); suivre(e);
  });
  zone.addEventListener('pointermove', (e) => { if (doigts.has(e.pointerId)) suivre(e); });
  const lever = (e) => { if (doigts.delete(e.pointerId)) compter(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => zone.addEventListener(t, lever));
  zone.addEventListener('contextmenu', (e) => e.preventDefault());
  return { fin() { doigts.clear(); compter(); } };
})();

// iOS : ni loupe, ni sélection, ni zoom au double-tap ou au pincement pendant qu'on joue
jeu.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
jeu.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
jeu.addEventListener('contextmenu', (e) => e.preventDefault());
// le son ne peut démarrer que sur un geste qui compte pour le navigateur : au tactile, c'est le doigt qui se lève
addEventListener('pointerup', reveillerSon, true);
addEventListener('touchend', reveillerSon, true);
addEventListener('pointerdown', (e) => {                  // un doigt sur l'écran : la manette apparaît (et reste)
  if (e.pointerType === 'touch' && !tactile) { tactile = true; montrerManette(); }
}, true);

export function basculerSon() {
  J.muet = !J.muet;
  try { localStorage.setItem('dragon-rider-muet', J.muet ? '1' : '0'); } catch {}
}
cvs.addEventListener('pointerdown', (e) => {
  reveillerSon();
  const r = cvs.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * J.W, y = (e.clientY - r.top) / r.height * J.H;
  if (x > J.W - 22 - J.bordD && y > 20 && y < 38) basculerSon();
  else if (J.pause) J.pause = false;
  else {
    if (J.etat === 'titre' && J.pageTitre === 'menu') MENU.forEach((m, i) => { if (Math.abs(y - menuY(i) - 7) < 10) J.choix = i; });   // toucher une entrée la choisit
    if (J.etat !== 'jeu') appui('fire');
  }
});
