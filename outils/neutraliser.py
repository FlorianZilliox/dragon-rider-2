"""Passe un fichier en noir et blanc : chaque couleur #rrggbb froide ou peu saturée devient un gris neutre
de même clarté perçue (L d'OKLab) ; les couleurs chaudes et saturées (feu, sang, or) sont gardées.
Usage : python3 outils/neutraliser.py <fichier> [<fichier>…]   (réécrit les fichiers, liste les changements)
"""
import math
import re
import sys
from pathlib import Path

GARDER = {'#3bffb0', '#9fb4c8'}          # couleurs des repères de mise au point (touche I)


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb(l):
    l = min(1, max(0, l))
    return round(255 * (l * 12.92 if l <= 0.0031308 else 1.055 * l ** (1 / 2.4) - 0.055))


def oklab(h):
    r, g, b = (lin(int(h[i:i + 2], 16)) for i in (1, 3, 5))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(A, B), math.degrees(math.atan2(B, A)) % 360


def neutre(h):
    if h.lower() in GARDER:
        return h
    L, C, teinte = oklab(h.lower())
    if C > 0.08 and (teinte < 100 or teinte > 330):     # feu, sang, or : on garde
        return h
    v = srgb(L ** 3)
    return '#%02x%02x%02x' % (v, v, v)


for f in sys.argv[1:]:
    p = Path(f)
    texte = p.read_text(encoding='utf-8')
    changes = {}
    def remplacer(m):
        n = neutre(m.group(0))
        if n.lower() != m.group(0).lower():
            changes[m.group(0)] = n
        return n
    texte = re.sub(r'#[0-9a-fA-F]{6}\b', remplacer, texte)
    p.write_text(texte, encoding='utf-8')
    print(f"{p.name} : {len(changes)} couleur(s) passées en gris ; gardées : "
          + ', '.join(sorted({c for c in re.findall(r'#[0-9a-fA-F]{6}\b', texte) if oklab(c.lower())[1] > 0.02})))
