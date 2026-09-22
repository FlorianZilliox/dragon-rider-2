---
name: jeu-scenariste
description: "Concevoir ce que le joueur FAIT dans un jeu 2D d'action et d'exploration : l'idée propre à chaque niveau, les mini-énigmes (ordre, lumière, poids, feu, mécanismes), les passages secrets et leurs indices, les artefacts à trouver, le récit porté par les lieux, et la variété d'un niveau à l'autre. Produit la grammaire du jeu (gestes × matières), une fiche d'intention par niveau validée avant toute carte, et une matrice anti-répétition, en puisant dans un catalogue de trouvailles (Owlboy, Zelda, Metroid, Celeste, Wario Land, Mario…). À utiliser dès qu'on imagine un niveau, un monde, un donjon, une énigme, un secret, un artefact ou l'« histoire » d'un jeu, qu'on trouve un jeu « répétitif », « trop simple », « basique », « toujours pareil », ou qu'on veut des niveaux « riches en trouvailles » ou « à la Owlboy ». Passe avant jeu-level-design, qui dessine la carte."
---

# Scénariste de jeu 2D : ce que le joueur fait

Les autres skills du harnais fabriquent le jeu : les images (jeu-assets-pixel-art), l'animation (jeu-animation-marionnette), les cartes (jeu-level-design), le moteur (jeu-moteur-2d-pwa). Celui-ci passe avant eux. Il décide ce que le joueur fait dans chaque niveau, pourquoi ce n'est pas la même chose qu'au niveau d'avant, et ce qu'il y trouve.

Exemple travaillé : Dragon Rider, dossier `design/` du dépôt `github.com/FlorianZilliox/dragon-rider-2`.

## Le principe : une grammaire, pas une liste de niveaux

- **Un jeu devient répétitif quand sa grammaire est pauvre** : peu de gestes du héros croisés avec peu de matières du monde qui y répondent. Changer le décor et les ennemis ne suffit pas.
  - Dragon Rider, premier essai : un dragon aux 7 gestes, un monde qui ne répond que par 3 matières (mur fissuré, courant, levier), et le même contrat dans les 4 niveaux (3 reliques, puis la porte). Jugé « très simple ».
- **La trouvaille naît d'un geste connu qui rencontre une matière nouvelle.** Il ne faut pas de nouveau bouton. Dans Owlboy, le tromblon de feu d'Alphonse brûle les lianes et allume les torches, et le grappin de Twig tire les objets.
- **Un geste neuf coûte cher** (animation, commande, apprentissage). **Une matière neuve coûte une image et un mécanisme.** Enrichir d'abord les matières.

## La démarche, dans l'ordre

1. **Lire ce qui est tranché** dans la mémoire du projet. Les décisions de l'utilisateur ne se rouvrent pas : les idées se posent à l'intérieur de ce cadre. Si une idée exige de rouvrir une décision, la présenter à part, comme telle.
2. **Écrire la grammaire du jeu** (`design/grammaire.md`, modèle dans `modeles.md`) :
   - les gestes du héros, avec leurs mesures lues **dans le code** ;
   - les matières et leurs déclencheurs ;
   - les ennemis et leur schéma ;
   - le langage des secrets.
3. **Le diagnostic de répétition, chiffré.** Pour chaque niveau : son contrat, les matières présentes (comptées dans la carte), les gestes vraiment utiles.
4. **L'acte en quatre temps.** Le kishōtenketsu de Nintendo s'applique aussi à l'échelle d'un acte, pas seulement d'un niveau :
   - premier niveau : introduire (le geste devient un outil) ;
   - deuxième : développer ;
   - troisième : retourner (le monde change de règle) ;
   - dernier : conclure (tout, sous pression).
5. **Diverger avant de choisir.** Pour chaque niveau, au moins trois idées tirées de familles différentes du catalogue, plus une inventée. Chaque idée passe cinq critères :
   - elle naît du thème du niveau (la phrase de son titre) ;
   - elle réutilise un geste existant ;
   - elle se lit sans texte ;
   - son coût est raisonnable ;
   - elle ne crée aucun doublon dans la matrice.

   On peut confier chaque famille à un agent, puis faire juger à l'aveugle.
6. **La fiche d'intention**, une par niveau (modèle dans `modeles.md`). Elle bloque la suite, comme dans le pipeline Sillage : **aucune carte n'est dessinée avant que l'utilisateur l'ait validée**. On lui montre les fiches et la matrice ensemble, sur une page lisible, pas dans le terminal.
7. **La matrice anti-répétition** (`design/README.md`). Deux niveaux ne partagent jamais l'idée, le geste mis en avant, la matière nouvelle ni la pression dominante.
8. **Passer la main.** jeu-level-design dessine la carte d'après la fiche validée. Le moteur de mécanismes câble ce qu'elle demande, et le vérificateur de niveaux prouve le graphe des énigmes quand ces outils existeront. Si le jeu contredit la fiche, on met la fiche à jour.

## Les règles d'une bonne énigme d'action

- **Une idée par niveau, en quatre temps**, puis on la jette (Koichi Hayashida et Shigeru Miyamoto, Super Mario 3D Land) :
  - introduire, sans danger et avec la solution en vue ;
  - développer ;
  - retourner ;
  - conclure.
- **Lisible sans texte.** L'objet dit ce qu'il fait : du bois mort appelle la flamme. Le texte sert au récit et aux énigmes de lecture, jamais au mode d'emploi.
- **Tout ce qui s'actionne s'actionne pareil.** Un levier, une cloche, un paratonnerre répondent aux mêmes gestes. Seule la conséquence change.
- **Chaque artefact qui ouvre la sortie est une énigme différente** : grimper, lire, oser, chercher, rattraper.
- **Nécessaire, et mesuré.** Une énigme qu'on peut contourner n'en est pas une. Vérifier chaque serrure contre les mesures de la grammaire : portée verticale, angle et portée du tir, endurance, gabarit. Dragon Rider :
  - dans une carte de 22 rangées, le dragon atteint tout depuis le sol, et un courant ascendant n'y débloque jamais la hauteur ;
  - un piqué ne fendait pas un sol fragile ;
  - un tir incliné à 15° monte de 8 rangées à bout de portée.

  Ces trois écarts ont été trouvés en relisant le code, pas en imaginant.
- **Comprendre est la difficulté, pas exécuter.** Une fois comprise, une énigme se fait en moins d'une minute.
- **Une erreur coûte peu, et ne coince jamais.** Un ennemi réveillé, une remise à zéro : jamais un long recommencement, jamais une impasse. Le prouver par le graphe des énigmes.
- **Tout ce qui menace s'annonce**, au moins une demi-seconde avant : il crépite, il tremble, il gronde.
- **La première rencontre montre la chose en marche.** On voit la foudre frapper avant de la guider. On voit l'ennemi briser un mur par accident avant de s'en servir.

## Secrets et artefacts

- **Trois couches de secrets** dans chaque niveau :
  1. **visible et inaccessible** : on voit la récompense tôt, on comprend plus tard comment l'atteindre ;
  2. **caché, avec un indice** : un secret sans indice est une punition ;
  3. **méta** : des fragments répartis entre les niveaux, qui composent un sens (Tunic, Fez, Animal Well).
- **Un langage des secrets constant.** Le même indice veut toujours dire la même chose dans tout le jeu, et on l'écrit dans la grammaire. Exemple : « une fuite trahit un creux ». De la fumée, un courant d'air, une lueur ou un son creux qui sort d'une paroi disent qu'il y a un vide derrière.
- **Trois sortes d'artefacts** :
  - ceux qui **ouvrent** (clés, reliques qui ouvrent la sortie) ;
  - ceux qui **donnent ou changent un geste** (l'objet du donjon de Zelda) ;
  - ceux qui **racontent**.

  Un artefact qui ne fait qu'augmenter un compteur est le moins intéressant.
- **La récompense suit l'effort** : un cœur pour un petit secret, un fragment d'histoire pour la couche méta.
- **Les fragments ajoutent du sens, ils n'en retirent pas.** La fin reste complète pour qui ne les trouve pas.

## L'histoire, par les lieux

- **Pas de dialogue imposé.** L'histoire se lit dans le décor, les inscriptions et les objets (Blasphemous, Hollow Knight, Inside).
- **Chaque niveau a un moment** : ce que le joueur comprend du monde en le traversant.
- **Le geste de jeu a un sens dans la fiction.** Allumer les bûchers funéraires, c'est rendre aux morts leur feu : l'énigme devient un rite.
- **La phrase du titre du niveau sert de brief.** L'idée doit en naître.

## Rejouer sans répéter

Si le jeu fait rejouer les niveaux (actes, boucles, New Game+), une énigme déjà résolue n'est plus une énigme.
- **Mêmes lieux, autres réponses** (la Second Quest de Zelda) : d'autres cachettes, un autre ordre, d'autres mécanismes actifs. Ce ne sont que des données de plus par boucle.
- **Le retour avec un pouvoir nouveau** : des passages vus au premier tour s'ouvrent au suivant.
- **Le lieu retourné** : à l'envers, effondré, de nuit (le château inversé de Symphony of the Night).

## Les coûts et l'ordre de fabrication

Chaque idée porte son coût (échelle dans `catalogue.md`) : Données, Rouages, Image, Animation, Moteur.
- Commencer par les idées à coût Données ou Rouages.
- Une idée qui demande une Animation ou du Moteur doit servir à plusieurs niveaux, ou à plusieurs jeux.
- Relever dans le `design/README.md` du jeu la liste de ce que le moteur de mécanismes devra savoir faire (déclencheurs, effets, conditions). Ce sont les besoins réels, pas une liste imaginée.

## Si une carte existe déjà

L'utilisateur de Dragon Rider a refusé une carte redessinée alors qu'il demandait seulement de l'allonger. Une idée neuve se pose donc **en ajouts localisés** sur la carte existante (objets, mécanismes, reliques déplacées), géométrie intacte. On ne redessine que si l'utilisateur l'a demandé.

## Fichiers

- `catalogue.md` : les trouvailles, avec leur index, leur fiche, leur coût et leurs emplois. À enrichir à chaque jeu.
- `modeles.md` : les modèles de la grammaire, de la fiche d'intention et de la matrice.
- Dans le jeu : `design/grammaire.md`, `design/README.md` (l'acte, la matrice, les besoins du moteur de mécanismes), `design/niveaux/<cle>.md`.

## Rester générique

Rien de propre à un jeu dans ce skill ni dans le catalogue. Ce qui est propre au jeu va dans son dossier `design/`. Une leçon neuve qui vaut pour tous les jeux remonte ici.
