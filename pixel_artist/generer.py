"""Pixel Artist · génération : fabrique les images sources d'un projet avec l'API d'images d'OpenAI.

Outil indépendant de tout jeu. Un projet est un dossier qui contient :
  style.txt          le style commun, ajouté à chaque demande (jamais de style dans un brief) ; un brief peut
                     désigner un autre fichier de style du projet avec « style » (ex. pour un personnage) ;
  briefs/*.json      une image par brief : { "nom", "sujet", "reference"?, "taille"?, "qualite"?, "fond"?, "modele"? } ;
  references/        les images de référence (facultatif) : un brief qui en cite une est généré
                     en ÉDITANT cette image, ce qui garde toute la série dans la même main ;
  generes/           les images produites et manifest.json (créés par l'outil).

Discipline héritée du pipeline Sillage : cache par empreinte (un brief inchangé ne coûte jamais deux fois),
manifeste, essai à blanc gratuit.

Usage :
  python3 pixel_artist/generer.py <projet>              génère ce qui manque ou a changé
  python3 pixel_artist/generer.py <projet> --essai      sans appel à l'API (image vide), pour tout vérifier
  python3 pixel_artist/generer.py <projet> --seul nom   un seul brief
  python3 pixel_artist/generer.py <projet> --forcer     ignore le cache

Clé : OPENAI_API_KEY dans l'environnement, ou dans un fichier .env du projet ou d'un dossier parent
(ce fichier ne doit jamais être versionné).
"""
import base64
import concurrent.futures as cf
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

API = 'https://api.openai.com/v1/images'
VIDE_PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==')
TAILLES = {'1024x1024', '1536x1024', '1024x1536', 'auto'}


def echec(message, action=None):
    print(f"\nÉCHEC : {message}" + (f"\n→ {action}" if action else ''), file=sys.stderr)
    sys.exit(1)


def cle_api(projet):
    import os
    if os.environ.get('OPENAI_API_KEY'):
        return os.environ['OPENAI_API_KEY']
    for dossier in [projet, *projet.parents]:
        env = dossier / '.env'
        if env.is_file():
            for ligne in env.read_text(encoding='utf-8').splitlines():
                if ligne.strip().startswith('OPENAI_API_KEY='):
                    return ligne.split('=', 1)[1].strip().strip('"\'')
    echec("aucune clé OpenAI trouvée.",
          "poser OPENAI_API_KEY dans l'environnement, ou l'écrire dans un fichier .env à la racine du projet (non versionné) ; "
          "ou lancer avec --essai pour tout vérifier sans rien dépenser.")


def lire_briefs(projet):
    style_f = projet / 'style.txt'
    if not style_f.is_file():
        echec(f"style commun absent : {style_f}", "écrire le style commun du projet dans style.txt.")
    style = style_f.read_text(encoding='utf-8').strip()
    if len(style) < 20 or 'TODO' in style:
        echec("style.txt est incomplet (TODO ou trop court).", "le compléter avant toute génération.")
    dossier = projet / 'briefs'
    fichiers = sorted(dossier.glob('*.json')) if dossier.is_dir() else []
    if not fichiers:
        echec(f"aucun brief dans {dossier}", "ajouter au moins un fichier briefs/<nom>.json.")
    briefs = []
    for f in fichiers:
        try:
            b = json.loads(f.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            echec(f"brief illisible ({f.name}) : {e}", "corriger le JSON.")
        if not b.get('nom') or not b.get('sujet'):
            echec(f"brief incomplet ({f.name}) : « nom » et « sujet » sont requis.")
        if b.get('style'):
            autre = projet / b['style']
            if not autre.is_file():
                echec(f"style « {b['style']} » introuvable pour « {b['nom']} ».")
            b['_style'] = autre.read_text(encoding='utf-8').strip()
        b.setdefault('taille', '1536x1024')
        b.setdefault('qualite', 'high')
        b.setdefault('fond', 'opaque')
        if b['taille'] not in TAILLES:
            echec(f"taille inconnue dans {f.name} : {b['taille']}", f"choisir parmi {', '.join(sorted(TAILLES))}.")
        ref = b.get('reference')
        if ref:
            chemin = projet / ref
            if not chemin.is_file():
                echec(f"référence introuvable pour « {b['nom']} » : {chemin}", "vérifier le chemin (relatif au dossier du projet).")
            b['_ref'] = chemin
        # fond transparent : gpt-image-1.5 ; image opaque sans référence : gpt-image-2 ; édition : gpt-image-1.5
        b.setdefault('modele', 'gpt-image-1.5' if (b['fond'] == 'transparent' or ref) else 'gpt-image-2')
        briefs.append(b)
    return style, briefs


def empreinte(style, b):
    h = hashlib.sha256()
    h.update(json.dumps({'style': b.get('_style', style), **{k: v for k, v in b.items() if not k.startswith('_')}}, sort_keys=True).encode())
    if b.get('_ref'):
        h.update(b['_ref'].read_bytes())
    return h.hexdigest()[:12]


def multipart(champs, fichiers):
    borne = uuid.uuid4().hex
    corps = bytearray()
    for k, v in champs.items():
        corps += f'--{borne}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, (nom, donnees) in fichiers.items():
        corps += (f'--{borne}\r\nContent-Disposition: form-data; name="{k}"; filename="{nom}"\r\n'
                  f'Content-Type: image/png\r\n\r\n').encode() + donnees + b'\r\n'
    corps += f'--{borne}--\r\n'.encode()
    return bytes(corps), f'multipart/form-data; boundary={borne}'


def appeler(cle, style, b):
    prompt = f"{b.get('_style', style)}\n\nSujet : {b['sujet']}"
    commun = {'model': b['modele'], 'prompt': prompt, 'size': b['taille'], 'quality': b['qualite'], 'n': 1}
    if b['fond'] == 'transparent':
        commun['background'] = 'transparent'
    if b.get('_ref'):
        corps, type_ = multipart({k: str(v) for k, v in commun.items()}, {'image': (b['_ref'].name, b['_ref'].read_bytes())})
        url = f'{API}/edits'
    else:
        corps, type_ = json.dumps(commun).encode(), 'application/json'
        url = f'{API}/generations'
    req = urllib.request.Request(url, data=corps, method='POST',
                                 headers={'Authorization': f'Bearer {cle}', 'Content-Type': type_})
    for essai in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            texte = e.read().decode(errors='replace')[:400]
            if e.code in (429, 500, 502, 503) and essai < 2:
                time.sleep(8 * (essai + 1))
                continue
            raise RuntimeError(f"l'API a refusé « {b['nom']} » ({e.code}) : {texte}")
        except urllib.error.URLError as e:
            if essai < 2:
                time.sleep(5)
                continue
            raise RuntimeError(f"réseau indisponible pour « {b['nom']} » : {e.reason}")
    image = (data.get('data') or [{}])[0].get('b64_json')
    if not image:
        raise RuntimeError(f"réponse sans image pour « {b['nom']} »")
    return base64.b64decode(image), data.get('usage')


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith('-'):
        echec("indiquer le dossier du projet.", "python3 pixel_artist/generer.py <projet> [--essai] [--seul nom] [--forcer]")
    projet = Path(args[0]).resolve()
    if not projet.is_dir():
        echec(f"dossier de projet introuvable : {projet}")
    essai, forcer = '--essai' in args, '--forcer' in args
    seul = args[args.index('--seul') + 1] if '--seul' in args and args.index('--seul') + 1 < len(args) else None
    style, briefs = lire_briefs(projet)
    if seul and not any(b['nom'] == seul for b in briefs):
        echec(f"aucun brief nommé « {seul} ».")
    sortie = projet / 'generes'
    sortie.mkdir(exist_ok=True)
    chemin_manifeste = sortie / 'manifest.json'
    manifeste = json.loads(chemin_manifeste.read_text(encoding='utf-8')) if chemin_manifeste.is_file() else {}
    cle = None if essai else cle_api(projet)

    a_faire = []
    for b in briefs:
        if seul and b['nom'] != seul:
            continue
        h = empreinte(style, b)
        fichier = sortie / f"{b['nom']}-{h}.png"
        connu = manifeste.get(b['nom'])
        if not forcer and connu and connu.get('empreinte') == h and fichier.is_file() and not connu.get('essai'):
            print(f"  cache   {b['nom']}")
            continue
        a_faire.append((b, h, fichier))

    def produire(t):
        b, h, fichier = t
        png, usage = (VIDE_PNG, None) if essai else appeler(cle, style, b)
        fichier.write_bytes(png)
        return b, h, fichier, usage

    erreurs = []
    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        for t in a_faire:
            print(f"  {'essai ' if essai else 'demande'} {t[0]['nom']} ({t[0]['modele']}, {t[0]['taille']}, {t[0]['qualite']}"
                  f"{', édition de ' + t[0]['reference'] if t[0].get('reference') else ''})")
        futurs = [pool.submit(produire, t) for t in a_faire]
        for f in cf.as_completed(futurs):
            try:
                b, h, fichier, usage = f.result()
            except RuntimeError as e:
                erreurs.append(str(e))
                continue
            manifeste[b['nom']] = {'fichier': f'generes/{fichier.name}', 'empreinte': h, 'modele': b['modele'],
                                   'taille': b['taille'], 'qualite': b['qualite'], 'fond': b['fond'],
                                   'reference': b.get('reference'), 'usage': usage, 'essai': essai,
                                   'date': datetime.now(timezone.utc).isoformat(timespec='seconds')}
            print(f"  prêt    {b['nom']} → generes/{fichier.name}")
            chemin_manifeste.write_text(json.dumps(manifeste, indent=1, ensure_ascii=False), encoding='utf-8')
    chemin_manifeste.write_text(json.dumps(manifeste, indent=1, ensure_ascii=False), encoding='utf-8')
    print(f"\nBilan : {len(a_faire) - len(erreurs)} produite(s), {len(briefs) - len(a_faire) if not seul else 0} en cache, "
          f"{len(erreurs)} échec(s).{' Essai à blanc : aucun coût.' if essai else ''}")
    if erreurs:
        echec('\n  '.join(erreurs), "lire le message de l'API ; corriger le brief ou réessayer plus tard.")


if __name__ == '__main__':
    main()
