---
name: jeu-assets-pixel-art
description: "Fabriquer les images d'un jeu 2D en pixel art de haute qualité : décors en parallaxe, textures de terrain, objets, ennemis, logos, inscriptions, icônes — par génération d'images (OpenAI, d'après une image de référence d'ambiance) puis passage dans Pixel Artist (palette, tramage, raccords, détourage, découpe en pièces). À utiliser dès qu'on crée, refait ou améliore un visuel de jeu 2D, qu'on veut « des décors plus beaux », un asset « moins moche », une direction artistique cohérente, ou qu'on parle de sprites, de tuiles, de pixel art, de Pixel Artist ou de génération d'assets — même si l'outil n'est pas nommé."
---

# Assets pixel art d'un jeu 2D

Méthode éprouvée sur Dragon Rider (jeu gothique en noir et blanc) : chaque image est **peinte par la génération, puis réduite par Pixel Artist**. Jamais fabriquée par du code. Les outils sont dans le dépôt `github.com/FlorianZilliox/dragon-rider-2`, dossier `pixel_artist/` : copier ce dossier dans le nouveau projet, son `README.md` détaille chaque option.

## La direction artistique d'abord

1. **Une image de référence d'ambiance**, choisie par l'utilisateur, sert de base à toutes les générations (édition d'après elle), pour que tout « respire » la même ambiance. La ranger dans `art/references/`.
2. **Écrire la direction** dès qu'elle est tranchée : palette, dominante, seule couleur chaude autorisée, style de trait. Par exemple, pour Dragon Rider : noir et blanc majoritaire, gris tramé, profondeur par la valeur, le feu est la seule lumière chaude.
3. **Une décision tranchée ne se rouvre pas.** On la note dans la mémoire du projet et on s'y tient.
4. **Des références d'œuvres d'autrui** (planches, illustrations) peuvent servir d'édition, en local seulement : dossier ignoré par git, jamais publié.

## La chaîne

| Étape | Outil | Ce qu'il faut savoir |
|---|---|---|
| Brief | `art/briefs/<nom>.json` | Sujet, cadrage, fond (transparent pour un objet), références (une liste). Formuler sobrement : la modération rejette les briefs violents. Pour du texte (logo, inscription), épeler les lettres et vérifier l'orthographe sur l'image (une génération a déjà sorti « DRAGOON », une autre un accent en trop). |
| Génération | `pixel_artist/generer.py` | Édition d'après la référence pour la cohérence ; cache par empreinte et manifeste : ne payer que ce qui change. Clé dans un `.env` jamais versionné. |
| Réduction | `pixel_artist/pixeliser.py` + `art/recettes/*.json` | Palette en rampe (luminance OKLab), plage de tons par plan (le lointain clair, le proche sombre), tramage Bayer 4×4, raccords sans couture (`raccord`), `garder` bas/haut, `contour`, `ilot_min`, `trous_max`, planches d'objets découpées automatiquement, `valeurs` (même étirement pour des pièces tirées d'une même source), `lumiere` (liseré). |
| Personnage | `pixel_artist/pixel_artist.py` + `pixel_artist/pantin/` | Redessin en pixel art, découpe en os d'après la recette (voir le skill jeu-animation-marionnette) : jointures sans couture, morceaux détachés rendus à la pièce voisine, image au repos identique au modèle. En jeu, Pantin anime la marionnette. |

## Ce qui a été rejeté, et pourquoi

- **Les décors fabriqués par du code.** Murs, colonnes et ruines construits en empilant des blocs de texture : jugés « très moches, côtés trop droits ». L'érosion procédurale des bords : « pas très réussie ». La règle : les cartes gardent des masses simples et épaisses. L'architecture vit dans les **plans peints en parallaxe** et dans des **objets peints**.
- **Les bords tirés à la règle.** Toute silhouette doit être irrégulière : un asset coupé net a été refusé.
- **Les pixels parasites.** Un pixel qui flotte au-dessus d'un personnage se voit. Nettoyer les îlots (`ilot_min`, et par pièce découpée).
- **La perte de qualité en refondant.** Un « nettoyage » qui appauvrit le détail est un recul.

## Structures de premier plan (tours, piliers, arbres géants)

Quand le décor lui-même sert de plateformes (des tours où l'on se pose), peindre les éléments et les découper **en tranches** : sommet (terrasse ou toit en flèche), fût qui se répète en hauteur, et ce qui est sous la base.
- **Rien de plus large que la collision sous l'endroit où l'on se pose.** Un « pied qui se perd dans la brume », peint pour des tours hautes, est arrivé à hauteur d'yeux quand les tours sont devenues basses : une tache deux fois plus large que le mur (« vraiment moche, mal intégré, pas logique »), et sous une île, une masse qu'on prenait pour un sol (« on s'attend à se poser dessus, mais non »).
- **Une tour posée s'arrête net sur sa base.** **Un fragment qui flotte porte dessous un coin de roche renversé** (comme les îles de l'image d'ambiance), plus étroit vers le bas : on ne se pose pas sur une pointe. Le coin se génère plat (deux fois plus large que haut), sinon il bouche le couloir de vol, et sa collision se calcule d'après ses pixels (Dragon Rider : cases `u`).
- **Un décor pointu ne blesse pas.** Des flèches de tour qui blessaient : « le joueur ne va jamais comprendre ». Prévoir une largeur de pièce par largeur de structure sur la carte. Le moteur les assemble à la hauteur voulue, et les collisions restent celles des cases. C'est la découpe « 3 tranches » du pipeline Sillage : tuiler, jamais étirer.

## La validation : une seule fois, au bon niveau

1. Produire une **planche des pièces**, une **maquette de scène** (les pièces composées sur le vrai fond, à l'échelle du jeu) et, pour un niveau, le **plan de la carte**.
2. **S'arrêter, et les montrer** à l'utilisateur, par exemple en ouvrant les images en local.
3. Ne brancher dans le jeu qu'après son accord. Ensuite, il ne re-juge plus ces objets.

## Contrôles avant de livrer

- **Détourage** : chaque sprite zoomé sur fond sombre **et** sur magenta (bords, halo, trous).
- **Îlots** : compter les composantes connexes de chaque pièce, et viser zéro îlot de moins de 6 px.
- **Cohérence** : capture en jeu côte à côte avec les assets existants et avec l'image de référence.
- **Avant / après** : toute refonte se compare à la version précédente, mêmes images, même zoom. Avec des pièces de personnage, vérifier qu'au repos l'image recomposée est identique au pixel près.
- **Coût** : noter le nombre d'images payées dans le rapport.
