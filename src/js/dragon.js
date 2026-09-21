import { J } from './etat.js';
import { AN, BOUCHE, BRUME, DESCENTE, FPS, G, OS, RUEE_COUT, SOUFFLE, S_BAS, V } from './config.js';
import { DECOLLAGE, GESTES, RENVERSE, SOL_Y, foulee, posture } from './dragon-rendu.js';
import { explosionSol } from './monde.js';
import { BAS, CORNICHE, CORPS_SOL, COURANT, FRAGILE, HAUT, LARG, PICS, TP, appuiOuMarche, appuiSous, bloque, briser, caseA, deplacerSol, deplacerVol, solSous, toucheCase } from './niveau.js';
import { approche, clamp, frac, mix, rand } from './outils.js';
import { particule, popup, poussiere } from './partie.js';
import { sfx } from './son.js';

// ---------- battement d'ailes (même profil que outils/animer_ailes.py) ----------
export function profilAile(ph) {
  const p = frac(ph);
  if (p < DESCENTE) { const u = p / DESCENTE; return [S_BAS + (1 - S_BAS) * (1 + Math.cos(Math.PI * u)) / 2, 1 + 0.04 * Math.sin(Math.PI * u), -5 * Math.sin(Math.PI * u)]; }
  const u = (p - DESCENTE) / (1 - DESCENTE);
  return [S_BAS + (1 - S_BAS) * (1 - Math.cos(Math.PI * u)) / 2, 1 - 0.14 * Math.sin(Math.PI * u), 7 * Math.sin(Math.PI * u)];
}
export function poseAile(p) {
  let [s, sx, rot] = profilAile(p.ph);
  const M = 0.35;
  s = M + p.amp * (s - M); sx = 1 + p.amp * (sx - 1); rot *= p.amp;
  s = mix(s, 0.5, p.plane); sx = mix(sx, 1.03, p.plane); rot = mix(rot, -4, p.plane);      // plané : ailes tendues
  s = mix(s, 0.2, p.replie); sx = mix(sx, 0.6, p.replie); rot = mix(rot, 14, p.replie);    // piqué, ruée : repliées
  s = mix(s, 1, p.haut); sx = mix(sx, 1, p.haut); rot = mix(rot, -3, p.haut);              // arrondi avant de se poser
  return { s, sx, rot: rot * Math.PI / 180 };
}

// ---------- actions du dragon ----------
export const auSol = () => J.P.mode === 'ground' || J.P.mode === 'land';
export function cracher() {
  const vole = J.P.mode === 'air' || J.P.mode === 'fall';
  const p = vole ? J.P.pitch : 0, c = Math.cos(p), s = Math.sin(p);
  const mx = BOUCHE.x, my = BOUCHE.y + (vole ? J.P.bob : 0);
  const bx = J.P.x + J.P.face * (mx * c - my * s), by = J.P.y + (mx * s + my * c);
  J.P.recul = 1; sfx('feu');
  J.P.ondeV += 7; J.P.dosV -= 5;                         // le recul du jet : le poitrail se relève, le dos se tend
  // collé à un mur, la gueule dépasse de l'autre côté : le feu part du corps et s'arrête à la première pierre
  for (let k = 0; k <= 1; k += 1 / 16) {
    const x = mix(J.P.x, bx, k), y = mix(J.P.y, by, k), tx = Math.floor(x / TP), ty = Math.floor(y / TP), t = caseA(tx, ty);
    if (!bloque(t)) continue;
    if (t === FRAGILE) briser(tx, ty);
    explosionSol(x - J.P.face * 4, y);
    particule({ x: x - J.P.face * 4, y, vie: 0.07, max: 0.07, genre: 'bouche' });
    return;
  }
  J.boules.push({ x: bx, y: by, vx: J.P.face * c * V.BOULE + J.P.vx * 0.3, vy: s * V.BOULE + J.P.vy * 0.2, vie: 1.3, trace: [] });
  for (let i = 0; i < 10; i++) particule({ x: bx, y: by, vx: J.P.face * rand(40, 200), vy: rand(-60, 60), vie: rand(0.15, 0.3), max: 0.3, t: 1 });
  particule({ x: bx + J.P.face * 3, y: by, vie: 0.07, max: 0.07, genre: 'bouche' });
}
export function demarrerRuee(versLeBas) {
  const depuisLeSol = auSol();
  if (depuisLeSol) { J.P.mode = 'air'; J.P.at = 0; J.P.ph = 0.05; J.P.amp = 1; J.P.pitch = -0.2; J.P.y = J.P.sol - BAS - 2; poussiere(J.P.x, J.P.sol, 8, 1.3); }
  J.P.ruee = 0; J.P.rueeCd = 0.6; J.P.inv = Math.max(J.P.inv, 0.3); J.P.atk = -1;
  J.P.dosV -= 14;                                        // l'élan : tout le corps se tend comme un arc
  if (J.etat === 'jeu') { J.P.souffle = Math.max(0, J.P.souffle - RUEE_COUT); J.P.rueeDispo = false; }
  J.P.rueeDir = depuisLeSol ? [J.P.face * 0.94, -0.36] : versLeBas ? [J.P.face * 0.7, 0.72] : [J.P.face, 0];
  popup(versLeBas && !depuisLeSol ? 'PIQUÉ !' : 'RUÉE !', J.P.x, J.P.y - 34, OS);
  sfx('ruee');
}
export function blesser(depuisX) {
  if (J.P.inv > 0 || J.P.pv <= 0 || J.etat !== 'jeu') return;
  J.P.pv--; J.P.inv = 2.2; J.P.flash = 0.12; J.P.atk = -1; J.P.ruee = -1;
  J.gel = 0.1; J.secousse = 0.28; sfx('aie');
  J.P.dosV -= 44; J.P.ondeV += 22; J.P.teteYV -= 26; J.P.cavYV -= 12;                       // le coup : il se voûte, l'avant se rejette en arrière
  J.P.vx = Math.sign(J.P.x - depuisX || -J.P.face) * 170;
  if (J.P.pv <= 0) {
    J.P.mal = -1;
    if (auSol()) { J.P.mode = 'dead'; J.P.at = 0; }
    else { J.P.mode = 'fall'; J.P.at = 0; J.P.vy = -70; }
    sfx('chute');
  } else {
    if (auSol() || J.P.mode === 'renverse') {             // au sol, le coup le renverse : il roule sur le dos (Scar), glisse, se relève
      J.P.mode = 'renverse'; J.P.at = 0; J.P.mal = -1;
      J.P.renverseDir = Math.sign(J.P.vx) === J.P.face ? 1 : -1;
      J.P.vx *= 0.8; poussiere(J.P.x, J.P.sol, 6, 1.2);
      return;
    }
    J.P.mal = 0;
    if (J.P.mode !== 'air') { J.P.mode = 'air'; J.P.at = 0; J.P.ph = 0; J.P.pitch = 0; J.P.y = Math.min(J.P.y, J.P.sol - BAS - 2); }
    J.P.vy = -80; J.P.pitchV += Math.random() < 0.5 ? 9 : -9;
  }
}
// Le corps touche un sol en vol, mais ce sol ne porte pas le centre de gravité (le dragon n'y tiendrait pas) :
// renvoie le côté du vide (-1 ou 1) pour qu'il glisse du rebord, au lieu de s'y poser puis d'en retomber sans fin.
function bordSeul(sol) {
  const avant = J.P.sol;
  J.P.sol = sol;
  const porte = appuiSous();
  J.P.sol = avant;
  if (porte) return 0;
  const ty = Math.floor(sol / TP), x0 = Math.floor((J.P.x - LARG + 1) / TP), x1 = Math.floor((J.P.x + LARG - 1) / TP);
  let somme = 0, n = 0;
  for (let tx = x0; tx <= x1; tx++) { const t = caseA(tx, ty); if (bloque(t) || t === CORNICHE) { somme += tx * TP + TP / 2; n++; } }
  return n && somme / n > J.P.x + J.P.face * 4 ? -1 : 1;
}
export function atterrir(sol) {
  J.P.impact = J.P.vy; J.P.mode = 'land'; J.P.at = 0; J.P.vy = 0; J.P.pitch = 0; J.P.pitchV = 0; J.P.sol = sol;
  J.P.ecrase = clamp(J.P.impact / 260, 0.35, 1);                    // l'impact écrase le corps, qui se détend
  J.P.dosV += clamp(J.P.impact, 40, 420) * 0.17; J.P.ondeV -= clamp(J.P.impact, 0, 420) * 0.045;
  J.P.cavYV += clamp(J.P.impact, 40, 420) * 0.12; J.P.teteYV += clamp(J.P.impact, 40, 420) * 0.1;   // le cavalier se tasse, la tête hoche   // le dos plie sous le poids, la tête plonge
  const fort = J.P.impact > 170 || J.P.ruee >= 0;
  J.P.ruee = -1;
  poussiere(J.P.x - J.P.face * 10, sol, fort ? 14 : 6, fort ? 1.5 : 0.8);
  if (fort) J.secousse = Math.max(J.secousse, 0.14);
  sfx('pose');
}

// ---------- mise à jour du dragon ----------
export function tomber() {                    // le sol s'arrête : le dragon ouvre les ailes et reprend l'air
  J.P.mode = 'air'; J.P.at = 0; J.P.y = J.P.sol - BAS - 1; J.P.vy = 30; J.P.ph = 0.2; J.P.amp = 1; J.P.cad = 1.6;
  J.P.pitch = 0.1; J.P.pitchV = 0; J.P.replie = 0; J.P.plane = 0; J.P.haut = 0; J.P.croisiere = 0;
  J.P.dosV -= 16; J.P.ondeV += 10;                       // la surprise du vide : il se cambre, relève le poitrail
  J.P.cavYV -= 14; J.P.teteYV -= 10; J.P.queueV += 5; J.P.amp = 1.25;   // cavalier soulevé, tête haute, coup de queue, ailes grandes ouvertes
}
export function chuteAbime() {                // tombé dans le gouffre : un cœur en moins, retour au dernier sol sûr
  const mourant = J.P.mode === 'fall' || J.P.pv <= 0;
  const [x, sol] = J.P.dernierSol;
  J.P.x = x; J.P.sol = sol; J.P.vx = 0; J.P.vy = 0; J.P.ruee = -1; J.P.atk = -1; J.P.mal = -1; J.P.pitch = 0; J.P.pitchV = 0; J.P.at = 0;
  if (J.etat !== 'jeu') { J.P.mode = 'ground'; return; }
  if (mourant) { J.P.mode = 'dead'; return; }
  J.P.pv--; J.secousse = 0.3; J.gel = 0.1; sfx('aie');
  if (J.P.pv <= 0) { J.P.mode = 'dead'; sfx('chute'); }
  else { J.P.mode = 'ground'; J.P.inv = 2.2; J.P.flash = 0.12; J.P.souffle = 1; popup('LE GOUFFRE...', x, sol - 62, BRUME); }
}
export function majDragon(dt, E) {
  const dir = (E.R ? 1 : 0) - (E.L ? 1 : 0);
  J.P.at += dt; J.P.cd -= dt; J.P.inv -= dt; J.P.flash -= dt; J.P.rueeCd -= dt; J.P.refus -= dt;
  if (auSol()) J.P.rueeDispo = true;                                   // toucher le sol recharge la ruée
  J.P.recul = Math.max(0, J.P.recul - dt * 5);
  secondaires(dt);
  if (J.P.mal >= 0) { J.P.mal += dt; if (J.P.mal > 0.45) J.P.mal = -1; }
  if (J.P.atk >= 0) {
    J.P.atk += dt;
    if (!J.P.tire && Math.floor(J.P.atk * FPS.attack) >= AN.attack.fireFrame) { J.P.tire = true; cracher(); }
    if (J.P.atk * FPS.attack >= AN.attack.frames) J.P.atk = -1;
  }
  const libre = J.P.mal < 0 && J.P.pv > 0;
  const enVol = J.P.mode === 'air';
  if ((E.appuis.has('fire') || E.feu) && libre && J.P.cd <= 0 && J.P.atk < 0 && (enVol || J.P.mode === 'ground')) {
    J.P.atk = 0; J.P.tire = false; J.P.cd = 0.3;
  }
  let ruee = E.appuis.has('ruee');
  if (E.gestes.has('ruee-left')) { ruee = true; J.P.face = -1; }
  if (E.gestes.has('ruee-right')) { ruee = true; J.P.face = 1; }
  // la ruée : un quart du souffle, une seule par envol (rechargée au sol, dans la cendre, à l'autel), 0,6 s entre deux
  if (libre && ruee && J.P.ruee < 0 && J.P.rueeCd <= 0 && (enVol || auSol())) {
    if (J.P.rueeDispo && (J.P.souffle >= RUEE_COUT || J.etat !== 'jeu')) demarrerRuee(E.D);
    else if (J.P.refus <= 0) { J.P.refus = 0.5; sfx('touche'); }
  }
  if (libre && dir && J.P.ruee < 0 && J.P.atk < 0) J.P.face = dir;
  J.P.fs += clamp(J.P.face - J.P.fs, -dt * 8, dt * 8);     // demi-tour animé, un quart de seconde

  switch (J.P.mode) {
    case 'air': majVol(dt, E, dir, libre); break;
    case 'jump': {        // décollage : les 7 images du modèle, le corps s'élève à partir de la 2e
      if (!J.P.envol && J.P.at >= DECOLLAGE) { J.P.envol = true; J.P.vy = -V.SAUT * J.P.charge; poussiere(J.P.x, J.P.sol, 10, 1.2); sfx('envol'); J.P.ph = 0.55; J.P.pitch = -0.3; J.P.pitchV = 0; J.P.y = J.P.sol - BAS - 2; }
      if (J.P.envol) { J.P.vy = approche(J.P.vy, -40, dt * 3); J.P.ph += dt * 3.2; J.P.amp = 1; J.P.pitch = approche(J.P.pitch, -0.12, dt * 3); ressortQueue(dt, 0.25); }
      J.P.vx = approche(J.P.vx, libre ? dir * V.AIR : 0, dt * 5);
      if (J.P.y + BAS > J.P.sol - 1) {                          // encore au ras du sol : on avance comme à pied
        deplacerSol(J.P.vx * dt);
        if (deplacerVol(0, J.P.vy * dt).plafond) J.P.vy = 0;
      } else if (deplacerVol(J.P.vx * dt, J.P.vy * dt).plafond) J.P.vy = Math.max(0, J.P.vy);
      if (J.P.at * FPS.jump >= AN.jump.frames) {
        J.P.mode = 'air'; J.P.at = 0; J.P.ph = 0; J.P.amp = 1; J.P.cad = 2.2; J.P.pitch = -0.22; J.P.pitchV = 0;
        J.P.replie = 0; J.P.plane = 0; J.P.haut = 0; J.P.croisiere = 0;
        if (J.P.y + BAS > J.P.sol) J.P.y = J.P.sol - BAS - 1;
      }
      break;
    }
    case 'land':
      J.P.vx = approche(J.P.vx, 0, dt * 5);
      deplacerSol(J.P.vx * dt);
      if (!appuiOuMarche()) tomber();
      else if (J.P.at * FPS.land >= AN.land.frames) { J.P.mode = 'ground'; J.P.at = 0; }
      break;
    case 'ground': {
      const accroupi = libre && E.D && J.P.atk < 0;
      J.P.accroupi = accroupi ? J.P.accroupi + dt : Math.max(0, J.P.accroupi - dt * 2);
      J.P.souffle = Math.min(1, J.P.souffle + dt * SOUFFLE.sol);
      if (libre && E.U && J.P.atk < 0) {
        J.P.charge = J.P.accroupi > 0.25 ? 1.3 : 1;
        if (J.P.charge > 1) popup('SUPER SAUT !', J.P.x, J.P.y - 34, OS);
        J.P.mode = 'jump'; J.P.at = 0; J.P.envol = false; J.P.accroupi = 0;
        J.P.y = J.P.sol - G + AN.jump.bodyY[0];
        break;
      }
      // le départ : une poussée, ramassé sur lui-même ; l'arrêt en pleine course : il dérape, arc-bouté (Simba)
      if (dir && Math.abs(J.P.vx) < 12 && !J.P.lance) { J.P.dosV += 12; J.P.ondeV -= 9; J.P.lance = true; }
      if (!dir) J.P.lance = false;
      const lance = Math.abs(J.P.vx) > V.MARCHE * 1.25 && (!dir || Math.sign(J.P.vx) !== dir);
      if (lance && J.P.derape <= 0) { J.P.derape = 0.42; J.P.ondeV += 12; poussiere(J.P.x + J.P.face * 18, J.P.sol, 3, 0.8); sfx('pose'); }
      J.P.derape = Math.max(0, J.P.derape - dt);
      J.P.course = dir && !accroupi && J.P.atk < 0 ? J.P.course + dt : 0;
      const vitesse = mix(V.MARCHE, V.COURSE, clamp((J.P.course - 0.35) / 0.7, 0, 1));
      J.P.vx = approche(J.P.vx, libre && !accroupi && J.P.atk < 0 && J.P.derape <= 0 ? dir * vitesse : 0, dt * (J.P.derape > 0 ? 3.5 : 8));
      if (J.P.derape > 0.15 && Math.random() < 0.18) poussiere(J.P.x + J.P.face * 20, J.P.sol, 1, 0.5);   // les griffes labourent le sol
      if (deplacerSol(J.P.vx * dt)) J.P.vx = 0;
      if (!appuiOuMarche()) { tomber(); break; }
      if (!toucheCase(PICS, J.P.x - LARG, J.P.sol - CORPS_SOL, J.P.x + LARG, J.P.sol - 1)) J.P.dernierSol = [J.P.x, J.P.sol];
      const avant = Math.floor(J.P.pas);
      J.P.pas += dt * FPS.walk * Math.abs(J.P.vx) / V.MARCHE;
      if (Math.floor(J.P.pas) !== avant && Math.floor(J.P.pas) % AN.walk.frames === 3 && Math.abs(J.P.vx) > V.MARCHE * 1.2) poussiere(J.P.x - J.P.face * 26, J.P.sol, 2, 0.5);
      break;
    }
    case 'renverse': {                                  // renversé : il glisse en roulant, puis se relève (voir posture)
      J.P.at += dt;
      J.P.vx = approche(J.P.vx, 0, dt * 2.2);
      if (deplacerSol(J.P.vx * dt)) J.P.vx = 0;
      if (!appuiOuMarche()) { tomber(); break; }
      if (J.P.at > 0.73 && J.P.at - dt <= 0.73) { J.P.dosV += 18; J.P.teteYV += 12; poussiere(J.P.x, J.P.sol, 4, 0.8); sfx('pose'); }   // il retombe sur ses pattes
      if (J.P.at >= RENVERSE) { J.P.mode = 'ground'; J.P.at = 0; }
      break;
    }
    case 'fall': {
      J.P.vy += 620 * dt; J.P.vx = approche(J.P.vx, 0, dt);
      const r = deplacerVol(J.P.vx * dt, J.P.vy * dt);
      J.P.amp = approche(J.P.amp, 0.45, dt * 3); J.P.cad = 3.2; J.P.replie = approche(J.P.replie, 0.35, dt * 3);
      J.P.ph += J.P.cad * dt;
      J.P.pitchV += (40 * (0.9 - J.P.pitch) - 6 * J.P.pitchV) * dt; J.P.pitch += J.P.pitchV * dt;
      ressortQueue(dt, 0.2);
      if (r.sol !== null) { J.P.sol = r.sol; J.P.mode = 'dead'; J.P.at = 0; J.P.pitch = 0; J.secousse = 0.25; poussiere(J.P.x, J.P.sol, 16, 1.4); sfx('pose'); }
      break;
    }
    case 'dead':
      J.P.vx = approche(J.P.vx, 0, dt * 6);
      deplacerSol(J.P.vx * dt);
      if (J.etat === 'jeu' && J.P.at * FPS.dead >= AN.dead.frames + 5) { J.etat = 'fin'; J.finT = 0; }
      break;
  }
  if (J.P.mode === 'ground' || J.P.mode === 'land' || J.P.mode === 'dead' || J.P.mode === 'renverse') {   // au sol, le corps suit l'image
    const d = posture();
    J.P.y = d.type === 'rig' ? J.P.sol - G + SOL_Y : J.P.sol - G + (AN[d.an].grounded ? AN[d.an].bodyY[d.i] : 0);
  }
  // dangers : pics (un cœur et on rebondit), gouffre
  if (J.P.pv > 0 && J.P.mode !== 'dead' && J.P.mode !== 'fall') {
    const pied = J.P.mode === 'air' ? J.P.y + BAS : J.P.sol, tete = J.P.mode === 'air' ? J.P.y - HAUT : J.P.sol - CORPS_SOL;
    if (toucheCase(PICS, J.P.x - LARG + 6, tete + 4, J.P.x + LARG - 6, pied - 1)) {
      blesser(J.P.x - J.P.face * 10);
      if (J.P.pv > 0) {
        if (J.P.mode !== 'air') { J.P.mode = 'air'; J.P.at = 0; J.P.ph = 0; J.P.pitch = 0; }
        J.P.y = Math.min(J.P.y, pied - BAS - 4); J.P.vy = -210;
        J.P.souffle = Math.max(J.P.souffle, 0.5);              // de quoi s'extraire des pics, même épuisé
      }
    }
  }
  if (J.P.y > J.NIV.hauteur + 40) chuteAbime();
  // l'arène du Veilleur est close : on lui fait face
  if (J.arene && J.NIV.arene && J.etat === 'jeu') {
    const g = J.NIV.arene.x + 14, d = J.NIV.arene.x + J.W * 0.45;
    if (J.P.x < g) { J.P.x = g; J.P.vx = Math.max(0, J.P.vx); }
    if (J.P.x > d) { J.P.x = d; J.P.vx = Math.min(0, J.P.vx); }
  }
}
export function ressortQueue(dt, cible) {
  J.P.queueV += (80 * (cible - J.P.queue) - 9 * J.P.queueV) * dt;
  J.P.queue += J.P.queueV * dt;
}
export function secondaires(dt) {
  // la queue en trois segments : chacun suit le précédent avec retard, l'onde descend jusqu'à la nageoire
  const enVol = J.P.mode === 'air' || J.P.mode === 'fall', pas = clamp(Math.abs(J.P.vx) / V.MARCHE, 0, 1.5);
  const onde = enVol ? 0.12 * J.P.amp * Math.sin(2 * Math.PI * J.P.ph - 1.8) + clamp(J.P.vy / V.PIQUE, -1, 1) * 0.06
    : 0.1 * pas * Math.sin(2 * Math.PI * J.P.allure - 1.6) + 0.05 * Math.sin(J.temps * 1.3);
  J.P.q2v += (34 * (J.P.queue * 0.5 + onde - J.P.q2) - 5 * J.P.q2v) * dt; J.P.q2 += J.P.q2v * dt;
  J.P.q3v += (26 * (J.P.q2 * 0.8 + onde * 1.5 - J.P.q3) - 4 * J.P.q3v) * dt; J.P.q3 += J.P.q3v * dt;
  // le cavalier se penche contre l'accélération, puis revient
  const acc = (J.P.vx - J.P.vxAvant) / Math.max(dt, 1e-3) * J.P.face;
  J.P.vxAvant = J.P.vx;
  J.P.pencheV += (60 * (clamp(-acc / 900, -0.25, 0.25) - J.P.penche) - 8 * J.P.pencheV) * dt; J.P.penche += J.P.pencheV * dt;
  J.P.ecrase = Math.max(0, J.P.ecrase - dt * 4);
  // la colonne vertébrale : le tronc n'est pas une planche. dos > 0 : il se creuse (le milieu descend), < 0 : il se voûte ;
  // onde > 0 : l'avant se relève et l'arrière s'abaisse (en pixels). Deux ressorts peu amortis : les chocs (atterrissage,
  // coup, jet de feu, ruée, vide) les lancent et ils rebondissent ; en fond, le rythme des ailes ou des pas.
  let dosC = 0, ondeC = 0;
  if (enVol) {
    const chute = clamp((J.P.vy - 60) / 200, 0, 1) * (1 - J.P.amp * 0.5);   // (le rythme des ailes agit directement, voir posture)
    dosC = -(J.P.ruee >= 0 ? 1.2 : 0) - 1.6 * chute + (J.P.mode === 'fall' ? -1.5 : 0);
    ondeC = -clamp(J.P.vy / V.VERT, -1.2, 1.2) * 0.9 + 1.2 * chute * Math.sin(J.temps * 11);   // la chute : il se débat
  } else if (J.P.mode === 'jump' && !J.P.envol) dosC = 2.8;          // l'élan, ramassé sur lui-même
  else {
    dosC = (J.P.accroupi || 0) * 2.2;                      // (le rythme des pas et du galop agit directement, voir posture)
  }
  J.P.dosV += (75 * (dosC - J.P.dos) - 6.5 * J.P.dosV) * dt; J.P.dos = clamp(J.P.dos + J.P.dosV * dt, -5, 6);
  J.P.ondeV += (65 * (ondeC - J.P.onde) - 7 * J.P.ondeV) * dt; J.P.onde = clamp(J.P.onde + J.P.ondeV * dt, -5, 5);
  J.P.cavYV += (-110 * J.P.cavY - 9 * J.P.cavYV) * dt; J.P.cavY = clamp(J.P.cavY + J.P.cavYV * dt, -4, 4);
  J.P.teteYV += (-80 * J.P.teteY - 7 * J.P.teteYV) * dt; J.P.teteY = clamp(J.P.teteY + J.P.teteYV * dt, -4, 4);
  // au repos, il vit : de temps en temps un geste (regarder autour, étirer ou secouer les ailes, un coup de queue)
  if (J.P.mode === 'ground' && Math.abs(J.P.vx) < 5 && J.P.atk < 0 && !(J.P.accroupi > 0.05)) J.P.oisif += dt; else { J.P.oisif = 0; J.P.geste = null; J.P.prochainGeste = rand(2.5, 4); }
  if (J.P.geste) { J.P.gesteT += dt; if (J.P.gesteT > GESTES[J.P.geste]) { J.P.geste = null; J.P.prochainGeste = J.P.oisif + rand(3.5, 7); } }
  else if (J.P.oisif > J.P.prochainGeste) { const g = Object.keys(GESTES); J.P.geste = g[Math.floor(Math.random() * g.length)]; J.P.gesteT = 0; }
  if (J.P.mode === 'ground') {
    const avant = J.P.allure;
    J.P.allure += dt * Math.abs(J.P.vx) / foulee() + (Math.abs(J.P.fs) < 0.98 ? dt * 3 : 0);   // un pas tous les « foulee » pixels ; il piétine en se retournant
    const vif = (Math.abs(J.P.vx) - V.MARCHE) / (V.COURSE - V.MARCHE);
    if (vif > 0.3 && Math.floor(avant * 2) !== Math.floor(J.P.allure * 2)) poussiere(J.P.x - J.P.face * 14, J.P.sol, 1, 0.4);   // la course soulève la poussière
  }
  J.P.cligne -= dt;
  if (J.P.cligne < -0.12) J.P.cligne = rand(2.5, 5.5);
}
export function majVol(dt, E, dir, libre) {
  let cAmp = 1, cCad = 1.15, cPlane = 0, cReplie = 0;
  const courant = toucheCase(COURANT, J.P.x - LARG + 8, J.P.y - HAUT, J.P.x + LARG - 8, J.P.y + BAS);
  if (courant) { J.P.souffle = Math.min(1, J.P.souffle + dt * SOUFFLE.courant); J.P.rueeDispo = true; }
  if (J.P.ruee >= 0) {
    J.P.ruee += dt;
    const u = J.P.ruee / 0.3, v = V.RUEE * (1 - 0.45 * u * u);
    J.P.vx = J.P.rueeDir[0] * v; J.P.vy = J.P.rueeDir[1] * v;
    cAmp = 0.1; cCad = 0.6; cReplie = 1;
    if (u >= 1) { J.P.ruee = -1; J.P.vx = J.P.face * V.AIR * 1.1; J.P.vy *= 0.3; }
  } else {
    // le souffle : voler fatigue ; épuisé, le dragon ne peut que planer vers le bas
    const epuise = J.P.souffle <= 0 && !courant;
    const pique = libre && E.D, monte = libre && E.U && !epuise;
    J.P.vx = approche(J.P.vx, libre ? dir * V.AIR : 0, dt * 4);
    J.P.vy = approche(J.P.vy, pique ? V.PIQUE : monte ? -V.VERT : epuise ? SOUFFLE.epuise : 0, dt * (pique ? 2.5 : 5));
    if (J.etat === 'jeu' && !courant && !J.arene)                  // face au Veilleur, le combat se livre en vol : le souffle tient
      J.P.souffle = Math.max(0, J.P.souffle - dt * (monte ? SOUFFLE.montee : pique ? 0 : SOUFFLE.palier));
    if (J.P.mal >= 0) cCad = 3.2;
    else if (epuise && !pique) { cAmp = 0.15; cCad = 0.6; cPlane = 1; }
    else if (pique) { cAmp = 0.15; cCad = 0.8; cReplie = clamp((J.P.vy - 50) / 140, 0, 0.9); }
    else if (monte) cCad = 2.3;
    else if (Math.abs(J.P.vx) > V.AIR * 0.6) {
      J.P.croisiere += dt;
      const bat = J.P.croisiere % 2.6 < 1.5;          // en croisière : quelques battements, puis on plane
      cAmp = bat ? 0.85 : 0.12; cCad = bat ? 1.7 : 0.7; cPlane = bat ? 0 : 1;
    } else J.P.croisiere = 0;
  }
  if (courant && J.P.ruee < 0) J.P.vy = Math.max(J.P.vy - 460 * dt, -165);      // le courant porte vers le haut
  const choc = deplacerVol(J.P.vx * dt, J.P.vy * dt);
  if (choc.plafond) J.P.vy = Math.max(0, J.P.vy);
  if (choc.mur && J.P.ruee >= 0) { J.P.ruee = -1; J.P.vx = 0; J.secousse = Math.max(J.secousse, 0.08); }
  // arrondi avant de toucher le sol (ailes levées, nez relevé), puis atterrissage
  const solDessous = solSous(J.P.x, J.P.y + BAS - 1), hauteur = solDessous === null ? 1e9 : solDessous - (J.P.y + BAS);
  const arrondi = J.P.vy > 0 && hauteur < Math.max(18, J.P.vy * 0.24);
  J.P.haut = approche(J.P.haut, arrondi ? 1 : 0, dt * (arrondi ? 10 : 6));
  if (arrondi) { cReplie = 0; cAmp = 0.3; }
  const cPitch = clamp(clamp(J.P.vy / V.VERT, -1.4, 1.9) * 0.18 + clamp(J.P.vx * J.P.face / V.AIR, -1, 1) * 0.04
    - J.P.recul * 0.12 - (arrondi ? 0.14 : 0) + (J.P.ruee >= 0 ? 0.08 : 0), -0.26, 0.32);
  J.P.pitchV += (55 * (cPitch - J.P.pitch) - 10 * J.P.pitchV) * dt; J.P.pitch += J.P.pitchV * dt;
  J.P.amp = approche(J.P.amp, cAmp, dt * 5); J.P.cad = approche(J.P.cad, cCad, dt * 4);
  J.P.plane = approche(J.P.plane, cPlane, dt * 3); J.P.replie = approche(J.P.replie, cReplie, dt * (J.P.ruee >= 0 ? 16 : 6));
  const avant = frac(J.P.ph);
  J.P.ph += J.P.cad * dt;
  if (avant > 0.9 && frac(J.P.ph) < 0.1 && J.P.amp > 0.6) sfx('battement');
  J.P.bob = -1.3 * J.P.amp * Math.sin(2 * Math.PI * (frac(J.P.ph) - 0.2));
  ressortQueue(dt, J.P.amp * 0.09 * Math.sin(2 * Math.PI * J.P.ph - 1.3) + clamp(J.P.vy / V.VERT, -1.5, 1.8) * 0.12
    + clamp((J.P.vy - 60) / 180, 0, 1) * 0.3 + (J.P.ruee >= 0 ? 0.14 : 0) - J.P.pitchV * 0.03);   // en chute, l'air soulève la queue
  if (choc.sol !== null) {
    const glisse = bordSeul(choc.sol);
    if (glisse) J.P.vx = glisse * Math.max(Math.abs(J.P.vx), 60);   // seul le bord du corps touche : il glisse du rebord
    else if (J.P.mal < 0 && J.P.pv > 0) atterrir(choc.sol);
    else J.P.vy = Math.min(J.P.vy, 0);
  }
  J.P.ombreT -= dt;
  if (J.P.ruee >= 0 && J.P.ombreT <= 0) { J.P.ombreT = 0.028; J.ombres.push({ d: posture(), vie: 0.2 }); }
}
