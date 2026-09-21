# Pixel Artist

Une chaîne pour fabriquer les graphismes d'un jeu en **vrai pixel art, très léger**, à partir d'images générées par l'IA (ou dessinées à la main). Elle ne sait rien du jeu qu'elle sert : tout se règle dans des fichiers texte (style, briefs, recettes). Elle a produit tous les décors, objets et créatures de Dragon Rider.

Deux outils, deux fichiers Python autonomes qu'on peut copier dans n'importe quel projet :

| Outil | Rôle | Coût | Dépendances |
|---|---|---|---|
| `generer.py` | fabrique les **images sources** avec l'API d'images d'OpenAI | payant (crédits OpenAI) ; `--essai` gratuit | aucune (Python 3.9 ou plus) |
| `pixeliser.py` | les convertit en **pixel art de jeu** : taille réelle, palette commune, tramage, transparence nette, PNG indexés | gratuit, hors ligne | Pillow, numpy, scipy |

`pixel_artist.py` (dans le même dossier) est un outil à part, propre au personnage de Dragon Rider (redessin et découpe du dragon en pièces articulées) ; il n'est pas couvert ici.

Aide rapide dans le terminal : `python3 pixel_artist/generer.py --aide` et `python3 pixel_artist/pixeliser.py --aide`.

---

## Sommaire

1. [Installation](#installation)
2. [Démarrer en cinq minutes : l'exemple](#démarrer-en-cinq-minutes--lexemple)
3. [Le flux complet](#le-flux-complet)
4. [Structure d'un projet d'art](#structure-dun-projet-dart)
5. [Les briefs (`generer.py`)](#les-briefs-genererpy)
6. [Les recettes (`pixeliser.py`)](#les-recettes-pixeliserpy)
7. [Intégrer les sorties dans un jeu](#intégrer-les-sorties-dans-un-jeu)
8. [Conseils qui ont marché sur Dragon Rider](#conseils-qui-ont-marché-sur-dragon-rider)
9. [Coût](#coût)
10. [Sécurité de la clé OpenAI](#sécurité-de-la-clé-openai)
11. [Dépannage](#dépannage)
12. [Pour qui maintient l'outil](#pour-qui-maintient-loutil)

---

## Installation

1. **Python 3.9 ou plus.** Sur Mac, `python3` est fourni avec les outils de développement d'Apple (s'il manque, le Mac propose de les installer) ; sur Windows, l'installer depuis python.org et taper `py` au lieu de `python3` dans les commandes ci-dessous ; sur Linux, le paquet `python3`.
2. **Pour `pixeliser.py` seulement** : `python3 -m pip install --user pillow numpy scipy`. Inutile de s'en souvenir : si une bibliothèque manque, le script le dit et affiche la commande exacte pour la machine où il tourne.
3. **Pour `generer.py` seulement** : une clé d'API OpenAI (voir [Sécurité de la clé](#sécurité-de-la-clé-openai)). Sans clé, `--essai` fonctionne quand même.

Les commandes de ce document se lancent depuis le dossier qui contient `pixel_artist/`. Tous les chemins écrits dans les briefs et les recettes sont **relatifs** (au projet ou à la recette) : on peut déplacer ou copier un projet d'art sur une autre machine sans rien modifier.

## Démarrer en cinq minutes : l'exemple

`pixel_artist/exemple/` est un mini-projet complet (style, brief, recette) dont les images sources sont dessinées par code, pour tout essayer sans rien payer :

```sh
python3 pixel_artist/generer.py pixel_artist/exemple --essai          # vérifie le projet, aucun appel à l'API
python3 pixel_artist/pixeliser.py pixel_artist/exemple/recettes/decor.json
```

Résultat dans `pixel_artist/exemple/sortie/` : deux plans de parallaxe qui bouclent sans couture et une pièce animée en quatre images, avec `decor-apercu.png` pour tout voir d'un coup d'œil. Pour démarrer un nouveau jeu, copier ce dossier et le réécrire.

## Le flux complet

```
 référence d'ambiance ─┐
 style.txt ────────────┼─► briefs/*.json ─► generer.py ─► generes/*.png + manifest.json
                       │                    (OpenAI, payant, cache)         │
                       │                                                    ▼
                       └──────────────────────────────── recettes/*.json ─► pixeliser.py ─► PNG indexés + JSON ─► jeu
                                                                             (gratuit)         (quelques Ko)
```

1. **Référence d'ambiance.** Une image qui fixe la direction artistique : trouvée, peinte, ou générée une fois puis choisie. On la range dans `references/`. Tout brief qui la cite est produit en **éditant cette image** : même main, même lumière, même grain d'une image à l'autre. C'est le principal levier de cohérence (Dragon Rider : `art/references/ambiance.png`).
2. **Style.** `style.txt` décrit ce qui est commun à toutes les images : technique (pixel art, gros pixels nets, pas d'anticrénelage), palette et ambiance, façon de rendre la profondeur, et les interdits (pas de texte, pas d'interface, pas de personnage dans un décor…). Il est ajouté automatiquement devant chaque demande : **on n'écrit jamais de style dans un brief**. Une famille d'images qui a besoin d'un autre style (personnages, feu, logo) a son propre fichier, désigné par le champ `style` du brief.
3. **Briefs.** Un fichier JSON par image, qui ne décrit que le sujet.
4. **Génération.** `generer.py <projet> --essai` d'abord (gratuit : vérifie tout), puis `generer.py <projet>` (payant). Les images arrivent dans `generes/` avec leur manifeste. Pour retoucher une seule image : modifier son brief, puis `--seul <nom>`.
5. **Recettes.** Une recette par série cohérente (un niveau, une famille d'objets, les créatures…) : une palette commune et, pour chaque élément, sa source, sa taille dans le jeu et sa plage de teintes.
6. **Pixelisation.** `pixeliser.py recettes/<serie>.json` : PNG indexés, un JSON de description pour le jeu, et un aperçu à vérifier.
7. **Intégration.** Le jeu charge le JSON et les PNG, et les dessine sans lissage (voir [Intégrer les sorties dans un jeu](#intégrer-les-sorties-dans-un-jeu)).

## Structure d'un projet d'art

```
mon-jeu/
├─ .env                     la clé OpenAI (JAMAIS versionnée : voir .gitignore)
├─ art/                     le projet d'art (le dossier qu'on donne à generer.py)
│  ├─ style.txt             style commun (obligatoire)
│  ├─ style-perso.txt       styles alternatifs (facultatif, désignés par le champ « style » d'un brief)
│  ├─ briefs/*.json         une image par brief
│  ├─ references/           images de référence à éditer (facultatif)
│  ├─ generes/              créé par generer.py : images reçues + manifest.json
│  └─ recettes/*.json       une recette par série
└─ assets/decors/           créé par pixeliser.py (le « sortie » des recettes) : ce que le jeu charge
```

À mettre dans `.gitignore` :

```
.env
**/.env
art/generes/*.png
```

Les images de `generes/` pèsent environ 2 Mo pièce : on ne les versionne pas, mais **on les sauvegarde** (elles ont été payées). Le manifeste, lui, se versionne. Les sorties de `pixeliser.py` sont minuscules et se versionnent.

## Les briefs (`generer.py`)

Un fichier `briefs/<nom>.json` par image. Le brief réel du plan lointain de l'acte II de Dragon Rider :

```json
{
 "nom": "cimetiere-lointain",
 "reference": "references/ambiance.png",
 "taille": "1536x1024",
 "qualite": "high",
 "fond": "transparent",
 "sujet": "Une frise panoramique horizontale, vue de profil, de silhouettes TRÈS lointaines, gris pâle et brumeuses, à peine contrastées : la nécropole des rois, dômes funéraires, flèches, obélisques, cyprès morts, sur une colline. Toute la largeur de l'image, dans le tiers inférieur, base continue et plate tout en bas. Pas de lune, pas de ciel ni de nuages au-dessus des silhouettes : tout ce qui est au-dessus est transparent."
}
```

| Champ | Requis | Valeurs (défaut en gras) | Effet |
|---|---|---|---|
| `nom` | oui | lettres, chiffres, `-`, `_` | identifiant de l'image ; nomme le fichier produit et sert de clé dans le manifeste (les recettes y font référence) ; unique dans le projet |
| `sujet` | oui | texte | ce que montre l'image ; la demande envoyée est `style` + « Sujet : » + `sujet` |
| `style` | non | chemin relatif au projet, ex. `"style-perso.txt"` | remplace `style.txt` pour ce brief |
| `reference` | non | chemin relatif au projet (PNG, JPEG ou WebP) | l'image est produite en **éditant** cette référence : garde la série dans la même main |
| `taille` | non | **`1536x1024`**, `1024x1024`, `1024x1536`, `auto` | format de l'image reçue |
| `qualite` | non | **`high`**, `medium`, `low`, `auto` | plus la qualité est haute, plus l'image coûte cher |
| `fond` | non | **`opaque`**, `transparent` | `transparent` pour tout ce qui sera détouré : plans de parallaxe, objets, planches |
| `modele` | non | nom d'un modèle d'image OpenAI | défaut : `gpt-image-1.5` pour une édition de référence ou un fond transparent, sinon `gpt-image-2` |
| `_…` | non | libre | un champ qui commence par `_` (ex. `_doc`) est un commentaire : ni envoyé, ni compté dans l'empreinte |

Un champ inconnu (faute de frappe, par exemple `referance`) est signalé avec une suggestion.

### Options de `generer.py`

| Commande | Effet |
|---|---|
| `generer.py <projet>` | demande à l'API tout ce qui manque ou a changé (**payant**) |
| `generer.py <projet> --essai` | vérifie tout (briefs, styles, références, clé) **sans jamais appeler l'API** ; pose une image vide pour les briefs jamais générés, sans jamais remplacer une vraie image |
| `generer.py <projet> --seul <nom>` | ne traite que ce brief |
| `generer.py <projet> --forcer` | ignore le cache et redemande (**payant**) ; à combiner avec `--seul` |
| `generer.py --aide` | l'aide complète |

### Le cache, en détail

Chaque image est rangée sous `generes/<nom>-<empreinte>.png`. L'empreinte résume tout ce qui compose la demande : le texte de `style.txt` (ou le **nom** du fichier de style propre au brief), tous les champs du brief sauf les `_…`, et le contenu de l'image de référence. Un brief dont l'empreinte n'a pas changé n'est jamais redemandé. Une image déjà reçue n'est jamais redemandée non plus, même si le manifeste l'a oubliée (lancement interrompu, manifeste supprimé, brief revenu à une version précédente) : elle est **reprise** gratuitement.

Ce qui déclenche une nouvelle demande (payante) :

- modifier le `sujet` ou un champ d'un brief : ce brief seulement ;
- modifier `style.txt` : **tous** les briefs qui l'utilisent ;
- modifier une image de référence : **tous** les briefs qui la citent ;
- supprimer une image de `generes/` : cette image.

Ce qui n'en déclenche pas : modifier un fichier de style propre à certains briefs (champ `style`). L'outil le signale pour les images qu'il a produites ; pour les refaire : `--seul <nom> --forcer`.

## Les recettes (`pixeliser.py`)

Une recette décrit une série d'éléments qui partagent une palette :

```json
{
 "nom": "terres",
 "_doc": "Acte I. « tons » = plage de la palette : plus un plan est loin, plus il est clair et peu contrasté.",
 "palette": { "rampe": ["#060606", "#ecebe6"], "teintes": 15 },
 "sources": "../generes/manifest.json",
 "sortie": "../../assets/decors",
 "elements": {
  "lointain": { "source": "terres-lointain", "largeur": 480, "alpha": true, "raccord": 0.1, "tons": [10, 13], "tramage": 0.5, "rogner": true, "garder": "bas" },
  "proche":   { "source": "terres-proche",   "largeur": 340, "alpha": true, "raccord": 0.1, "tons": [4, 7],   "tramage": 0.35, "rogner": true }
 }
}
```

### Clés de la recette

| Clé | Requise | Effet |
|---|---|---|
| `nom` | oui | nom de la série : les images vont dans `<sortie>/<nom>/`, la description dans `<sortie>/<nom>.json` |
| `palette` | oui | voir ci-dessous |
| `elements` | oui | `{ "nom de l'élément": { options… } }` ; le nom de l'élément nomme son PNG |
| `sources` | non | chemin (relatif à la recette) du `manifest.json` de `generer.py` : permet de désigner une source par le nom de son brief |
| `sortie` | non | dossier de sortie, relatif à la recette ; défaut : `sortie` |
| `_…` | non | commentaire |

### La palette

Deux façons de l'écrire :

- **une rampe** : `{ "rampe": ["#sombre", "#clair"], "teintes": 15 }` — `teintes` couleurs (2 à 255, défaut 16) régulièrement espacées en clarté perçue entre les deux extrêmes. Deux gris neutres donnent un noir et blanc ; un indigo et un crème donnent un crépuscule.
- **une liste explicite** : `["#1a0608", "#5e1a22", "#b8323a", "#f0a050", "#fff4d6"]` — 1 à 255 couleurs, rangées automatiquement de la plus sombre à la plus claire.

L'indice 0 est toujours la teinte la plus sombre. Un index de plus est réservé à la transparence : avec **15 teintes ou moins**, chaque PNG est enregistré en **4 bits par pixel**.

Comment les couleurs sont choisies : pixeliser.py ne garde que la **valeur** (clarté perçue) de chaque pixel source, l'étire sur la plage `tons` de l'élément, puis la projette sur la palette avec un tramage ordonné. La teinte de la source ne compte pas : c'est la palette qui décide des couleurs. Une série qui a besoin d'une autre gamme de couleurs (le feu dans un monde en noir et blanc) prend sa propre recette.

### Options d'un élément

| Option | Défaut | Effet |
|---|---|---|
| `source` | requis | nom d'un brief du manifeste (si la recette a `sources`), ou chemin d'une image relatif à la recette (une image dessinée à la main convient) |
| `largeur` | requis | largeur finale en pixels du jeu ; la hauteur suit les proportions (sans objet pour une planche) |
| `tons` | toute la palette | `[t0, t1]` : plage d'indices de la palette utilisée. C'est le réglage de la **profondeur** : un plan lointain prend une plage claire et étroite, un plan proche une plage sombre |
| `tramage` | `0.7` | force du tramage ordonné (Bayer 4 × 4) entre deux teintes : `0` = aplats, `1` = trame forte |
| `alpha` | `false` | garde la transparence de la source ; sans elle, l'élément est opaque (ciel, fond, texture) |
| `seuil_alpha` | `0.5` | opacité (0 à 1) à partir de laquelle un pixel réduit reste visible ; plus bas pour garder des fumées légères |
| `ilot_min` | `6` | avec `alpha` : les morceaux isolés de moins de `ilot_min` pixels sont effacés (les trous d'un ou deux pixels dans le motif sont bouchés) |
| `garder` | aucun | avec `alpha` : `"bas"` ne garde que ce qui touche le bas du motif (retire une lune, un oiseau, un bosquet égaré dans le ciel) ; `"haut"` pour ce qui pend du haut (arcades, stalactites) |
| `rogner` | `false` | rogne le vide autour du motif ; le décalage retiré est noté dans le JSON (`decalage`). Un plan raccordable garde toute sa largeur |
| `raccord` | `0` | fraction de la largeur (ex. `0.1`, au plus `0.5`) fondue dans le début de l'image : l'élément **boucle horizontalement sans couture**. La largeur utile de la source diminue d'autant |
| `raccord_v` | `0` | la même chose en hauteur, pour une texture qui se répète dans les deux sens |
| `recadrer` | aucun | `[x0, y0, x1, y1]` en fractions de la source (0 à 1), appliqué avant tout le reste ; ex. `[0, 0.47, 1, 1]` garde le bas |
| `etirer` | `true` | étire les valeurs de la source (centiles 1 à 99) sur toute la plage `tons` ; `false` garde les valeurs telles quelles |
| `gamma` | `1.0` | courbe des valeurs avant projection : au-dessus de 1 assombrit, en dessous éclaircit |
| `contour` | `false` | liseré d'un pixel sur le bord du motif : un petit objet reste lisible sur n'importe quel fond |
| `contour_ton` | `t0` | indice de palette du liseré |
| `objets` | `false` | **planche** : la source contient plusieurs objets côte à côte (images d'une animation) ; chacun est découpé, réduit et rangé dans une case identique, de gauche à droite |
| `echelle` | requis si `objets` | planche : facteur de réduction (`0.15` : un objet de 1 000 px en fait 150) ; toutes les images gardent la même échelle |
| `attendus` | aucun | planche : nombre d'objets attendus ; si la découpe automatique n'en trouve pas autant (objets qui se touchent), la planche est découpée en colonnes égales |
| `joindre` | `0.012` | planche : écart (fraction de la largeur) sous lequel deux éclats appartiennent au même objet |
| `aire_min` | `0.08` | planche : taille minimale d'un objet, en fraction du plus grand (écarte les poussières) |
| `ancre` | `"centre"` | planche : `"centre"` ou `"bas"` (pieds alignés en bas de la case, pour ce qui marche ou brûle au sol) |
| `regarde` | `"gauche"` | planche : sens du personnage, recopié tel quel dans le JSON pour que le jeu sache quand le retourner |
| `base` | `false` | ancien nom : `true` équivaut à `"garder": "bas"` |
| `_…` | | commentaire |

Une option inconnue (faute de frappe) est signalée avec une suggestion ; une valeur impossible (plage de tons hors palette, recadrage vide, booléen entre guillemets…) arrête l'outil **avant** d'écrire quoi que ce soit, avec un message qui dit quoi corriger.

Ordre des opérations pour un élément : recadrage → raccords → réduction à la largeur finale (moyenne par surface, alpha prémultiplié) → transparence nette (`seuil_alpha`) → nettoyage des îlots et `garder` → étirement des valeurs, `gamma` → projection tramée sur `tons` → `contour` → `rogner`.

### Recettes types

Un ciel opaque qui défile en boucle :

```json
"ciel": { "source": "ciel-nuit", "largeur": 480, "raccord": 0.2, "tons": [3, 12], "tramage": 0.75 }
```

Trois plans de parallaxe détourés, du plus lointain au plus proche (la profondeur vient des plages de tons) :

```json
"lointain": { "source": "cimetiere-lointain", "largeur": 480, "alpha": true, "raccord": 0.1, "tons": [11, 14], "tramage": 0.5,  "rogner": true, "garder": "bas" },
"milieu":   { "source": "cimetiere-milieu",   "largeur": 380, "alpha": true, "raccord": 0.1, "tons": [8, 12],  "tramage": 0.45, "rogner": true, "garder": "bas" },
"proche":   { "source": "cimetiere-proche",   "largeur": 340, "alpha": true, "raccord": 0.1, "tons": [4, 7],   "tramage": 0.35, "rogner": true }
```

Une texture de sol de 128 px qui se répète dans les deux sens (on recadre d'abord la partie utile) :

```json
"roc": { "source": "terres-roc", "largeur": 128, "recadrer": [0.1, 0, 0.7667, 1], "raccord": 0.12, "raccord_v": 0.12, "tons": [0, 6], "tramage": 0.5 }
```

Un petit objet posé sur la carte, lisible grâce au liseré :

```json
"autel": { "source": "autel", "largeur": 40, "alpha": true, "tons": [1, 12], "tramage": 0.3, "rogner": true, "contour": true }
```

Une planche d'animation (5 images d'un corbeau, découpées automatiquement) :

```json
"corbeau": { "source": "corbeau", "objets": true, "echelle": 0.155, "attendus": 5, "joindre": 0.006, "tons": [0, 12], "tramage": 0.3, "contour": true, "contour_ton": 0, "regarde": "droite" }
```

Une série en couleur avec sa propre palette explicite (le feu) et des flammes posées au sol :

```json
{ "nom": "feu", "palette": ["#1a0608", "#5e1a22", "#7a1c26", "#b8323a", "#e0702e", "#f0a050", "#ffd9a0", "#fff4d6"],
  "sources": "../generes/manifest.json", "sortie": "../../assets/decors",
  "elements": { "flamme": { "source": "flamme", "objets": true, "echelle": 0.12, "attendus": 6, "tons": [0, 7], "tramage": 0.3, "ancre": "bas", "regarde": "haut" } } }
```

### Options de `pixeliser.py`

| Commande | Effet |
|---|---|
| `pixeliser.py <recette.json>` | refait tous les éléments de la recette |
| `pixeliser.py art/recettes/*.json` | plusieurs recettes à la suite |
| `pixeliser.py <recette.json> --seul <element>` | ne refait que cet élément (l'aperçu ne montre alors que lui) |
| `pixeliser.py --aide` | l'aide complète, avec toutes les options |

Le résultat est **toujours le même** pour les mêmes sources et la même recette : on peut tout relancer sans crainte.

### Les sorties

- `<sortie>/<nom>/<element>.png` : PNG indexé (palette + un index transparent).
- `<sortie>/<nom>-apercu.png` : chaque élément agrandi ×2 sur un fond de contrôle violet, pour vérifier d'un coup d'œil (défaut connu : les planches y apparaissent sur fond noir ; leurs PNG sont bien transparents).
- `<sortie>/<nom>.json` : la description pour le jeu. Extraits réels de Dragon Rider (`terres.json` pour un plan, `ennemis.json` pour une planche ; palette et rectangles abrégés) :

```json
{
 "nom": "terres",
 "palette": ["#060606", "#121211", "…", "#ecebe6"],
 "elements": {
  "lointain": { "image": "terres/lointain.png", "taille": [480, 141], "decalage": [0, 171], "hauteurAvantRognage": 355, "raccord": true }
 }
}
```

```json
"corbeau": { "image": "ennemis/corbeau.png", "taille": [285, 51], "cellule": [57, 51], "images": 5,
             "rects": [[5, 0, 46, 51], [57, 4, 57, 42], "…"], "regarde": "droite", "raccord": false, "decalage": [0, 0] }
```

| Champ | Sens |
|---|---|
| `image` | chemin du PNG, relatif au JSON |
| `taille` | largeur et hauteur du PNG |
| `decalage` | `[x, y]` retirés par `rogner` : pour replacer le motif là où il était dans l'image réduite |
| `hauteurAvantRognage` | hauteur de l'image réduite avant `rogner` (pour caler un plan sur l'horizon) |
| `raccord` | `true` si l'élément boucle horizontalement |
| `cellule` | planche : taille d'une case ; l'image *k* occupe la case qui commence en `x = k × cellule[0]` |
| `images` | planche : nombre d'images |
| `rects` | planche : rectangle exact de chaque image dans la feuille (pour les collisions) |
| `regarde` | planche : sens du personnage |

Le JSON est **complété** à chaque passage : un élément retiré de la recette y reste (l'outil le signale) ; supprimer le JSON pour repartir de zéro.

## Intégrer les sorties dans un jeu

Principes : dessiner **sans lissage** et à une **échelle entière** (×2, ×3…), sinon les pixels bavent.

Exemple en JavaScript avec un `<canvas>` :

```js
const desc = await (await fetch('assets/decors/terres.json')).json();
const charger = (el) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'assets/decors/' + el.image; });
const lointain = desc.elements.lointain, imgLointain = await charger(lointain);

ctx.imageSmoothingEnabled = false;                 // et en CSS : canvas { image-rendering: pixelated; }

// Plan de parallaxe qui boucle (raccord : true) : on le répète, décalé selon la caméra
const w = lointain.taille[0], depart = -Math.floor((camera * 0.3) % w);
for (let x = depart; x < largeurEcran; x += w) ctx.drawImage(imgLointain, x, horizon + lointain.decalage[1]);

// Planche d'animation : on dessine la case entière (l'ancrage reste stable d'une image à l'autre)
const ennemis = await (await fetch('assets/decors/ennemis.json')).json();
const corbeau = ennemis.elements.corbeau, imgCorbeau = await charger(corbeau);
const [cw, ch] = corbeau.cellule, k = Math.floor(temps * 9) % corbeau.images;
ctx.drawImage(imgCorbeau, k * cw, 0, cw, ch, xEcran, yEcran, cw, ch);
```

Pour un jeu en un seul fichier HTML jouable hors ligne, les PNG peuvent être embarqués en base64 : c'est ce que fait `outils/construire_jeu.py` pour Dragon Rider.

## Conseils qui ont marché sur Dragon Rider

- **Éditer une image de référence pour la cohérence.** Générer chaque image « de zéro » donne des mains différentes ; partir de la même référence (`"reference": "references/ambiance.png"`) garde le trait, la lumière et le grain d'une image à l'autre. Un personnage récurrent a sa propre référence (le dragon : `references/dragon.png`).
- **La profondeur par les plages de teintes, plan par plan.** Sur une palette de 15 gris, les Terres Décharnées utilisent `tons` [10, 13] au lointain, [7, 11] au milieu, [4, 7] au proche, avec un tramage qui diminue (0.5 → 0.45 → 0.35) : le lointain est clair, doux et brumeux, le proche sombre et net.
- **Fond clair et calme, jeu sombre et net.** Le décor ne doit jamais concurrencer ce qui se joue : les plans de fond restent clairs et peu contrastés, le terrain jouable, les ennemis et les objets prennent les teintes sombres et un contraste fort.
- **Un liseré sur les petits objets.** En dessous d'une soixantaine de pixels, un objet se perd dans le décor : `"contour": true` (et `"contour_ton": 0` pour le plus sombre) le rend lisible partout.
- **15 teintes + la transparence = PNG 4 bits, très légers.** Les 36 images de décors, objets et créatures de Dragon Rider pèsent environ 230 Ko en tout, pour plus de 100 Mo d'images sources.
- **Une seule couleur vive, dans sa propre recette.** Dans un monde en noir et blanc, le feu est la seule couleur : il a sa palette explicite et sa recette à lui.
- **Des briefs précis pour les planches.** Écrire « N images alignées sur UNE seule rangée horizontale, même taille, bien séparées par du vide, sans chevauchement. Rien d'autre, fond transparent. » ; si les images se touchent quand même, `attendus` découpe en colonnes égales.
- **Des briefs précis pour les plans qui défilent.** « Frise panoramique horizontale, vue de profil… toute la largeur de l'image, base continue et plate tout en bas ; rien au-dessus des silhouettes, tout ce qui est au-dessus est transparent » ; puis `garder: "bas"` retire ce qui flotte encore, et `raccord` fond les bords. Vérifier le raccord en posant deux copies côte à côte.
- **Le filtre de sécurité de l'API refuse parfois une demande.** Un univers sombre (morts, crânes, sang) le déclenche facilement. L'outil l'explique ; il suffit de reformuler le sujet avec des mots moins crus (« cadavre » → « silhouette immobile », « sang » → « taches sombres ») et de relancer avec `--seul`.
- **Toujours vérifier l'aperçu, puis dans le jeu sur fond sombre.** Un défaut de détourage (liseré clair, poussière) saute aux yeux sur un fond de nuit alors qu'il passe inaperçu sur un fond gris.
- **Itérer sur la recette, pas sur l'image.** Une teinte, un tramage ou une taille se corrigent gratuitement dans la recette ; ne regénérer (payant) que si le dessin lui-même ne convient pas.

## Coût

- **Chaque image générée coûte des crédits OpenAI.** Le prix dépend du modèle, de la taille et de la qualité (voir la page des tarifs d'OpenAI) ; le manifeste note pour chaque image la consommation annoncée par l'API (`usage`), de quoi faire les comptes.
- **Le cache évite de payer deux fois** : un brief inchangé n'est jamais redemandé, et une image déjà reçue est reprise même si le manifeste l'a perdue. Voir [ce qui déclenche une nouvelle demande](#le-cache-en-détail).
- **`--essai` ne coûte rien** : aucun appel à l'API. Le lancer après chaque modification de briefs pour voir ce qui serait demandé.
- Avant de demander quoi que ce soit, `generer.py` annonce combien d'images vont partir. **Ctrl-C** annule les demandes pas encore parties ; celles déjà envoyées sont payées, leurs images sont gardées.
- `--forcer` redemande même ce qui est en cache : à réserver à `--seul <nom>`.
- `pixeliser.py` est entièrement gratuit et hors ligne : c'est là qu'on règle tout ce qui peut l'être.

## Sécurité de la clé OpenAI

- `generer.py` lit la clé dans la variable d'environnement `OPENAI_API_KEY`, sinon dans le premier fichier `.env` trouvé dans le dossier du projet ou l'un de ses parents, sous la forme `OPENAI_API_KEY=sk-…`.
- **Le fichier `.env` n'est jamais versionné** : il doit figurer dans `.gitignore` (`.env` et `**/.env`) *avant* sa création. C'est vital sur un dépôt public comme celui de Dragon Rider.
- La clé ne sert qu'à fabriquer les images, sur la machine de la personne qui fabrique le jeu. **Le jeu lui-même n'en a jamais besoin** : ne jamais la mettre dans un fichier du jeu, un brief, une recette, un message ou une capture d'écran.
- L'outil n'affiche jamais la clé (l'essai à blanc dit seulement si elle a été trouvée, et où).
- En cas de fuite (clé publiée, poussée sur GitHub…), la **révoquer immédiatement** dans le tableau de bord d'OpenAI (section des clés d'API), en créer une nouvelle et la reporter dans `.env`.

## Dépannage

Chaque échec s'affiche sous la forme `ÉCHEC : ce qui se passe` suivi de `→ ce qu'il faut faire`. Les plus fréquents :

| Message | Que faire |
|---|---|
| `il manque le module Python « scipy »` | lancer la commande d'installation affichée juste en dessous |
| `aucune clé OpenAI trouvée` | créer `.env` avec `OPENAI_API_KEY=…`, ou lancer avec `--essai` |
| `le filtre de sécurité d'OpenAI a refusé ce brief` | reformuler le `sujet`, relancer avec `--seul <nom>` |
| `crédit OpenAI épuisé` | recharger le compte OpenAI, relancer : ce qui est déjà reçu est gardé |
| `brief incomplet : « nom » et « sujet » sont requis` | compléter le brief |
| `… n'est qu'une image vide d'essai à blanc` | la recette pointe sur un brief pas encore vraiment généré : lancer `generer.py` sans `--essai` |
| `l'image de « … » est notée dans le manifeste, mais le fichier manque` | les images générées ne sont pas versionnées : récupérer le dossier `generes/` d'origine, ou regénérer (payant) |
| `source introuvable pour l'élément « … »` | vérifier le nom du brief (une suggestion est proposée) ou le chemin, relatif à la recette |
| `« tons » doit être [t0, t1] avec 0 ≤ t0 ≤ t1 ≤ …` | la plage dépasse la palette : la réduire, ou augmenter `teintes` |
| `n objet(s) trouvé(s) au lieu de N : découpe en N colonnes égales` | normal si les images se touchent ; sinon ajuster `joindre` ou `aire_min` |
| `« … » est entièrement transparent` | `seuil_alpha` trop haut, `garder` qui retire tout, ou `recadrer` hors du motif |

## Pour qui maintient l'outil

- Deux fichiers autonomes, sans configuration ni chemin propre à une machine : les copier dans un autre projet suffit. Compatibles Python 3.9.
- Réglages en tête de `generer.py` : modèles par défaut (`MODELE_GENERATION`, `MODELE_EDITION`), demandes simultanées (`EN_PARALLELE`), délai d'attente (`DELAI`). **Changer un modèle par défaut change l'empreinte de tous les briefs qui ne précisent pas `modele` : ils seraient tous regénérés.** Pour passer à un nouveau modèle, préférer le champ `modele` dans les briefs concernés.
- Ne jamais modifier la fonction `empreinte()` de `generer.py` : toute différence ferait repayer toutes les images.
- `pixeliser.py` est déterministe : après toute modification, relancer toutes les recettes et comparer octet à octet les PNG et JSON produits avec ceux d'avant.
- Les listes d'options de l'aide (`CHAMPS` dans `generer.py`, `OPTIONS` dans `pixeliser.py`) servent aussi à détecter les fautes de frappe : une nouvelle option s'y ajoute.
