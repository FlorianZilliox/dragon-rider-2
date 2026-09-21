import { J } from './etat.js';
import { CALME, DIFFICULTE, FEU, OS, PV_MAX } from './config.js';
import { ART } from './donnees.js';
import { CORNICHE, TP, bloque, caseA, solSous } from './niveau.js';
import { approche, clamp, frac, rand } from './outils.js';
import { explosion, particule, popup, rang } from './partie.js';
import { sfx } from './son.js';

// ================= Ennemis : placés sur la carte, chacun avec son propre schéma =================
//   charognard : guette perché, puis fond en piqué sur le dragon, remonte et replonge (trois fois) avant de fuir ;
//   chauve-souris : dort pendue au plafond, se réveille quand on passe, fonce en zigzag ;
//   âme errante : tourne en huit autour de son point, sans jamais poursuivre — un obstacle vivant ;
//   spectre : dérive vers le dragon, s'efface, réapparaît dans son dos (on ne le touche que visible) ;
//   crâne ardent : tremble en visant, charge en ligne droite, vise de nouveau ; au troisième assaut, il se brise.
export const TYPES = {
  charognard: { pv: 1, r: 13, pts: 100, sprite: 'corbeau', vol: 7, pique: 7, pose: 8 },   // vol : images du battement ; pique ; pose : perché (8, 9)
  ame: { pv: 1, r: 12, pts: 80, sprite: 'ame', vol: 6 },
  chauve: { pv: 1, r: 11, pts: 120, sprite: 'chauve', vol: 6, pose: 6 },          // vol : 6 images du battement ; pose : pendue, repliée
  spectre: { pv: 2, r: 14, pts: 200, sprite: 'spectre', vol: 6 },
  crane: { pv: 2, r: 13, pts: 150, sprite: 'crane', vol: 4 },
};
export const TRAVERSE = { ame: true, spectre: true };        // les âmes et les spectres passent à travers la pierre
export const pierre = (x, y) => bloque(caseA(Math.floor(x / TP), Math.floor(y / TP)));
export function creerEnnemi(type, x, y, dir, diff) {
  const e = { type, x, y, hx: x, hy: y, t: rand(0, 3), ph: rand(0, 6.28), pv: TYPES[type].pv, flash: 0, vx: dir * 30, vy: 0,
              visible: true, alpha: 1, etat: '', et: 0, diff, n: 0, face: dir, image: 0 };
  if (type === 'charognard') {           // se perche sur le sol le plus proche en dessous, sinon plane sur place
    e.etat = 'guet';
    for (let ty = Math.floor(y / TP); ty < Math.floor(y / TP) + 6; ty++) if (bloque(caseA(Math.floor(x / TP), ty)) || caseA(Math.floor(x / TP), ty) === CORNICHE) { e.y = e.hy = ty * TP - piedsPerche(); e.perche = true; break; }
    e.fl = rand(0, 7); e.frequence = 12; e.plane = 0;
  } else if (type === 'chauve') {        // cherche un plafond où se pendre
    e.etat = 'vole';
    // un vrai plafond de la carte, pas le bord du ciel
    for (let ty = Math.floor(y / TP); ty >= Math.max(0, Math.floor(y / TP) - 8); ty--) if (bloque(caseA(Math.floor(x / TP), ty))) { e.y = e.hy = (ty + 1) * TP + 14; e.etat = 'dort'; break; }
    e.chg = 0;
  } else if (type === 'ame') e.etat = 'orbite';
  else if (type === 'spectre') { e.etat = 'visible'; e.et = rand(0, 1); }
  else if (type === 'crane') { e.etat = 'veille'; e.vx = 0; }
  return e;
}
export function changer(e, etat) { e.etat = etat; e.et = 0; }
export function piedsPerche() {                // du centre de la case au bas des serres, sur l'image « perché »
  const a = ART['ennemis/corbeau'], [cw, ch] = a.cellule, [, ry, , rh] = a.rects[TYPES.charognard.pose];
  return ry + rh - ch / 2;
}
export function battre(e, dt, frequence, nb) {   // le battement : sa vitesse suit l'effort, il se fond d'un rythme à l'autre
  e.frequence = approche(e.frequence || frequence, frequence, dt * 6);
  e.fl = (e.fl || 0) + dt * e.frequence;
  return Math.floor(e.fl) % nb;
}
export function plume(e, n) {                   // quelques plumes arrachées, qui tombent en tournoyant
  for (let i = 0; i < n; i++) particule({ x: e.x + rand(-6, 6), y: e.y + rand(-4, 4), vx: rand(-40, 40), vy: rand(-50, 0), vie: rand(0.8, 1.4), max: 1.4, t: 2, rot: rand(0, 6), genre: 'plume' });
}
export function majEnnemi(e, dt) {
  const ax = e.x, ay = e.y, nb = TYPES[e.type].vol, repos = TYPES[e.type].pose;
  const dx = J.P.x - e.x, dy = J.P.y - e.y, dist = Math.hypot(dx, dy), d = e.diff;
  e.t += dt; e.et += dt; e.flash -= dt;
  switch (e.type) {
    case 'charognard': {
      const T = TYPES.charognard;
      if (e.etat === 'guet') {           // perché : il tourne la tête, secoue parfois les ailes
        e.face = Math.sign(dx) || 1;
        if (e.perche) {
          e.y = e.hy;
          const secoue = frac(e.t * 0.23 + e.ph) > 0.93;
          e.image = secoue ? [3, 4, 3][Math.floor(frac(e.t * 0.23 + e.ph) * 40) % 3] : T.pose + (Math.sin(e.t * 1.7 + e.ph) > 0.6 ? 1 : 0);
        } else { e.y = e.hy + Math.sin(e.t * 2) * 2; e.image = battre(e, dt, 9, nb); }
        if (Math.abs(dx) < 280 && Math.abs(dy) < 190) changer(e, e.perche ? 'accroupi' : 'envol');   // il repère le dragon de loin
      } else if (e.etat === 'accroupi') { // l'élan : il se ramasse, tête basse
        e.image = T.pose + 1; e.y = e.hy + 1;
        if (e.et > 0.14) { changer(e, 'envol'); e.vy = -150; plume(e, 2); sfx('touche'); }
      } else if (e.etat === 'envol') {   // il s'arrache : battements rapides, il ralentit en montant
        e.vy = approche(e.vy || -150, -30, dt * 3); e.y += e.vy * dt; e.x -= e.face * 12 * dt;
        e.image = battre(e, dt, 17, nb);
        if (e.et > 0.45) { changer(e, 'pique'); e.x0 = e.x; e.y0 = e.y; e.cx = J.P.x; e.cy = J.P.y + 6; e.n++; }
      } else if (e.etat === 'pique') {   // un arc en U qui passe par où était le dragon
        const u = Math.min(1, e.et / (1.25 / d)), px = e.x;
        e.x = e.x0 + (e.cx - e.x0) * 2 * u; e.y = e.y0 + (e.cy - e.y0) * Math.sin(Math.PI * u);
        e.face = Math.sign(e.x - px) || e.face;
        // il bat pour prendre de la vitesse, replie serres en avant pour frapper, rebat fort pour remonter
        if (u > 0.32 && u < 0.56) { e.image = T.pique; e.frequence = 16; }
        else e.image = battre(e, dt, u < 0.32 ? 10 : 16, nb);
        if (u >= 1) changer(e, 'remonte');
      } else if (e.etat === 'remonte') {
        e.x += e.face * 50 * dt; e.y -= 70 * dt; e.image = battre(e, dt, 15, nb);
        if (e.et > 0.7) { if (e.n < 3) { changer(e, 'pique'); e.x0 = e.x; e.y0 = e.y; e.cx = J.P.x; e.cy = J.P.y + 6; e.n++; } else changer(e, 'fuite'); }
      } else {                           // il fuit : salves de battements, puis il plane ailes déployées
        const cycle = frac(e.et * 0.8), plane = cycle > 0.62;
        e.x += e.face * (plane ? 100 : 85) * dt; e.y += (plane ? 12 : -45) * dt;
        e.image = plane ? T.pique : battre(e, dt, 12, nb);
      }
      break;
    }
    case 'chauve':
      if (e.etat === 'dort') {           // pendue, repliée, la tête en bas
        e.image = repos; e.y = e.hy + Math.sin(e.t * 1.5) * 0.6;
        if (dist < 125) changer(e, 'reveil');
      } else if (e.etat === 'reveil') {
        e.y += 40 * dt; e.image = Math.floor(e.t * 16) % nb;
        if (e.et > 0.3) changer(e, 'vole');
      } else {                            // zigzag vif vers le dragon, cassures franches
        e.chg -= dt;
        if (e.chg <= 0) { e.chg = rand(0.22, 0.4); e.zig = -(e.zig || 1); }
        e.vx = approche(e.vx, Math.sign(dx || 1) * 70 * d, dt * 2);
        e.vy = e.zig * 75 + clamp(dy, -40, 40);
        e.x += e.vx * dt; e.y += e.vy * dt; e.face = Math.sign(e.vx) || 1; e.image = Math.floor(e.t * 16) % nb;
      }
      break;
    case 'ame': {                         // un huit lent autour de son point
      const w = 2 * Math.PI / 5.5 * d;
      const nx = e.hx + 44 * Math.sin(w * e.t + e.ph), ny = e.hy + 20 * Math.sin(2 * (w * e.t + e.ph));
      e.face = Math.sign(nx - e.x) || e.face; e.x = nx; e.y = ny;
      e.image = Math.floor(e.t * 8) % nb; e.alpha = 1;               // opaque : on la reconnaît d'un coup d'œil
      break;
    }
    case 'spectre':
      // il dérive lanterne basse, qu'il balance lentement ; il la lève pour s'effacer, la redescend en revenant
      e.face = Math.sign(dx) || 1;
      e.image = e.etat === 'efface' ? 2 : e.etat === 'revient' ? (e.et < 0.25 ? 1 : 0) : [0, 3, 5, 3][Math.floor(e.t * 2.2) % 4];
      if (e.visible && Math.random() < 0.4) particule({ x: e.x + rand(-10, 6), y: e.y + rand(14, 24), vx: rand(-8, 8), vy: rand(-14, -4), vie: 0.6, max: 0.6, t: 1, genre: 'ecto' });
      if (e.etat === 'visible') {
        e.visible = true; e.alpha = 0.85;
        e.x += (dx / (dist || 1) * 20 * d) * dt; e.y += (dy / (dist || 1) * 15 * d + Math.sin(e.t * 2) * 6) * dt;
        if (e.et > 2.2) changer(e, 'efface');
      } else if (e.etat === 'efface') {
        e.visible = false; e.alpha = 0.85 * (1 - e.et / 0.4);
        if (e.et > 0.4) changer(e, 'absent');
      } else if (e.etat === 'absent') {
        e.visible = false; e.alpha = 0;
        if (e.et > 0.9) {                 // réapparaît dans le dos du dragon
          for (let k = 0; k < 6; k++) {
            const x = J.P.x - J.P.face * rand(60, 95), y = J.P.y + rand(-24, 16);
            if (!pierre(x, y)) { e.x = x; e.y = y; break; }
          }
          changer(e, 'revient');
        }
      } else {                             // en train de réapparaître : inoffensif, des volutes l'annoncent
        e.visible = false; e.alpha = 0.85 * e.et / 0.5;
        if (Math.random() < 0.6) particule({ x: e.x + rand(-8, 8), y: e.y + rand(-10, 10), vx: rand(-6, 6), vy: rand(-18, -6), vie: 0.5, max: 0.5, t: 1, genre: 'ecto' });
        if (e.et > 0.5) changer(e, 'visible');
      }
      break;
    case 'crane':
      e.image = Math.floor(e.t * 12) % nb;
      if (e.etat === 'veille') {
        e.y = e.hy + Math.sin(e.t * 2.5) * 3;
        if (dist < 175) changer(e, 'vise');
      } else if (e.etat === 'vise') {     // tremble et vise : on le voit venir
        e.face = Math.sign(dx) || e.face;
        e.x += rand(-1, 1); e.y += rand(-1, 1);
        if (Math.random() < 0.7) particule({ x: e.x - e.face * 8, y: e.y + rand(-3, 3), vx: -e.face * rand(20, 50), vy: rand(-20, 5), vie: 0.3, max: 0.3, t: 1 });
        if (e.et > 0.7 / d) { const v = 220 * d; e.vx = dx / (dist || 1) * v; e.vy = dy / (dist || 1) * v; e.n++; changer(e, 'charge'); sfx('ruee'); }
      } else {
        e.x += e.vx * dt; e.y += e.vy * dt; e.face = Math.sign(e.vx) || e.face;
        if (Math.random() < 0.8) particule({ x: e.x - Math.sign(e.vx) * 8, y: e.y + rand(-3, 3), vx: -e.vx * 0.2 + rand(-10, 10), vy: rand(-20, 5), vie: 0.3, max: 0.3, t: 1 });
        if (e.et > 0.75 && e.n < 3) changer(e, 'vise');
      }
      break;
  }
  if (e.type === 'charognard' && dt > 0) {          // il s'incline dans le sens de sa course
    const cible = e.etat === 'guet' ? 0 : clamp(Math.atan2(e.y - ay, Math.abs(e.x - ax) + 0.01) * 0.6, -0.5, 0.5);
    e.tilt = approche(e.tilt || 0, cible, dt * 8);
  }
  if (!TRAVERSE[e.type] && pierre(e.x, e.y)) {
    if (e.type === 'crane') { e.mort = true; explosion(e.x, e.y, true); if (e.source) e.source.mort = true; }   // le crâne se brise sur la pierre
    else if (e.type === 'charognard' && e.etat === 'pique') { e.x = ax; e.y = ay; changer(e, 'remonte'); }
    else { e.x = ax; e.y = ay; e.vx = -e.vx; e.zig = -(e.zig || 1); }
  }
  e.y = clamp(e.y, 10, J.NIV.hauteur - 10);
}
// la difficulté de l'acte, décidée à l'entrée du niveau : des renforts près des ennemis de la carte,
// une part d'entre eux plus coriaces (cerclés de sang : un coup de plus). Rang 0 : la carte telle quelle.
export function durcir(niv, r) {
  if (r <= 0) return;
  const D = DIFFICULTE, places = [[28, 0], [-28, 0], [20, -20], [-20, -20], [0, -28], [36, 12], [-36, 12]];
  const libre = (x, y) => !pierre(x, y) && !pierre(x - 10, y) && !pierre(x + 10, y) && !pierre(x, y - 10) && !pierre(x, y + 8)
    && x > 0 && x < niv.largeur && y > 0 && y < niv.hauteur;
  const carte = niv.objets.filter((o) => o.genre === 'ennemi');
  for (const o of carte) {
    if (Math.random() >= D.renfort(r)) continue;
    const p = places.map(([dx, dy]) => [o.x + dx, o.y + dy]).find(([x, y]) => libre(x, y));
    if (p) niv.objets.push({ ...o, x: p[0], y: p[1], renfort: true });
  }
  for (const o of niv.objets) {
    if (o.genre !== 'ennemi') continue;
    const base = TYPES[o.type].pv;
    if ((base === 1 && Math.random() < D.coriace(r)) || (base >= 2 && Math.random() < D.cuirasse(r))) o.coriace = true;
  }
}
export function apparitions() {
  if (J.arene || CALME || J.P.pv <= 0 || (J.carte && J.carte.fondu)) return;
  const diff = DIFFICULTE.vivacite(rang());
  for (const o of J.NIV.objets) {
    if (o.genre !== 'ennemi' || o.mort) continue;
    const champ = o.x > J.cam - 24 && o.x < J.cam + J.W + 48 && o.y > J.camY - 40 && o.y < J.camY + J.H + 40;
    if (o.actif === 'parti') { if (!champ) o.actif = false; continue; }   // reviendra quand on repassera
    if (o.actif || !champ) continue;
    o.actif = true;
    const e = creerEnnemi(o.type, o.x, o.y, J.P.x < o.x ? -1 : 1, diff);
    if (o.coriace) e.pv++;
    e.source = o; J.ennemis.push(e);
  }
}
export function tuer(e) {
  if (e.source) e.source.mort = true;
  explosion(e.x, e.y, e.type === 'crane' || e.type === 'spectre');
  if (J.etat !== 'jeu') return;
  J.combo = J.temps - J.dernierKill < 1.4 ? Math.min(J.combo + 1, 9) : 1;
  J.dernierKill = J.temps;
  const pts = Math.round(TYPES[e.type].pts * (e.source && e.source.coriace ? 1.5 : 1)) * J.combo;
  J.score += pts; J.gel = Math.max(J.gel, 0.04);
  popup('+' + pts, e.x, e.y - 10, J.combo > 1 ? '#e0c080' : OS);
  if (J.combo > 1) { popup('COMBO ×' + J.combo, e.x, e.y - 22, FEU[2]); sfx('combo'); }
  if (J.P.pv < PV_MAX && Math.random() < (J.arene ? 0.4 : 0.2)) J.coeurs.push({ x: e.x, y: e.y, t: 0, sol: solSous(e.x, e.y) });
  noterRecord();
}
export function noterRecord() { if (J.score > J.record) { J.record = J.score; try { localStorage.setItem('dragon-rider-record', J.record); } catch {} } }
