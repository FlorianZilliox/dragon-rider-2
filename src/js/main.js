import { J } from './etat.js';
import { suivreCamera } from './camera.js';
import { NIVEAUX, ENCRE, ESSAI, G, OS, PV_MAX, SANG_VIF, reduit } from './config.js';
import { IMAGES_ART, PLANS, construireHalo, decor, dessinerMeteo, majMeteo } from './decor.js';
import { entreesDemo } from './demo.js';
import { ART, ATLAS, CARTES, PLANCHE } from './donnees.js';
import { majDragon } from './dragon.js';
import { construirePieces, construirePlanche } from './dragon-pieces.js';
import { dessinerDragon, posture } from './dragon-rendu.js';
import { ctx, disposer } from './ecran.js';
import { construireEnnemis } from './ennemis-sprites.js';
import { tenu } from './entrees.js';
import { dessinerCarte, hud } from './interface.js';
import { majMonde } from './monde.js';
import { TP, caseA } from './niveau.js';
import { rand } from './outils.js';
import { cadrer, majCarte, modeTitre, nouvelActe, nouvellePartie, progression, reprendre } from './partie.js';
import { dessinerEffets, dessinerEnnemis } from './rendu-monde.js';
import { sfx } from './son.js';
import { TERRAIN, construireAccessoires, construireTuiles, dessinerCourants, dessinerObjets, dessinerTuiles } from './terrain.js';
import { texte } from './texte.js';
import { MENU, ecranEpilogue, ecranFin, ecranPause, ecranTitre } from './titre.js';
import { enPause } from './appareil.js';
import { dessinerObscurite } from './obscurite.js';

// ================= Boucle =================
J.avant = 0;
export function boucle(tms) {
  const dt = Math.min(0.05, (tms - J.avant) / 1000 || 0);
  J.avant = tms;
  J.temps += dt;
  if (J.etat === 'epilogue') {
    J.epiT += dt;
    if (J.epiT > 7 && J.appuis.has('fire')) { nouvelActe(); J.feuRetenu = true; }
    J.appuis.clear(); J.gestes.clear();
    if (J.etat === 'epilogue') { ecranEpilogue(); requestAnimationFrame(boucle); return; }
  }
  if (J.feuRetenu && !tenu('fire')) J.feuRetenu = false;         // l'appui qui a validé un menu ne tire pas : il faut relâcher
  const E = J.etat === 'titre' ? entreesDemo()
    : { L: tenu('left'), R: tenu('right'), U: tenu('up'), D: tenu('down'), feu: tenu('fire') && !J.feuRetenu, appuis: J.appuis, gestes: J.gestes };
  J.tenuBas = E.D;
  if (J.etat === 'titre' && J.pageTitre === 'commandes' && (J.appuis.has('fire') || J.appuis.has('ruee'))) { J.pageTitre = 'menu'; sfx('touche'); }
  else if (J.etat === 'titre' && (J.appuis.has('up') || J.appuis.has('down'))) { J.choix = (J.choix + (J.appuis.has('up') ? MENU.length - 1 : 1)) % MENU.length; sfx('touche'); }
  else if (J.etat === 'titre' && (J.appuis.has('fire') || J.appuis.has('ruee'))) { if (J.choix === 0) { nouvellePartie(); J.feuRetenu = true; } else { J.pageTitre = 'commandes'; sfx('touche'); } }
  else if (J.etat === 'fin' && J.finT > 0.8 && J.appuis.has('fire')) { reprendre(); J.feuRetenu = true; }
  else if (J.etat === 'jeu' && enPause()) J.appuis.clear();          // pause : l'image reste figée
  else if (J.gel > 0) J.gel -= dt;                                   // micro-pause à l'impact
  else {
    if (J.etat === 'titre') { J.P.pv = PV_MAX; J.P.souffle = 1; }
    majCarte(dt);
    majDragon(dt, E);
    if (J.etat === 'jeu') progression();
    majMonde(dt);
    majMeteo(dt);
    suivreCamera(dt);
  }
  J.appuis.clear(); J.gestes.clear();
  J.secousse = Math.max(0, J.secousse - dt);

  ctx.save();
  if (J.secousse > 0 && !reduit) ctx.translate(Math.round(rand(-2, 2) * J.secousse * 5), Math.round(rand(-2, 2) * J.secousse * 5));
  decor();
  ctx.save();
  ctx.translate(-Math.round(J.cam), -Math.round(J.camY));          // le monde, en coordonnées de la carte
  dessinerCourants();
  dessinerTuiles();
  dessinerObjets();
  dessinerEnnemis();
  dessinerDragon();
  dessinerEffets();
  ctx.restore();
  dessinerMeteo();
  dessinerObscurite();                                             // la pénombre des profondeurs (certains niveaux)
  ctx.restore();
  if (J.etat === 'titre') ecranTitre();
  else { hud(); dessinerCarte(); if (J.etat === 'fin') ecranFin(dt); }
  if (J.etat === 'jeu' && enPause()) ecranPause();
  if (J.etat === 'epilogue') ecranEpilogue();
  requestAnimationFrame(boucle);
}

// lecture seule, pour les tests automatisés (outils de vérification)
window.__dragonRider = () => {
  return { etat: J.etat, niveau: J.niveau + 1, acte: J.acte, decor: J.niveauVisuel + 1, arene: J.arene, veilleur: J.veilleur ? J.veilleur.pv : null, veilleurY: J.veilleur ? Math.round(J.veilleur.y) : null, mode: J.P.mode,
           pv: J.P.pv, score: J.score, ennemis: J.ennemis.length, x: Math.round(J.P.x), y: Math.round(J.P.y), sol: J.P.sol, souffle: +J.P.souffle.toFixed(2),
           sx: Math.round(J.P.x - J.cam), sy: Math.round(J.P.y - J.camY), cam: Math.round(J.cam), camY: Math.round(J.camY),
           reliques: J.NIV.prises + '/' + J.NIV.reliques, reprise: J.NIV.reprise, largeur: J.NIV.largeur, rueeDispo: J.P.rueeDispo, ruee: J.P.ruee,
           px: J.P.x, py: J.P.y, cx: J.cam, cy: J.camY, fs: J.P.fs,
           visuel: (() => { const d = posture(); return d.type === 'rig' ? 'rig ' + d.pose : d.an + ' ' + (d.i + 1); })() };
};
// #essai : poser le dragon où l'on veut pour tester un passage (outils de vérification)
if (ESSAI) window.__essai = {
  poser(tx, ty) { J.P.x = tx * TP + TP / 2; J.P.sol = (ty + 1) * TP; J.P.mode = 'ground'; J.P.at = 0; J.P.vx = J.P.vy = 0; J.P.y = J.P.sol - G; J.P.dernierSol = [J.P.x, J.P.sol]; cadrer(); },
  voler(tx, ty) { J.P.x = tx * TP + TP / 2; J.P.y = ty * TP + TP / 2; J.P.mode = 'air'; J.P.vx = J.P.vy = 0; cadrer(); },
  niveau: () => ({ l: J.NIV.l, h: J.NIV.h, objets: J.NIV.objets.length, reliques: J.NIV.reliques }),
  souffle(v) { J.P.souffle = v; },
  eclair() { J.eclair = 0.24; },                               // déclenche un éclair (niveaux d'orage)
  reliques() { for (const o of J.NIV.objets) if (o.genre === 'relique' && !o.pris) { o.pris = true; J.NIV.prises++; } },   // ouvre la porte du niveau
  pv(n) { J.P.pv = n; },
  caseA: (tx, ty) => caseA(tx, ty),
  objets: () => J.NIV.objets.filter((o) => o.genre !== 'decor').map((o) => `${o.genre}${o.type ? '/' + o.type : ''}@${Math.floor(o.x / TP)},${Math.floor(o.y / TP)}${o.pris ? ' pris' : ''}${o.allume ? ' allumé' : ''}${o.tire ? ' tiré' : ''}${o.mort ? ' mort' : ''}${o.coriace ? ' coriace' : ''}${o.renfort ? ' renfort' : ''}`),
};

export function panne(l1, l2) {
  disposer();
  ctx.fillStyle = ENCRE; ctx.fillRect(0, 0, J.W, J.H);
  texte(l1, J.W / 2, J.H / 2 - 6, SANG_VIF, 1, 'ombre', 'centre');
  texte(l2, J.W / 2, J.H / 2 + 8, OS, 1, 'ombre', 'centre');
}
export const charger = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
export const demarrerJeu = (img, imgPlanche) => {
  disposer();
  J.PIECES = construirePieces(img);
  J.PL = construirePlanche(imgPlanche);
  J.HALOS = [construireHalo(14, 1), construireHalo(16, 2)];
  J.TUILES = construireTuiles(); J.ACCESSOIRES = construireAccessoires();
  construireEnnemis();
  modeTitre();
  requestAnimationFrame((t) => { J.avant = t; requestAnimationFrame(boucle); });
};
// garde-fous : chaque acte a sa carte, ses plans de décor et sa roche (sinon un message, jamais un écran noir)
const sansCarte = NIVEAUX.find((a) => !CARTES || !CARTES[a.cle]);
const sansDecor = NIVEAUX.find((a) => !PLANS[a.cle] || !TERRAIN[a.cle] || PLANS[a.cle].plans.some((p) => !ART || !ART[p.el]));
if (sansCarte) panne('CARTE INTROUVABLE : CARTES/' + sansCarte.cle.toUpperCase() + '.TXT', 'RECONSTRUIRE LE JEU : NPM RUN BUILD');
else if (sansDecor) panne('DÉCOR INCOMPLET : ' + sansDecor.cle.toUpperCase(), 'RECONSTRUIRE LE JEU : NPM RUN BUILD');
else Promise.all([charger(ATLAS), charger(PLANCHE), ...Object.entries(ART).map(([k, a]) => charger(a.src).then((i) => { IMAGES_ART[k] = i; }))])
  .then(([img, imgPlanche]) => demarrerJeu(img, imgPlanche))
  .catch(() => panne('IMAGES DU JEU ILLISIBLES', 'RECONSTRUIRE LE JEU : NPM RUN BUILD'));
