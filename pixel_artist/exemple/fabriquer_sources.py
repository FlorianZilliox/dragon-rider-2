"""Dessine par code les images sources de l'exemple, à la place d'images générées (aucun appel à l'API, aucun coût).

  sources/collines.png   ce que produirait le brief briefs/collines.json : collines, tour en ruine, arbre mort,
                         fond transparent, plus un oiseau égaré dans le ciel (la recette le retire avec « garder »)
  sources/piece.png      une « planche » dessinée à la main : 4 images d'une pièce qui tourne, côte à côte

Usage : python3 pixel_artist/exemple/fabriquer_sources.py   (Pillow suffit ; le résultat est toujours le même)
"""
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps

ICI = Path(__file__).resolve().parent
SOMBRE, CLAIR = '#1b1530', '#e8d9b0'          # simple mise en couleur : pixeliser.py ne garde que les valeurs


def degrade_vertical(w, h, haut, bas):
    """Image en niveaux de gris : valeur « haut » en haut, « bas » en bas."""
    g = Image.linear_gradient('L').resize((w, h))            # 0 en haut, 255 en bas
    return g.point(lambda v: round(haut + (bas - haut) * v / 255))


def collines():
    w, h = 768, 512
    masque = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(masque)
    # ligne de crête qui se répète tous les 90 % de la largeur : la recette fond les 10 % restants (« raccord »: 0.1)
    # dans le début de l'image, donc un motif de cette période boucle sans marche
    periode = w * 0.9
    crete = [(x, 300 + 38 * math.sin(2 * math.pi * x / periode) + 14 * math.sin(2 * math.pi * x / periode * 3 + 1)) for x in range(0, w + 1, 4)]
    d.polygon(crete + [(w, h), (0, h)], fill=255)
    # tour en ruine : corps, créneaux, sommet brisé
    d.rectangle([470, 150, 540, 420], fill=255)          # enfoncée dans la colline
    for x in range(470, 540, 18):
        d.rectangle([x, 136, x + 10, 150], fill=255)
    d.polygon([(470, 150), (478, 118), (492, 138), (505, 100), (515, 150)], fill=255)
    # arbre mort : tronc et branches
    for (x0, y0, x1, y1, e) in [(180, 380, 186, 210, 9), (184, 240, 150, 205, 5), (185, 225, 222, 190, 5),
                                (160, 214, 146, 186, 3), (212, 198, 230, 170, 3)]:
        d.line([x0, y0, x1, y1], fill=255, width=e)
    # oiseau égaré dans le ciel : un îlot détaché que « garder »: « bas » doit retirer
    d.polygon([(90, 80), (110, 92), (130, 80), (110, 100)], fill=255)

    valeurs = degrade_vertical(w, h, 215, 25)                 # lumière de lune par le haut : crête claire, pied sombre
    reliefs = Image.new('L', (w, h), 0)
    r = ImageDraw.Draw(reliefs)
    for k in range(14):                                       # rochers et fenêtres : taches sombres
        x = (k * 97) % 560 + 90                               # hors de la bande de raccord
        y = 360 + (k * 53) % 120
        r.ellipse([x, y, x + 40 + (k % 3) * 12, y + 16], fill=70)
    r.rectangle([496, 190, 512, 222], fill=150)
    r.rectangle([496, 260, 512, 290], fill=150)
    valeurs = ImageChops.subtract(valeurs, reliefs)

    image = ImageOps.colorize(valeurs, SOMBRE, CLAIR).convert('RGBA')
    image.putalpha(masque)
    return image


def piece():
    w, h = 512, 128
    planche = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for k, largeur in enumerate([1.0, 0.62, 0.16, 0.62]):    # la pièce tourne : elle s'amincit puis revient
        cx, cy, ry = k * 128 + 64, 64, 48
        rx = max(4, round(48 * largeur))
        valeurs = Image.new('L', (w, h), 0)
        masque = Image.new('L', (w, h), 0)
        dv, dm = ImageDraw.Draw(valeurs), ImageDraw.Draw(masque)
        dm.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
        dv.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=90)                    # tranche sombre
        ix = max(2, rx - 7)
        dv.ellipse([cx - ix, cy - ry + 7, cx + ix, cy + ry - 7], fill=190)             # face
        if rx > 20:                                                                   # motif en relief : une étoile
            etoile = [(cx + (0.55 if i % 2 else 1) * 20 * largeur * math.sin(i * math.pi / 5),
                       cy - (0.55 if i % 2 else 1) * 20 * math.cos(i * math.pi / 5)) for i in range(10)]
            dv.polygon(etoile, fill=240)
        dv.ellipse([cx - ix // 2, cy - ry + 12, cx, cy - ry + 26], fill=255)          # reflet
        couleur = ImageOps.colorize(valeurs, SOMBRE, CLAIR).convert('RGBA')
        couleur.putalpha(masque)
        planche.alpha_composite(couleur)
    return planche


if __name__ == '__main__':
    (ICI / 'sources').mkdir(exist_ok=True)
    collines().save(ICI / 'sources' / 'collines.png', optimize=True)
    piece().save(ICI / 'sources' / 'piece.png', optimize=True)
    print(f"→ {ICI / 'sources'} : collines.png, piece.png")
