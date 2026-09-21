import { J } from './etat.js';
import { cvs } from './ecran.js';
import { reveillerSon } from './son.js';
import { MENU, menuY } from './titre.js';

// ================= Entrées : les lettres affichées sur les boutons sont les touches du clavier =================
export const clavier = {}, boutons = {};
export const tenu = (k) => !!(clavier[k] || boutons[k]);
J.appuis = new Set(); J.gestes = new Set();
export const dernierAppui = {};
export function appui(k) {
  reveillerSon();
  const t = performance.now();
  if ((k === 'left' || k === 'right') && t - (dernierAppui[k] || -1e9) < 260) { J.gestes.add('ruee-' + k); dernierAppui[k] = -1e9; }
  else dernierAppui[k] = t;
  J.appuis.add(k);
}
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
  const k = TOUCHES[t];
  if (!k) return;
  e.preventDefault();
  if (!e.repeat) appui(k);
  clavier[k] = true;
});
addEventListener('keyup', (e) => { const t = e.key.length === 1 ? e.key.toLowerCase() : e.key; const k = TOUCHES[t]; if (k) clavier[k] = false; });
addEventListener('blur', () => { for (const k in clavier) clavier[k] = false; for (const k in boutons) boutons[k] = 0; });
document.querySelectorAll('[data-k]').forEach((b) => {
  const k = b.dataset.k, actifs = new Set();
  const maj = () => { boutons[k] = actifs.size; b.classList.toggle('on', actifs.size > 0); };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); appui(k); actifs.add(e.pointerId); maj(); });
  const fin = (e) => { actifs.delete(e.pointerId); maj(); };
  b.addEventListener('pointerup', fin); b.addEventListener('pointercancel', fin); b.addEventListener('lostpointercapture', fin);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
export function basculerSon() {
  J.muet = !J.muet;
  try { localStorage.setItem('dragon-rider-muet', J.muet ? '1' : '0'); } catch {}
}
cvs.addEventListener('pointerdown', (e) => {
  reveillerSon();
  const r = cvs.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * J.W, y = (e.clientY - r.top) / r.height * J.H;
  if (x > J.W - 22 && y > 20 && y < 38) basculerSon();
  else {
    if (J.etat === 'titre' && J.pageTitre === 'menu') MENU.forEach((m, i) => { if (Math.abs(y - menuY(i) - 7) < 10) J.choix = i; });   // toucher une entrée la choisit
    if (J.etat !== 'jeu') appui('fire');
  }
});
