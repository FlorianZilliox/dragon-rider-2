import { J } from './etat.js';

// ================= Démo de l'écran titre : le dragon patrouille au-dessus du premier gouffre =================
J.demoAvant = 0; J.demoDir = 1;
export function entreesDemo() {
  if (J.P.x > 600) J.demoDir = -1; else if (J.P.x < 140) J.demoDir = 1;
  const E = { L: J.demoDir < 0, R: J.demoDir > 0, U: false, D: false, feu: false, appuis: new Set(), gestes: new Set() };
  const c0 = J.demoAvant % 7, c1 = J.temps % 7;
  J.demoAvant = J.temps;
  const passe = (t) => c0 < t && c1 >= t;
  const ys = J.P.y - J.camY;                                   // altitude à l'écran, sous le titre
  E.U = ys > 128 || (c1 > 1 && c1 < 1.6);
  E.D = ys < 88 && !E.U;
  if (passe(0.5) || passe(2.2) || passe(4.6) || passe(6.3)) E.appuis.add('fire');
  if (passe(5.5)) E.appuis.add('ruee');
  return E;
}
