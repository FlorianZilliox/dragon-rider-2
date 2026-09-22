---
name: jeu-level-design
description: "Concevoir les niveaux d'un jeu 2D d'action et d'exploration (plateforme, vol, metroidvania) : cartes en texte, dimensions dictées par le personnage, parcours sinueux à la Castlevania (chemins haut et bas, raccourcis herses et leviers, secrets, reliques qui ouvrent la sortie), pénombre des profondeurs, placement des ennemis et difficulté qui monte d'acte en acte. À utiliser dès qu'on dessine, allonge ou refait un niveau, qu'on parle de level design, de carte, de parcours, de secret, de checkpoint, d'exploration ou de difficulté progressive — y compris pour « rendre un niveau plus long » ou « moins linéaire »."
---

# Level design d'un jeu 2D d'exploration

Tiré de Dragon Rider : 4 niveaux (Terres, Cimetière, Tours, Cryptes), puis le boss (le Veilleur). Les jouer tous forme un **acte**, et l'acte suivant rejoue les mêmes niveaux, plus durs.

**Avant la carte, la fiche.** Ce que le joueur fait dans le niveau (son idée, ses énigmes, ses secrets, ses reliques) se décide avec le skill `jeu-scenariste`, dans une fiche d'intention que l'utilisateur valide. La carte se dessine d'après elle ; pour Dragon Rider, les fiches sont dans `design/niveaux/`.

## Les cartes sont du texte

- **Un fichier par niveau**, `niveaux/<cle>.txt` : une lettre par case de 16 × 16 px. Les lignes qui commencent par `;` sont des commentaires, et l'en-tête décrit les sections avec leurs colonnes, les reliques, les autels et les cœurs.
- **La légende** vit dans le README : roc, corniche, pics, mur fissuré, colonne de cendre, départ, porte, autel, cœur, relique, ennemis, décors, et `H` pour une herse, `l` pour un levier, `|` pour une tour peinte.
- **Mesurer le personnage d'abord**, puis concevoir avec ces mesures. Pour le dragon : 3 cases de haut au sol, il enjambe seul une marche d'une case, son souffle permet environ 7 s de vol à plat ou 3,5 s de montée, et son feu part à hauteur de gueule (un mur fissuré doit se toucher de face).
- **Contrôler la carte automatiquement** : tout est atteignable, les murs fissurés se touchent de face, aucun objet n'est pris dans la pierre.
- **Une carte construite par un petit générateur** (des fonctions « tour », « courant », « salle ») garde des écarts exacts. Attention à l'ordre : une salle creusée après coup efface ce qu'on avait posé (un levier a disparu ainsi).

## Ce qu'on ne fait plus (retours de l'utilisateur)

- **Redessiner une carte qu'on devait seulement allonger.** « Je n'ai pas demandé de nouvelles cartes, juste qu'elles soient plus longues. » Garder l'original et **insérer des sections dans le même esprit**, puis montrer l'avant et l'après.
- **Construire l'architecture en empilant des blocs** (salles creuses à parois fines, cadres, piliers de 2 cases). La géométrie reste faite de masses épaisses : sols, îles, sommets larges, corniches. L'architecture passe par le décor peint (voir le skill jeu-assets-pixel-art).
- **Faire doublon.** Chaque niveau garde son caractère. Si un nouveau thème est aérien, les autres ne le deviennent pas.

## Un niveau de vol (d'après Owlboy, Demon's Crest, ActRaiser 2, Castlevania)

Les premières Tours de Dragon Rider ont été jugées « très laborieuses » : vingt-quatre tours plus hautes que l'écran, 5 cases d'écart entre elles pour un dragon de 110 px, et des corbeaux figés contre les murs. La refonte suit ces règles :
- **L'espace se mesure au personnage.** Le héros d'Owlboy fait 1/12 de l'écran et vole dans des salles grandes comme l'écran. Un grand personnage demande des passages d'au moins une dizaine de cases, jamais moins d'une fois et demie sa longueur.
- **Le ciel reste ouvert.** Le décor reste en bas : une ligne d'horizon (brume, remparts) d'où sortent des sommets bas, espacés d'environ un écran, qui servent de perchoirs. On vole au-dessus sans remonter chaque obstacle. Des îles (des fragments de tour qui flottent) meublent le haut, toujours contournables.
- **La hauteur se gagne dans des puits larges ou par des courants ascendants**, avec des rebords réguliers. Aucune montée de plus de 40 % du souffle sans un endroit où se poser.
- **Une seule grande tour, comme but.** On la grimpe par ses balcons alternés, avec un courant à côté ; la relique est au sommet. Un tel géant bloque le chemin : pas plus d'un par niveau.
- **Les ennemis viennent au joueur.** En plein ciel, un ennemi posé qui attend ne menace personne. Des volées surgissent du bord de l'écran, devant le personnage (comme les têtes de Méduse de Castlevania), et un ennemi ne doit jamais rester figé contre un mur : il le contourne par-dessus.
- **Le vérifier au robot** : `outils/tests/survol.mjs` traverse le niveau en vol à altitude de croisière et dit s'il se bloque. Sur les anciennes Tours, le robot restait coincé à 60 % du niveau ; sur les nouvelles, il traverse en 26 s.

## Exploration à la Castlevania

- **Deux étages qui se croisent.** Un chemin haut, de sommet en sommet, et un chemin bas, à pied, dans les fondations, reliés par des puits avec leur colonne de cendre pour remonter.
- **Les reliques ouvrent la sortie.** La porte n'apparaît qu'une fois toutes les reliques ramassées : si on arrive sans elles, un message « IL MANQUE 2 RELIQUES » ; à la dernière, un glas sonne et la porte monte de la brume. Disperser les reliques pour forcer l'exploration et les retours.
- **Herses et leviers comme raccourcis.** Placer le levier du côté du retour : on passe la première fois par le détour, et on ouvre en revenant.
  - Le levier s'actionne au feu ou à la ruée ; à bout portant, le feu doit l'atteindre avant de naître au-delà.
  - Le feu touche le levier sur toute la hauteur de son manche : au sol, la gueule est plus haute que la tête du levier (un cercle de tolérance le ratait).
  - Éviter qu'on le tire par accident depuis le chemin normal.
- **Les secrets** se cachent derrière des murs fissurés : de petites alcôves dans des masses épaisses, avec un cœur ou une relique.
- **Des autels** (points de reprise) aux carrefours et avant les passages durs.
- **La prise de rebord** : des terrasses qu'on n'atteint qu'en s'y agrippant. Il faut 3 rangées libres au-dessus et 2 cases de plateforme.
- **La pénombre des profondeurs**, réglée par niveau (`obscurite: { debut, plein, max }`). Placer des sources de lumière : autels, crânes ardents, et le feu du dragon, qui sert aussi à voir.
- **Un fond peint pour les profondeurs.** Quand la carte descend loin, un plan peint (soubassements, voûtes) couvre le bas, sinon on voit le ciel dans les galeries.

## Ennemis

- **Chacun a son propre schéma de comportement**, jamais une simple copie.
- **Les placer selon leur nature** : charognards perchés sur les sommets, âmes et spectres dans le vide, chauves-souris seulement sous un vrai plafond (jamais en plein ciel), crânes dans les galeries.
- **Doser la détection** : un ennemi qui ne réagit qu'au dernier moment se fait abattre avant d'attaquer.

## Difficulté : entre les actes, jamais entre les niveaux

- **Tout l'acte I garde la même difficulté**, celle des cartes. À partir de l'acte II, il y a plus d'ennemis (des renforts près de ceux de la carte), plus vifs, et une part d'entre eux plus résistants (un coup de plus).
- **Aucun signe distinctif** pour les ennemis durs : un liseré rouge a été refusé.
- **Le vocabulaire** : « niveau 2 » désigne le Cimetière, et « acte II » la deuxième boucle. En haut à gauche, un code court « 2-1 », sans surcharger l'écran ; la carte de titre dit « ACTE II · NIVEAU 1 ».

## Prouver qu'un niveau fonctionne

- **Des scénarios** : chaque relique ramassée, chaque mur fissuré cédé, chaque herse ouverte par son levier, chaque autel allumé, la porte qui mène au niveau suivant.
- **Un robot avec et sans ennemis** : utile sur un niveau linéaire. Sur un niveau à explorer, il se perd, et seule une vraie partie tranche.
- **Des captures en jeu, section par section**, dont les profondeurs, comparées aux maquettes validées.
- **La performance** sur les grandes cartes et avec la pénombre, sur téléphone simulé.
- **Montrer à l'utilisateur avant de publier.**
