import { J } from './etat.js';
import { BRUME, CENDRE, ENCRE, OS, OS2, PV_MAX, RUEE_COUT, SANG_VIF } from './config.js';
import { IMAGES_ART } from './decor.js';
import { ctx } from './ecran.js';
import { clamp, pad } from './outils.js';
import { voileCarte } from './partie.js';
import { coeur } from './rendu-monde.js';
import { texte } from './texte.js';

// ================= Interface (dessinée dans l'image, en police pixel) =================
export function hautParleur(x, y) {
  ctx.fillStyle = OS;
  ctx.fillRect(x, y + 2, 2, 3); ctx.fillRect(x + 2, y + 1, 1, 5); ctx.fillRect(x + 3, y, 1, 7);
  if (J.muet) { ctx.fillStyle = SANG_VIF; for (let i = 0; i < 5; i++) { ctx.fillRect(x + 5 + i, y + 1 + i, 1, 1); ctx.fillRect(x + 9 - i, y + 1 + i, 1, 1); } }
  else { ctx.fillRect(x + 5, y + 2, 1, 3); ctx.fillRect(x + 7, y + 1, 1, 5); }
}
export function barre(x, y, w, f, c) {
  ctx.fillStyle = ENCRE; ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = '#292929'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = c; ctx.fillRect(x, y, Math.round(w * clamp(f, 0, 1)), 3);
}
export function hud() {
  // à gauche : cœurs, souffle, « 2-1 » (acte II, niveau 1) ; à droite : score et son. Chaque côté s'écarte de l'encoche du téléphone.
  ctx.save(); ctx.translate(J.bordG, 0);
  for (let i = 0; i < PV_MAX; i++) coeur(6 + i * 9, 6, i < J.P.pv);
  // le souffle, sous les cœurs : il pâlit quand il s'épuise, clignote quand il est vide
  const s = J.P.souffle, vide = s <= 0.02;
  if ((!vide && J.P.refus <= 0) || Math.floor(J.temps * 12) % 2) barre(6, 15, 43, s, s < RUEE_COUT ? SANG_VIF : '#9a9a96');
  ctx.fillStyle = J.P.rueeDispo ? OS : '#2a2a29'; ctx.fillRect(52, 15, 3, 3);   // le témoin de la ruée
  if (!J.arene) {
    texte(J.acte + '-' + (J.niveau + 1), 6, 22, BRUME);
    barre(6, 32, 52, J.P.x / J.NIV.largeur, CENDRE);
    if (J.NIV.reliques) {                                    // reliquaire : petite croix et compte
      ctx.fillStyle = ENCRE; ctx.fillRect(63, 28, 5, 9); ctx.fillRect(61, 30, 9, 3);
      ctx.fillStyle = J.NIV.prises ? '#e0c080' : OS2; ctx.fillRect(64, 29, 3, 7); ctx.fillRect(62, 31, 7, 1);
      texte(J.NIV.prises + '/' + J.NIV.reliques, 72, 29, J.NIV.prises === J.NIV.reliques ? '#e0c080' : OS2);
    }
  }
  ctx.restore();
  const d = J.W - 6 - J.bordD;
  texte('SCORE ' + pad(J.score, 6), d, 6, OS, 1, 'ombre', 'droite');
  texte('RECORD ' + pad(J.record, 6), d, 16, BRUME, 1, 'ombre', 'droite');
  hautParleur(d - 10, 26);
  if (J.veilleur && J.veilleur.entree > 0.6 && J.veilleur.mort < 0) {
    texte('LE VEILLEUR', J.W / 2, 6, OS, 1, 'ombre', 'centre');
    barre(Math.round(J.W / 2) - 60, 16, 120, J.veilleur.pv / J.veilleur.pvMax, SANG_VIF);
  }
}
export function dessinerCarte() {
  if (!J.carte) return;
  const a = voileCarte(J.carte);
  if (a > 0) { ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = ENCRE; ctx.fillRect(0, 0, J.W, J.H); ctx.globalAlpha = 1; }
  const visible = J.carte.fondu ? J.carte.t > 0.7 && J.carte.t < 3.4 : J.carte.t < 2.7;
  if (!visible) return;
  // l'inscription gothique du niveau (ou du Veilleur), « A C T E  I  ·  N I V E A U  1 » au-dessus, la devise dessous
  const plaque = IMAGES_ART[J.carte.plaque], espace = (t) => t.split('').join(' ');
  const py = Math.round(J.H * 0.44 - plaque.height / 2);
  if (J.carte.fondu) texte(espace(J.carte.titre), J.W / 2, py - 12, BRUME, 1, 'ombre', 'centre');
  ctx.drawImage(plaque, Math.round(J.W / 2 - plaque.width / 2), py);
  texte(J.carte.sous, J.W / 2, py + plaque.height + 7, OS2, 1, 'ombre', 'centre');
}
