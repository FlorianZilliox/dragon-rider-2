"""Assemble le jeu en UN fichier autonome : double-clic pour jouer, hors ligne, sur n'importe quel appareil.

Le dragon vient du pipeline Pixel Artist (pixel_artist/pixel_artist.py) :
  - dragon.png / dragon.json : les pièces de la pose en vol (le jeu les anime en continu) ;
  - dragon_propre.png / .json : toutes les images du modèle redessinées (course, décollage, atterrissage…).
Les décors sont les plans peints de assets/decors/ (pixel_artist/pixeliser.py sur art/recettes/*.json).
Les niveaux sont des fichiers texte (niveaux/acte1.txt, acte2.txt, acte3.txt) : une lettre = une case.

Usage : python3 outils/construire_jeu.py
"""
import base64
import json
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
PIXEL = RACINE / 'assets' / 'pixel-artist'
for f in ('dragon.png', 'dragon.json', 'dragon_propre.png', 'dragon_propre.json'):
    if not (PIXEL / f).exists():
        raise SystemExit(f"{f} absent : lancer d'abord  python3 pixel_artist/pixel_artist.py")
NIVEAUX = [RACINE / 'niveaux' / f'acte{n}.txt' for n in (1, 2, 3)]
for f in NIVEAUX:
    if not f.exists():
        raise SystemExit(f"niveau absent : {f.relative_to(RACINE)} (les trois actes sont nécessaires)")
DECORS = RACINE / 'assets' / 'decors'
art = {}
for desc in sorted(DECORS.glob('*.json')):
    d = json.loads(desc.read_text(encoding='utf-8'))
    for nom, el in d['elements'].items():
        art[f"{d['nom']}/{nom}"] = {**{k: v for k, v in el.items() if k != 'image'},
                                    'src': 'data:image/png;base64,' + base64.b64encode((DECORS / el['image']).read_bytes()).decode('ascii')}
if not art:
    raise SystemExit("décors absents : lancer  python3 pixel_artist/pixeliser.py art/recettes/<acte>.json  pour chaque recette")
meta = json.loads((PIXEL / 'dragon.json').read_text(encoding='utf-8'))
meta['planche'] = json.loads((PIXEL / 'dragon_propre.json').read_text(encoding='utf-8'))
b64 = lambda f: base64.b64encode((PIXEL / f).read_bytes()).decode('ascii')
html = ((ICI / 'jeu.src.html').read_text(encoding='utf-8')
        .replace('/*PIXEL_META*/null', json.dumps(meta, ensure_ascii=False))
        .replace('/*PIXEL_DATA*/', b64('dragon.png'))
        .replace('/*PIXEL_PLANCHE*/', b64('dragon_propre.png'))
        .replace('/*DECORS_ART*/null', json.dumps(art))
        .replace('/*NIVEAUX*/null', json.dumps([f.read_text(encoding='utf-8') for f in NIVEAUX], ensure_ascii=False)))
# garde-fou : le script du jeu doit être lisible par un navigateur (vérifié avec Node s'il est installé)
import re, shutil, subprocess, tempfile
if shutil.which('node'):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(re.search(r'<script>(.*)</script>', html, re.S).group(1))
    r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
    Path(f.name).unlink()
    if r.returncode:
        raise SystemExit("le script du jeu contient une erreur de syntaxe, Dragon-Rider.html n'a pas été écrit :\n" + r.stderr.strip())
else:
    print('(Node absent : vérification de syntaxe sautée)')
sortie = RACINE / 'Dragon-Rider.html'
sortie.write_text(html, encoding='utf-8')
print(f"{sortie.name} : {len(html) / 1e3:.0f} Ko")
