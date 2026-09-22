import { J } from './etat.js';
import { approche, clamp } from './outils.js';

// ================= Caméra : suit le dragon dans les deux directions, se fige dans l'arène =================
export function suivreCamera(dt) {
  if (J.arene && J.NIV.arene) { J.cam = approche(J.cam, J.NIV.arene.x, dt * 3); J.camY = approche(J.camY, J.NIV.arene.y, dt * 3); return; }
  J.cam = clamp(approche(J.cam, J.P.x - J.W * 0.38 + J.P.face * J.W * 0.08, dt * 3), 0, Math.max(0, J.NIV.largeur - J.W));
  let cible;
  if (J.etat === 'titre') cible = J.NIV.depart[1] - J.SOL;
  else if (J.P.mode === 'ground' || J.P.mode === 'land' || J.P.mode === 'dead') cible = J.P.sol - J.SOL;   // au sol : le sol à sa place habituelle
  else {                                   // en vol : elle regarde un peu au-dessus quand il monte vite (une colonne),
    J.regard = approche(J.regard || 0, clamp(J.P.vy * 0.4, -64, 0), dt * 1.5);   // en montée seulement ; ce regard glisse, sans à-coup
    const y = J.P.y + J.regard;
    cible = clamp(J.camY, y - J.H * 0.74, y - J.H * 0.3);
  }
  if (J.P.mode !== 'air' && J.P.mode !== 'fall') J.regard = approche(J.regard || 0, 0, dt * 1.5);
  J.camY = clamp(approche(J.camY, cible, dt * 4), 0, Math.max(0, J.NIV.hauteur - J.H));
}
