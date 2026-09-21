import { J } from './etat.js';
import { AN, AX, AY, FH, FPS, FW, G, LOIN, V } from './config.js';
import { poseAile } from './dragon.js';
import { BAYER, ctx } from './ecran.js';
import { BAS, CORNICHE, CORPS_SOL, HAUT, LARG, TP, bloque, caseA, solSous } from './niveau.js';
import { clamp, frac, mix, toile } from './outils.js';
import { auPixel } from './terrain.js';
import { texte } from './texte.js';
import { pinceau } from './pinceau.js';

// ---------- posture : ce qui décrit l'image du dragon à dessiner ----------
// en vol : la marionnette, calculée en continu ; au sol : les images du modèle, redessinées par Pixel Artist
export function posture() {
  const unique = (a, t, fps) => Math.min(Math.floor(t * fps), AN[a].frames - 1);
  const vol = () => {                    // la marionnette en vol : battements, tangage, queue, cavalier
    const ph = frac(J.P.ph);
    return { type: 'rig', pose: 'vol', x: J.P.x, y: J.P.y, fs: J.P.fs, pitch: J.P.pitch, corps: { dx: -J.P.recul * 3, dy: J.P.bob },
             aile: poseAile(J.P), queue: J.P.queue, tete: { dx: 0, dy: -0.6 * J.P.amp * Math.sin(2 * Math.PI * (ph - 0.35)), rot: 0 },
             teteVariante: J.P.atk >= 0 ? unique('attack', J.P.atk, FPS.attack) : -1,
             cavalier: { dy: 0.7 * J.P.amp * Math.sin(2 * Math.PI * (ph - 0.05)), rot: (J.P.ruee >= 0 ? 0.3 : clamp(J.P.vy / V.PIQUE, 0, 1) * 0.2) + J.P.penche },
             queues: { 'queue-2': J.P.q2, 'queue-3': J.P.q3 }, cligne: J.P.cligne < 0 };
  };
  // la marionnette au sol ; o : ce qui s'y ajoute (s'accroupir, ailes levées, tête basse, s'affaisser…)
  const sol = (o = {}) => {
    // la marche : le corps descend à chaque appui, tête et cavalier suivent avec un léger retard ;
    // les pattes (dessinerPattes) gardent leurs pieds plantés au sol ; à l'arrêt, une respiration
    const g = J.P.allure, amp = clamp(Math.abs(J.P.vx) / V.MARCHE, 0, 1) * (o.fige ? 0 : 1), vif = clamp((Math.abs(J.P.vx) - V.MARCHE) / (V.COURSE - V.MARCHE), 0, 1);
    const souffle = o.repos || o.mort ? 0 : Math.sin(J.temps * 2.2) * (1 - amp), bas = o.bas || 0;
    return { type: 'rig', pose: 'sol', x: J.P.x, y: J.P.sol - G + SOL_Y, fs: J.P.fs, pitch: -0.04 * vif + (0.025 + 0.03 * vif) * amp * Math.sin(4 * Math.PI * g - 0.6) + (o.pitch || 0),
             corps: { dx: 0.8 * amp * Math.sin(4 * Math.PI * g), dy: amp * (0.9 + 1.1 * vif) * Math.cos(4 * Math.PI * g) + 0.6 * souffle + bas },
             aile: { s: (1 - 0.04 * (souffle + 1) - 0.03 * amp * Math.sin(4 * Math.PI * g)) * (o.aile || 1), sx: 1, rot: -0.02 * amp * Math.sin(4 * Math.PI * g) + (o.aileRot || 0) },
             queue: J.P.queue + 0.14 * amp * Math.sin(2 * Math.PI * g - 1) + 0.05 * souffle + (o.queue || 0), allure: g, amp, vif,
             tete: { dx: -2 * J.P.recul, dy: amp * 0.8 * Math.cos(4 * Math.PI * g - 0.9) + 0.4 * souffle + (o.tete || 0), rot: -0.06 * J.P.recul + (o.teteRot || 0) },
             teteVariante: J.P.atk >= 0 ? unique('attack', J.P.atk, FPS.attack) : -1,
             cavalier: { dy: amp * 0.7 * Math.cos(4 * Math.PI * g - 0.5) + 0.4 * souffle + (o.cavalier || 0), rot: J.P.penche + (o.cavalierRot || 0) },
             queues: { 'queue-2': J.P.q2 + (o.queue || 0) * 0.6, 'queue-3': J.P.q3 + (o.queue || 0) * 0.4 }, cligne: o.mort ? true : J.P.cligne < 0, ecrase: J.P.ecrase };
  };
  switch (J.P.mode) {
    case 'air': case 'fall': return vol();
    case 'jump': {
      if (!J.P.envol) {                    // l'élan : il s'accroupit, lève les ailes, baisse la tête
        const u = clamp(J.P.at / DECOLLAGE, 0, 1);
        return sol({ fige: true, bas: 3 * u, aile: 1 + 0.18 * u, aileRot: -0.12 * u, tete: 2 * u, cavalier: 1.5 * u, pitch: 0.05 * u, queue: 0.12 * u });
      }
      return vol();                      // arraché du sol : nez levé, grand battement
    }
    case 'land': {                       // l'impact écrase le corps, les ailes encore hautes se replient, la tête plonge et remonte
      const u = clamp(J.P.at * FPS.land / AN.land.frames, 0, 1);
      return sol({ bas: 2 * (1 - u), aile: 1 + 0.22 * (1 - u), tete: 2.5 * Math.sin(Math.PI * Math.min(1, u * 1.6)), cavalier: 1.5 * Math.sin(Math.PI * Math.min(1, u * 1.3)) });
    }
    case 'dead': {                       // il s'affaisse : corps au sol, tête qui tombe, ailes repliées, queue molle
      const u = clamp(J.P.at * 1.4, 0, 1), e = u * u * (3 - 2 * u);
      return sol({ fige: true, mort: true, bas: 6 * e, aile: 1 - 0.4 * e, aileRot: 0.2 * e, tete: 4 * e, teteRot: 0.35 * e, cavalier: 3 * e, cavalierRot: 0.5 * e, queue: 0.25 * e });
    }
    default:
      if (J.P.accroupi > 0.05 && J.tenuBas && J.P.atk < 0) return sol({ fige: true, bas: 3 * clamp(J.P.accroupi / 0.15, 0, 1), aile: 1.06, tete: 1.5 });   // accroupi : ressort bandé
      return Math.abs(J.P.vx) < 5 && J.P.atk < 0 ? sol({ ...vieAuRepos(), repos: true }) : sol();
  }
}
export const DECOLLAGE = 0.12;                  // durée de l'élan avant de s'arracher du sol
export const GESTES = { regard: 1.6, etire: 1.3, secoue: 0.7, queue: 0.9 };   // les gestes au repos et leur durée
export function vieAuRepos() {                  // ce que le repos ajoute à la pose au sol : respiration décalée et geste en cours
  const r = Math.sin(J.temps * 2.1), o = { bas: 0.7 * r, tete: 0.7 * Math.sin(J.temps * 2.1 - 0.9), cavalier: 0.6 * Math.sin(J.temps * 2.1 - 1.6), aile: 1 - 0.035 * (1 + r), queue: 0.06 * Math.sin(J.temps * 1.2) };
  if (!J.P.geste) return o;
  const u = J.P.gesteT / GESTES[J.P.geste], env = Math.sin(Math.PI * clamp(u, 0, 1));
  if (J.P.geste === 'regard') { o.teteRot = -0.14 * env * (u < 0.6 ? 1 : -0.5); o.tete -= 1.2 * env; o.cavalierRot = -0.1 * env; }
  else if (J.P.geste === 'etire') { o.aile *= 1 + 0.32 * env; o.aileRot = -0.16 * env; o.bas -= 0.8 * env; o.tete += 0.8 * env; }
  else if (J.P.geste === 'secoue') { o.aileRot = 0.12 * Math.sin(u * Math.PI * 7) * env; o.aile *= 1 + 0.08 * env; }
  else if (J.P.geste === 'queue') o.queue += 0.4 * env * Math.sin(u * Math.PI * 3);
  return o;
}
export const SOL_Y = -1.5;                      // la marionnette au sol, un peu haut sur pattes : de son repère au sol
export const foulee = () => mix(24, 36, clamp((Math.abs(J.P.vx) - V.MARCHE) / (V.COURSE - V.MARCHE), 0, 1));
// les quatre pattes, dans le repère de la pose au sol : hanche (ou épaule), côté (près / loin), place dans le pas.
// Au pas, une marche latérale à quatre temps, comme un grand félin : arrière près, avant près, arrière loin,
// avant loin ; chaque pied reste posé les trois quarts du temps, une seule patte en l'air à la fois.
// En courant, les pattes avant glissent d'un quart de temps : trot, par paires diagonales.
// Les pattes du fond sont presque derrière celles de devant (profil), un peu rentrées par la perspective.
export const PATTES = [
  { h: [-15.5, 16.5], loin: true, phase: 0.5, avant: false }, { h: [19.5, 17], loin: true, phase: 0.75, avant: true },
  { h: [-19, 15.5], loin: false, phase: 0, avant: false }, { h: [23.5, 17], loin: false, phase: 0.25, avant: true },
];
export const JAMBE = { cuisse: 6.5, tibia: 6.5, appuiPas: 0.75, appuiCourse: 0.52 };
export function membre(p, x0, y0, r0, x1, y1, r1, grossir) {   // un segment de membre effilé, en gros pixels (disques le long du segment)
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, r = r0 + (r1 - r0) * u + grossir;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (w > 0 || r >= 0.5) p.rect(Math.round(x) - w, Math.round(y) + dy, w * 2 + 1, 1);
    }
  }
}
const PATTES_PINCEAU = pinceau(96, 64);                 // les pattes : peintes hors écran, posées d'un seul coup
export function dessinerPattes(d, loin, jeu) {
  const sol = G - SOL_Y, S = foulee(), [cdx, cdy] = [d.corps.dx, d.corps.dy];
  const teinte = jeu === 'blanc' ? ['#ffffff', '#ffffff', '#ffffff', '#ffffff'] : jeu === 'fantome' ? ['#646464', '#646464', '#646464', '#646464']
    : loin ? ['#050505', '#0d0d0d', '#1d1d1d', '#3a3a3a'] : ['#050505', '#262626', '#676767', '#b9b9b9'];   // contour, chair, liseré, griffes
  const os = [];
  for (const pt of PATTES) {
    if (pt.loin !== loin) continue;
    const hx = pt.h[0] + cdx, hy = pt.h[1] - 2 + Math.round(cdy);          // la hanche, un peu dans le corps : pas de jointure visible
    // le pied : planté pendant l'appui (il recule à la vitesse du sol), puis levé en arc pour se reposer devant
    const appui = mix(JAMBE.appuiPas, JAMBE.appuiCourse, d.vif);
    const p = frac(d.allure - pt.phase - (pt.avant ? 0.25 * d.vif : 0)), a = d.amp;   // (la patte arrière lève, puis l'avant du même côté)
    let fx, fy = sol - 1;
    if (p < appui) fx = pt.h[0] + S * appui * (0.5 - p / appui) * a;
    else {                                                                 // le pied se lève en arc, file vers l'avant, se repose en douceur
      const u = (p - appui) / (1 - appui), e = u * u * (3 - 2 * u);
      fx = pt.h[0] + S * appui * (-0.5 + e) * a; fy = sol - 1 - (3.5 + 2 * d.vif) * Math.sin(Math.PI * Math.pow(u, 0.8)) * a;
    }
    const dessous = caseA(Math.floor((d.x + Math.sign(d.fs || 1) * fx) / TP), Math.floor(J.P.sol / TP));
    if (!bloque(dessous) && dessous !== CORNICHE) { fx = pt.h[0] + 1.5; fy = hy + JAMBE.cuisse + JAMBE.tibia - 2; }   // rien sous la patte : elle pend
    // cinématique inverse : cuisse et tibia, le genou (ou le jarret) vers l'arrière
    const dx = fx - hx, dy = fy - hy, dist = Math.min(Math.hypot(dx, dy), JAMBE.cuisse + JAMBE.tibia - 0.01);
    const ang = Math.atan2(dy, dx), b = Math.acos(clamp((JAMBE.cuisse ** 2 + dist ** 2 - JAMBE.tibia ** 2) / (2 * JAMBE.cuisse * dist), -1, 1));
    const kx = hx + JAMBE.cuisse * Math.cos(ang + b), ky = hy + JAMBE.cuisse * Math.sin(ang + b);
    const t = Math.atan2(fy - ky, fx - kx), px = kx + JAMBE.tibia * Math.cos(t), py = ky + JAMBE.tibia * Math.sin(t);
    os.push({ hx, hy, kx, ky, px, py });
  }
  // trois passes pour toutes les pattes du côté : contour, chair, puis lumière (les pattes se recouvrent proprement)
  const p = PATTES_PINCEAU;
  p.debut(Math.min(...os.map((o) => Math.min(o.hx, o.kx, o.px))) - 6, Math.min(...os.map((o) => Math.min(o.hy, o.ky, o.py))) - 6);
  p.couleur(teinte[0]);
  for (const o of os) { membre(p, o.hx, o.hy, 2.2, o.kx, o.ky, 1.2, 1); membre(p, o.kx, o.ky, 1.2, o.px, o.py, 0.8, 1); membre(p, o.px - 1, o.py, 1, o.px + 3, o.py + 0.5, 0.6, 1); }
  p.couleur(teinte[1]);
  for (const o of os) { membre(p, o.hx, o.hy, 2.2, o.kx, o.ky, 1.2, 0); membre(p, o.kx, o.ky, 1.2, o.px, o.py, 0.8, 0); membre(p, o.px - 1, o.py, 1, o.px + 3, o.py + 0.5, 0.6, 0); }
  for (const o of os) {
    p.couleur(teinte[2]);                                                  // le liseré de lune sur l'avant du membre
    p.rect(Math.round(o.kx) + 1, Math.round(o.ky) - 1, 1, 2); p.rect(Math.round((o.kx + o.px) / 2) + 1, Math.round((o.ky + o.py) / 2), 1, 1);
    p.couleur(teinte[3]);                                                  // deux griffes au bout de la patte
    p.rect(Math.round(o.px) + 4, Math.round(o.py) + 1, 1, 1); p.rect(Math.round(o.px) + 2, Math.round(o.py) + 2, 1, 1);
  }
  p.poser(ctx);
}

export function autour(q, rot, dx = 0, dy = 0) { ctx.translate(q.p[0] + dx, q.p[1] + dy); ctx.rotate(rot); ctx.translate(-q.p[0], -q.p[1]); }
export function transformer(q, d, loin) {
  switch (q.role) {
    case 'aile': {
      const w = d.aile, [qx, qy] = q.a || [q.p[0] - 10, q.p[1]], b = Math.atan2(q.p[1] - qy, q.p[0] - qx);
      ctx.translate(q.p[0], q.p[1]); ctx.rotate(b + w.rot);
      ctx.scale(w.sx * (loin ? LOIN.sx : 1), w.s * (loin ? LOIN.s : 1));
      ctx.rotate(-b); ctx.translate(-q.p[0], -q.p[1]);
      break;
    }
    case 'tete': autour(q, d.tete.rot, Math.round(d.tete.dx), Math.round(d.tete.dy)); break;
    case 'queue': autour(q, d.queues && d.queues[q.nom] !== undefined ? d.queues[q.nom] : d.queue); break;
    case 'cavalier': autour(q, d.cavalier.rot, 0, Math.round(d.cavalier.dy)); break;
    case 'jambe': { const [a, h] = (d.jambes && d.jambes[q.nom]) || [0, 0]; autour(q, a, 0, Math.round(h)); break; }
  }
}
export function dessinerPosture(d, jeu) {
  if (d.type === 'planche') {
    ctx.save();
    ctx.translate(Math.round(d.x), Math.round(d.y));
    ctx.scale(largeurDemiTour(d.fs), 1);
    ctx.drawImage(J.PL[jeu], d.i * FW, AN[d.an].row * FH, FW, FH, -Math.round(AX), -Math.round(AY), FW, FH);
    ctx.restore();
    return;
  }
  const L = J.PIECES[jeu][d.pose], tete = L.find((q) => q.role === 'tete');
  // demi-tour : 0 au repos, 1 au milieu ; la tête a déjà tourné, le corps se cabre et s'écrase, la queue traîne
  const tour = Math.sin(Math.PI * clamp((1 - d.fs * J.P.face) / 2, 0, 1));
  d.tourne = Math.sign(d.fs) !== J.P.face && Math.abs(d.fs) < 0.65;   // le corps n'a pas fini de tourner, la tête si
  d.queue = (d.queue || 0) + 0.6 * tour;
  ctx.save();
  const auSolPose = d.pose === 'sol', e = d.ecrase || 0;
  if (tour) {                                          // volte-face : ailes levées et écartées, le miroir passe caché derrière
    d.aile = { ...d.aile, s: d.aile.s * (1 + 0.45 * tour), rot: d.aile.rot - 0.3 * tour };
    d.ecart = 1 + 2.2 * tour;
  }
  ctx.translate(auPixel(d.x, J.cam), auPixel(d.y - (auSolPose ? 4 : 3) * tour, J.camY));
  if (e) { ctx.translate(0, G); ctx.scale(1 + 0.1 * e, 1 - 0.12 * e); ctx.translate(0, -G); }   // écrasé par l'impact, pattes au sol
  ctx.scale(largeurDemiTour(d.fs), 1 + (auSolPose ? 0.04 : 0.08) * tour);
  if (d.pitch || tour) ctx.rotate((d.pitch || 0) - (auSolPose ? 0.2 : 0.3) * tour);
  ctx.translate(Math.round(d.corps.dx), Math.round(d.corps.dy));
  for (const q of L) if (q.double) {                  // l'aile opposée, plus sombre, derrière tout (écartée pendant la volte-face)
    const k = d.ecart || 1;
    ctx.save(); ctx.translate(LOIN.dx * k, LOIN.dy * k); transformer(q, d, true); ctx.drawImage(q.loin, q.o[0], q.o[1]); ctx.restore();
  }
  let fond = false, devant = false;
  for (const q of L) {
    if (d.pose === 'sol' && !fond && q.z >= 0) { dessinerPattes(d, true, jeu); fond = true; }     // pattes du fond, derrière le corps
    if (d.pose === 'sol' && !devant && q.z > 0) { dessinerPattes(d, false, jeu); devant = true; } // pattes de devant, sur le corps
    ctx.save();
    const lignee = [];                                   // la pièce suit tous ses parents (la tête, les segments de queue…)
    for (let a = q; a; a = a.parent ? L.find((x) => x.nom === a.parent) : null) lignee.unshift(a);
    // demi-tour : la tête se retourne la première et regarde déjà de l'autre côté
    if (d.tourne && (q === tete || q.parent === 'tete')) { ctx.translate(tete.p[0], tete.p[1]); ctx.scale(-1, 1); ctx.translate(-tete.p[0], -tete.p[1]); }
    for (const a of lignee) transformer(a, d, false);
    const v = q.role === 'tete' && d.teteVariante >= 0 && q.variantes[d.teteVariante];
    if (q === tete && !v && d.cligne && tete.oeil && jeu === 'normal') {  // clignement : la paupière couvre l'œil
      ctx.drawImage(q.img, q.o[0], q.o[1]);
      const [ox, oy, ow, oh] = tete.oeil;
      ctx.fillStyle = '#161616'; ctx.fillRect(q.o[0] + ox, q.o[1] + oy, ow, oh); ctx.fillStyle = '#5c5c5c'; ctx.fillRect(q.o[0] + ox, q.o[1] + oy + oh - 1, ow, 1);
      ctx.restore(); continue;
    }
    if (v) ctx.drawImage(v.img, v.o[0], v.o[1]);                      // la vraie tête d'attaque, gueule ouverte
    else ctx.drawImage(q.role === 'aile' && d.aile.s < 0 ? q.dessous : q.role === 'jambe' && q.z < 0 ? q.loin : q.img, q.o[0], q.o[1]);   // pattes du fond, plus sombres
    ctx.restore();
  }
  ctx.restore();
}
// l'ombre : un ovale tramé (Bayer, calé sur la grille du monde), préparé une fois par taille, densité et phase de trame
const OVALES = new Map();
function ovaleTrame(rx, ry, force, phx, phy) {
  const cle = `${rx},${ry},${force},${phx},${phy}`;
  let t = OVALES.get(cle);
  if (t) return t;
  if (OVALES.size > 300) OVALES.clear();
  const p = pinceau(rx * 2 + 1, ry * 2 + 1);
  p.debut(0, 0); p.couleur('#050505');
  for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
    const d = (dx / rx) ** 2 + (dy / ry) ** 2, x = dx + rx + phx, y = dy + ry + phy;
    if (d < 1 && (1 - d) * force > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16) p.rect(dx + rx, dy + ry, 1, 1);
  }
  t = toile(rx * 2 + 1, ry * 2 + 1);
  p.poser(t.getContext('2d'));
  OVALES.set(cle, t);
  return t;
}
export const largeurDemiTour = (fs) => (fs < 0 ? -1 : 1) * (0.55 + 0.45 * Math.abs(fs));   // jamais une feuille de papier
export function dessinerDragon() {
  const d = posture();
  const sol = solSous(J.P.x, J.P.y - 4);                       // ombre sur le premier sol en dessous
  if (sol !== null) {
    // un ovale tramé, dense au centre, qui pâlit et rétrécit quand le dragon s'élève ; il ne se pose que sur
    // le sol qui le porte, à cette hauteur : il s'arrête net au bord du vide ou d'un mur
    const haut = clamp((sol - J.P.y - G) / 160, 0, 1), rx = Math.round(40 * (1 - haut * 0.55)), ry = Math.max(2, Math.round(rx * 0.07));
    const cx = Math.round(J.P.x + J.P.fs * 6), ty = sol / TP, force = 1.15 * (1 - haut * 0.7);
    const porte = (tx) => { const t = caseA(tx, ty); return (bloque(t) || t === CORNICHE) && !bloque(caseA(tx, ty - 1)); };
    const img = ovaleTrame(rx, ry, Math.round(force * 32) / 32, (cx - rx) & 3, (sol - ry) & 3);
    // posé par morceaux : seulement au-dessus des cases qui le portent
    for (let tx = Math.floor((cx - rx) / TP), fin = Math.floor((cx + rx) / TP); tx <= fin; tx++) {
      if (!porte(tx)) continue;
      let t2 = tx;
      while (t2 < fin && porte(t2 + 1)) t2++;
      const a = Math.max(cx - rx, tx * TP), b = Math.min(cx + rx + 1, (t2 + 1) * TP);
      ctx.drawImage(img, a - (cx - rx), 0, b - a, img.height, a, sol - ry, b - a, img.height);
      tx = t2;
    }
  }
  for (const o of J.ombres) { ctx.globalAlpha = 0.5 * o.vie / 0.2; dessinerPosture(o.d, 'fantome'); }
  ctx.globalAlpha = 1;
  const clignote = J.P.inv > 0 && J.P.pv > 0 && J.P.ruee < 0 && J.P.mal < 0 && Math.floor(J.temps * 30) % 2;
  if (clignote) return;
  if (J.P.flash > 0) { dessinerPosture(d, 'blanc'); return; }
  dessinerPosture(d, 'normal');
  if (J.reperes) {
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(Math.round(J.P.x) - 4, Math.round(J.P.y), 9, 1); ctx.fillRect(Math.round(J.P.x), Math.round(J.P.y) - 4, 1, 9);
    ctx.strokeStyle = '#3bffb0'; ctx.lineWidth = 1;
    const bas = J.P.mode === 'air' || J.P.mode === 'jump' || J.P.mode === 'fall' ? J.P.y + BAS : J.P.sol, haut = J.P.mode === 'air' || J.P.mode === 'jump' || J.P.mode === 'fall' ? J.P.y - HAUT : J.P.sol - CORPS_SOL;
    ctx.strokeRect(Math.round(J.P.x - LARG) + 0.5, Math.round(haut) + 0.5, LARG * 2, Math.round(bas - haut));
    texte(`${J.P.mode} · ${d.type === 'rig' ? 'marionnette' : d.an + ' ' + (d.i + 1)} · souffle ${Math.round(J.P.souffle * 100)}`.toUpperCase(), Math.round(J.cam) + 6, Math.round(J.camY) + J.H - 12, '#9fb4c8');
  }
}
