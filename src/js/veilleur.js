import { J } from './etat.js';
import { blesser } from './dragon.js';
import { creerEnnemi, noterRecord } from './ennemis.js';
import { solSous } from './niveau.js';
import { approche, clamp, rand } from './outils.js';
import { explosion, popup } from './partie.js';
import { sfx } from './son.js';

// ---------- le Veilleur, au fond des cryptes ----------
export function entrerArene() {
  J.arene = true; J.ennemis = [];
  const V_ = J.NIV.veilleur, sol = solSous(V_.x, V_.y) ?? J.NIV.hauteur;
  const y = clamp(sol - J.SOL, 0, Math.max(0, J.NIV.hauteur - J.H));
  J.NIV.arene = { x: Math.round(V_.x - J.W * 0.74), y, sol, haut: y + 48 };
  J.veilleur = { x: V_.x, y: sol + 70, pv: 22, pvMax: 22, t: 0, entree: 0, tir: 3, invoc: 9, flash: 0, machoire: 0, mort: -1, boum: 0 };
  J.carte = { titre: 'LE VEILLEUR', nom: '', plaque: 'inscriptions/veilleur', sous: "IL N'A JAMAIS DORMI.", t: 0, fondu: false };
  sfx('veilleur');
}
export function eventail(v, n, ecart) {
  const bx = v.x - 6, by = v.y + 18, a0 = Math.atan2(J.P.y - by, J.P.x - bx);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * ecart / (n - 1);
    J.orbes.push({ x: bx, y: by, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, vie: 8 });
  }
  sfx('orbe');
}
export function blesserVeilleur(v, n) {
  if (v.mort >= 0 || v.entree < 2) return;
  v.pv -= n; v.flash = 0.08; sfx('touche');
  if (v.pv <= 0) {
    v.mort = 0; J.orbes = []; J.secousse = 0.6; sfx('veilleur');
    J.ennemis.forEach((e) => explosion(e.x, e.y, true)); J.ennemis = [];
    J.score += 5000 * J.acte; popup('+' + 5000 * J.acte, v.x, v.y - 40, '#e0c080', 2);
    noterRecord();
  }
}
export function majVeilleur(dt) {
  const v = J.veilleur;
  if (!v) return;
  v.t += dt; v.flash -= dt;
  const A = J.NIV.arene, haut = A.haut + 16, bas = A.sol - 64, milieu = (haut + bas) / 2;
  if (v.mort >= 0) {
    v.mort += dt; v.boum -= dt; v.y += 10 * dt;
    if (v.boum <= 0) { v.boum = 0.12; explosion(v.x + rand(-26, 26), v.y + rand(-22, 26), true); J.secousse = 0.3; }
    if (v.mort > 2.6) { J.etat = 'epilogue'; J.epiT = 0; J.veilleur = null; }
    return;
  }
  if (v.entree < 2) { v.entree += dt; v.y = approche(v.y, milieu, dt * 1.6); v.machoire = v.entree < 1.6 ? 0.5 + 0.5 * Math.sin(v.t * 9) : 0; return; }
  const rage = v.pv < v.pvMax / 2, diff = 1 + (J.acte - 1) * 0.2;
  v.x = A.x + J.W * (0.74 + 0.07 * Math.sin(v.t * 0.55));
  v.y = milieu + Math.sin(v.t * (rage ? 1.05 : 0.75)) * (bas - haut) * 0.45;
  v.tir -= dt * diff; v.invoc -= dt;
  v.machoire = approche(v.machoire, v.tir < 0.35 ? 1 : 0, dt * 10);
  if (v.tir <= 0) { v.tir = rage ? 2.5 : 3.2; eventail(v, rage ? 6 : 5, rage ? 1.1 : 0.9); }
  if (v.invoc <= 0) {
    v.invoc = rage ? 8 : 10;
    if (J.ennemis.length < 4) for (const k of [-1, 1]) J.ennemis.push(Object.assign(creerEnnemi('chauve', v.x - 10, v.y + k * 18, -1, 1), { etat: 'vole', y: v.y + k * 18 }));
  }
  const d = Math.hypot(J.P.x - v.x, J.P.y + 4 - v.y);
  if (d < 28 && J.P.pv > 0) {
    if (J.P.ruee >= 0) { blesserVeilleur(v, 2); J.P.ruee = -1; J.P.vx = -J.P.face * 250; J.P.inv = Math.max(J.P.inv, 0.6); }
    else blesser(v.x);
  }
}
