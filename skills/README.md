# Le harnais : faire des jeux 2D

Ce qu'on a appris en faisant Dragon Rider, rendu réutilisable pour d'autres jeux. Il y a deux sortes de pièces :
- des **skills**, qui portent la méthode (ce dossier) ;
- des **outils**, qui fabriquent (`pixel_artist/` à la racine du dépôt).

Rien n'y est propre à Dragon Rider. Le jeu sert d'exemple travaillé, et ce qui lui est propre vit ailleurs : `design/`, `art/`, `niveaux/`, `src/`.

## Pour un nouveau jeu, dans l'ordre

| Étape | Skill | Ce qu'on produit | Validé par l'utilisateur avant la suite |
|---|---|---|---|
| 1. Ce que le joueur fait | `jeu-scenariste` | la grammaire (gestes × matières), l'acte en quatre temps, une fiche d'intention par niveau, la matrice anti-répétition | les fiches |
| 2. Les cartes | `jeu-level-design` | une carte en texte par niveau, d'après sa fiche | le plan de chaque carte |
| 3. Les images | `jeu-assets-pixel-art` | l'image de référence d'ambiance, puis les décors, objets et ennemis (génération, puis Pixel Artist) | une planche des pièces et une maquette de scène |
| 4. Les personnages | `jeu-animation-marionnette` | le personnage découpé en os (Pixel Artist), animé par Pantin | des bandes d'images en mouvement |
| 5. Le jeu | `jeu-moteur-2d-pwa` | le moteur en modules, la PWA, les contrôles mobiles, les robots de test, la publication | le jeu, sur téléphone |

Les étapes 3 à 5 avancent en parallèle une fois les fiches validées. On ne dessine pas de carte sans fiche, et on ne branche pas d'image sans planche validée.

## La méthode de validation (reprise du pipeline Sillage)

- **Une fiche d'intention avant de fabriquer.** Rien ne se construit sans elle.
- **Des couches** : ce qui est validé en bas n'est plus rejugé en haut. La grammaire passe avant les fiches, les fiches avant les cartes, et les pièces avant les scènes.
- **Valider une fois, au bon niveau**, sur une page lisible (planche, maquette, fiches), puis ne plus y revenir.
- **Confronter au réel** : le vrai rendu en jeu, les robots, des bandes d'images en mouvement, une comparaison avant/après.

## Les outils

| Outil | Où | Rôle | État |
|---|---|---|---|
| Pixel Artist | `pixel_artist/` (`generer.py`, `pixeliser.py`, `pixel_artist.py`) | génère d'après une référence, réduit en pixel art, découpe un personnage en os | en service |
| Pantin | `pixel_artist/pantin/` | anime une marionnette découpée : os, ressorts, cinématique inverse | en service |
| Salles d'essai | `niveaux/salles/`, `#salle=<nom>` (Dragon Rider) | une idée de jeu jouable seule, prouvée au robot avant d'être montrée | en service (bûcher) |
| Rouages | à venir | moteur générique de mécanismes : déclencheur → effet, liens nommés dans les cartes | étape 2 du chantier « ce que le joueur fait » |
| Arpenteur | à venir | lit carte, mécanismes et grammaire ; prouve qu'un niveau se termine, trace le graphe des énigmes, et une table à dessin | étape 3 |

## Installer les skills

Copier chaque dossier `skills/<nom>/` dans `~/.claude/skills/<nom>/` pour que Claude Code s'en serve dans n'importe quel projet. Après une modification, recopier : la version de ce dépôt fait foi.
