"""Icônes de l'application (PWA) : le dragon qui crache son feu devant la pleine lune, en pixels du jeu.

Composées à partir des sprites du jeu (assets/), en 128 × 128 pixels de jeu, puis agrandies en pixels nets.
Usage : python3 outils/icones.py   (écrit src/icones/)
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / 'src' / 'icones'
PIXEL = RACINE / 'assets' / 'pixel-artist'
BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
NUIT = (7, 7, 7, 255)


def image_du_dragon():
    meta = json.loads((PIXEL / 'dragon_propre.json').read_text(encoding='utf-8'))
    planche = Image.open(PIXEL / 'dragon_propre.png').convert('RGBA')
    fw, fh = meta['frameWidth'], meta['frameHeight']
    a = meta['animations']['attack']
    img = planche.crop((3 * fw, a['row'] * fh, 4 * fw, (a['row'] + 1) * fh))   # gueule ouverte, le feu devant
    img = img.crop(img.getbbox())
    # le souffle, au bout de la gueule, prend les couleurs du feu du jeu : la seule lumière chaude du monde
    px, feu = img.load(), [(224, 112, 46), (240, 160, 80), (255, 217, 160), (244, 244, 244)]
    for y in range(img.height):
        for x in range(img.width - 40, img.width):
            r, g, b, al = px[x, y]
            lum = (r + g + b) / 3
            if al and lum > 110:
                px[x, y] = feu[min(3, int((lum - 110) / 145 * 4))] + (al,)
    return img


def lune(r):
    """Un disque d'os tramé : plein au centre, qui s'assombrit vers le bord (le limbe)."""
    t = 2 * r + 1
    img = Image.new('RGBA', (t, t), (0, 0, 0, 0))
    px = img.load()
    tons = [(236, 235, 230), (209, 209, 205), (170, 170, 166), (128, 128, 125)]
    for y in range(t):
        for x in range(t):
            d = ((x - r) ** 2 + (y - r) ** 2) ** 0.5 / r
            if d > 1:
                continue
            v = (1 - d) * 3.2 + 0.4 - 0.25 * ((x - r) / r)      # un peu plus claire à gauche
            k = max(0, min(3, int(3 - v + (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16)))
            px[x, y] = tons[k] + (255,)
    return img


def composer(cote, marge):
    """cote : taille en pixels de jeu ; marge : part du bord laissée libre (icônes « maskable »)."""
    img = Image.new('RGBA', (cote, cote), NUIT)
    d = ImageDraw.Draw(img)
    for i, (x, y) in enumerate([(9, 14), (23, 8), (104, 18), (116, 40), (14, 96), (30, 60), (98, 108), (119, 88)]):
        if i % 2 or marge == 0:
            d.point((round(x * cote / 128), round(y * cote / 128)), fill=(160, 160, 156, 255))
    m = lune(round(cote * (0.30 if marge == 0 else 0.25)))
    img.alpha_composite(m, (round(cote * 0.60 - m.width / 2), round(cote * 0.40 - m.height / 2)))
    dragon = image_du_dragon()
    utile = cote * (1 - 2 * marge)
    if dragon.width > utile:                                   # (seulement pour les très petites icônes)
        f = utile / dragon.width
        dragon = dragon.resize((round(dragon.width * f), round(dragon.height * f)), Image.NEAREST)
    img.alpha_composite(dragon, (round((cote - dragon.width) / 2), round(cote * 0.60 - dragon.height / 2)))
    return img


def agrandir(img, taille):
    """Agrandit en pixels nets (facteur entier), puis ramène à la taille exacte."""
    f = -(-taille // img.width)
    net = img.resize((img.width * f, img.height * f), Image.NEAREST)
    return net if net.width == taille else net.resize((taille, taille), Image.LANCZOS)


SORTIE.mkdir(parents=True, exist_ok=True)
normale, masquable = composer(128, 0), composer(128, 0.1)
for taille in (180, 192, 512):
    agrandir(normale, taille).convert('RGB').save(SORTIE / f'icone-{taille}.png', optimize=True)
agrandir(masquable, 512).convert('RGB').save(SORTIE / 'icone-masquable-512.png', optimize=True)
print('icônes écrites dans', SORTIE.relative_to(RACINE))
