"""Pixel Artist · pixelisation : transforme des images (générées ou dessinées) en vrai pixel art pour un jeu.

Outil indépendant de tout jeu : tout se règle dans une recette JSON. Documentation complète : README.md à côté de ce
script ; liste de toutes les options : --aide.

  {
    "nom": "terres",
    "palette": { "rampe": ["#050505", "#e4e2dc"], "teintes": 15 },    (ou une liste explicite de couleurs, du sombre au clair)
    "sources": "../generes/manifest.json",                          (les sources par nom, via le manifeste de generer.py)
    "sortie": "../../assets/decors",
    "elements": {
      "ciel":     { "source": "terres-ciel", "largeur": 768, "tons": [0, 9], "tramage": 0.8 },
      "lointain": { "source": "terres-lointain", "largeur": 1024, "alpha": true, "raccord": 0.1, "tons": [6, 11], "rogner": true, "garder": "bas" }
    }
  }

Pour chaque élément : recadrage éventuel, raccord horizontal sans couture (fondu sur une bande, pour les plans
qui défilent en boucle), réduction à la taille du jeu (moyenne par surface, alpha prémultiplié), transparence
nette, suppression des îlots (et, avec « garder » : "bas" ou "haut", de tout ce qui ne tient pas au bas ou au haut du
motif), puis projection sur une plage de teintes de la palette avec tramage ordonné (Bayer 4 × 4) : la profondeur se
règle par la plage de teintes (un plan lointain n'utilise que des gris clairs).
Planches : avec « objets », l'image est découpée en objets (de gauche à droite), réduits de « echelle », rangés
dans une grille (« cellule », « rects » dans le JSON) ; « regarde » note le sens de la créature.
Autres options : « raccord_v » (texture raccordable aussi en hauteur), « contour » (liseré sombre autour du motif,
pour les petits objets ; « contour_ton » choisit sa teinte), « recadrer » ([x0, y0, x1, y1] en fractions de l'image source).

Usage : python3 pixel_artist/pixeliser.py <recette.json> [<autre recette.json> …] [--seul element]
Sorties : <sortie>/<nom>/<element>.png, <sortie>/<nom>.json (tailles, décalages), <sortie>/<nom>-apercu.png
Dépendances : Pillow, numpy, scipy (message d'installation clair si l'une manque).
"""
import difflib
import json
import re
import sys
import traceback
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
    from scipy import ndimage as ndi
    MANQUE = None
except ImportError as e:                        # signalé proprement dans main(), après l'éventuelle --aide
    MANQUE = e

BAYER = None if MANQUE else np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], float) / 16 + 1 / 32
FOND_APERCU = (120, 40, 110)                    # fond de contrôle de l'aperçu : une couleur qu'aucun jeu n'utilise

CLES_RECETTE = {
    'nom': "(requis) nom de la série : nomme le dossier <sortie>/<nom>/ et le fichier <sortie>/<nom>.json",
    'palette': "(requise) liste de couleurs \"#rrggbb\" (1 à 255), ou { \"rampe\": [\"#sombre\", \"#clair\"], \"teintes\": n }",
    'sources': "manifeste de generer.py (ex. \"../generes/manifest.json\") pour désigner les sources par nom de brief",
    'sortie': "dossier de sortie, relatif à la recette (défaut : \"sortie\")",
    'elements': "(requis) { \"nom de l'élément\": { options… }, … }",
}
# Options d'un élément : (nom, défaut, effet). Sert à l'aide et à signaler les fautes de frappe.
OPTIONS = [
    ('source', 'requis', "nom d'un brief du manifeste (« sources »), ou chemin d'une image relatif à la recette"),
    ('largeur', 'requis', "largeur finale en pixels du jeu, hauteur proportionnelle (sans objet pour une planche)"),
    ('tons', 'toute la palette', "[t0, t1] : plage d'indices de la palette (0 = le plus sombre) ; règle la profondeur"),
    ('tramage', '0.7', "force du tramage ordonné (Bayer 4 × 4), de 0 (aplats) à 1 (fort)"),
    ('alpha', 'false', "garder la transparence de la source (sinon l'élément est opaque)"),
    ('seuil_alpha', '0.5', "opacité (0 à 1) à partir de laquelle un pixel réduit reste visible"),
    ('ilot_min', '6', "avec alpha : un morceau isolé de moins de ilot_min pixels est effacé"),
    ('garder', 'aucun', "avec alpha : \"bas\" ou \"haut\" : ne garde que ce qui touche le bas (ou le haut) du motif"),
    ('trous_max', '2', "avec alpha : bouche les trous intérieurs jusqu'à cette taille (pixels), avec la couleur de leur bord"),
    ('rogner', 'false', "rogne le vide autour du motif (le décalage est noté dans le JSON)"),
    ('raccord', '0', "fraction de la largeur (ex. 0.1, au plus 0.5) fondue pour un raccord horizontal sans couture"),
    ('raccord_v', '0', "même chose en hauteur (texture qui se répète aussi verticalement)"),
    ('recadrer', 'aucun', "[x0, y0, x1, y1] en fractions de la source (0 à 1), appliqué avant tout le reste"),
    ('etirer', 'true', "étire les valeurs de la source (centiles 1 à 99) sur toute la plage de tons"),
    ('valeurs', 'centiles', "[bas, haut] (0 à 1) : les valeurs de la source étirées sur la plage de tons, fixées au lieu des "
                            "centiles de l'élément : plusieurs pièces découpées dans une même source gardent les mêmes teintes"),
    ('gamma', '1.0', "courbe des valeurs avant projection : > 1 assombrit, < 1 éclaircit"),
    ('contour', 'false', "liseré d'un pixel sur le bord du motif : lisible même minuscule"),
    ('contour_ton', 't0', "indice de palette du liseré"),
    ('lumiere', 'aucune', "liseré de lumière sur les bords tournés vers une source : { \"ton\": 11, \"dx\": 1, \"dy\": -1 } "
                          "(dx = 1 : bords de droite, dy = -1 : bords du haut) ; les bords coupés de l'image ne s'éclairent pas"),
    ('objets', 'false', "planche : découpe la source en objets (images d'animation), rangés dans des cases identiques"),
    ('echelle', 'requis si objets', "planche : facteur de réduction (ex. 0.15 : un objet de 1000 px en fait 150)"),
    ('attendus', 'aucun', "planche : nombre d'objets attendus ; s'il n'est pas trouvé, découpe en colonnes égales"),
    ('joindre', '0.012', "planche : écart (fraction de la largeur) sous lequel deux éclats forment un même objet"),
    ('aire_min', '0.08', "planche : taille minimale d'un objet, en fraction du plus grand (écarte les poussières)"),
    ('ancre', 'centre', "planche : \"centre\" ou \"bas\" (pieds alignés en bas de la case)"),
    ('regarde', 'gauche', "planche : sens du personnage, recopié tel quel dans le JSON pour le jeu"),
    ('base', 'false', "(ancien nom) true équivaut à \"garder\": \"bas\""),
]
CLES_ELEMENT = {k for k, _, _ in OPTIONS}
IGNOREES_PLANCHE = ('largeur', 'rogner', 'alpha', 'raccord')    # imposées par le découpage d'une planche


def commande():
    """La commande telle qu'on peut la retaper sur cette machine (interpréteur et chemin du script détectés)."""
    script = sys.argv[0] if sys.argv and sys.argv[0] else 'pixeliser.py'
    if ' ' in script:
        script = f'"{script}"'
    return f"{Path(sys.executable).stem or 'python3'} {script}"


def aide():
    recette = '\n'.join(f"  {k:<12} {v}" for k, v in CLES_RECETTE.items())
    options = '\n'.join(f"  {k:<12} {d:<17} {e}" for k, d, e in OPTIONS)
    return f"""Pixel Artist · pixelisation : des images (générées ou dessinées) en vrai pixel art pour un jeu

Usage :
  {commande()} <recette.json> [<autre recette.json> …] [--seul <element>]

Options :
  --seul <element>  ne refait que cet élément de la recette (l'aperçu ne montre alors que lui)
  --aide, -h        cette aide

Sorties (dossier « sortie » de la recette) :
  <nom>/<element>.png   PNG indexé (palette + 1 index transparent) ; 15 teintes ou moins : 4 bits par pixel
  <nom>.json            pour le jeu : palette, et par élément taille, décalage, raccord (cellule, rects pour une planche)
  <nom>-apercu.png      tous les éléments ×2 sur fond de contrôle, pour vérifier d'un coup d'œil

Recette ; une clé qui commence par « _ » est un commentaire :
{recette}

Options d'un élément (option, défaut, effet) :
{options}

Documentation complète et exemples : {Path(__file__).resolve().parent / 'README.md'}"""


def console_robuste():
    """Un caractère que la console ne sait pas afficher (Windows, sortie redirigée) ne doit jamais faire planter l'outil."""
    for flux in (sys.stdout, sys.stderr):
        try:
            flux.reconfigure(errors='replace')
        except (AttributeError, ValueError):
            pass


def echec(message, action=None):
    print(f"\nÉCHEC : {message}" + (f"\n→ {action}" if action else ''), file=sys.stderr)
    sys.exit(1)


def avertir(message):
    print(f"  attention : {message}", file=sys.stderr)


def proche(mot, possibles):
    """« vouliez-vous dire … ? » pour une faute de frappe."""
    trouves = difflib.get_close_matches(str(mot), list(possibles), n=1)
    return f" (vouliez-vous dire « {trouves[0]} » ?)" if trouves else ''


def verifier_dependances():
    if MANQUE is None:
        return
    module = {'PIL': 'Pillow'}.get(MANQUE.name, MANQUE.name) if MANQUE.name else None
    en_venv = sys.prefix != getattr(sys, 'base_prefix', sys.prefix)
    installer = f"\"{sys.executable}\" -m pip install {'' if en_venv else '--user '}pillow numpy scipy"
    echec(f"il manque {'le module Python « ' + module + ' »' if module else 'une bibliothèque Python'} "
          f"(pixeliser.py a besoin de Pillow, numpy et scipy).\n  Détail : {MANQUE}",
          f"les installer une fois pour toutes avec :  {installer}")


def lire_json(chemin, quoi, action):
    try:
        return json.loads(chemin.read_text(encoding='utf-8-sig'))     # -sig : tolère le BOM de certains éditeurs Windows
    except json.JSONDecodeError as e:
        echec(f"{quoi} illisible : {chemin}\n  ligne {e.lineno}, colonne {e.colno} : {e.msg}", action)
    except UnicodeDecodeError:
        echec(f"{quoi} illisible : {chemin} n'est pas en UTF-8.", "l'enregistrer en UTF-8.")


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


def couleur_valide(h):
    return isinstance(h, str) and re.fullmatch(r'#?[0-9a-fA-F]{6}', h.strip()) is not None


def verifier_palette(desc, ou):
    exemple = 'donner une liste de couleurs "#rrggbb" (du sombre au clair) ou { "rampe": ["#101010", "#f0f0f0"], "teintes": 15 }.'
    if isinstance(desc, list):
        if not desc:
            echec(f"{ou} : la palette est vide.", exemple)
        if len(desc) > 255:
            echec(f"{ou} : {len(desc)} couleurs dans la palette, 255 au plus (un index est réservé à la transparence).")
        mauvaises = [h for h in desc if not couleur_valide(h)]
        if mauvaises:
            echec(f"{ou} : couleur(s) illisible(s) dans la palette : {', '.join(map(str, mauvaises))}.", 'écrire chaque couleur "#rrggbb", ex. "#1a0608".')
    elif isinstance(desc, dict) and 'rampe' in desc:
        rampe = desc['rampe']
        if not isinstance(rampe, list) or len(rampe) != 2 or not all(couleur_valide(h) for h in rampe):
            echec(f"{ou} : « rampe » doit donner exactement deux couleurs, la plus sombre et la plus claire.", exemple)
        n = desc.get('teintes', 16)
        if isinstance(n, bool) or not isinstance(n, int) or not 2 <= n <= 255:
            echec(f"{ou} : « teintes » doit être un entier de 2 à 255 (reçu : {n}).", "15 teintes + la transparence tiennent en 4 bits par pixel.")
    else:
        echec(f"{ou} : palette illisible.", exemple)


def palette(desc):
    """Liste de couleurs (du plus sombre au plus clair), ou rampe interpolée à clarté régulière."""
    if isinstance(desc, list):
        cols = np.array([hex_rgb(h.strip()) for h in desc])
    else:
        a, b = (hex_rgb(h.strip()) for h in desc['rampe'])
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
    ordre = np.argsort(clarte(cols))
    return cols[ordre]


def est_nombre(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def verifier_element(nom, el, n, ou):
    """Contrôle un élément AVANT tout calcul : une faute dans la recette doit s'expliquer, pas planter à mi-chemin."""
    ici = f"{ou} · élément « {nom} »"

    def err(message, action=None):
        echec(f"{ici} : {message}", action)

    if not nom or re.search(r'[\\/]', nom) or nom in ('.', '..'):
        echec(f"{ou} : nom d'élément invalide « {nom} ».", "un nom simple, sans / ni \\ : il nomme le fichier PNG.")
    if not isinstance(el, dict):
        err("il doit être un objet { \"source\": …, \"largeur\": … }.")
    for k in el:
        if k not in CLES_ELEMENT and not k.startswith('_'):
            avertir(f"{ici} : option inconnue « {k} », ignorée{proche(k, CLES_ELEMENT)}. Liste des options : --aide.")
    if not isinstance(el.get('source'), str) or not el['source'].strip():
        err("« source » manquante.", 'donner le nom d\'un brief (avec « sources ») ou le chemin d\'une image, ex. "source": "../sources/ciel.png".')
    for k in ('alpha', 'rogner', 'contour', 'objets', 'etirer', 'base'):
        if k in el and not isinstance(el[k], bool):
            err(f"« {k} » doit valoir true ou false (sans guillemets), reçu : {json.dumps(el[k], ensure_ascii=False)}.")
    if el.get('objets'):
        if not est_nombre(el.get('echelle')) or el['echelle'] <= 0:
            err("une planche (« objets ») demande « echelle » : un nombre positif.", 'ex. "echelle": 0.15 (un objet de 1000 px en fait 150).')
        for k in IGNOREES_PLANCHE:
            if k in el:
                avertir(f"{ici} : « {k} » est sans effet sur une planche (« objets ») : la taille vient de « echelle ».")
    elif not est_nombre(el.get('largeur')) or int(el['largeur']) < 1:
        err("« largeur » manquante ou invalide : la largeur finale en pixels du jeu.", 'ex. "largeur": 320.')
    bornes = {'tramage': (0, None), 'gamma': (0, None), 'seuil_alpha': (0, 1), 'ilot_min': (0, None),
              'joindre': (0, None), 'aire_min': (0, 1)}
    for k, (mini, maxi) in bornes.items():
        if k in el:
            v = el[k]
            if not est_nombre(v) or v < mini or (maxi is not None and v > maxi) or (k == 'gamma' and v == 0):
                err(f"« {k} » invalide : {json.dumps(v, ensure_ascii=False)} (attendu : un nombre"
                    f"{' entre ' + str(mini) + ' et ' + str(maxi) if maxi is not None else ' positif'}).")
    for k in ('raccord', 'raccord_v'):
        v = el.get(k)
        if v is None or v is False or v == 0:
            continue
        if not est_nombre(v) or not 0 < v <= 0.5:
            err(f"« {k} » doit être une fraction de 0 à 0.5 (ex. 0.1), reçu : {json.dumps(v, ensure_ascii=False)}.")
    if 'attendus' in el and (isinstance(el['attendus'], bool) or not isinstance(el['attendus'], int) or el['attendus'] < 1):
        err("« attendus » doit être un nombre entier d'objets (ex. 4).")
    tons = el.get('tons', [0, n - 1])
    if (not isinstance(tons, list) or len(tons) != 2 or any(isinstance(t, bool) or not isinstance(t, int) for t in tons)
            or not 0 <= tons[0] <= tons[1] <= n - 1):
        err(f"« tons » doit être [t0, t1] avec 0 ≤ t0 ≤ t1 ≤ {n - 1} (la palette a {n} teintes), reçu : {json.dumps(tons)}.")
    if 'valeurs' in el:
        v = el['valeurs']
        if not isinstance(v, list) or len(v) != 2 or not all(est_nombre(x) and 0 <= x <= 1 for x in v) or not v[0] < v[1]:
            err(f"« valeurs » doit être [bas, haut] avec 0 ≤ bas < haut ≤ 1, reçu : {json.dumps(v)}.", 'ex. "valeurs": [0.08, 0.62]')
    if 'lumiere' in el:
        l = el['lumiere']
        if (not isinstance(l, dict) or isinstance(l.get('ton'), bool) or not isinstance(l.get('ton'), int)
                or not 0 <= l['ton'] <= n - 1 or l.get('dx', 0) not in (-1, 0, 1) or l.get('dy', 0) not in (-1, 0, 1)
                or not (l.get('dx', 0) or l.get('dy', 0))):
            err(f"« lumiere » doit être {{ \"ton\": 0 à {n - 1}, \"dx\": -1, 0 ou 1, \"dy\": -1, 0 ou 1 }} (au moins un des deux non nul), "
                f"reçu : {json.dumps(l, ensure_ascii=False)}.", 'ex. "lumiere": { "ton": 11, "dx": 1, "dy": -1 } : lune en haut à droite.')
    if 'contour_ton' in el:
        c = el['contour_ton']
        if isinstance(c, bool) or not isinstance(c, int) or not 0 <= c <= n - 1:
            err(f"« contour_ton » doit être un indice de la palette, de 0 à {n - 1}, reçu : {json.dumps(c)}.")
    if 'recadrer' in el:
        r = el['recadrer']
        if (not isinstance(r, list) or len(r) != 4 or not all(est_nombre(v) and 0 <= v <= 1 for v in r)
                or not (r[0] < r[2] and r[1] < r[3])):
            err(f"« recadrer » doit être [x0, y0, x1, y1] en fractions (0 à 1), avec x0 < x1 et y0 < y1, reçu : {json.dumps(r)}.",
                'ex. [0, 0.5, 1, 1] garde la moitié basse.')
    if el.get('garder') not in (None, 'bas', 'haut'):
        err(f"« garder » vaut \"bas\" ou \"haut\", reçu : {json.dumps(el['garder'], ensure_ascii=False)}.")
    if el.get('ancre', 'centre') not in ('centre', 'bas'):
        err(f"« ancre » vaut \"centre\" ou \"bas\", reçu : {json.dumps(el['ancre'], ensure_ascii=False)}.")


def verifier_recette(rec, chemin):
    ou = f"recette {chemin.name}"
    if not isinstance(rec, dict):
        echec(f"{ou} : le fichier doit contenir un objet JSON {{ … }}.", "partir de l'exemple : pixel_artist/exemple/recettes/.")
    for k in rec:
        if k not in CLES_RECETTE and not k.startswith('_'):
            avertir(f"{ou} : clé inconnue « {k} », ignorée{proche(k, CLES_RECETTE)}.")
    nom = rec.get('nom')
    if not isinstance(nom, str) or not nom.strip() or re.search(r'[\\/]', nom) or nom in ('.', '..'):
        echec(f"{ou} : « nom » manquant ou invalide.", 'un nom simple, ex. "nom": "foret" : il nomme le dossier et le JSON de sortie.')
    if 'palette' not in rec:
        echec(f"{ou} : « palette » manquante.", 'ex. "palette": { "rampe": ["#101018", "#f0ead8"], "teintes": 15 }')
    verifier_palette(rec['palette'], ou)
    for k in ('sources', 'sortie'):
        if k in rec and (not isinstance(rec[k], str) or not rec[k].strip()):
            echec(f"{ou} : « {k} » doit être un chemin entre guillemets, relatif à la recette.")
    elements = rec.get('elements')
    if not isinstance(elements, dict) or not elements:
        echec(f"{ou} : « elements » manquant ou vide.", 'ex. "elements": { "fond": { "source": "../sources/fond.png", "largeur": 320 } }')
    n = len(palette(rec['palette']))
    for nom_el, el in elements.items():
        verifier_element(nom_el, el, n, ou)


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
    if isinstance(img, np.ndarray):              # morceau de planche : RGBA flottant, alpha déjà entre 0 et 1
        a = img.copy()
    else:                                        # image Pillow : alpha 0..255 ramené entre 0 et 1
        a = np.array(img.convert('RGBA')).astype(float)
        a[..., 3] /= 255
    if 'recadrer' in el:                         # fractions [x0, y0, x1, y1]
        x0, y0, x1, y1 = el['recadrer']
        H, W = a.shape[:2]
        a = a[round(y0 * H):round(y1 * H), round(x0 * W):round(x1 * W)]
        if a.shape[0] < 1 or a.shape[1] < 4:
            raise ValueError(f"le recadrage {el['recadrer']} ne laisse presque rien de l'image ({W}×{H} px)")
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
        trous = ndi.binary_fill_holes(opaque) & ~opaque     # bouche les trous du motif (1 ou 2 pixels par défaut)
        lab, n = ndi.label(trous)
        if n:
            tailles = ndi.sum(trous, lab, range(1, n + 1))
            bouches = np.isin(lab, 1 + np.flatnonzero(tailles <= el.get('trous_max', 2)))
            if bouches.any() and el.get('trous_max', 2) > 2:  # un vrai trou : il prend la couleur de son bord, pas le noir
                _, (iy, ix) = ndi.distance_transform_edt(~opaque, return_indices=True)
                a[bouches, :3] = a[iy[bouches], ix[bouches], :3]
            opaque |= bouches
    # valeur -> plage de teintes, tramage ordonné
    L = clarte(a[..., :3])
    if el.get('etirer', True) and (opaque.any() or bornes or 'valeurs' in el):
        bas, haut = bornes if bornes else el['valeurs'] if 'valeurs' in el else np.percentile(L[opaque], [1, 99])
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
    if el.get('lumiere') and opaque.any():      # liseré de lumière : les bords tournés vers la source (lune, feu)
        l = el['lumiere']
        # voisins hors de l'image : on prolonge le bord (une coupe n'est pas une silhouette) ; en boucle si raccordable
        ext = np.pad(opaque, 1, mode='edge')
        if el.get('raccord'):
            ext[1:-1, 0], ext[1:-1, -1] = opaque[:, -1], opaque[:, 0]
        if el.get('raccord_v'):
            ext[0, 1:-1], ext[-1, 1:-1] = opaque[-1], opaque[0]
        eclaire = np.zeros_like(opaque)
        if l.get('dx'):
            eclaire |= opaque & ~ext[1:-1, 1 + l['dx']:ext.shape[1] - 1 + l['dx']]
        if l.get('dy'):
            eclaire |= opaque & ~ext[1 + l['dy']:ext.shape[0] - 1 + l['dy'], 1:-1]
        idx = np.where(eclaire, l['ton'], idx)
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


def planche_objets(img, el, cols, nom=''):
    """Découpe une planche (images d'animation, objets posés côte à côte) : un morceau par objet, de gauche à droite,
    tous réduits à la même échelle et avec les mêmes teintes, rangés dans une grille de cases identiques."""
    a = np.array(img.convert('RGBA')).astype(float)
    a[..., 3] /= 255
    masque = a[..., 3] > 0.5
    if not masque.any():
        raise ValueError("la planche est entièrement transparente : aucun objet à découper")
    if masque.all():
        avertir(f"« {nom} » : la planche n'a aucune transparence, les objets ne peuvent pas être séparés "
                "(générer la planche avec \"fond\": \"transparent\").")
    rayon = max(2, int(el.get('joindre', 0.012) * masque.shape[1]))       # rapproche les éclats d'un même objet
    lab, n = ndi.label(ndi.binary_dilation(masque, iterations=rayon))
    boites = [(k + 1, b) for k, b in enumerate(ndi.find_objects(lab)) if b is not None]
    aires = [int((masque[b] & (lab[b] == k)).sum()) for k, b in boites]
    boites = [kb for kb, ar in zip(boites, aires) if ar >= max(aires) * el.get('aire_min', 0.08)]
    boites.sort(key=lambda kb: kb[1][1].start)
    if len(boites) > 1:                              # planche sur plusieurs rangées : on lit rangée par rangée
        hauteurs = sorted(b[0].stop - b[0].start for _, b in boites)
        pas_rangee = hauteurs[len(hauteurs) // 2] * 0.6
        par_y = sorted(boites, key=lambda kb: (kb[1][0].start + kb[1][0].stop) / 2)
        rangees, courante = [], [par_y[0]]
        for kb in par_y[1:]:
            centre = lambda x: (x[1][0].start + x[1][0].stop) / 2
            if centre(kb) - centre(courante[-1]) > pas_rangee:
                rangees.append(courante); courante = []
            courante.append(kb)
        rangees.append(courante)
        boites = [kb for r in rangees for kb in sorted(r, key=lambda kb: kb[1][1].start)]
    if el.get('attendus') and len(boites) != el['attendus']:
        # les objets se touchent (traînées de fumée…) ou s'éparpillent (braises) : on coupe au milieu des plus
        # larges bandes vides verticales ; s'il n'y en a pas assez, en colonnes égales
        ys, xs = np.nonzero(masque)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        lab = np.zeros(masque.shape, int)
        vide = ~masque[:, x0:x1].any(0)
        bandes, debut = [], None
        for x, v in enumerate(vide):
            if v and debut is None: debut = x
            if not v and debut is not None: bandes.append((x - debut, debut + (x - debut) // 2)); debut = None
        n = el['attendus']
        if len(bandes) >= n - 1:
            coupes = sorted(c for _, c in sorted(bandes, reverse=True)[:n - 1])
            bords = np.array([x0] + [x0 + c for c in coupes] + [x1])
            print(f"  {len(boites)} objet(s) trouvé(s) au lieu de {n} : découpe aux {n - 1} plus larges bandes vides")
        else:                                          # pas assez de vides francs : au plus creux, près des divisions égales
            couverture = ndi.uniform_filter1d(masque[:, x0:x1].sum(0).astype(float), max(3, (x1 - x0) // 200))
            egales = np.linspace(0, x1 - x0, n + 1)
            marge = (x1 - x0) / n * 0.25
            coupes = [int(lo + np.argmin(couverture[int(lo):int(hi) + 1]))
                      for lo, hi in ((max(0, c - marge), min(x1 - x0 - 1, c + marge)) for c in egales[1:-1])]
            bords = np.array([x0] + [x0 + c for c in coupes] + [x1])
            print(f"  {len(boites)} objet(s) trouvé(s) au lieu de {n} : découpe au plus creux près de {n} colonnes égales")
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


def trouver_source(nom, el, ici, manifeste, base_sources, chemin_manifeste):
    """Le fichier image d'un élément : par nom dans le manifeste de generer.py, sinon chemin relatif à la recette."""
    src = el['source']
    if src in manifeste:
        entree = manifeste[src] if isinstance(manifeste[src], dict) else {}
        if entree.get('essai'):
            echec(f"« {src} » (élément « {nom} ») n'est qu'une image vide d'essai à blanc.",
                  'lancer la vraie génération (generer.py sans --essai).')
        if not entree.get('fichier'):
            echec(f"le manifeste {chemin_manifeste} n'indique pas de fichier pour « {src} ».", 'relancer generer.py sur le projet.')
        fichier = base_sources / entree['fichier']
        if not fichier.is_file():
            echec(f"l'image de « {src} » (élément « {nom} ») est notée dans le manifeste, mais le fichier manque : {fichier}",
                  "les images générées ne sont pas versionnées : récupérer le dossier generes/ d'origine, "
                  "ou relancer generer.py sur le projet (payant pour les images manquantes).")
        return fichier
    fichier = (ici / src).resolve()
    if not fichier.is_file():
        if manifeste:
            echec(f"source introuvable pour l'élément « {nom} » : « {src} » n'est ni un brief du manifeste"
                  f"{proche(src, manifeste)} ni un fichier ({fichier}).",
                  "vérifier le nom du brief (et lancer generer.py s'il n'est pas encore généré), "
                  "ou donner le chemin d'une image, relatif à la recette.")
        echec(f"source introuvable pour l'élément « {nom} » : {fichier}",
              "donner le chemin d'une image, relatif au dossier de la recette ; "
              "pour désigner un brief par son nom, ajouter à la recette \"sources\": \"<chemin du manifest.json>\".")
    return fichier


def ouvrir_image(fichier, nom):
    try:
        with Image.open(fichier) as im:
            im.load()
            return im
    except (OSError, SyntaxError, ValueError) as e:
        detail = '' if isinstance(e, Image.UnidentifiedImageError) else f" ({e})"
        echec(f"image illisible pour l'élément « {nom} » : {fichier}{detail}",
              "vérifier que c'est bien une image PNG, JPEG ou WebP complète (la regénérer au besoin).")


def pixeliser_recette(chemin, seul=None):
    rec = lire_json(chemin, 'recette', "corriger le JSON (guillemets droits \"…\", virgules entre les champs, pas de virgule après le dernier).")
    verifier_recette(rec, chemin)
    ici = chemin.parent
    cols = palette(rec['palette'])
    if seul and seul not in rec['elements']:
        echec(f"la recette {chemin.name} n'a pas d'élément « {seul} »{proche(seul, rec['elements'])}.",
              f"éléments de la recette : {', '.join(rec['elements'])}.")
    manifeste, base_sources, mf = {}, None, None
    if rec.get('sources'):
        mf = (ici / rec['sources']).resolve()
        if not mf.is_file():
            echec(f'manifeste des sources introuvable : {mf}', 'lancer d\'abord pixel_artist/generer.py sur le projet '
                  '(ou retirer « sources » de la recette et désigner les images par leur chemin).')
        manifeste = lire_json(mf, 'manifeste des sources', "relancer generer.py sur le projet pour le réécrire.")
        if not isinstance(manifeste, dict):
            echec(f"manifeste des sources illisible : {mf}", "relancer generer.py sur le projet pour le réécrire.")
        base_sources = mf.parent.parent          # le manifeste vit dans <projet>/generes/ ; ses chemins partent du projet
    # toutes les sources sont vérifiées avant de rien écrire
    taches = [(nom, el, trouver_source(nom, el, ici, manifeste, base_sources, mf))
              for nom, el in rec['elements'].items() if not seul or nom == seul]
    sortie = (ici / rec.get('sortie', 'sortie')).resolve()
    (sortie / rec['nom']).mkdir(parents=True, exist_ok=True)
    desc_f = sortie / f"{rec['nom']}.json"
    desc = lire_json(desc_f, 'description existante', f"supprimer {desc_f.name} : il sera recréé.") if desc_f.is_file() else {}
    if not isinstance(desc, dict) or not isinstance(desc.get('elements', {}), dict):
        echec(f"description existante illisible : {desc_f}", f"supprimer {desc_f.name} : il sera recréé.")
    desc.update({'nom': rec['nom'], 'palette': ['#%02x%02x%02x' % tuple(int(v) for v in c) for c in cols]})
    desc.setdefault('elements', {})
    apercus = []
    for nom, el, fichier in taches:
        source = ouvrir_image(fichier, nom)
        try:
            img, info = planche_objets(source, el, cols, nom) if el.get('objets') else traiter(source, el, cols)
        except ValueError as e:
            echec(f"élément « {nom} » : {e}.", "vérifier la source et les options de l'élément (recadrer, seuil_alpha…).")
        if info['taille'][0] * info['taille'][1] and not np.any(np.array(img) != len(cols)):
            avertir(f"« {nom} » est entièrement transparent : vérifier la source, « seuil_alpha », « garder » ou « recadrer ».")
        img.save(sortie / rec['nom'] / f'{nom}.png', optimize=True, bits=4 if len(cols) < 16 else 8, transparency=len(cols))   # 15 teintes + transparence : 4 bits par pixel
        desc['elements'][nom] = {'image': f"{rec['nom']}/{nom}.png", **info}
        apercus.append((nom, img.convert('RGBA')))
        print(f"  {nom} : {info['taille'][0]}×{info['taille'][1]}{' (raccordable)' if info['raccord'] else ''}")
    desc_f.write_text(json.dumps(desc, indent=1, ensure_ascii=False), encoding='utf-8')
    anciens = [k for k in desc['elements'] if k not in rec['elements']]
    if anciens:
        print(f"  note : {desc_f.name} décrit encore {', '.join(anciens)}, absent(s) de la recette "
              f"(gardé(s) ; supprimer {desc_f.name} pour repartir de zéro).")
    if apercus:                                   # aperçu : chaque élément sur fond de contrôle, ×2
        larg = max(i.width for _, i in apercus) * 2 + 20
        haut = sum(i.height * 2 + 20 for _, i in apercus)
        ap = Image.new('RGB', (larg, haut), FOND_APERCU)
        y = 0
        for _, i in apercus:
            ap.paste(i.resize((i.width * 2, i.height * 2), Image.NEAREST), (10, y + 10), i.resize((i.width * 2, i.height * 2), Image.NEAREST))
            y += i.height * 2 + 20
        ap.save(sortie / f"{rec['nom']}-apercu.png")
    print(f"→ {sortie / rec['nom']}  ({len(apercus)} élément(s), palette de {len(cols)} teintes)")


def analyser_arguments(args):
    recettes, seul = [], None
    i = 0
    while i < len(args):
        a = args[i]
        if a in ('--aide', '-h', '--help'):
            print(aide())
            sys.exit(0)
        elif a == '--seul':
            if i + 1 >= len(args) or args[i + 1].startswith('-'):
                echec("--seul attend le nom d'un élément de la recette.", f"exemple : {commande()} <recette.json> --seul ciel")
            seul = args[i + 1]
            i += 1
        elif a.startswith('-'):
            echec(f"option inconnue : {a}{proche(a, ['--seul', '--aide'])}.", f"options possibles : --seul <element>, --aide ({commande()} --aide).")
        else:
            recettes.append(a)
        i += 1
    if not recettes:
        echec('indiquer une recette.', f'{commande()} <recette.json> [--seul element]   (aide : --aide)')
    if seul and len(recettes) > 1:
        echec("--seul s'emploie avec une seule recette.")
    return recettes, seul


def main():
    console_robuste()
    recettes, seul = analyser_arguments(sys.argv[1:])
    verifier_dependances()
    for r in recettes:
        chemin = Path(r).resolve()
        if not chemin.is_file():
            echec(f'recette introuvable : {chemin}', 'vérifier le chemin du fichier .json (relatif au dossier où la commande est lancée).')
        if len(recettes) > 1:
            print(f"{chemin.name}")
        pixeliser_recette(chemin, seul)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        echec("interrompu à la demande.", "relancer la même commande : chaque élément est refait entièrement.")
    except OSError as e:
        echec(f"lecture ou écriture impossible : {e.filename or ''} ({e.strerror or e})",
              "vérifier que le dossier de sortie existe ou peut être créé, qu'il est accessible en écriture et que le disque n'est pas plein.")
    except Exception as e:                      # imprévu : message humain d'abord, détail technique ensuite
        print(''.join(traceback.format_exception(type(e), e, e.__traceback__)), file=sys.stderr)
        echec(f"erreur inattendue ({type(e).__name__} : {e}).",
              "vérifier la recette et la source ; si l'erreur revient, transmettre ce message à qui maintient Pixel Artist.")
