// ================= Pantin : le moteur de marionnette de Pixel Artist =================
// Il fait vivre, dans n'importe quel jeu HTML5 (canvas 2D), un personnage que pixel_artist.py a redessiné et découpé
// en os : chaque pièce est un os (pivot, parent, ordre de dessin z), le corps est la racine. Le jeu décrit à chaque
// image l'angle, le décalage et l'étirement de quelques os ; Pantin calcule toute la chaîne (une queue en trois
// segments suit sa croupe, qui suit le corps), dessine les pièces dans l'ordre, y insère les couches que le jeu peint
// lui-même (des membres en cinématique inverse), et sait dire où se trouve un point porté par un os.
// Aucune dépendance : copier le dossier pantin/ dans le projet. Mode d'emploi : pantin/README.md.
import { pinceau } from './pinceau.js';

export { pinceau };
const toile = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

// ---------------------------------------------------------------- teintes
// la silhouette d'une image, toute d'une couleur (flash blanc, ombre portée, fantôme…)
export function silhouette(src, teinte) {
  const c = toile(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = teinte; g.fillRect(0, 0, c.width, c.height);
  return c;
}
// la même image, plus sombre (f < 1) ou plus claire (f > 1), sans sortir de la palette : chaque couleur devient la
// couleur de la palette la plus proche de (couleur × f). Pour une pièce du côté lointain, ou le dessous d'une aile.
export function reteinter(src, f, palette) {
  const table = new Map(palette.map((c) => {
    const cible = c.map((v) => Math.min(255, v * f));
    let best = c, bd = Infinity;
    for (const q of palette) { const d = (q[0] - cible[0]) ** 2 + (q[1] - cible[1]) ** 2 + (q[2] - cible[2]) ** 2; if (d < bd) { bd = d; best = q; } }
    return [c.join(','), best];
  }));
  const c = toile(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const q = p[i + 3] && table.get(p[i] + ',' + p[i + 1] + ',' + p[i + 2]);
    if (q) { p[i] = q[0]; p[i + 1] = q[1]; p[i + 2] = q[2]; }
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ---------------------------------------------------------------- matrices (même convention que le canvas)
// [a, b, c, d, e, f] : x' = a·x + c·y + e, y' = b·x + d·y + f ; chaque opération multiplie à droite, comme ctx.translate…
const copier = (m, s) => { m[0] = s[0]; m[1] = s[1]; m[2] = s[2]; m[3] = s[3]; m[4] = s[4]; m[5] = s[5]; return m; };
const unite = (m) => { m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 1; m[4] = 0; m[5] = 0; return m; };
function translater(m, x, y) { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
function tourner(m, t) {
  if (!t) return;
  const c = Math.cos(t), s = Math.sin(t), a = m[0], b = m[1];
  m[0] = a * c + m[2] * s; m[1] = b * c + m[3] * s; m[2] = -a * s + m[2] * c; m[3] = -b * s + m[3] * c;
}
function etirer(m, sx, sy) { m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
function multiplier(m, s) {
  const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5];
  m[0] = a * s[0] + c * s[1]; m[1] = b * s[0] + d * s[1]; m[2] = a * s[2] + c * s[3]; m[3] = b * s[2] + d * s[3];
  m[4] = a * s[4] + c * s[5] + e; m[5] = b * s[4] + d * s[5] + f;
}

// ---------------------------------------------------------------- chargement
// desc : le JSON écrit par pixel_artist.py ; atlas : son image (chargée). Options :
//   teintes   : { nom: '#rrggbb' } des jeux de silhouettes (ex. { blanc: '#ffffff' }) ; « normal » existe toujours ;
//   reteintes : { nom: facteur } des versions reteintes de chaque pièce (ex. { loin: 0.55, dessous: 1.2 }) ;
//               dans un jeu de silhouettes, elles sont la silhouette elle-même.
export function chargerPantin(desc, atlas, { teintes = {}, reteintes = {} } = {}) {
  const palette = (desc.palette || []).map(hexRgb), jeux = ['normal', ...Object.keys(teintes)];
  const decouper = ([x, y, w, h]) => { const c = toile(w, h); c.getContext('2d').drawImage(atlas, x, y, w, h, 0, 0, w, h); return c; };
  const images = (base, avecReteintes) => {
    const r = {};
    for (const j of jeux) {
      const img = j === 'normal' ? base : silhouette(base, teintes[j]);
      r[j] = { img };
      if (avecReteintes) for (const [nom, f] of Object.entries(reteintes)) r[j][nom] = j === 'normal' ? reteinter(base, f, palette) : img;
    }
    return r;
  };
  const poses = {};
  for (const [nom, p] of Object.entries(desc.poses)) poses[nom] = creerPose(nom, p, decouper, images);
  return { poses, jeux, palette, membre: desc.membre || null };
}

function creerPose(nomPose, p, decouper, images) {
  // l'origine de la pose, calée sur un pixel entier : une pièce posée à cheval sur deux pixels serait échantillonnée
  // au gré des arrondis du calcul (des colonnes doublées ou perdues, qui changent d'une image à l'autre)
  const ax = Math.floor(p.ancre[0]), ay = Math.floor(p.ancre[1]), rel = (q) => [q[0] - ax, q[1] - ay];
  const racine = p.calques.some((c) => c.nom === 'corps') ? 'corps' : null;
  const os = p.calques.map((c) => ({
    nom: c.nom, role: c.role, z: c.z || 0, double: !!c.double,
    nomParent: c.parent || (c.nom !== racine ? racine : null),
    p: c.pivot ? rel(c.pivot) : [0, 0], a: c.axe ? rel(c.axe) : null, o: rel(c.origine),
    jeux: images(decouper(c.atlas), true),
    variantes: (c.variantes || []).map((v) => ({ o: rel(v.origine), jeux: images(decouper(v.atlas), false) })),
    m: new Float64Array(6), md: new Float64Array(6),     // sa matrice dans le repère de la pose (et celle de sa copie opposée)
  }));
  const parNom = Object.fromEntries(os.map((o) => [o.nom, o]));
  for (const o of os) {
    if (o.nomParent && !parNom[o.nomParent]) throw new Error(`Pantin, pose « ${nomPose} » : l'os « ${o.nom} » a pour parent « ${o.nomParent} », qui n'existe pas.`);
    o.parent = o.nomParent ? parNom[o.nomParent] : null;
    o.axeAngle = o.a ? Math.atan2(o.p[1] - o.a[1], o.p[0] - o.a[0]) : 0;
  }
  const profondeur = (o) => (o.parent ? 1 + profondeur(o.parent) : 0);
  const chaine = [...os].sort((a, b) => profondeur(a) - profondeur(b));   // les parents avant leurs enfants
  const ordre = [...os].sort((a, b) => a.z - b.z);                      // l'ordre de dessin, du fond vers l'avant
  const membres = (p.membres || []).map((m) => ({ ...m, attache: rel(m.attache) }));
  for (const m of membres) if (!parNom[m.os]) throw new Error(`Pantin, pose « ${nomPose} » : le membre « ${m.nom} » est porté par l'os « ${m.os} », qui n'existe pas.`);
  const pose = { nom: nomPose, os, parNom, chaine, ordre, membres, taille: p.taille, sol: p.sol === null || p.sol === undefined ? null : p.sol - ay };
  const cadre = creerCadre(pose);
  pose.cadre = (reglages) => cadre.calculer(reglages);
  return pose;
}

// ---------------------------------------------------------------- une image de la marionnette
// reglages = {
//   os: { nom: { rot, dx, dy, sx, sy, miroir, variante, image, cache } },  (tout est facultatif)
//       rot : angle (radians) autour du pivot ; dx, dy : décalage (arrondi au pixel) ; sx, sy : étirement —
//       le long de l'axe de la pièce si elle en a un (une aile se replie autour de sa ligne d'attache) ;
//       miroir : retournée autour de son pivot (une tête qui regarde déjà de l'autre côté) ;
//       variante : le numéro d'une variante (tête d'attaque…) ; image : une reteinte (« dessous »…) ; cache : ne pas la dessiner.
//       L'os « corps » (la racine) porte tout le reste : son dx, dy déplace toute la marionnette.
//   double: { dx, dy, sx, sy, image }  la copie opposée des pièces « double » (l'aile du fond), derrière tout.
// }
// Le cadre calculé dit où est chaque os (porte, versOs) et dessine la marionnette (dessiner).
const NEUTRE = {};
function creerCadre(pose) {
  let R = null;
  const cadre = {
    calculer(reglages) {
      R = reglages || NEUTRE;
      const regl = R.os || NEUTRE, dbl = R.double;
      for (const o of pose.chaine) {
        const g = regl[o.nom] || NEUTRE, m = o.parent ? copier(o.m, o.parent.m) : unite(o.m);
        local(m, o, g, 1, 1);
        if (o.double) {                                // la copie opposée : même chaîne, décalée et étirée
          const md = unite(o.md);
          if (dbl) translater(md, dbl.dx || 0, dbl.dy || 0);
          if (o.parent) multiplier(md, o.parent.m);
          local(md, o, g, dbl && dbl.sx !== undefined ? dbl.sx : 1, dbl && dbl.sy !== undefined ? dbl.sy : 1);
        }
      }
      return cadre;
    },
    // un point porté par un os (dans le repère de l'os au repos) → repère de la pose
    porte(nom, [x, y]) {
      const m = pose.parNom[nom].m;
      return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    },
    // l'inverse : un point du repère de la pose → repère de l'os au repos
    versOs(nom, [X, Y]) {
      const m = pose.parNom[nom].m, det = m[0] * m[3] - m[1] * m[2], x = X - m[4], y = Y - m[5];
      return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det];
    },
    // dessine dans ctx (déjà placé dans le repère de la pose : position, retournement, tangage…).
    //   jeu : le jeu de teintes ; calques : [{ z, dessiner(ctx, cadre) }] des couches peintes par le jeu, insérées
    //   avant le premier os de z plus grand ; apres(os, ctx, variante) : appelé dans le repère de chaque os, après
    //   son image (une paupière qui se ferme…).
    dessiner(ctx, jeu = 'normal', { calques = [], apres = null } = {}) {
      const regl = R.os || NEUTRE, dbl = R.double;
      for (const o of pose.ordre) if (o.double && !(regl[o.nom] && regl[o.nom].cache)) {   // la copie opposée, derrière tout
        const j = o.jeux[jeu] || o.jeux.normal;
        poser(ctx, o.md, (dbl && dbl.image && j[dbl.image]) || j.img, o.o);
      }
      let c = 0;
      const couches = calques.length > 1 ? [...calques].sort((a, b) => a.z - b.z) : calques;
      for (const o of pose.ordre) {
        while (c < couches.length && couches[c].z < o.z) couches[c++].dessiner(ctx, cadre);
        const g = regl[o.nom] || NEUTRE;
        if (g.cache) continue;
        const v = g.variante >= 0 ? o.variantes[g.variante] : null, j = (v || o).jeux[jeu] || (v || o).jeux.normal;
        ctx.save();
        ctx.transform(o.m[0], o.m[1], o.m[2], o.m[3], o.m[4], o.m[5]);
        const img = (!v && g.image && j[g.image]) || j.img, org = v ? v.o : o.o;
        ctx.drawImage(img, org[0], org[1]);
        if (apres) apres(o, ctx, v ? g.variante : -1);
        ctx.restore();
      }
      while (c < couches.length) couches[c++].dessiner(ctx, cadre);
    },
  };
  return cadre;
}
// la transformation propre d'un os : autour de son pivot, retournement, décalage, rotation, étirement (le long de son axe)
function local(m, o, g, ksx, ksy) {
  const [px, py] = o.p;
  translater(m, px, py);
  if (g.miroir) etirer(m, -1, 1);
  if (g.dx || g.dy) translater(m, Math.round(g.dx || 0), Math.round(g.dy || 0));
  tourner(m, g.rot || 0);
  const sx = (g.sx === undefined ? 1 : g.sx) * ksx, sy = (g.sy === undefined ? 1 : g.sy) * ksy;
  if (sx !== 1 || sy !== 1) {
    if (o.a) { tourner(m, o.axeAngle); etirer(m, sx, sy); tourner(m, -o.axeAngle); } else etirer(m, sx, sy);
  }
  translater(m, -px, -py);
}
function poser(ctx, m, img, o) {
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(img, o[0], o[1]);
  ctx.restore();
}

// ---------------------------------------------------------------- membres en cinématique inverse
// Deux segments (cuisse et tibia, ou bras et avant-bras) de la hanche (hx, hy) vers le pied visé (fx, fy) :
// le genou plie du côté « sens » (+1 : vers l'arrière pour une patte de quadrupède vue de profil, tournée vers +x).
// Hors d'atteinte, le membre se tend vers la cible.
export function ik2(hx, hy, fx, fy, l1, l2, sens = 1) {
  const dx = fx - hx, dy = fy - hy, dist = clamp(Math.hypot(dx, dy), 1e-3, l1 + l2 - 0.01);
  const ang = Math.atan2(dy, dx), b = sens * Math.acos(clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1));
  const kx = hx + l1 * Math.cos(ang + b), ky = hy + l1 * Math.sin(ang + b), t = Math.atan2(fy - ky, fx - kx);
  return { hx, hy, kx, ky, px: kx + l2 * Math.cos(t), py: ky + l2 * Math.sin(t) };
}
// un segment effilé en gros pixels : des disques pleins le long du segment, du rayon r0 au rayon r1 (+ grossir)
export function segmentEffile(p, x0, y0, r0, x1, y1, r1, grossir = 0) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, r = r0 + (r1 - r0) * u + grossir;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (w > 0 || r >= 0.5) p.rect(Math.round(x) - w, Math.round(y) + dy, w * 2 + 1, 1);
    }
  }
}
// peint des membres (résultats d'ik2) avec un pinceau, en trois passes pour qu'ils se recouvrent proprement :
// contour, chair, puis lumière (un liseré sur l'avant du genou et du tibia) et griffes. Un seul appel de dessin.
//   style : { epaisseur: [hanche, genou, cheville], pied: [longueur, talon, bout] } (en pixels) ;
//   teintes : [contour, chair, liseré, griffes] ('#rrggbb', ou null pour ne pas peindre ce détail).
export function peindreMembres(p, liste, style, teintes) {
  if (!liste.length) return;
  const [eh, ek, ec] = style.epaisseur, [lp, pt, pb] = style.pied || [0, 0, 0];
  let x0 = Infinity, y0 = Infinity;
  for (const o of liste) { x0 = Math.min(x0, o.hx, o.kx, o.px); y0 = Math.min(y0, o.hy, o.ky, o.py); }
  p.debut(x0 - 6, y0 - 6);
  const passe = (teinte, g) => {                       // g : le contour déborde d'un pixel autour de la chair
    if (!teinte) return;
    p.couleur(teinte);
    for (const o of liste) {
      segmentEffile(p, o.hx, o.hy, eh, o.kx, o.ky, ek, g);
      segmentEffile(p, o.kx, o.ky, ek, o.px, o.py, ec, g);
      if (lp) segmentEffile(p, o.px - 1, o.py, pt, o.px + lp - 1, o.py + 0.5, pb, g);
    }
  };
  passe(teintes[0], 1); passe(teintes[1], 0);
  for (const o of liste) {
    if (teintes[2]) {
      p.couleur(teintes[2]);
      p.rect(Math.round(o.kx) + 1, Math.round(o.ky) - 1, 1, 2); p.rect(Math.round((o.kx + o.px) / 2) + 1, Math.round((o.ky + o.py) / 2), 1, 1);
    }
    if (teintes[3] && lp) {
      p.couleur(teintes[3]);
      p.rect(Math.round(o.px) + lp, Math.round(o.py) + 1, 1, 1); p.rect(Math.round(o.px) + lp - 2, Math.round(o.py) + 2, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- allures
// La place d'un pied dans son cycle de pas, par rapport à sa hanche. phase : l'allure (un tour par foulée) moins la
// place de ce pied dans le pas (de 0 à 1 : pour un quadrupède au pas, 0, 0,25, 0,5, 0,75 — jamais deux pieds ensemble).
//   appui : part du cycle où le pied est posé (0,75 au pas : une seule patte en l'air à la fois) ;
//   foulee : longueur d'une foulée (pixels) ; levee : hauteur du pied en l'air ; amp : 0 à l'arrêt, 1 en marche.
// Posé, le pied recule à la vitesse du sol (il reste planté) ; levé, il file vers l'avant en arc et se repose en douceur.
export function pas(phase, { appui = 0.75, foulee = 30, levee = 4, amp = 1 } = {}) {
  const p = phase - Math.floor(phase);
  if (p < appui) return { dx: foulee * appui * (0.5 - p / appui) * amp, dy: 0, pose: true, u: p / appui };
  const u = (p - appui) / (1 - appui), e = u * u * (3 - 2 * u);
  return { dx: foulee * appui * (-0.5 + e) * amp, dy: -levee * Math.sin(Math.PI * Math.pow(u, 0.8)) * amp, pose: false, u };
}

// ---------------------------------------------------------------- ressorts
// Un ressort amorti : o[cle] tend vers « cible », sa vitesse est o[cle + 'V']. Peu amorti, il dépasse et revient :
// c'est le mouvement secondaire (une tête qui encaisse, un dos qui plie à l'atterrissage). Une impulsion : o[cle + 'V'] += …
export function ressort(o, cle, cible, raideur, amorti, dt, min = -Infinity, max = Infinity) {
  const v = cle + 'V';
  o[v] = (o[v] || 0) + (raideur * (cible - o[cle]) - amorti * (o[v] || 0)) * dt;
  o[cle] = clamp(o[cle] + o[v] * dt, min, max);
  return o[cle];
}
// Le demi-tour « en volume » : un personnage de profil qui se retourne ne devient jamais une feuille de papier ;
// fs va de 1 à −1 pendant le demi-tour, sa largeur ne descend pas sous « mini ».
export const demiTour = (fs, mini = 0.55) => (fs < 0 ? -1 : 1) * (mini + (1 - mini) * Math.abs(fs));
