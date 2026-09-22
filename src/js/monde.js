import { J } from './etat.js';
import { FEU, OS, PV_MAX } from './config.js';
import { auSol, blesser } from './dragon.js';
import { TYPES, apparitions, majEnnemi, noterRecord, tuer } from './ennemis.js';
import { FRAGILE, TP, bloque, briser, caseA, majHerses, porteOuverte, tirerLevier, toucheLevier } from './niveau.js';
import { rand } from './outils.js';
import { explosion, particule, popup } from './partie.js';
import { sfx } from './son.js';
import { blesserVeilleur, majVeilleur } from './veilleur.js';

// ================= Le monde : ennemis, boules de feu, orbes, cœurs, objets de la carte, particules =================
export function majMonde(dt) {
  apparitions();
  majHerses();
  for (const e of J.ennemis) majEnnemi(e, dt);
  J.ennemis = J.ennemis.filter((e) => {
    const loin = Math.abs(e.x - (J.cam + J.W / 2)) > J.W + 220 || Math.abs(e.y - (J.camY + J.H / 2)) > J.H + 160;
    if (loin && e.source && !e.mort) e.source.actif = 'parti';
    return !loin;
  });
  majVeilleur(dt);

  for (const b of J.boules) {
    b.vie -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    b.trace.unshift([b.x, b.y]); if (b.trace.length > 7) b.trace.pop();
    if (Math.random() < 0.6) particule({ x: b.x, y: b.y, vx: -b.vx * 0.15 + rand(-20, 20), vy: -b.vy * 0.15 + rand(-25, 25), vie: rand(0.12, 0.3), max: 0.3, t: 1 });
    const mi = [Math.floor((b.x - b.vx * dt / 2) / TP), Math.floor((b.y - b.vy * dt / 2) / TP)];
    const [tx, ty] = bloque(caseA(mi[0], mi[1])) ? mi : [Math.floor(b.x / TP), Math.floor(b.y / TP)], t = caseA(tx, ty);
    if (bloque(t) || b.y > J.NIV.hauteur) {                  // la pierre arrête le feu ; le mur fissuré cède
      b.vie = 0;
      if (t === FRAGILE) briser(tx, ty);
      explosionSol(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      continue;
    }
    for (const e of J.ennemis) {
      if (e.mort || !e.visible || Math.hypot(e.x - b.x, e.y - b.y) > TYPES[e.type].r + 8) continue;
      b.vie = 0; e.pv--; e.flash = 0.08;
      if (e.pv <= 0) { e.mort = true; tuer(e); }
      else sfx('touche');
      break;
    }
    for (const o of J.orbes) if (b.vie > 0 && Math.hypot(o.x - b.x, o.y - b.y) < 10) { o.vie = 0; b.vie = 0; explosionSol(o.x, o.y); }
    for (const o of J.NIV.objets) if (b.vie > 0 && o.genre === 'levier' && !o.tire && toucheLevier(o, b.x, b.y)) { tirerLevier(o); b.vie = 0; explosionSol(b.x, b.y); }
    // le feu touche tout le crâne et la mâchoire
    if (J.veilleur && b.vie > 0 && ((J.veilleur.x - b.x) / 34) ** 2 + ((J.veilleur.y + 8 - b.y) / 44) ** 2 < 1) { b.vie = 0; blesserVeilleur(J.veilleur, 1); explosionSol(b.x, b.y); }
  }
  J.boules = J.boules.filter((b) => b.vie > 0);

  // collisions avec le dragon (zone réduite au corps, plus indulgente que le sprite)
  const hx = J.P.x + J.P.face * 6, hy = J.P.y + 4, fonce = J.P.ruee >= 0;
  const touche = (x, y, r) => { const dx = (x - hx) / (34 + r), dy = (y - hy) / (12 + r); return dx * dx + dy * dy < 1; };
  if (fonce) for (const o of J.NIV.objets) if (o.genre === 'levier' && !o.tire && touche(o.x, o.y - 9, 6)) tirerLevier(o);   // la ruée actionne un levier
  for (const e of J.ennemis) {
    if (e.mort || !e.visible || J.P.pv <= 0 || !touche(e.x, e.y, TYPES[e.type].r)) continue;
    if (fonce) { e.mort = true; tuer(e); }
    else if (J.P.inv <= 0) { blesser(e.x); e.mort = true; if (e.source) e.source.mort = true; explosion(e.x, e.y, false); }
  }
  J.ennemis = J.ennemis.filter((e) => !e.mort);
  for (const o of J.orbes) {
    o.vie -= dt; o.x += o.vx * dt; o.y += o.vy * dt;
    if (J.P.pv > 0 && touche(o.x, o.y, 3) && J.P.ruee < 0) { o.vie = 0; blesser(o.x); }
  }
  J.orbes = J.orbes.filter((o) => o.vie > 0 && o.y > J.camY - 20 && o.y < J.camY + J.H + 10 && Math.abs(o.x - J.cam - J.W / 2) < J.W);
  for (const c of J.coeurs) {
    c.t += dt; c.y = Math.min((c.sol ?? J.NIV.hauteur + 60) - 8, c.y + 14 * dt);
    if (J.P.pv > 0 && Math.hypot(c.x - J.P.x, c.y - J.P.y - 4) < 24) { c.pris = true; J.P.pv = Math.min(PV_MAX, J.P.pv + 1); popup('VIE +1', c.x, c.y - 10, '#e0505a'); sfx('soin'); }
  }
  J.coeurs = J.coeurs.filter((c) => !c.pris && c.t < 9);
  if (J.etat === 'jeu' && J.P.pv > 0) ramasser();

  for (const p of J.particules) {
    p.vie -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.genre === 'plume' || p.genre === 'os' || p.genre === 'gravat') { p.vy += 200 * dt; p.vx *= 0.97; p.rot += dt * 7; }
    else if (p.genre === 'poussiere') { p.vx *= 0.9; p.vy = 0; }
    else { p.vx *= 0.93; p.vy *= 0.93; }
  }
  J.particules = J.particules.filter((p) => p.vie > 0);
  for (const o of J.ombres) o.vie -= dt;
  J.ombres = J.ombres.filter((o) => o.vie > 0);
  for (const p of J.popups) { p.vie -= dt; p.y -= 22 * dt; }
  J.popups = J.popups.filter((p) => p.vie > 0);
}
// reliques, cœurs posés sur la carte, autels (on y reprendra après une chute)
export function ramasser() {
  const hx = J.P.x + J.P.face * 6, hy = J.P.y + 4;
  for (const o of J.NIV.objets) {
    if (o.genre === 'relique' || o.genre === 'coeur') {
      if (o.pris || ((o.x - hx) / 42) ** 2 + ((o.y - hy) / 26) ** 2 > 1) continue;   // au contact du corps, du cou ou de la tête
      o.pris = true;
      if (o.genre === 'coeur') { J.P.pv = Math.min(PV_MAX, J.P.pv + 1); popup('VIE +1', o.x, o.y - 10, '#e0505a'); sfx('soin'); continue; }
      J.NIV.prises++; J.score += 500 * J.acte; noterRecord();
      popup('RELIQUE ' + J.NIV.prises + '/' + J.NIV.reliques, o.x, o.y - 12, '#e0c080');
      if (porteOuverte() && J.NIV.sortie) {                      // la dernière : la porte se révèle au bout du niveau
        J.NIV.sortie.revele = J.temps;
        popup('LA PORTE EST APPARUE', o.x, o.y - 26, OS, 1.6); sfx('glas', 0.25);
      }
      for (let i = 0; i < 10; i++) particule({ x: o.x, y: o.y, vx: rand(-60, 60), vy: rand(-80, 10), vie: rand(0.3, 0.6), max: 0.6, t: 1, genre: 'ecto' });
      sfx('combo');
    } else if (o.genre === 'autel' && !o.allume && auSol() && Math.abs(o.x - J.P.x) < 26 && Math.abs(o.y - J.P.sol) < 6) {
      J.NIV.objets.forEach((a) => { if (a.genre === 'autel') a.allume = false; });
      o.allume = true; J.NIV.reprise = [o.x, o.y];
      J.P.pv = PV_MAX; J.P.souffle = 1; J.P.rueeDispo = true;
      popup("L'AUTEL S'ALLUME", o.x, o.y - 40, FEU[1]); sfx('soin'); sfx('glas', 0.1);
    }
  }
}
export function explosionSol(x, y) {
  particule({ x, y, vie: 0.32, max: 0.32, genre: 'explosion' });
  for (let i = 0; i < 8; i++) particule({ x, y: y + 1, vx: rand(-70, 70), vy: rand(-90, -20), vie: rand(0.2, 0.45), max: 0.45, t: Math.floor(rand(1, 3)) });
}
