import { J } from './etat.js';
import { AN, ATELIER, AX, AY, FH, FPS, FW, G, LOIN, V } from './config.js';
import { PRISE, poseAile } from './dragon.js';
import { BAYER, ctx } from './ecran.js';
import { BAS, CORNICHE, CORPS_SOL, HAUT, LARG, TP, bloque, caseA, solSous } from './niveau.js';
import { clamp, frac, mix, toile } from './outils.js';
import { auPixel } from './terrain.js';
import { texte } from './texte.js';
import { demiTour, ik2, pas, peindreMembres, pinceau } from '../../pixel_artist/pantin/pantin.js';

// ---------- posture : ce qui décrit l'image du dragon à dessiner ----------
// en vol : la marionnette, calculée en continu ; au sol : les images du modèle, redessinées par Pixel Artist
export function posture() {
  const unique = (a, t, fps) => Math.min(Math.floor(t * fps), AN[a].frames - 1);
  const vol = () => {                    // la marionnette en vol : battements, tangage, queue, cavalier
    const ph = frac(J.P.ph);
    return { type: 'rig', pose: 'vol', x: J.P.x, y: J.P.y, fs: J.P.fs, pitch: J.P.pitch, corps: { dx: -J.P.recul * 3, dy: J.P.bob },
             aile: poseAile(J.P), aileBout: poseAile(J.P, RETARD_BOUT), queue: J.P.queue, tete: { dx: 0, dy: -1.5 * J.P.amp * Math.sin(2 * Math.PI * (ph - 0.35)) + J.P.teteY, rot: -0.05 * J.P.teteY + 0.05 * J.P.amp * Math.sin(2 * Math.PI * (ph - 0.45)) },
             teteVariante: J.P.atk >= 0 ? unique('attack', J.P.atk, FPS.attack) : -1,
             cavalier: { dy: 1.6 * J.P.amp * Math.sin(2 * Math.PI * (ph - 0.05)) + J.P.cavY, rot: (J.P.ruee >= 0 ? 0.3 : clamp(J.P.vy / V.PIQUE, 0, 1) * 0.2) + J.P.penche },
             queues: { 'queue-2': J.P.q2, 'queue-3': J.P.q3 }, cligne: J.P.cligne < 0,
             etire: J.P.mode === 'jump' ? 0.16 * clamp(1 - (J.P.at - DECOLLAGE) / 0.35, 0, 1) : 0,   // l'arrachement du saut : tout le corps s'étire
             dos: J.P.dos + 2.6 * J.P.amp * Math.cos(2 * Math.PI * ph - 0.7), onde: J.P.onde + 2.8 * J.P.amp * Math.sin(2 * Math.PI * ph - 1.3) };
  };
  // la marionnette au sol ; o : ce qui s'y ajoute (s'accroupir, ailes levées, tête basse, s'affaisser…)
  const sol = (o = {}) => {
    const freine = clamp(J.P.derape / 0.3, 0, 1), g = J.P.allure, amp = clamp(Math.abs(J.P.vx) / V.MARCHE, 0, 1) * (o.fige ? 0 : 1) * (1 - freine), vif = clamp((Math.abs(J.P.vx) - V.MARCHE) / (V.COURSE - V.MARCHE), 0, 1);
    const souffle = o.repos || o.mort ? 0 : Math.sin(J.temps * 2.2) * (1 - amp), bas = o.bas || 0;
    // La marche vient des pieds. Chaque ceinture (les hanches, les épaules) s'enfonce juste après la pose de ses pieds
    // et remonte quand la patte passe sous elle. Au pas latéral, les pieds avant suivent les arrière d'un quart de
    // foulée : les deux ceintures se balancent à contretemps, et le dos tangue doucement, comme celui d'un cheval,
    // deux fois par foulée. La colonne accompagne (la croupe descend quand le poitrail monte) ; la tête et le cavalier
    // compensent et restent presque de niveau. Les à-coups de chaque pied (ressorts, voir secondaires) font le reste.
    const c = Math.cos(4 * Math.PI * (g - ENCAISSE)), aH = amp * mix(0.7, 1.1, vif), aF = amp * mix(1, 1.5, vif);
    const tangue = (-aF * c - aH * c) / ENTRAXE, ondeRythme = 0.7 * amp * c;
    const teteBouge = 38 * tangue - 21 * TRONC.K * ondeRythme, cavBouge = 31 * tangue - 14 * TRONC.K * ondeRythme, tourne = tangue - TRONC.K * ondeRythme;
    return { type: 'rig', pose: 'sol', x: J.P.x, y: o.y !== undefined ? o.y : J.P.sol - G + SOL_Y, fs: J.P.fs, pieds: o.pieds, surLeSol: o.y === undefined, pitch: tangue + 0.02 * vif - 0.2 * freine + (o.pitch || 0),
             etire: o.etire || 0, freine, agite: o.agite, couche: o.couche || 0, ecarte: o.ecarte || 0,
             corps: { dx: 0.5 * amp * Math.sin(4 * Math.PI * (g - ENCAISSE)) + (o.avance || 0), dy: (aH - aF) / 2 * c + 0.6 * souffle + bas },
             // l'aile repliée : un peu soulevée en course (l'équilibre), elle frémit à chaque pas avant
             aile: { s: (1 - 0.04 * (souffle + 1) + 0.06 * vif + 0.08 * J.P.aileS) * (o.aile || 1), sx: 1, rot: -0.02 * amp * Math.sin(4 * Math.PI * (g - ENCAISSE) - 0.8) - 0.04 * vif + (o.aileRot || 0) },
             queue: J.P.queue + 0.08 * amp * Math.sin(2 * Math.PI * g - 1) + 0.06 * vif + 0.05 * souffle + 0.3 * freine + (o.queue || 0), allure: g, amp, vif,
             // en course, la tête s'allonge et s'abaisse, le dragonnier se penche en avant (le jockey)
             tete: { dx: -2 * J.P.recul + (o.teteAvance || 0) + vif, dy: -0.6 * teteBouge + vif + 0.4 * souffle + (o.tete || 0) + J.P.teteY, rot: -0.85 * tourne + 0.04 * vif - 0.06 * J.P.recul + (o.teteRot || 0) - 0.04 * J.P.teteY },
             teteVariante: J.P.atk >= 0 ? unique('attack', J.P.atk, FPS.attack) : -1,
             cavalier: { dy: -0.35 * cavBouge + 0.4 * souffle + (o.cavalier || 0) + J.P.cavY, rot: -0.6 * tourne + 0.1 * vif + J.P.penche + (o.cavalierRot || 0) },
             queues: { 'queue-2': J.P.q2 + (o.queue || 0) * 0.6, 'queue-3': J.P.q3 + (o.queue || 0) * 0.4 }, cligne: o.mort ? true : J.P.cligne < 0, ecrase: J.P.ecrase,
             dos: J.P.dos - 2 * freine + (o.dos || 0), onde: J.P.onde + ondeRythme + 3.5 * freine + (o.onde || 0) };
  };
  switch (J.P.mode) {
    case 'air': case 'fall': return vol();
    case 'jump': {
      if (!J.P.envol) {                    // l'élan : il s'accroupit, lève les ailes, baisse la tête
        const u = clamp(J.P.at / DECOLLAGE, 0, 1);
        return sol({ fige: true, bas: 5.5 * u, ecarte: u, aile: 1 + 0.3 * u, aileRot: -0.2 * u, tete: 3 * u, cavalier: 2.5 * u, pitch: 0.08 * u, queue: 0.2 * u, dos: 2.5 * u });
      }
      return vol();                      // arraché du sol : nez levé, grand battement
    }
    case 'land': {                       // l'impact écrase le corps, les ailes encore hautes se replient, la tête plonge et remonte
      const u = clamp(J.P.at * FPS.land / AN.land.frames, 0, 1), avant = (1 - Math.min(1, u * 2.5)) ** 2;
      const lourd = 1 + 1.6 * clamp((J.P.impact - 140) / 260, 0, 1);   // plus il tombe de haut, plus il s'écrase
      return sol({ bas: Math.min(6, 3.5 * lourd) * (1 - u), ecarte: 0.8 * (1 - u), aile: 1 + 0.3 * (1 - u), tete: 3.5 * lourd * Math.sin(Math.PI * Math.min(1, u * 1.6)), cavalier: 2.5 * lourd * Math.sin(Math.PI * Math.min(1, u * 1.3)),
                   pitch: 0.16 * avant });           // les pattes avant touchent d'abord (Simba), l'arrière suit
    }
    case 'agrippe': {                    // accroché au rebord (Simba) : griffes sur l'arête, pattes arrière qui pédalent, ailes qui battent fort
      const u = clamp((J.P.at - PRISE.accroche) / PRISE.hisse, 0, 1), b = Math.sin(J.temps * 15), r = J.P.rebord;
      return sol({ fige: true, y: J.P.y, pitch: J.P.pitch, agite: u < 0.6 ? 'arriere' : false,
                   pieds: u < 0.55 ? { avant: [r.x + J.P.face * 3, r.y] } : null,
                   aile: 1.15 + 0.4 * b * (1 - u), aileRot: -0.18 + 0.16 * b * (1 - u), queue: -0.15 + 0.1 * Math.sin(J.temps * 9),
                   tete: -1 * (1 - u), teteRot: -0.15 * (1 - u), cavalier: 1.2, cavalierRot: 0.32 * (1 - u) + 0.1, dos: 1.5 * (1 - u) });
    }
    case 'renverse': {                   // le gros coup au sol : il se cabre comme un cheval monté (jamais sur le dos : il y a le dragonnier),
      // pattes arrière qui glissent, pattes avant qui battent l'air, ailes grandes ouvertes, cavalier couché sur l'encolure ; puis il retombe
      const u = clamp(J.P.at / RENVERSE, 0, 1), r = clamp(u / 0.7, 0, 1), cabre = Math.sin(Math.PI * r) ** 0.8;
      const apres = clamp((u - 0.7) / 0.3, 0, 1), secoue = apres > 0 ? Math.sin(apres * Math.PI * 5) * (1 - apres) : 0;
      return sol({ fige: true, agite: r < 0.92 ? 'avant' : false, pitch: -0.64 * cabre, bas: -12 * cabre + 2.5 * Math.sin(Math.PI * apres),
                   aile: 1.28 - 0.28 * r + 0.06 * Math.sin(J.temps * 26) * cabre, aileRot: -0.22 * cabre, queue: 0.3 * cabre,   // la queue se pose en appui
                   tete: -1.5 * cabre, teteRot: -0.28 * cabre + 0.25 * secoue, cavalier: 1.5 * cabre, cavalierRot: 0.38 * cabre, dos: -1.5 * cabre });
    }
    case 'dead': {                       // il s'affaisse : corps au sol, tête qui tombe, ailes repliées, queue molle
      const u = clamp(J.P.at * 1.4, 0, 1), e = u * u * (3 - 2 * u);
      return sol({ fige: true, mort: true, bas: 6 * e, couche: e, aile: 1 - 0.4 * e, aileRot: 0.2 * e, tete: 4 * e, teteRot: 0.35 * e, cavalier: 3 * e, cavalierRot: 0.5 * e, queue: 0.25 * e });
    }
    default:
      if (J.P.accroupi > 0.05 && J.tenuBas && J.P.atk < 0) return sol({ fige: true, bas: 3 * clamp(J.P.accroupi / 0.15, 0, 1), ecarte: clamp(J.P.accroupi / 0.15, 0, 1), aile: 1.06, tete: 1.5 });   // accroupi : ressort bandé
      if (J.P.atk >= 0 && Math.abs(J.P.vx) < V.COURSE * 0.8) {     // le jet de feu au sol : un rugissement (Simba) — il plonge en avant, se ramasse, revient
        const u = clamp(J.P.atk / 0.36, 0, 1), L = u < 0.16 ? Math.sin(Math.PI / 2 * u / 0.16) : Math.cos(Math.PI / 2 * (u - 0.16) / 0.84) ** 2 - 0.12 * Math.sin(Math.PI * (u - 0.16) / 0.84);
        return sol({ avance: 6.5 * L, teteAvance: 5 * L, bas: 3.6 * L, aile: 1 + 0.34 * L, aileRot: -0.14 * L, queue: -0.3 * L, teteRot: -0.12 * L, dos: 3.2 * L, onde: -2.2 * L,
                     cavalier: 1.8 * L, cavalierRot: 0.18 * L });   // le dragonnier se tasse pour encaisser
      }
      return Math.abs(J.P.vx) < 5 && J.P.atk < 0 ? sol({ ...vieAuRepos(), repos: true }) : sol();
  }
}
export const RENVERSE = 1.05;                      // durée du cabré sous un gros coup (une bête lourde : rien de précipité)
export const ENCAISSE = 0.07, ENTRAXE = 38;     // le retard d'une ceinture qui encaisse la pose de ses pieds (fraction de foulée) ; des hanches aux épaules (px)
export const RETARD_BOUT = 0.09;                // le bout de l'aile suit le bras avec ce retard (fraction de battement) : il fouette
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
export const foulee = () => mix(24, 40, clamp((Math.abs(J.P.vx) - V.MARCHE) / (V.COURSE - V.MARCHE), 0, 1));   // en courant, des foulées plus longues
// Les quatre pattes sont décrites dans la recette de Pixel Artist (pixel_artist/dragon.json, « membres ») : l'os qui
// les porte (croupe ou poitrail), l'attache (hanche ou épaule), le côté, la place dans le pas.
// Au pas, une marche latérale à quatre temps, comme un grand félin : arrière près, avant près, arrière loin,
// avant loin ; chaque pied reste posé les trois quarts du temps, une seule patte en l'air à la fois.
// En courant, le même pas à quatre temps, plus vif (l'allure d'un cheval de selle rapide) : jamais deux pattes qui
// se posent ensemble — un galop par paires, sur ces pattes courtes et ce corps massif, faisait « rhinocéros ».
// Le dos reste presque horizontal : il porte le dragonnier.
// Les pattes du fond sont presque derrière celles de devant (profil), un peu rentrées par la perspective.
export const JAMBE = { appuiPas: 0.75, appuiCourse: 0.62 };
const PATTES_PINCEAU = pinceau(96, 64);                 // les pattes : peintes hors écran, posées d'un seul coup
const BLANC = ['#ffffff', '#ffffff', '#ffffff', '#ffffff'], FANTOME = ['#646464', '#646464', '#646464', '#646464'];
// un point du monde → le repère de la pose, par l'inverse exact de ce que le dessin a posé (position, retournement,
// tangage, écrasement, demi-tour) : les pieds visent le vrai sol, même quand le corps bascule ou se cabre
function versPose(d, X, Y) {
  const m = d.versPose;
  return [m.a * X + m.c * Y + m.e, m.b * X + m.d * Y + m.f];
}
const OS_PATTES = [];
// les pattes d'un côté, en cinématique inverse : les hanches sont portées par le tronc (la croupe, le poitrail),
// les pieds visent le sol du repère de la pose — le corps qui descend plie donc les genoux, les pieds restent au sol
export function dessinerPattes(d, loin, jeu, cadre) {
  const M = J.PANTIN.membre, solMonde = d.y + G - SOL_Y - 1, S = foulee(), [l1, l2] = M.segments, L = largeurDemiTour(d.fs);
  const teinte = jeu === 'blanc' ? BLANC : jeu === 'fantome' ? FANTOME : M.teintes[loin ? 'loin' : 'pres'];
  const liste = OS_PATTES;
  liste.length = 0;
  J.PANTIN.poses.sol.membres.forEach((m, k) => {
    if (!!m.loin !== loin) return;
    const [hx, hy] = cadre.porte(m.os, m.attache), h0 = m.attache[0];
    let fx, fy, X = null, leve = 0;
    const agite = d.agite === true || (d.agite === 'avant' && m.avant) || (d.agite === 'arriere' && !m.avant);
    if (d.pieds && m.avant && d.pieds.avant) { [fx, fy] = versPose(d, d.pieds.avant[0], d.pieds.avant[1]); fx += m.loin ? -2 : 0; }   // les griffes tiennent l'arête
    else if (agite) { fx = h0 + 3 + 4 * Math.sin(J.temps * 21 + k * 1.9); fy = hy + 8 + 3 * Math.cos(J.temps * 17 + k); }   // cabré : les pattes battent l'air
    else {
      let px = h0 + (m.avant ? 1 : -1) * (2 * (d.ecarte || 0) + (m.avant ? 9 : 8) * (d.couche || 0));   // accroupi : pattes écartées ; couché : allongées
      if (d.freine) px += (m.avant ? 8 : -2) * d.freine;                  // le dérapage : pattes avant en butée devant, arrière sous le corps
      else {                                                              // le pied planté recule à la vitesse du sol, puis se lève en arc
        const q = pas(d.allure - m.pas, { appui: mix(JAMBE.appuiPas, JAMBE.appuiCourse, d.vif), foulee: S, levee: 3.5 + 1.2 * d.vif, amp: d.amp });
        px += q.dx; leve = q.dy;                                          // la patte rase le sol : pas de trot sautillant
      }
      X = d.x + L * px;                                                   // le pied, dans le monde, sur le sol
      [fx, fy] = versPose(d, X, solMonde + leve);
    }
    const dessous = X === null ? null : caseA(Math.floor(X / TP), Math.floor(J.P.sol / TP));
    if (dessous !== null && !bloque(dessous) && dessous !== CORNICHE) { fx = h0 + 1.5; fy = hy + l1 + l2 - 2; }   // rien sous la patte : elle pend
    const o = ik2(hx, hy, fx, fy, l1, l2);                             // le genou (ou le jarret) vers l'arrière
    o.style = (m.avant ? M.avant : M.arriere) || M;                      // la cuisse plus massive que le bras
    liste.push(o);
  });
  peindreMembres(PATTES_PINCEAU, liste, M, teinte);
  PATTES_PINCEAU.poser(ctx);
}

// la posture décrite par le jeu → les réglages des os de la marionnette (un seul objet, réutilisé à chaque image)
const REGLAGES = { os: { corps: {}, croupe: {}, poitrail: {}, tete: {}, cavalier: {}, aile: {}, 'aile-bout': {}, queue: {}, 'queue-2': {}, 'queue-3': {} }, double: { image: 'loin' } };
export const TRONC = { K: 0.05, max: 0.42 };   // la colonne : degrés de pli par pixel de « dos » et d'« onde », et le pli maximal
function reglerOs(d) {
  const o = REGLAGES.os, dos = d.dos || 0, onde = d.onde || 0;
  // le tronc articulé, comme la queue : la croupe (queue, pattes arrière) et le poitrail (cou, tête, cavalier, pattes
  // avant) pivotent autour des reins et du garrot ; le milieu reste l'axe. dos > 0 : il se creuse (les deux bouts
  // remontent) ; < 0 : il se voûte ; onde > 0 : le poitrail se relève, la croupe s'abaisse. Bornés : jamais la tête dans le sol.
  o.corps.dx = d.corps.dx; o.corps.dy = d.corps.dy;
  o.croupe.rot = clamp(TRONC.K * (dos - onde), -TRONC.max, TRONC.max);
  o.poitrail.rot = clamp(-TRONC.K * (dos + onde), -TRONC.max, TRONC.max);
  Object.assign(o.tete, d.tete); o.tete.miroir = d.tourne; o.tete.variante = d.teteVariante;   // demi-tour : la tête a déjà tourné
  o.cavalier.rot = d.cavalier.rot; o.cavalier.dy = d.cavalier.dy;
  for (const [nom, w] of [['aile', d.aile], ['aile-bout', d.aileBout || d.aile]]) {    // l'aile retournée montre son dessous
    const r = o[nom]; r.rot = w.rot; r.sx = w.sx; r.sy = w.s; r.image = w.s < 0 ? 'dessous' : null;
  }
  o.queue.rot = d.queue;
  for (const q of ['queue-2', 'queue-3']) o[q].rot = d.queues && d.queues[q] !== undefined ? d.queues[q] : d.queue;
  const k = d.ecart || 1;                              // l'aile opposée, plus sombre, derrière tout (écartée pendant la volte-face)
  REGLAGES.double.dx = LOIN.dx * k; REGLAGES.double.dy = LOIN.dy * k; REGLAGES.double.sx = LOIN.sx; REGLAGES.double.sy = LOIN.s;
  return REGLAGES;
}
// Rien ne passe sous le sol : ni le bout de la queue (cabré, dérapage), ni le menton (atterrissage lourd). Si une pièce
// descend plus bas que le sol, la queue se relève d'autant, la tête se redresse ; le calcul des os est refait.
const GARDE = 1;                                       // pixels laissés entre la pièce et le sol
function horsDuSol(d, pose, cadre) {
  const inv = new DOMMatrix([d.versPose.a, d.versPose.b, d.versPose.c, d.versPose.d, d.versPose.e, d.versPose.f]).invertSelf();
  const versMonde = (x, y) => inv.b * x + inv.d * y + inv.f, sol = J.P.sol - GARDE;
  for (let passe = 0; passe < 2; passe++) {
    let refaire = false;
    const q = cadre.plusBas('queue-3', versMonde);
    if (q.y > sol) {                                   // la queue se relève autour de sa racine
      const [px, py] = cadre.porte('queue', pose.parNom.queue.p), dist = Math.max(8, Math.abs(q.point[0] - px));
      d.queue += (q.y - sol) / dist; refaire = true;
    }
    const t = cadre.plusBas('tete', versMonde);
    if (t.y > sol) { d.tete = { ...d.tete, dy: d.tete.dy - (t.y - sol) }; refaire = true; }   // la tête se redresse
    if (!refaire) break;
    cadre = pose.cadre(reglerOs(d));
  }
  return cadre;
}
let jeuEnCours = 'normal', postureEnCours = null;
function paupiere(os, g, variante) {                   // clignement : la paupière couvre l'œil
  if (os.role !== 'tete' || variante >= 0 || !postureEnCours.cligne || !os.oeil || jeuEnCours !== 'normal') return;
  const [ox, oy, ow, oh] = os.oeil;
  g.fillStyle = '#161616'; g.fillRect(os.o[0] + ox, os.o[1] + oy, ow, oh); g.fillStyle = '#5c5c5c'; g.fillRect(os.o[0] + ox, os.o[1] + oy + oh - 1, ow, 1);
}
const COUCHES_SOL = [
  { z: -0.5, dessiner: (g, cadre) => dessinerPattes(postureEnCours, true, jeuEnCours, cadre) },    // pattes du fond, derrière le tronc
  { z: 0.5, dessiner: (g, cadre) => dessinerPattes(postureEnCours, false, jeuEnCours, cadre) },   // pattes de devant, sur le corps
], OPTIONS = { calques: COUCHES_SOL, apres: paupiere }, OPTIONS_VOL = { calques: [], apres: paupiere };
export function dessinerPosture(d, jeu) {
  if (d.type === 'planche') {
    ctx.save();
    ctx.translate(Math.round(d.x), Math.round(d.y));
    ctx.scale(largeurDemiTour(d.fs), 1);
    ctx.drawImage(J.PL[jeu], d.i * FW, AN[d.an].row * FH, FW, FH, -Math.round(AX), -Math.round(AY), FW, FH);
    ctx.restore();
    return;
  }
  // demi-tour : 0 au repos, 1 au milieu ; la tête a déjà tourné, le corps se cabre et s'écrase, la queue traîne
  const tour = Math.sin(Math.PI * clamp((1 - d.fs * J.P.face) / 2, 0, 1));
  d.tourne = Math.sign(d.fs) !== J.P.face && Math.abs(d.fs) < 0.65;   // le corps n'a pas fini de tourner, la tête si
  d.queue = (d.queue || 0) + 0.6 * tour;
  ctx.save();
  const monde = ctx.getTransform(), auSolPose = d.pose === 'sol', e = d.ecrase || 0;
  if (tour) {                                          // volte-face : ailes levées et écartées, le miroir passe caché derrière
    d.aile = { ...d.aile, s: d.aile.s * (1 + 0.45 * tour), rot: d.aile.rot - 0.3 * tour };
    if (d.aileBout) d.aileBout = { ...d.aileBout, s: d.aileBout.s * (1 + 0.45 * tour), rot: d.aileBout.rot - 0.3 * tour };
    d.ecart = 1 + 2.2 * tour;
  }
  ctx.translate(auPixel(d.x, J.cam), auPixel(d.y - (auSolPose ? 4 : 3) * tour, J.camY));
  if (e) { ctx.translate(0, G); ctx.scale(1 + 0.16 * e, 1 - 0.2 * e); ctx.translate(0, -G); }   // écrasé par l'impact, pattes au sol
  ctx.scale(largeurDemiTour(d.fs), 1 + (auSolPose ? 0.04 : 0.08) * tour);
  if (d.pitch || tour) ctx.rotate((d.pitch || 0) - (auSolPose ? 0.2 : 0.3) * tour);
  if (d.etire) ctx.scale(1 + d.etire, 1 - 0.5 * d.etire);           // l'arrachement du saut : tout le corps s'allonge
  d.versPose = ctx.getTransform().invertSelf().multiplySelf(monde);   // du monde au repère de la pose (les pieds)
  jeuEnCours = jeu; postureEnCours = d;
  const pose = J.PANTIN.poses[d.pose];
  let cadre = pose.cadre(reglerOs(d));
  if (auSolPose && d.surLeSol) cadre = horsDuSol(d, pose, cadre);
  cadre.dessiner(ctx, jeu, auSolPose ? OPTIONS : OPTIONS_VOL);
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
export const largeurDemiTour = (fs) => demiTour(fs, 0.55);   // jamais une feuille de papier
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
  const clignote = !ATELIER && J.P.inv > 0 && J.P.pv > 0 && J.P.ruee < 0 && J.P.mal < 0 && Math.floor(J.temps * 30) % 2;   // (pas à l'atelier : on étudie chaque image)
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
