"""Pixel Artist · génération : fabrique les images sources d'un projet d'art avec l'API d'images d'OpenAI.

Outil indépendant de tout jeu. Documentation complète : README.md à côté de ce script ; aide : --aide.

Un projet d'art est un dossier qui contient :
  style.txt          le style commun, ajouté à chaque demande (jamais de style dans un brief) ; un brief peut
                     désigner un autre fichier de style du projet avec « style » (ex. pour un personnage) ;
  briefs/*.json      une image par brief : { "nom", "sujet", "style"?, "reference"?, "taille"?, "qualite"?, "fond"?, "modele"? } ;
  references/        les images de référence (facultatif) : un brief qui en cite une est généré
                     en ÉDITANT cette image, ce qui garde toute la série dans la même main ;
  generes/           les images produites et manifest.json (créés par l'outil).

Discipline héritée du pipeline Sillage : cache par empreinte (un brief inchangé ne coûte jamais deux fois),
manifeste, essai à blanc gratuit. Une image déjà reçue n'est jamais redemandée, même si le manifeste l'a oubliée
(lancement interrompu, manifeste supprimé) : elle est reprise telle quelle.

Usage :
  python3 pixel_artist/generer.py <projet>              génère ce qui manque ou a changé (PAYANT)
  python3 pixel_artist/generer.py <projet> --essai      sans aucun appel à l'API, pour tout vérifier (gratuit)
  python3 pixel_artist/generer.py <projet> --seul nom   un seul brief
  python3 pixel_artist/generer.py <projet> --forcer     ignore le cache (PAYANT)

Clé : OPENAI_API_KEY dans l'environnement, ou dans un fichier .env du projet ou d'un dossier parent
(ce fichier ne doit jamais être versionné). Aucune dépendance : Python 3.9 ou plus suffit.
"""
import base64
import concurrent.futures as cf
import difflib
import hashlib
import http.client
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

API = 'https://api.openai.com/v1/images'
# Modèles par défaut ; un brief peut en imposer un autre avec « modele ». ATTENTION : changer ces valeurs change
# l'empreinte de tous les briefs qui ne précisent pas « modele » : ils seraient tous regénérés (payant).
MODELE_GENERATION = 'gpt-image-2'      # image opaque sans référence
MODELE_EDITION = 'gpt-image-1.5'       # édition d'une référence, ou fond transparent
VIDE_PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==')
TAILLES = {'1024x1024', '1536x1024', '1024x1536', 'auto'}
QUALITES = {'low', 'medium', 'high', 'auto'}
FONDS = {'opaque', 'transparent'}
TYPES_IMAGE = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}
EN_PARALLELE = 4                       # demandes simultanées
DELAI = 300                            # secondes d'attente maximale d'une réponse

# Champs d'un brief (sert à l'aide et à signaler les fautes de frappe). Un champ qui commence par « _ » est un
# commentaire libre : il n'est ni envoyé ni compté dans l'empreinte.
CHAMPS = {
    'nom': "(requis) identifiant de l'image : lettres, chiffres, - ou _ ; nomme le fichier produit",
    'sujet': "(requis) ce que montre l'image ; le style est ajouté automatiquement devant",
    'style': "autre fichier de style du projet à utiliser à la place de style.txt (ex. \"style-perso.txt\")",
    'reference': "image du projet à ÉDITER (ex. \"references/ambiance.png\") : garde toute la série dans la même main ; ou une liste d'images (la première donne la main, les suivantes des formes à reprendre)",
    'taille': "1536x1024 (défaut), 1024x1024, 1024x1536 ou auto",
    'qualite': "high (défaut), medium, low ou auto",
    'fond': "opaque (défaut) ou transparent",
    'modele': f"modèle OpenAI ; défaut : {MODELE_EDITION} avec référence ou fond transparent, sinon {MODELE_GENERATION}",
}


def commande():
    """La commande telle qu'on peut la retaper sur cette machine (interpréteur et chemin du script détectés)."""
    script = sys.argv[0] if sys.argv and sys.argv[0] else 'generer.py'
    if ' ' in script:
        script = f'"{script}"'
    return f"{Path(sys.executable).stem or 'python3'} {script}"


def aide():
    champs = '\n'.join(f"  {k:<10} {v}" for k, v in CHAMPS.items())
    return f"""Pixel Artist · génération des images sources avec l'API d'images d'OpenAI

Usage :
  {commande()} <projet> [--essai] [--seul <nom>] [--forcer]

  <projet>          dossier du projet d'art : style.txt, briefs/*.json, references/ (facultatif) ;
                    les images arrivent dans <projet>/generes/ avec leur manifeste (manifest.json)

Options :
  --essai           essai à blanc : vérifie tout sans JAMAIS appeler l'API (aucun coût) ; pose une image vide
                    pour les briefs jamais générés, sans jamais remplacer une vraie image
  --seul <nom>      ne traite que ce brief
  --forcer          ignore le cache et redemande l'image (PAYANT)
  --aide, -h        cette aide

Coût : chaque image demandée coûte des crédits OpenAI. Un brief inchangé n'est jamais redemandé (cache par
empreinte : style + brief + image de référence) ; --essai ne coûte rien.
Clé : OPENAI_API_KEY dans l'environnement, ou dans un fichier .env du projet ou d'un dossier parent
(ne jamais versionner ce fichier).

Champs d'un brief (briefs/<nom>.json) ; un champ qui commence par « _ » est un commentaire :
{champs}

Documentation complète : {Path(__file__).resolve().parent / 'README.md'}"""


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
    trouves = difflib.get_close_matches(mot, list(possibles), n=1)
    return f" (vouliez-vous dire « {trouves[0]} » ?)" if trouves else ''


def lire_texte(chemin):
    return chemin.read_text(encoding='utf-8-sig')    # -sig : tolère le BOM qu'ajoutent certains éditeurs Windows


def trouver_cle(projet):
    """(clé, origine) : l'environnement d'abord, puis le premier fichier .env du projet ou d'un dossier parent."""
    if os.environ.get('OPENAI_API_KEY', '').strip():
        return os.environ['OPENAI_API_KEY'].strip(), "variable d'environnement OPENAI_API_KEY"
    for dossier in [projet, *projet.parents]:
        env = dossier / '.env'
        if env.is_file():
            try:
                lignes = lire_texte(env).splitlines()
            except (OSError, UnicodeDecodeError):
                continue
            for ligne in lignes:
                ligne = ligne.strip()
                if ligne.startswith('export '):
                    ligne = ligne[len('export '):].strip()
                if ligne.startswith('OPENAI_API_KEY='):
                    cle = ligne.split('=', 1)[1].strip().strip('"\'')
                    if cle:
                        return cle, str(env)
    return None, None


def cle_api(projet):
    cle, _ = trouver_cle(projet)
    if not cle:
        echec("aucune clé OpenAI trouvée.",
              "poser OPENAI_API_KEY dans l'environnement, ou écrire la ligne OPENAI_API_KEY=sk-… dans un fichier .env "
              "à la racine du projet (jamais versionné) ; ou lancer avec --essai pour tout vérifier sans rien dépenser.")
    return cle


def lire_style(chemin, qui):
    if not chemin.is_file():
        echec(f"fichier de style introuvable {qui}: {chemin}",
              "écrire le style commun du projet dans style.txt (chemin relatif au dossier du projet).")
    style = lire_texte(chemin).strip()
    if len(style) < 20 or 'TODO' in style:
        echec(f"{chemin.name} est incomplet (TODO ou trop court).", "le compléter avant toute génération.")
    return style


def lire_briefs(projet):
    style = lire_style(projet / 'style.txt', '')
    dossier = projet / 'briefs'
    fichiers = sorted(dossier.glob('*.json')) if dossier.is_dir() else []
    if not fichiers:
        echec(f"aucun brief dans {dossier}", "ajouter au moins un fichier briefs/<nom>.json (voir --aide pour les champs).")
    briefs, vus = [], {}
    for f in fichiers:
        try:
            b = json.loads(lire_texte(f))
        except json.JSONDecodeError as e:
            echec(f"brief illisible ({f.name}), ligne {e.lineno}, colonne {e.colno} : {e.msg}",
                  "corriger le JSON (guillemets droits \"…\", virgules entre les champs, pas de virgule après le dernier).")
        except UnicodeDecodeError:
            echec(f"brief illisible ({f.name}) : le fichier n'est pas en UTF-8.", "l'enregistrer en UTF-8.")
        if not isinstance(b, dict):
            echec(f"brief {f.name} : le fichier doit contenir un objet JSON {{ … }}.")
        if not isinstance(b.get('nom'), str) or not b['nom'].strip() or not isinstance(b.get('sujet'), str) or not b['sujet'].strip():
            echec(f"brief incomplet ({f.name}) : « nom » et « sujet » sont requis.",
                  'exemple : { "nom": "ciel", "sujet": "un ciel de nuit calme, sans lune" }')
        if not re.fullmatch(r'\w[\w.-]*', b['nom']):
            echec(f"nom invalide dans {f.name} : « {b['nom']} ».",
                  "n'utiliser que des lettres, chiffres, tirets ou soulignés (il sert de nom de fichier).")
        if b['nom'] in vus:
            echec(f"deux briefs portent le nom « {b['nom']} » : {vus[b['nom']]} et {f.name}.", "renommer l'un des deux.")
        vus[b['nom']] = f.name
        for k in b:
            if k not in CHAMPS and not k.startswith('_'):
                avertir(f"champ inconnu « {k} » dans briefs/{f.name}{proche(k, CHAMPS)} : "
                        "ignoré par l'outil, mais compté dans l'empreinte (le renommer « _… » pour un commentaire).")
        for k in ('style', 'reference', 'taille', 'qualite', 'fond', 'modele'):
            if k == 'reference' and isinstance(b.get(k), list) and b[k] and all(isinstance(v, str) for v in b[k]):
                continue                                # plusieurs références : une liste de chemins
            if k in b and not isinstance(b[k], str):
                echec(f"brief {f.name} : « {k} » doit être un texte entre guillemets"
                      f"{' (ou, pour « reference », une liste de chemins)' if k == 'reference' else ''}.")
        if b.get('style'):
            b['_style'] = lire_style(projet / b['style'], f"pour « {b['nom']} » ")
        b.setdefault('taille', '1536x1024')
        b.setdefault('qualite', 'high')
        b.setdefault('fond', 'opaque')
        if b['taille'] not in TAILLES:
            echec(f"taille inconnue dans {f.name} : {b['taille']}", f"choisir parmi {', '.join(sorted(TAILLES))}.")
        if b['qualite'] not in QUALITES:
            echec(f"qualité inconnue dans {f.name} : {b['qualite']}", f"choisir parmi {', '.join(sorted(QUALITES))}.")
        if b['fond'] not in FONDS:
            echec(f"fond inconnu dans {f.name} : {b['fond']}", "écrire \"opaque\" ou \"transparent\".")
        ref = b.get('reference')
        chemins = []
        for r in ([ref] if isinstance(ref, str) else ref or []):
            chemin = projet / r
            if not chemin.is_file():
                echec(f"référence introuvable pour « {b['nom']} » : {chemin}",
                      "vérifier le chemin (relatif au dossier du projet) ; une référence locale non versionnée "
                      "(ex. references/externes/) doit être recopiée sur cette machine.")
            if chemin.suffix.lower() not in TYPES_IMAGE:
                echec(f"référence de « {b['nom']} » dans un format non pris en charge : {chemin.name}",
                      "fournir une image PNG, JPEG ou WebP.")
            chemins.append(chemin)
        if chemins:
            b['_ref'] = chemins[0]                      # la première : la main de la série
            b['_refs_autres'] = chemins[1:]             # les suivantes : formes, motifs à reprendre
        # fond transparent ou édition d'une référence : MODELE_EDITION ; image opaque sans référence : MODELE_GENERATION
        b.setdefault('modele', MODELE_EDITION if (b['fond'] == 'transparent' or ref) else MODELE_GENERATION)
        briefs.append(b)
    return style, briefs


def empreinte(style, b):
    # NE PAS MODIFIER : toute différence ici change l'empreinte de toutes les images et les ferait toutes repayer.
    # (Un brief qui désigne son propre « style » est compté par le NOM de ce fichier, pas par son contenu :
    # voir style_modifie().)
    h = hashlib.sha256()
    h.update(json.dumps({'style': b.get('_style', style), **{k: v for k, v in b.items() if not k.startswith('_')}}, sort_keys=True).encode())
    if b.get('_ref'):
        h.update(b['_ref'].read_bytes())
    for autre in b.get('_refs_autres', []):          # (plusieurs références : les briefs à une seule n'en ont pas)
        h.update(autre.read_bytes())
    return h.hexdigest()[:12]


def empreinte_texte(texte):
    return hashlib.sha256(texte.encode()).hexdigest()[:12]


def style_modifie(b, connu):
    """Vrai si le fichier de style propre au brief a changé depuis la génération (seulement pour les images produites
    par cette version de l'outil, qui notent l'empreinte du style dans le manifeste)."""
    return bool(b.get('_style') and connu.get('empreinte_style') and connu['empreinte_style'] != empreinte_texte(b['_style']))


def multipart(champs, fichiers):
    """fichiers : { champ: (nom, données, type) }, ou une liste de (champ, (nom, données, type)) pour répéter un champ."""
    borne = uuid.uuid4().hex
    corps = bytearray()
    for k, v in champs.items():
        corps += f'--{borne}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, (nom, donnees, type_) in (fichiers.items() if isinstance(fichiers, dict) else fichiers):
        corps += (f'--{borne}\r\nContent-Disposition: form-data; name="{k}"; filename="{nom}"\r\n'
                  f'Content-Type: {type_}\r\n\r\n').encode() + donnees + b'\r\n'
    corps += f'--{borne}--\r\n'.encode()
    return bytes(corps), f'multipart/form-data; boundary={borne}'


def expliquer_refus(nom, code, texte):
    """Traduit un refus de l'API en message humain + action."""
    try:
        erreur = json.loads(texte).get('error') or {}
    except (ValueError, AttributeError):
        erreur = {}
    detail = (erreur.get('message') or texte or '').strip()[:400]
    code_api = str(erreur.get('code') or '')
    bas = detail.lower()
    if code == 401:
        pourquoi = "clé OpenAI refusée (invalide ou révoquée) → vérifier OPENAI_API_KEY ; en créer une nouvelle au besoin"
    elif code_api in ('moderation_blocked', 'content_policy_violation') or 'safety' in bas or 'moderation' in bas:
        pourquoi = ("le filtre de sécurité d'OpenAI a refusé ce brief → reformuler le sujet (mots moins crus ou "
                    "violents, ex. « cadavre » → « silhouette immobile ») puis relancer")
    elif code_api in ('insufficient_quota', 'billing_hard_limit_reached', 'billing_not_active'):
        pourquoi = "crédit OpenAI épuisé ou facturation inactive → recharger le compte OpenAI puis relancer"
    elif code == 403:
        pourquoi = ("accès refusé à ce modèle → vérifier les droits du compte OpenAI (certains modèles d'image "
                    "demandent une organisation vérifiée) ou choisir un autre « modele »")
    elif code == 400:
        pourquoi = "demande refusée → lire le détail : souvent une valeur de brief invalide (modèle, taille, qualité)"
    elif code == 429:
        pourquoi = "trop de demandes à la fois → attendre quelques minutes puis relancer"
    else:
        pourquoi = "l'API a répondu par une erreur → réessayer plus tard"
    return f"« {nom} » : {pourquoi}.\n    (réponse de l'API, code {code} : {detail})"


def appeler(cle, style, b):
    prompt = f"{b.get('_style', style)}\n\nSujet : {b['sujet']}"
    commun = {'model': b['modele'], 'prompt': prompt, 'size': b['taille'], 'quality': b['qualite'], 'n': 1}
    if b['fond'] == 'transparent':
        commun['background'] = 'transparent'
    if b.get('_ref') and b.get('_refs_autres'):         # plusieurs références : le champ image[] répété
        fichiers = [('image[]', (f.name, f.read_bytes(), TYPES_IMAGE[f.suffix.lower()])) for f in [b['_ref'], *b['_refs_autres']]]
        corps, type_ = multipart({k: str(v) for k, v in commun.items()}, fichiers)
        url = f'{API}/edits'
    elif b.get('_ref'):
        type_ = TYPES_IMAGE[b['_ref'].suffix.lower()]
        corps, type_ = multipart({k: str(v) for k, v in commun.items()}, {'image': (b['_ref'].name, b['_ref'].read_bytes(), type_)})
        url = f'{API}/edits'
    else:
        corps, type_ = json.dumps(commun).encode(), 'application/json'
        url = f'{API}/generations'
    req = urllib.request.Request(url, data=corps, method='POST',
                                 headers={'Authorization': f'Bearer {cle}', 'Content-Type': type_})
    for essai in range(3):
        try:
            with urllib.request.urlopen(req, timeout=DELAI) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            texte = e.read().decode(errors='replace')
            quota = 'insufficient_quota' in texte
            if e.code in (429, 500, 502, 503) and not quota and essai < 2:
                time.sleep(8 * (essai + 1))
                continue
            raise RuntimeError(expliquer_refus(b['nom'], e.code, texte))
        except urllib.error.URLError as e:           # connexion impossible : rien n'est parti, on peut réessayer
            if essai < 2:
                time.sleep(5)
                continue
            raise RuntimeError(f"« {b['nom']} » : réseau indisponible ({e.reason}) → vérifier la connexion Internet puis relancer.")
        except (socket.timeout, TimeoutError):      # la demande est partie : ne pas la renvoyer (elle serait payée deux fois)
            raise RuntimeError(f"« {b['nom']} » : pas de réponse en {DELAI // 60} min → relancer plus tard "
                               "(les images déjà reçues sont gardées).")
        except (OSError, ValueError, http.client.HTTPException) as e:   # connexion coupée en route, réponse tronquée…
            raise RuntimeError(f"« {b['nom']} » : échange interrompu avec l'API ({e}) → relancer plus tard.")
    image = (data.get('data') or [{}])[0].get('b64_json')
    if not image:
        raise RuntimeError(f"« {b['nom']} » : réponse sans image (le modèle « {b['modele']} » ne renvoie peut-être pas "
                           "l'image elle-même) → utiliser un modèle gpt-image.")
    return base64.b64decode(image), data.get('usage')


def ecrire_atomique(chemin, donnees):
    """Écrit d'un bloc : un fichier n'est jamais à moitié écrit, même si l'outil est interrompu."""
    tmp = chemin.with_name(f'.{chemin.name}.{os.getpid()}.tmp')
    tmp.write_bytes(donnees)
    os.replace(tmp, chemin)


def lire_manifeste(chemin):
    if not chemin.is_file():
        return {}
    try:
        m = json.loads(lire_texte(chemin))
    except json.JSONDecodeError as e:
        echec(f"manifeste illisible : {chemin} (ligne {e.lineno} : {e.msg})",
              "le réparer, ou le supprimer : les images déjà présentes dans generes/ seront reprises sans rien repayer.")
    if not isinstance(m, dict):
        echec(f"manifeste illisible : {chemin}", "le supprimer : les images déjà présentes dans generes/ seront reprises sans rien repayer.")
    return m


def ecrire_manifeste(chemin, entrees):
    """Relit le manifeste juste avant d'écrire et n'y change que nos entrées : un autre lancement a pu en ajouter
    entre-temps. Une entrée d'essai ne remplace jamais une vraie image."""
    manifeste = lire_manifeste(chemin)
    for nom, e in entrees.items():
        if e.get('essai') and nom in manifeste and not manifeste[nom].get('essai'):
            continue
        manifeste[nom] = e
    ecrire_atomique(chemin, json.dumps(manifeste, indent=1, ensure_ascii=False).encode('utf-8'))


def image_reelle(fichier):
    """Une vraie image déjà reçue (et non l'image vide d'un essai à blanc) ?"""
    try:
        with open(fichier, 'rb') as f:
            debut = f.read(len(VIDE_PNG) + 1)
    except OSError:
        return False
    return debut.startswith(b'\x89PNG') and debut != VIDE_PNG


def entree(b, h, fichier, usage, essai, **extra):
    e = {'fichier': f'generes/{fichier.name}', 'empreinte': h, 'modele': b['modele'],
         'taille': b['taille'], 'qualite': b['qualite'], 'fond': b['fond'],
         'reference': b.get('reference'), 'usage': usage, 'essai': essai,
         'date': datetime.now(timezone.utc).isoformat(timespec='seconds')}
    if b.get('_style') and not extra.get('repris'):
        e['empreinte_style'] = empreinte_texte(b['_style'])
    e.update(extra)
    return e


def analyser_arguments(args):
    projet, seul, essai, forcer = None, None, False, False
    i = 0
    while i < len(args):
        a = args[i]
        if a in ('--aide', '-h', '--help'):
            print(aide())
            sys.exit(0)
        elif a == '--essai':
            essai = True
        elif a == '--forcer':
            forcer = True
        elif a == '--seul':
            if i + 1 >= len(args) or args[i + 1].startswith('-'):
                echec("--seul attend le nom d'un brief.", f"exemple : {commande()} <projet> --seul ciel")
            seul = args[i + 1]
            i += 1
        elif a.startswith('-'):
            echec(f"option inconnue : {a}{proche(a, ['--essai', '--seul', '--forcer', '--aide'])}. Rien n'a été demandé à l'API.",
                  f"options possibles : --essai, --seul <nom>, --forcer, --aide ({commande()} --aide).")
        elif projet is None:
            projet = a
        else:
            echec(f"un seul dossier de projet à la fois (reçu « {projet} » puis « {a} »).",
                  "mettre entre guillemets un chemin qui contient des espaces.")
        i += 1
    if projet is None:
        echec("indiquer le dossier du projet d'art.", f"{commande()} <projet> [--essai] [--seul nom] [--forcer]   (aide : --aide)")
    return projet, seul, essai, forcer


def main():
    console_robuste()
    projet_arg, seul, essai, forcer = analyser_arguments(sys.argv[1:])
    projet = Path(projet_arg).resolve()
    if not projet.is_dir():
        echec(f"dossier de projet introuvable : {projet}", "donner le chemin du dossier qui contient style.txt et briefs/.")
    style, briefs = lire_briefs(projet)
    noms = [b['nom'] for b in briefs]
    if seul and seul not in noms:
        echec(f"aucun brief nommé « {seul} »{proche(seul, noms)}.", f"briefs du projet : {', '.join(noms)}.")
    sortie = projet / 'generes'
    sortie.mkdir(exist_ok=True)
    chemin_manifeste = sortie / 'manifest.json'
    manifeste = lire_manifeste(chemin_manifeste)
    cle = None if essai else cle_api(projet)

    a_faire, en_cache, repris, gardes = [], 0, 0, 0
    for b in briefs:
        if seul and b['nom'] != seul:
            continue
        h = empreinte(style, b)
        fichier = sortie / f"{b['nom']}-{h}.png"
        connu = manifeste.get(b['nom']) or {}
        if not forcer and connu.get('empreinte') == h and fichier.is_file() and not connu.get('essai'):
            print(f"  cache   {b['nom']}")
            en_cache += 1
            if style_modifie(b, connu):
                avertir(f"le style « {b['style']} » a changé depuis la génération de « {b['nom']} » (image gardée) ; "
                        f"pour la refaire : --seul {b['nom']} --forcer (payant).")
            continue
        if not forcer and image_reelle(fichier):
            # déjà reçue et payée (lancement interrompu, manifeste perdu, brief revenu à une version antérieure)
            repris += 1
            if essai:
                print(f"  reprise {b['nom']} : generes/{fichier.name} existe déjà, elle serait reprise sans rien payer")
            else:
                ecrire_manifeste(chemin_manifeste, {b['nom']: entree(b, h, fichier, None, False, repris=True)})
                print(f"  reprise {b['nom']} → generes/{fichier.name} (déjà reçue : rien n'est redemandé)")
            continue
        if essai and connu and not connu.get('essai'):
            # un essai ne remplace jamais une vraie image : on dit seulement ce qui serait redemandé
            gardes += 1
            raison = 'forcé' if forcer else ('image absente' if not (sortie / Path(connu.get('fichier', '')).name).is_file() else 'brief modifié')
            print(f"  essai   {b['nom']} : serait redemandé ({raison}) ; l'entrée actuelle est gardée")
            continue
        a_faire.append((b, h, fichier))

    def produire(t):
        b, h, fichier = t
        if essai:
            if not fichier.exists():
                ecrire_atomique(fichier, VIDE_PNG)
            return b, h, fichier, None
        png, usage = appeler(cle, style, b)
        ecrire_atomique(fichier, png)
        return b, h, fichier, usage

    if a_faire and not essai:
        print(f"  {len(a_faire)} image(s) à demander à OpenAI (payant) ; Ctrl-C pour arrêter.")
    erreurs, faits, noms_futurs = [], set(), {}

    def enregistrer(f):
        faits.add(f)
        try:
            b, h, fichier, usage = f.result()
        except RuntimeError as e:
            erreurs.append(str(e))
            return
        except Exception as e:                          # imprévu : on le dit sans perdre les autres images
            erreurs.append(f"« {noms_futurs.get(f, '?')} » : erreur inattendue ({type(e).__name__} : {e}) → relancer ; "
                           "si elle revient, transmettre ce message à qui maintient Pixel Artist.")
            return
        ecrire_manifeste(chemin_manifeste, {b['nom']: entree(b, h, fichier, usage, essai)})
        print(f"  {'vide   ' if essai else 'prêt   '} {b['nom']} → generes/{fichier.name}")

    pool = cf.ThreadPoolExecutor(max_workers=EN_PARALLELE)
    futurs = []
    try:
        for t in a_faire:
            print(f"  {'essai ' if essai else 'demande'} {t[0]['nom']} ({t[0]['modele']}, {t[0]['taille']}, {t[0]['qualite']}"
                  f"{', édition de ' + (t[0]['reference'] if isinstance(t[0]['reference'], str) else ' + '.join(t[0]['reference'])) if t[0].get('reference') else ''})")
        for t in a_faire:
            f = pool.submit(produire, t)
            noms_futurs[f] = t[0]['nom']
            futurs.append(f)
        for f in cf.as_completed(futurs):
            enregistrer(f)
    except KeyboardInterrupt:
        # les demandes pas encore parties sont annulées ; celles en cours sont déjà payées : on garde leurs images
        for f in futurs:
            f.cancel()
        en_cours = [f for f in futurs if not f.cancelled() and f not in faits]
        if en_cours:
            print(f"\n  interruption : attente des {len(en_cours)} demande(s) déjà parties (déjà payées : leurs images "
                  "seront gardées)…", file=sys.stderr)
            try:
                for f in cf.as_completed(en_cours):
                    enregistrer(f)
            except KeyboardInterrupt:
                pass                                    # les images arrivées plus tard seront reprises au prochain lancement
        pool.shutdown(wait=False)
        echec("interrompu à la demande.", "relancer la même commande pour reprendre : ce qui est déjà reçu ne sera pas redemandé.")
    pool.shutdown()
    produites = len(a_faire) - len(erreurs)
    print(f"\nBilan : {produites} {'image(s) vide(s) posée(s)' if essai else 'produite(s)'}, {en_cache} en cache"
          f"{f', {repris} reprise(s)' if repris else ''}{f', {gardes} à redemander' if gardes else ''}, {len(erreurs)} échec(s)."
          f"{' Essai à blanc : aucun coût.' if essai else ''}")
    if essai:
        cle_trouvee, origine = trouver_cle(projet)
        print(f"Clé OpenAI : {'trouvée (' + origine + ')' if cle_trouvee else 'ABSENTE : il en faudra une pour la vraie génération (voir --aide)'}.")
    if erreurs:
        echec('\n  '.join(erreurs), "corriger le brief ou réessayer plus tard : les images réussies sont gardées.")


if __name__ == '__main__':
    try:
        main()
    except OSError as e:
        echec(f"lecture ou écriture impossible : {e.filename or ''} ({e.strerror or e})",
              "vérifier que le dossier existe, qu'il est accessible en écriture et que le disque n'est pas plein.")
