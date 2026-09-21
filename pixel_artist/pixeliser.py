"""Pixel Artist · pixelisation : transforme des images (générées ou dessinées) en vrai pixel art pour un jeu.

Outil indépendant de tout jeu : tout se règle dans une recette JSON.

  {
    "nom": "terres",
    "palette": { "rampe": ["#050505", "#e4e2dc"], "teintes": 16 }     (ou une liste explicite de couleurs, du sombre au clair)
    "sources": "../generes/manifest.json",                          (les sources par nom, via le manifeste de generer.py)
    "sortie": "../../assets/decors",
    "elements": {
      "ciel":     { "source": "terres-ciel", "largeur": 768, "tons": [0, 9], "tramage": 0.8 },
      "lointain": { "source": "terres-lointain", "largeur": 1024, "alpha": true, "raccord": 0.1, "tons": [6, 11], "rogner": true, "garder": "bas" }
    }
  }

Pour chaque élément : recadrage éventuel, raccord horizontal sans couture (fondu sur une bande, pour les plans
qui défilent en boucle), réduction à la taille du jeu (moyenne par surface, alpha prémultiplié), transparence
nette, suppression des îlots (et, avec « garder » : "bas" ou "haut", de tout ce qui ne tient pas au bas ou au haut du motif), puis projection sur une plage de teintes de la palette avec tramage ordonné
(Bayer 4 × 4) : la profondeur se règle par la plage de teintes (un plan lointain n'utilise que des gris clairs).
Planches : avec « objets », l'image est découpée en objets (de gauche à droite), réduits de « echelle », rangés
dans une grille (« cellule », « rects » dans le JSON) ; « regarde » note le sens de la créature.
Autres options : « raccord_v » (texture raccordable aussi en hauteur), « contour » (liseré sombre autour du motif,
pour les petits objets ; « contour_ton » choisit sa teinte), « recadrer » ([x0, y0, x1, y1] en fractions de l'image source).

Usage : python3 pixel_artist/pixeliser.py <recette.json> [--seul element]
Sorties : <sortie>/<nom>/<element>.png, <sortie>/<nom>.json (tailles, décalages), <sortie>/<nom>-apercu.png
Dépendances : Pillow, numpy, scipy.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], float) / 16 + 1 / 32


def echec(message, action=None):
    print(f"\nÉCHEC : {message}" + (f"\n→ {action}" if action else ''), file=sys.stderr)
    sys.exit(1)


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def lineaire(c):          # sRGB 0..255 -> linéaire 0..1
    c = np.asarray(c, float) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(l):              # linéaire 0..1 -> sRGB 0..255
    l = np.clip(l, 0, 1)
    return np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055) * 255


def clarte(rgb):          # clarté perceptive (L d'OKLab), 0..1
    lin = lineaire(rgb)
    l = 0.4122214708 * lin[..., 0] + 0.5363325363 * lin[..., 1] + 0.0514459929 * lin[..., 2]
    m = 0.2119034982 * lin[..., 0] + 0.6806995451 * lin[..., 1] + 0.1073969566 * lin[..., 2]
    s = 0.0883024619 * lin[..., 0] + 0.2817188376 * lin[..., 1] + 0.6299787005 * lin[..., 2]
    return 0.2104542553 * np.cbrt(l) + 0.7936177850 * np.cbrt(m) - 0.0040720468 * np.cbrt(s)


def palette(desc):
    """Liste de couleurs (du plus sombre au plus clair), ou rampe interpolée à clarté régulière."""
    if isinstance(desc, list):
        cols = np.array([hex_rgb(h) for h in desc])
    elif isinstance(desc, dict) and 'rampe' in desc:
        a, b = (hex_rgb(h) for h in desc['rampe'])
        n = int(desc.get('teintes', 16))
        la, lb = clarte(a), clarte(b)
        cols = []
        for k in range(n):          # on cherche, pour chaque clarté cible, le mélange (en linéaire) qui l'atteint
            cible = la + (lb - la) * k / (n - 1)
            lo, hi = 0.0, 1.0
            for _ in range(40):
                t = (lo + hi) / 2
                c = srgb(lineaire(a) * (1 - t) + lineaire(b) * t)
                lo, hi = (t, hi) if clarte(c) < cible else (lo, t)
            cols.append(np.round(srgb(lineaire(a) * (1 - t) + lineaire(b) * t)))
        cols = np.array(cols)
    else:
        echec("palette illisible dans la recette.", 'donner une liste de couleurs "#rrggbb" ou { "rampe": [sombre, clair], "teintes": n }.')
    ordre = np.argsort(clarte(cols))
    return cols[ordre]


def raccorder(a, part):
    """Rend l'image raccordable horizontalement : la fin se fond dans le début sur une bande (alpha prémultiplié)."""
    n = a.shape[1]
    w = max(2, int(n * part))
    m = n - w
    pre = a.copy()
    pre[..., :3] *= pre[..., 3:4]
    out = pre[:, :m].copy()
    t = (np.arange(w) / w)[None, :, None]
    out[:, :w] = pre[:, m:] * (1 - t) + pre[:, :w] * t
    alpha = out[..., 3:4]
    out[..., :3] = np.where(alpha > 1e-6, out[..., :3] / np.maximum(alpha, 1e-6), 0)
    return out


def reduire(a, largeur):
    h = max(1, round(a.shape[0] * largeur / a.shape[1]))
    pre = a.copy()
    pre[..., :3] *= pre[..., 3:4]
    canaux = [np.array(Image.fromarray(pre[..., k].astype(np.float32)).resize((largeur, h), Image.BOX)) for k in range(4)]
    out = np.stack(canaux, -1)
    alpha = out[..., 3:4]
    out[..., :3] = np.where(alpha > 1e-6, out[..., :3] / np.maximum(alpha, 1e-6), 0)
    return out


def traiter(img, el, cols, bornes=None):
    a = np.array(img.convert('RGBA')).astype(float) if not isinstance(img, np.ndarray) else img.copy()
    if a[..., 3].max() > 1:
        a[..., 3] /= 255
    if 'recadrer' in el:                         # fractions [x0, y0, x1, y1]
        x0, y0, x1, y1 = el['recadrer']
        H, W = a.shape[:2]
        a = a[round(y0 * H):round(y1 * H), round(x0 * W):round(x1 * W)]
    if not el.get('alpha'):
        a[..., 3] = 1
    if el.get('raccord'):
        a = raccorder(a, el['raccord'])
    if el.get('raccord_v'):                      # texture qui se répète aussi verticalement
        a = raccorder(a.transpose(1, 0, 2), el['raccord_v']).transpose(1, 0, 2)
    a = reduire(a, int(el['largeur']))
    opaque = a[..., 3] >= el.get('seuil_alpha', 0.5)
    if el.get('alpha'):
        mini = el.get('ilot_min', 6)
        lab, n = ndi.label(opaque)
        if n:
            tailles = ndi.sum(opaque, lab, range(1, n + 1))
            opaque &= np.isin(lab, 1 + np.flatnonzero(tailles >= mini))
        garder = el.get('garder', 'bas' if el.get('base') else None)
        if garder in ('bas', 'haut'):            # ne garder que ce qui tient au bas (ou au haut) du motif : retire lunes, bosquets égarés…
            lab, n = ndi.label(opaque)
            lignes = np.flatnonzero(opaque.any(1))
            if len(lignes):
                y0, y1 = lignes[0], lignes[-1] + 1
                bande = max(2, (y1 - y0) // 25)
                tranche = lab[y1 - bande:y1] if garder == 'bas' else lab[y0:y0 + bande]
                gardes = np.unique(tranche)
                opaque &= np.isin(lab, gardes[gardes > 0])
        trous = ndi.binary_fill_holes(opaque) & ~opaque
        lab, n = ndi.label(trous)
        if n:
            tailles = ndi.sum(trous, lab, range(1, n + 1))
            opaque |= np.isin(lab, 1 + np.flatnonzero(tailles <= 2))
    # valeur -> plage de teintes, tramage ordonné
    L = clarte(a[..., :3])
    if el.get('etirer', True) and (opaque.any() or bornes):
        bas, haut = bornes if bornes else np.percentile(L[opaque], [1, 99])
        L = np.clip((L - bas) / max(1e-6, haut - bas), 0, 1)
    L = L ** el.get('gamma', 1.0)
    t0, t1 = el.get('tons', [0, len(cols) - 1])
    f = t0 + L * (t1 - t0)
    h, w = f.shape
    seuil = 0.5 + (np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w] - 0.5) * el.get('tramage', 0.7)
    idx = np.clip(np.floor(f) + ((f - np.floor(f)) > seuil), t0, t1).astype(int)
    if el.get('contour') and opaque.any():      # liseré sombre sur le bord du motif : lisible même minuscule
        bord = opaque & ~ndi.binary_erosion(opaque, np.ones((3, 3), bool), border_value=0)
        idx = np.where(bord, el.get('contour_ton', t0), idx)
    transparent = len(cols)                      # index réservé à la transparence
    ind = np.where(opaque, idx, transparent).astype(np.uint8)
    decalage = [0, 0]
    if el.get('rogner') and opaque.any():
        ys, xs = np.nonzero(opaque)
        if el.get('raccord'):                    # un plan raccordable garde toute sa largeur
            xs = np.array([0, w - 1])
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        ind = ind[y0:y1, x0:x1]
        decalage = [int(x0), int(y0)]
    img = Image.fromarray(ind)
    img.putpalette([int(v) for c in cols for v in c] + [0, 0, 0])
    img.info['transparency'] = transparent
    return img, {'taille': [ind.shape[1], ind.shape[0]], 'decalage': decalage,
                 'hauteurAvantRognage': h, 'raccord': bool(el.get('raccord'))}


def planche_objets(img, el, cols):
    """Découpe une planche (images d'animation, objets posés côte à côte) : un morceau par objet, de gauche à droite,
    tous réduits à la même échelle et avec les mêmes teintes, rangés dans une grille de cases identiques."""
    a = np.array(img.convert('RGBA')).astype(float)
    a[..., 3] /= 255
    masque = a[..., 3] > 0.5
    rayon = max(2, int(el.get('joindre', 0.012) * masque.shape[1]))       # rapproche les éclats d'un même objet
    lab, n = ndi.label(ndi.binary_dilation(masque, iterations=rayon))
    boites = [(k + 1, b) for k, b in enumerate(ndi.find_objects(lab)) if b is not None]
    aires = [int((masque[b] & (lab[b] == k)).sum()) for k, b in boites]
    boites = [kb for kb, ar in zip(boites, aires) if ar >= max(aires) * el.get('aire_min', 0.08)]
    boites.sort(key=lambda kb: kb[1][1].start)
    if el.get('attendus') and len(boites) != el['attendus']:
        # les objets se touchent (traînées de fumée…) : on découpe la planche en colonnes égales
        print(f"  {len(boites)} objet(s) trouvé(s) au lieu de {el['attendus']} : découpe en {el['attendus']} colonnes égales")
        ys, xs = np.nonzero(masque)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        lab = np.zeros(masque.shape, int)
        bords = np.linspace(x0, x1, el['attendus'] + 1).round().astype(int)
        boites = []
        for k in range(el['attendus']):
            lab[y0:y1, bords[k]:bords[k + 1]] = k + 1
            boites.append((k + 1, (slice(y0, y1), slice(bords[k], bords[k + 1]))))
    L = clarte(a[..., :3])
    bornes = tuple(np.percentile(L[masque], [1, 99]))
    f = el['echelle']
    morceaux = []
    for etiquette, b in boites:
        m = (lab[b] == etiquette) & masque[b]              # seulement cet objet, pas les éclats de ses voisins
        crop = a[b].copy()
        crop[..., 3] *= m
        largeur = max(1, round(crop.shape[1] * f))
        img_k, info = traiter(crop, {**el, 'largeur': largeur, 'rogner': True, 'alpha': True, 'raccord': 0}, cols, bornes)
        morceaux.append((img_k, info))
    cw = max(i.width for i, _ in morceaux)
    ch = max(i.height for i, _ in morceaux)
    feuille = Image.new('P', (cw * len(morceaux), ch), len(cols))
    feuille.putpalette([int(v) for c in cols for v in c] + [0, 0, 0])
    rects = []
    for k, (im, _) in enumerate(morceaux):
        x = k * cw + (cw - im.width) // 2
        y = (ch - im.height) // 2 if el.get('ancre', 'centre') == 'centre' else ch - im.height
        feuille.paste(im, (x, y))
        rects.append([x, y, im.width, im.height])
    return feuille, {'taille': [feuille.width, feuille.height], 'cellule': [cw, ch], 'images': len(morceaux),
                     'rects': rects, 'regarde': el.get('regarde', 'gauche'), 'raccord': False, 'decalage': [0, 0]}


def main():
    args = sys.argv[1:]
    if not args:
        echec('indiquer une recette.', 'python3 pixel_artist/pixeliser.py <recette.json> [--seul element]')
    chemin = Path(args[0]).resolve()
    if not chemin.is_file():
        echec(f'recette introuvable : {chemin}')
    seul = args[args.index('--seul') + 1] if '--seul' in args else None
    rec = json.loads(chemin.read_text(encoding='utf-8'))
    ici = chemin.parent
    cols = palette(rec['palette'])
    manifeste = {}
    if rec.get('sources'):
        mf = (ici / rec['sources']).resolve()
        if not mf.is_file():
            echec(f'manifeste des sources introuvable : {mf}', 'lancer d\'abord pixel_artist/generer.py sur le projet.')
        manifeste = json.loads(mf.read_text(encoding='utf-8'))
        base_sources = mf.parent.parent
    sortie = (ici / rec.get('sortie', 'sortie')).resolve()
    (sortie / rec['nom']).mkdir(parents=True, exist_ok=True)
    desc_f = sortie / f"{rec['nom']}.json"
    desc = json.loads(desc_f.read_text(encoding='utf-8')) if desc_f.is_file() else {}
    desc.update({'nom': rec['nom'], 'palette': ['#%02x%02x%02x' % tuple(int(v) for v in c) for c in cols]})
    desc.setdefault('elements', {})
    apercus = []
    for nom, el in rec['elements'].items():
        if seul and nom != seul:
            continue
        src = el['source']
        if src in manifeste:
            if manifeste[src].get('essai'):
                echec(f"« {src} » n'est qu'un essai à blanc.", 'lancer la vraie génération (generer.py sans --essai).')
            fichier = base_sources / manifeste[src]['fichier']
        else:
            fichier = (ici / src).resolve()
        if not fichier.is_file():
            echec(f"source introuvable pour « {nom} » : {src}", "vérifier le nom dans le manifeste ou le chemin.")
        img, info = planche_objets(Image.open(fichier), el, cols) if el.get('objets') else traiter(Image.open(fichier), el, cols)
        img.save(sortie / rec['nom'] / f'{nom}.png', optimize=True, bits=4 if len(cols) < 16 else 8, transparency=len(cols))   # 15 teintes + transparence : 4 bits par pixel
        desc['elements'][nom] = {'image': f"{rec['nom']}/{nom}.png", **info}
        apercus.append((nom, img.convert('RGBA')))
        print(f"  {nom} : {info['taille'][0]}×{info['taille'][1]}{' (raccordable)' if info['raccord'] else ''}")
    desc_f.write_text(json.dumps(desc, indent=1, ensure_ascii=False), encoding='utf-8')
    if apercus:                                   # aperçu : chaque élément sur fond de contrôle, ×2
        larg = max(i.width for _, i in apercus) * 2 + 20
        haut = sum(i.height * 2 + 20 for _, i in apercus)
        ap = Image.new('RGB', (larg, haut), (120, 40, 110))
        y = 0
        for _, i in apercus:
            ap.paste(i.resize((i.width * 2, i.height * 2), Image.NEAREST), (10, y + 10), i.resize((i.width * 2, i.height * 2), Image.NEAREST))
            y += i.height * 2 + 20
        ap.save(sortie / f"{rec['nom']}-apercu.png")
    print(f"→ {sortie / rec['nom']}  ({len(apercus)} élément(s), palette de {len(cols)} teintes)")


if __name__ == '__main__':
    main()
