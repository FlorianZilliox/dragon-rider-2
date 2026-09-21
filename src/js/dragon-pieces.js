import { J } from './etat.js';
import { POSES } from './config.js';
import { PIXEL } from './donnees.js';
import { hexRgb, toile } from './outils.js';

// ================= Le dragon : pièces redessinées par Pixel Artist =================
J.PIECES = null;   // PIECES[jeu de teintes][pose] = calques triés du fond vers l'avant
J.PL = null;       // PL[jeu de teintes] = planche propre (course, décollage, atterrissage, chute)
export function silhouette(src, teinte) {
  const c = toile(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = teinte; g.fillRect(0, 0, c.width, c.height);
  return c;
}
// chaque couleur de la palette → la couleur de la palette la plus proche de (couleur × f)
export function reteinter(src, f) {
  const pal = PIXEL.palette.map(hexRgb);
  const table = new Map(pal.map((c) => {
    const cible = c.map((v) => Math.min(255, v * f));
    let best = c, bd = Infinity;
    for (const q of pal) { const d = (q[0] - cible[0]) ** 2 + (q[1] - cible[1]) ** 2 + (q[2] - cible[2]) ** 2; if (d < bd) { bd = d; best = q; } }
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
export function construirePieces(atlas) {
  const jeux = { normal: null, blanc: '#ffffff', fantome: '#646464', contour: '#3e3e3e' }, out = {};
  for (const [jeu, teinte] of Object.entries(jeux)) {
    out[jeu] = {};
    for (const [nom, pose] of Object.entries(POSES)) {
      const [ax, ay] = pose.ancre, rel = (q) => [q[0] - ax, q[1] - ay];
      out[jeu][nom] = pose.calques.map((c) => {
        const [x, y, w, h] = c.atlas, base = toile(w, h);
        base.getContext('2d').drawImage(atlas, x, y, w, h, 0, 0, w, h);
        const img = teinte ? silhouette(base, teinte) : base;
        const variantes = (c.variantes || []).map((v) => {
          const [vx, vy, vw, vh] = v.atlas, b = toile(vw, vh);
          b.getContext('2d').drawImage(atlas, vx, vy, vw, vh, 0, 0, vw, vh);
          return { img: teinte ? silhouette(b, teinte) : b, o: rel(v.origine) };
        });
        return { ...c, img, variantes, loin: teinte ? img : reteinter(base, 0.55), dessous: teinte ? img : reteinter(base, 1.2),
                 o: rel(c.origine), p: c.pivot ? rel(c.pivot) : [0, 0], a: c.axe ? rel(c.axe) : null };
      }).sort((a, b) => a.z - b.z);
      const tete = out[jeu][nom].find((q) => q.role === 'tete');
      if (tete && !teinte) tete.oeil = boiteClaire(tete.img);
    }
  }
  return out;
}
export function boiteClaire(img) {             // la boîte des pixels presque blancs (l'œil), pour la paupière
  const g = toile(img.width, img.height).getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4;
    if (d[i + 3] && d[i] > 185) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x1 >= 0 && x1 - x0 < 10 && y1 - y0 < 10 ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null;
}
export function construirePlanche(img) {
  const c = toile(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  return { normal: c, blanc: silhouette(c, '#ffffff'), fantome: silhouette(c, '#646464'), contour: silhouette(c, '#3e3e3e') };
}
