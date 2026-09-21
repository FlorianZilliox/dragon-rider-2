# Dragon Rider

Un dragonnier traverse un monde éteint sur son dragon noir : des terres décharnées jusqu'aux cryptes, où quelque chose veille encore. Jeu d'action en style 16 bits, gothique, presque entièrement en noir et blanc : le feu est la seule lumière chaude.

## Jouer

En ligne : **https://florianzilliox.github.io/dragon-rider-2/** (cette adresse s'envoie telle quelle : on clique, on joue dans le navigateur).

Le jeu est aussi une application installable (PWA) : installé, il se joue sans réseau, dans sa propre fenêtre.

- **Téléphone** (en paysage) : Safari → bouton Partager → « Sur l'écran d'accueil » ; Chrome → menu ⋮ → « Installer l'application ».
- **Ordinateur** : Chrome ou Edge → icône « Installer » à droite de la barre d'adresse ; Safari (Mac) → Fichier → « Ajouter au Dock ».

| Action | Clavier | Manette à l'écran |
|---|---|---|
| Voler, marcher | ← → (ou Q/A et D) | croix |
| Monter / piquer | ↑ / ↓ (ou Z/W et S) | croix |
| Cracher le feu (maintenu : rafale) | X ou Espace | bouton X |
| Ruée à travers les ennemis (coûte du souffle) | C, ou 2 × ← / → | bouton C |
| Piqué éclair | ↓ + C | |
| Au sol : accroupi, super saut | ↓ puis ↑ | |
| Briser un mur fissuré | feu ou ruée | |
| S'agripper à un rebord et se hisser | pousser vers le rebord, en arrivant trop bas | croix |
| Actionner un levier | feu ou ruée | |
| Repères (ancre, collisions) | I | |
| Couper le son | M | icône haut-parleur |
| Pause | P ou Échap | automatique quand on quitte l'application ou qu'on tourne l'écran |

La manette à l'écran n'apparaît que sur un écran tactile. La croix se joue au glissé, comme une vraie : le pouce passe d'une direction à l'autre (huit en tout) sans se lever ; les boutons aussi, et plusieurs doigts à la fois fonctionnent. Sur Android, les boutons vibrent légèrement.

## L'histoire

Le jeu compte plusieurs **niveaux**, chacun une carte dessinée à la main, à explorer en vol et à pied ; au bout du dernier, l'arène du Veilleur se referme. Les jouer tous et vaincre le Veilleur, c'est un **acte** : l'acte II reprend les mêmes niveaux, plus durs, puis l'acte III, etc. En haut à gauche, « 2-1 » veut dire acte II, niveau 1.

- **Le souffle** (barre sous les cœurs) : voler l'use, monter l'use plus vite ; épuisé, le dragon ne peut que planer vers le bas. Se poser le rend, tout comme les **colonnes de cendre** qui portent vers le haut.
- **Les reliques** : la porte de sortie d'un niveau n'apparaît qu'une fois toutes ses reliques ramassées.
- **Autels** : on les allume en s'y posant ; ils soignent, et après une défaite on reprend au dernier autel allumé.
- **Secrets** : murs fissurés à briser, cœurs cachés.
- **Difficulté** : elle ne change pas d'un niveau à l'autre, seulement d'un acte à l'autre : à partir de l'acte II, plus d'ennemis, plus vifs, et une part d'entre eux plus résistants (un coup de plus), sans que rien ne les distingue.

Raccourcis d'entraînement, à ajouter à la fin de l'adresse : `#calme` (sans ennemis), `#niveau=2`, `#niveau=3`…, `#veilleur`, `#acte=2` (les niveaux de l'acte II). `#essai` expose des aides de test (`window.__essai`) pour les robots de vérification.

## Construire le jeu

Il faut [Node.js](https://nodejs.org) (18 ou plus récent). Une seule fois, dans le dossier du jeu :

```sh
npm install        # installe l'outil d'assemblage (esbuild)
```

Puis :

```sh
npm run build      # produit dist/ : la PWA, à publier telle quelle
npm run dev        # serveur local sur http://localhost:8000, reconstruit à chaque modification
npm test           # robots : téléphone simulé et écran titre (après npm run build)
```

Chaque envoi sur la branche `main` de GitHub reconstruit et republie le jeu en ligne (`.github/workflows/publier.yml`).

### Organisation

```
src/
  index.html        la page : l'écran et la manette, rien d'autre
  styles.css        les styles de la page et de la manette
  sw.js             le service worker (cache hors ligne de la PWA)
  js/               le jeu, en modules ES
    main.js           démarrage et boucle de jeu
    etat.js           l'état partagé de la partie (J)
    config.js         constantes, liste des niveaux, difficulté par acte
    appareil.js       PWA, écran allumé, pause automatique, plein écran
    ecran.js · entrees.js · son.js · texte.js · pinceau.js · outils.js
    niveau.js         lecture des cartes, cases, collisions
    terrain.js        roche, passerelles, objets (peints une fois par niveau, en bandes)
    decor.js          plans peints en parallaxe, météo
    dragon.js         le dragon : vol, marche, feu, ruée
    dragon-rendu.js   le dragon en marionnette : poses, pattes en cinématique inverse, ombre
    ennemis.js · ennemis-sprites.js · veilleur.js · monde.js · rendu-monde.js
    partie.js         niveaux et actes, cartes de titre, progression
    interface.js · titre.js · demo.js · camera.js
niveaux/<cle>.txt   une carte par niveau
assets/             sorties de Pixel Artist (dragon, décors, ennemis)
art/                recettes et briefs de génération des images
pixel_artist/       le pipeline pixel art (réutilisable pour d'autres jeux)
outils/construire.mjs   l'assemblage
outils/tests/       robots de vérification (Chrome sans fenêtre)
```

Les données (dragon, décors, cartes) sont injectées à l'assemblage dans un module `donnees.js` qui n'existe pas dans `src/`. Les images restent des fichiers séparés, mis en cache par le service worker.

## Level design

Chaque niveau est un fichier texte, `niveaux/<cle>.txt`, dont la clé est déclarée dans la liste `NIVEAUX` de `src/js/config.js` (qui donne aussi l'ordre des niveaux, leurs noms, leurs décors). Une lettre = une case de 16 × 16 pixels, 22 lignes de haut. Les lignes qui commencent par `;` sont des commentaires.

| Lettre | Case | Lettre | Objet |
|---|---|---|---|
| `.` | vide | `P` | départ du dragon |
| `#` | roc | `E` | porte de sortie du niveau |
| `=` | corniche (on la traverse par-dessous, on s'y pose) | `f` | autel (point de reprise) |
| `^` | pics | `h` / `r` | cœur / relique |
| `x` | mur fissuré (feu ou ruée ; tout le mur cède d'un coup) | `V` | le Veilleur (son arène) |
| `~` | colonne de cendre (porte vers le haut, rend le souffle) | `T` `t` `+` | arbre mort, tombe, croix (décor) |
| | | `G` `g` `B` `I` | gargouille tournée vers la droite, vers la gauche ; étendard en lambeaux ; clocheton (décor) |

Herses et leviers (raccourcis à la Castlevania) : `H` est une case de herse, qui bloque tant qu'elle est fermée ; `l` est un levier. Un tir de feu ou une ruée l'actionne, et il lève d'un bloc la herse la plus proche (le groupe de cases `H` qui se touchent).

Pénombre : un niveau peut s'assombrir en profondeur, avec `obscurite: { debut, plein, max }` dans son entrée de `NIVEAUX` (rangées de la carte, opacité maximale de 0 à 1). La lumière vient du dragon, de son feu, des autels allumés, des explosions, des crânes ardents, et de la lueur des âmes, des spectres et des reliques.

Ennemis : `c` charognard, `a` âme errante, `b` chauve-souris (seulement sous un vrai plafond), `s` spectre, `k` crâne ardent. Chacun a son propre schéma de comportement ; ils se réveillent quand ils entrent dans le champ, et un ennemi vaincu le reste.

Mesures utiles pour dessiner une carte (le dragon est grand) :

- Au sol, il lui faut **3 cases de haut** ; en vol, 3 cases suffisent aussi, mais avec peu de marge.
- Il enjambe seul une marche d'**une case** ; au-delà, il faut sauter ou voler.
- Son feu part à hauteur de gueule : un mur fissuré doit être atteignable de face.
- Le souffle plein permet environ 7 s de vol à plat (≈ 1 200 px, 75 cases) ou 3,5 s de montée : au-delà, prévoir un sol ou une colonne de cendre.
- Hors de la carte : roc sur les côtés et en haut, gouffre en bas.
- La roche qui pend (`dessous`) garnit toute cavité de 3 rangées ou plus sous du roc, et la crête se pose sur tout sol découvert. Dans les tours (`sousLeCiel` dans `TERRAIN`), les créneaux ne se posent qu'à l'air libre et, au plafond d'une alcôve, les mâchicoulis se réduisent à une corniche (une alcôve : un sol et un plafond à 5 rangées au plus l'un de l'autre).

## Les images

- **Génération** : `pixel_artist/generer.py` produit les images d'après les briefs de `art/briefs/` et la référence d'ambiance (`art/references/`), avec l'API d'OpenAI (clé dans un fichier `.env`, jamais versionné).
- **Pixel art** : `pixel_artist/pixeliser.py` les réduit à la palette du jeu selon les recettes de `art/recettes/*.json` (décors, terrain, ennemis, objets, inscriptions) et écrit `assets/decors/`.
- **Le dragon** : `pixel_artist/pixel_artist.py` le redessine et le découpe en pièces (`pixel_artist/dragon.json`) ; le jeu l'anime en marionnette (ailes, queue en trois segments, pattes en cinématique inverse, demi-tour en volume).

Voir `pixel_artist/README.md` pour le détail du pipeline. Les icônes de l'application (`src/icones/`) sont composées à partir des sprites du jeu par `python3 outils/icones.py`.

## Vérifier

Les robots de `outils/tests/` pilotent Chrome sans fenêtre (Chrome est trouvé automatiquement ; sinon `CHROME=/chemin/vers/chrome`). Ils servent eux-mêmes `dist/` (lancer `npm run build` avant) ; le premier argument est `-`, des raccourcis (`#essai`…) ou une adresse http :

```sh
node outils/tests/titre.mjs - /tmp/titre                       # écran titre et menu
node outils/tests/traverser.mjs "#essai" /tmp/trav 90 reliques   # un robot joue les niveaux (portes ouvertes d'office)
node outils/tests/inspection.mjs - /tmp/insp                   # sauts d'image, tressautements
node outils/tests/perf.mjs - /tmp/perf 60 4                   # téléphone simulé (processeur ÷ 4)
node outils/tests/mobile.mjs /tmp/mobile        # la PWA (dist/) sur téléphone simulé : croix, portrait, hors ligne
```
