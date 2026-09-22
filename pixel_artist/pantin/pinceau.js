// Un pinceau logiciel (livré avec Pantin, le moteur de marionnette de Pixel Artist) : les formes faites de centaines
// de petits rectangles (membres d'une marionnette, ombre tramée) sont peintes dans un tampon de pixels, puis posées
// sur l'écran en un seul appel de dessin. Sur téléphone, c'est le nombre d'appels de dessin par image qui coûte,
// pas le nombre de pixels.
const toile = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

const RGBA = new Map();
function rgba(hex) {                                   // '#rrggbb' → pixel du tampon (octets R, G, B, A en mémoire)
  let v = RGBA.get(hex);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    v = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
    RGBA.set(hex, v);
  }
  return v;
}

export function pinceau(largeur, hauteur) {
  const surface = toile(largeur, hauteur), g = surface.getContext('2d');
  const image = g.createImageData(largeur, hauteur), px = new Uint32Array(image.data.buffer);
  let ox = 0, oy = 0, c = 0, sale = false;
  return {
    // commence une forme : (x, y) est le coin haut-gauche de la zone peinte, dans le repère où elle sera posée
    debut(x, y) { ox = Math.floor(x); oy = Math.floor(y); if (sale) px.fill(0); sale = false; },
    couleur(hex) { c = rgba(hex); },
    rect(x, y, l, h) {
      const x0 = Math.max(0, x - ox), y0 = Math.max(0, y - oy), x1 = Math.min(largeur, x - ox + l), y1 = Math.min(hauteur, y - oy + h);
      for (let yy = y0; yy < y1; yy++) px.fill(c, yy * largeur + x0, yy * largeur + x1);
      if (x1 > x0 && y1 > y0) sale = true;
    },
    poser(ctx) {
      if (!sale) return;
      g.putImageData(image, 0, 0);
      ctx.drawImage(surface, ox, oy);
    },
  };
}
