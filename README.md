# Dragon Rider

Un dragonnier traverse un monde éteint sur son dragon noir : des terres décharnées jusqu'aux cryptes, où quelque chose veille encore. Jeu d'action en style 16 bits, gothique, presque entièrement en noir et blanc : le feu est la seule lumière chaude.

## Jouer

- **Sur téléphone** : ouvrir la version en ligne, puis « Ajouter à l'écran d'accueil ». Le jeu s'installe comme une application (PWA), plein écran, en paysage, et se joue ensuite sans réseau.
- **Sur ordinateur** : ouvrir `Dragon-Rider.html` (double-clic). Le fichier est autonome : il fonctionne hors ligne et n'a rien à installer.

| Action | Clavier | Manette à l'écran |
|---|---|---|
| Voler, marcher | ← → (ou Q/A et D) | croix |
| Monter / piquer | ↑ / ↓ (ou Z/W et S) | croix |
| Cracher le feu (maintenu : rafale) | X ou Espace | bouton X |
| Ruée à travers les ennemis (coûte du souffle) | C, ou 2 × ← / → | bouton C |
| Piqué éclair | ↓ + C | |
| Au sol : accroupi, super saut | ↓ puis ↑ | |
| Briser un mur fissuré | feu ou ruée | |
| Repères (ancre, collisions) | I | |
| Couper le son | M | icône haut-parleur |

## L'histoire

Chaque acte est une carte dessinée à la main, à explorer en vol et à pied ; au bout du dernier, l'arène du Veilleur se referme. Puis un nouveau cycle commence, plus difficile.

- **Le souffle** (barre sous les cœurs) : voler l'use, monter l'use plus vite ; épuisé, le dragon ne peut que planer vers le bas. Se poser le rend, tout comme les **colonnes de cendre** qui portent vers le haut.
- **Les reliques** : la porte de sortie d'un acte n'apparaît qu'une fois toutes ses reliques ramassées.
- **Autels** : on les allume en s'y posant ; ils soignent, et après une défaite on reprend au dernier autel allumé.
- **Secrets** : murs fissurés à briser, cœurs cachés.
- **Difficulté** : elle monte d'acte en acte, puis de cycle en cycle. Les ennemis deviennent plus vifs, certains viennent accompagnés, et une part d'entre eux est **coriace** : cerclés d'un liseré de sang, il leur faut un coup de plus (le liseré se brise au premier).

Raccourcis d'entraînement, à ajouter à la fin de l'adresse : `#calme` (sans ennemis), `#acte=2`, `#acte=3`…, `#veilleur`. `#essai` expose des aides de test (`window.__essai`) pour les robots de vérification.

## Construire le jeu

Il faut [Node.js](https://nodejs.org) (18 ou plus récent). Une seule fois, dans le dossier du jeu :

```sh
npm install        # installe l'outil d'assemblage (esbuild)
```

Puis :

```sh
npm run build      # produit dist/ (la PWA, à publier) et Dragon-Rider.html (le fichier unique)
npm run dev        # serveur local sur http://localhost:8000, reconstruit à chaque modification
```

### Organisation

```
src/
  index.html        la page : l'écran et la manette, rien d'autre
  styles.css        les styles de la page et de la manette
  sw.js             le service worker (cache hors ligne de la PWA)
  js/               le jeu, en modules ES
    main.js           démarrage et boucle de jeu
    etat.js           l'état partagé de la partie (J)
    config.js         constantes, liste des actes, difficulté
    ecran.js · entrees.js · son.js · texte.js · pinceau.js · outils.js
    niveau.js         lecture des cartes, cases, collisions
    terrain.js        roche, passerelles, objets (peints une fois par niveau, en bandes)
    decor.js          plans peints en parallaxe, météo
    dragon.js         le dragon : vol, marche, feu, ruée
    dragon-rendu.js   le dragon en marionnette : poses, pattes en cinématique inverse, ombre
    ennemis.js · ennemis-sprites.js · veilleur.js · monde.js · rendu-monde.js
    partie.js         actes, cartes de titre, progression
    interface.js · titre.js · demo.js · camera.js
niveaux/<cle>.txt   une carte par acte
assets/             sorties de Pixel Artist (dragon, décors, ennemis)
art/                recettes et briefs de génération des images
pixel_artist/       le pipeline pixel art (réutilisable pour d'autres jeux)
outils/construire.mjs   l'assemblage
outils/tests/       robots de vérification (Chrome sans fenêtre)
```

Les données (dragon, décors, cartes) sont injectées à l'assemblage dans un module `donnees.js` qui n'existe pas dans `src/`. La PWA garde les images en fichiers séparés, mis en cache par le service worker ; le fichier unique les embarque.

## Level design

Chaque acte est un fichier texte, `niveaux/<cle>.txt`, dont la clé est déclarée dans la liste `ACTES` de `src/js/config.js` (qui donne aussi l'ordre des actes, leurs noms, leurs décors). Une lettre = une case de 16 × 16 pixels, 22 lignes de haut. Les lignes qui commencent par `;` sont des commentaires.

| Lettre | Case | Lettre | Objet |
|---|---|---|---|
| `.` | vide | `P` | départ du dragon |
| `#` | roc | `E` | porte de sortie de l'acte |
| `=` | corniche (on la traverse par-dessous, on s'y pose) | `f` | autel (point de reprise) |
| `^` | pics | `h` / `r` | cœur / relique |
| `x` | mur fissuré (feu ou ruée ; tout le mur cède d'un coup) | `V` | le Veilleur (son arène) |
| `~` | colonne de cendre (porte vers le haut, rend le souffle) | `T` `t` `+` | arbre mort, tombe, croix (décor) |

Ennemis : `c` charognard, `a` âme errante, `b` chauve-souris (seulement sous un vrai plafond), `s` spectre, `k` crâne ardent. Chacun a son propre schéma de comportement ; ils se réveillent quand ils entrent dans le champ, et un ennemi vaincu le reste.

Mesures utiles pour dessiner une carte (le dragon est grand) :

- Au sol, il lui faut **3 cases de haut** ; en vol, 3 cases suffisent aussi, mais avec peu de marge.
- Il enjambe seul une marche d'**une case** ; au-delà, il faut sauter ou voler.
- Son feu part à hauteur de gueule : un mur fissuré doit être atteignable de face.
- Le souffle plein permet environ 7 s de vol à plat (≈ 1 200 px, 75 cases) ou 3,5 s de montée : au-delà, prévoir un sol ou une colonne de cendre.
- Hors de la carte : roc sur les côtés et en haut, gouffre en bas.

## Les images

- **Génération** : `pixel_artist/generer.py` produit les images d'après les briefs de `art/briefs/` et la référence d'ambiance (`art/references/`), avec l'API d'OpenAI (clé dans un fichier `.env`, jamais versionné).
- **Pixel art** : `pixel_artist/pixeliser.py` les réduit à la palette du jeu selon les recettes de `art/recettes/*.json` (décors, terrain, ennemis, objets, inscriptions) et écrit `assets/decors/`.
- **Le dragon** : `pixel_artist/pixel_artist.py` le redessine et le découpe en pièces (`pixel_artist/dragon.json`) ; le jeu l'anime en marionnette (ailes, queue en trois segments, pattes en cinématique inverse, demi-tour en volume).

Voir `pixel_artist/README.md` pour le détail du pipeline.

## Vérifier

Les robots de `outils/tests/` pilotent Chrome sans fenêtre (Chrome est trouvé automatiquement ; sinon `CHROME=/chemin/vers/chrome`) :

```sh
node outils/tests/titre.mjs "file://$PWD/Dragon-Rider.html" /tmp/titre            # écran titre et menu
node outils/tests/traverser.mjs "file://$PWD/Dragon-Rider.html#essai" /tmp/trav 90   # un robot joue les actes
node outils/tests/inspection.mjs "file://$PWD/Dragon-Rider.html#essai" /tmp/insp    # sauts d'image, tressautements
node outils/tests/perf.mjs "file://$PWD/Dragon-Rider.html" /tmp/perf 60 4          # téléphone simulé (processeur ÷ 4)
```
