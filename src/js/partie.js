import { J } from './etat.js';
import { ACTE_DEPART, AN, DEPART, G, NIVEAUX, OS, PV_MAX, SALLE, VEILLEUR } from './config.js';
import { BAS, HAUT, LARG, lireNiveau, porteOuverte, solSous } from './niveau.js';
import { clamp, rand, romain } from './outils.js';
import { sfx } from './son.js';
import { entrerArene } from './veilleur.js';
import { durcir } from './ennemis.js';

// ================= État du jeu =================
J.etat = 'titre'; J.P = null; J.ennemis = []; J.boules = []; J.orbes = []; J.coeurs = []; J.particules = []; J.popups = []; J.ombres = [];
J.cam = 0; J.camY = 0; J.temps = 0; J.score = 0; J.record = 0; J.combo = 0; J.dernierKill = -9; J.secousse = 0; J.gel = 0; J.finT = 0; J.tenuBas = false;
J.niveau = 0; J.niveauVisuel = 0; J.carte = null; J.arene = false; J.veilleur = null; J.acte = 1; J.epiT = 0;   // acte : 1, 2, 3… (les niveaux rejoués, plus durs)
try { J.record = +localStorage.getItem('dragon-rider-record') || 0; } catch {}

export function joueurNeuf(x, sol) {
  return {
    x, y: sol - G + AN.land.bodyY[AN.land.frames - 1], sol, vx: 0, vy: 0, face: 1, fs: 1, mode: 'ground', at: 0,
    ph: 0, cad: 1.15, amp: 1, plane: 0, replie: 0, haut: 0, pitch: 0, pitchV: 0, queue: 0, queueV: 0, bob: 0,
    croisiere: 0, atk: -1, tire: false, cd: 0, recul: 0, mal: -1, inv: 0, flash: 0, pv: PV_MAX,
    ruee: -1, rueeDir: [1, 0], rueeCd: 0, rueeDispo: true, refus: 0, charge: 1, envol: false, accroupi: 0, course: 0, pas: 0, ombreT: 0, impact: 0,
    souffle: 1, dernierSol: [x, sol],
    q2: 0, q2v: 0, q3: 0, q3v: 0, allure: 0, oisif: 0, geste: null, gesteT: 0, prochainGeste: 3, penche: 0, pencheV: 0, vxAvant: 0, ecrase: 0, cligne: 3,
    dos: 0, dosV: 0, onde: 0, ondeV: 0,               // la colonne vertébrale (voir secondaires)
    cavY: 0, cavYV: 0, teteY: 0, teteYV: 0,           // le cavalier et la tête encaissent les à-coups avec retard
    aileS: 0, aileSV: 0,                               // l'aile repliée frémit à chaque pas
    derape: 0, lance: false, renverseDir: -1,          // l'arrêt en pleine course, le départ ; le sens de la roulade quand il est renversé
  };
}
export function vider() { J.ennemis = []; J.boules = []; J.orbes = []; J.coeurs = []; J.particules = []; J.popups = []; J.ombres = []; }
// rang de difficulté : 0 pendant tout l'acte I, 1 pendant l'acte II… (le même pour tous les niveaux d'un acte)
export const rang = () => J.acte - 1;
export function cadrer() {
  J.cam = clamp(J.P.x - J.W * 0.38, 0, Math.max(0, J.NIV.largeur - J.W));
  J.camY = clamp(J.P.y - J.H * 0.55, 0, Math.max(0, J.NIV.hauteur - J.H));
}
// entrer dans un niveau : neuf, ou repris à l'autel (reliques prises, murs brisés et ennemis vaincus le restent)
export function entrerNiveau(n, reprise) {
  const pv = J.P ? J.P.pv : PV_MAX;
  J.niveau = n; J.niveauVisuel = n; J.arene = false; J.veilleur = null; vider();
  if (!reprise || !J.NIV || J.NIV.niveau !== n) { J.NIV = lireNiveau(n); durcir(J.NIV, rang()); }
  else J.NIV.objets.forEach((o) => { if (o.genre === 'ennemi' && !o.mort) o.actif = false; });
  const [x, sol] = reprise && J.NIV.reprise ? J.NIV.reprise : J.NIV.depart;
  J.P = joueurNeuf(x, sol);
  J.P.pv = reprise ? PV_MAX : pv;
  cadrer();
}
export function modeTitre() {
  J.etat = 'titre'; J.carte = null; J.P = null;
  entrerNiveau(Math.max(0, NIVEAUX.findIndex((n) => n.cle === 'terres')), false);   // l'écran titre : toujours les Terres
  J.P.mode = 'air'; J.P.x = 220; J.P.y = J.NIV.depart[1] - J.SOL + 108; cadrer(); J.camY = J.NIV.depart[1] - J.SOL;
}
// « ACTE II · NIVEAU 3 », au-dessus du nom du niveau
export const titreNiveau = (n) => NIVEAUX[n].titre || `ACTE ${romain(J.acte)} · NIVEAU ${n + 1}`;
export function lancerNiveau(n, depuisLeNoir) {
  J.carte = { titre: titreNiveau(n), nom: NIVEAUX[n].nom, plaque: NIVEAUX[n].plaque, sous: NIVEAUX[n].sous, t: depuisLeNoir ? 0.45 : 0, fondu: true, bascule: depuisLeNoir, niveau: n };
  if (depuisLeNoir) entrerNiveau(n, false);
  sfx('glas');
}
export function nouvellePartie() {
  J.etat = 'jeu'; J.acte = ACTE_DEPART; J.score = 0; J.combo = 0; J.P = null;
  lancerNiveau(DEPART, true);
  if (VEILLEUR && J.NIV.veilleur) {                  // entraînement : juste avant l'arène
    const x = J.NIV.veilleur.x - J.W * 0.8, sol = solSous(x, J.NIV.veilleur.y);
    J.P = joueurNeuf(x, sol); cadrer();
  }
}
export function reprendre() {
  J.etat = 'jeu'; J.combo = 0;
  J.carte = { titre: titreNiveau(J.niveau), nom: NIVEAUX[J.niveau].nom, plaque: NIVEAUX[J.niveau].plaque, sous: J.NIV.reprise ? "L'AUTEL VOUS RAPPELLE." : NIVEAUX[J.niveau].sous, t: 0.45, fondu: true, bascule: true, niveau: J.niveau };
  entrerNiveau(J.niveau, true); sfx('glas');
}
export function nouvelActe() { J.etat = 'jeu'; J.acte++; J.combo = 0; J.P = null; lancerNiveau(0, true); }

export function majCarte(dt) {
  if (!J.carte) return;
  J.carte.t += dt;
  if (J.carte.fondu && !J.carte.bascule && J.carte.t >= 0.45) {
    J.carte.bascule = true;
    const pv = Math.min(PV_MAX, J.P.pv + 2);
    entrerNiveau(J.carte.niveau, false); J.P.pv = pv;
  }
  if (J.carte.t > (J.carte.fondu ? 3.7 : 2.9)) J.carte = null;
}
export function voileCarte(c) {
  const t = c.t;
  if (!c.fondu) return t < 2.4 ? 0.3 : 0.3 * (1 - (t - 2.4) / 0.5);
  if (t < 0.45) return t / 0.45;
  if (t < 0.75) return 1;
  if (t < 1.3) return 1 - (t - 0.75) / 0.55 * 0.55;
  if (t < 3.1) return 0.45;
  return 0.45 * (1 - (t - 3.1) / 0.6);
}
export function progression() {
  if (!J.NIV || (J.carte && J.carte.fondu) || J.P.pv <= 0) return;
  const s = J.NIV.sortie;
  // la porte : il suffit que le corps du dragon la touche, à pied ou en vol ; sans toutes les reliques, elle n'est pas là
  if (s && (J.niveau < NIVEAUX.length - 1 || SALLE) && Math.abs(J.P.x - s.x) < 15 + LARG && J.P.y + BAS > s.y - 50 && J.P.y - HAUT < s.y) {
    if (porteOuverte()) { lancerNiveau(SALLE ? J.niveau : J.niveau + 1, false); J.P.inv = 3; }
    else if (!(J.temps - (s.rappel ?? -9) < 4)) {           // rappel, au plus toutes les 4 secondes
      s.rappel = J.temps;
      const manque = J.NIV.reliques - J.NIV.prises;
      popup(manque > 1 ? `IL MANQUE ${manque} RELIQUES` : 'IL MANQUE UNE RELIQUE', s.x, s.y - 60, OS, 1.4); sfx('touche');
    }
  }
  if (J.NIV.veilleur && !J.arene && J.P.x >= J.NIV.veilleur.x - J.W * 0.62) entrerArene();
}

export function popup(txt, x, y, teinte = OS, k = 1) { J.popups.push({ txt, x, y, teinte, k, vie: 1.1 }); }
export function particule(o) { J.particules.push(Object.assign({ vx: 0, vy: 0, vie: 0.5, max: 0.5, t: 1, genre: 'braise' }, o)); }
export function poussiere(x, y, n, force = 1) {      // des bouffées de poussière peintes, posées au sol, qui s'écartent un peu
  const k = Math.max(1, Math.min(4, Math.round(n / 4)));
  for (let i = 0; i < k; i++) {
    const dx = k === 1 ? 0 : (i / (k - 1) - 0.5) * Math.min(40, n * 3);
    particule({ x: x + dx + rand(-3, 3), y, vx: Math.sign(dx || rand(-1, 1)) * rand(10, 30) * force, vy: 0, vie: rand(0.4, 0.55), max: 0.55, t: Math.random() < 0.5 ? -1 : 1, genre: 'poussiere' });
  }
}
export function explosion(x, y, os) {
  particule({ x, y, vie: 0.42, max: 0.42, genre: 'explosion' });
  for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), v = rand(40, 160); particule({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: rand(0.25, 0.55), max: 0.55, t: Math.floor(rand(1, 3)) }); }
  for (let i = 0; i < 6; i++) particule({ x, y, vx: rand(-80, 80), vy: rand(-110, 10), vie: rand(0.7, 1.2), max: 1.2, t: 2, rot: rand(0, 6), genre: os ? 'os' : 'plume' });
  sfx('boum');
}
