import { PIXEL } from './donnees.js';
import { clamp, romain } from './outils.js';

// ================= Constantes =================
export const POSES = PIXEL.poses;                        // la pose en vol, découpée en pièces
export const PL_META = PIXEL.planche, AN = PL_META.animations;   // toutes les images du modèle, redessinées
export const FW = PL_META.frameWidth, FH = PL_META.frameHeight;
export const AX = PL_META.anchor.x, AY = PL_META.anchor.y;
export const G = PL_META.groundOffset;                   // du corps au bout des pattes, au sol
export const BOUCHE = PL_META.mouth;
export const FPS = { attack: 16, jump: 14, land: 16, dead: 6, walk: 12 };
export const PV_MAX = 5;
export const V = { AIR: 170, VERT: 118, PIQUE: 215, MARCHE: 85, COURSE: 150, SAUT: 270, RUEE: 430, BOULE: 390 };
export const LOIN = { dx: 2.5, dy: -1.5, sx: 0.95, s: 0.92 };   // l'aile opposée, derrière le corps
export const DESCENTE = 0.45, S_BAS = -0.8;             // profil du battement (voir outils/animer_ailes.py)
export const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

// palette gothique : nuit violette, os, cendre, sang. Le feu est la seule lumière chaude.
export const ENCRE = '#070707', OS = '#d1d1d1', OS2 = '#a0a0a0', CENDRE = '#606060', BRUME = '#818181';
export const SANG = '#7a1c26', SANG_VIF = '#b8323a';
export const LOGO = ['#f4f3ee', '#e2e1dc', '#c9c8c3', '#abaaa5', '#8c8b87', '#6e6d69', '#4f4e4b'];
export const FEU = ['#f4f4f4', '#ffd9a0', '#f0a050', '#e0702e', '#b8323a', '#7a1c26', '#262626'];

// l'histoire : des actes vers la droite, puis le Veilleur au fond du dernier. C'est la seule liste des actes :
// cle nomme la carte (niveaux/<cle>.txt), les plans du décor (PLANS) et la roche (TERRAIN) de l'acte.
export const ACTES = [
  { cle: 'terres', nom: 'LES TERRES DÉCHARNÉES', sous: "RIEN NE POUSSE PLUS. RIEN N'ATTEND.", plaque: 'inscriptions/terres' },
  { cle: 'cimetiere', nom: 'LE CIMETIÈRE DES ROIS', sous: 'ILS ONT RÉGNÉ. IL RESTE LEURS NOMS.', plaque: 'inscriptions/cimetiere' },
  { cle: 'tours', nom: 'LES TOURS FOUDROYÉES', sous: 'LE CIEL EST TOUT PRÈS. LE SOL, NULLE PART.', plaque: 'inscriptions/tours' },
  { cle: 'cryptes', nom: 'LES CRYPTES', sous: 'EN BAS, QUELQUE CHOSE VEILLE ENCORE.', plaque: 'inscriptions/cryptes' },
].map((a, i) => ({ ...a, num: romain(i + 1) }));
// la difficulté monte d'acte en acte, puis de cycle en cycle (rang 0 : acte I du premier cycle)
export const DIFFICULTE = {
  vivacite: (r) => 1 + Math.min(0.6, r * 0.07),                   // vitesse et réflexes des ennemis
  renfort: (r) => Math.min(0.6, r * 0.14),                        // part des ennemis de la carte qui viennent accompagnés
  coriace: (r) => Math.min(0.55, r * 0.14),                       // part des ennemis d'un coup qui en demandent deux
  cuirasse: (r) => Math.min(0.4, Math.max(0, r - ACTES.length + 1) * 0.1),   // au cycle suivant : deux coups → trois
};
// le souffle du dragon (1 = plein) : ce que coûte une seconde de vol, ce que rendent le sol et les courants
export const SOUFFLE = { montee: 1 / 3.5, palier: 1 / 7, courant: 1.4, sol: 1.2, epuise: 42 };
export const RUEE_COUT = 0.25;                   // une ruée coûte un quart du souffle
export const EPILOGUE = ["LE VEILLEUR S'EST TU.", "AU FOND DE LA CRYPTE, IL N'Y AVAIT RIEN.",
                  'NI TRÉSOR, NI RÉPONSE. SEULEMENT LA NUIT.', 'LE DRAGONNIER REPRIT SON VOL.'];
// raccourcis d'entraînement : #calme (sans ennemis), #acte=2, #acte=3…, #veilleur ; #essai expose des aides de test
export const CALME = /calme/.test(location.hash), ESSAI = /essai/.test(location.hash), VEILLEUR = /veilleur/.test(location.hash);
export const DEPART = VEILLEUR ? ACTES.length - 1 : clamp((+((/acte=(\d+)/.exec(location.hash) || [])[1]) || 1) - 1, 0, ACTES.length - 1);
