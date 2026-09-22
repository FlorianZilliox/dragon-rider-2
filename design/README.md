# Dragon Rider — ce que le joueur fait

Conception des niveaux par la méthode du skill `jeu-scenariste` (dans `skills/`, générique, réutilisable pour d'autres jeux). Ici vit ce qui est propre à Dragon Rider :
- `grammaire.md` : les gestes du dragon, mesurés dans le code, les matières, les ennemis, ce qui est tranché, et le diagnostic de répétition ;
- `niveaux/<cle>.md` : une fiche d'intention par niveau. **Aucune carte ne se dessine avant que Florian l'ait validée.**

Statut : **proposé le 2026-09-22, en attente de validation.**

## Le diagnostic, en une ligne

Les quatre niveaux ont le même contrat (3 reliques, puis la porte), le monde ne répond au dragon que par trois matières (mur fissuré, colonne de cendre, levier), et le feu ne sert qu'à tuer et à casser. Le détail chiffré est dans `grammaire.md`.

## L'acte en quatre temps

Le kishōtenketsu de Nintendo (introduire, développer, retourner, conclure) sert à l'échelle d'un niveau, et aussi à l'échelle de l'acte :

| Niveau | Rôle | L'idée |
|---|---|---|
| Terres Décharnées | introduire | **Le feu fait le vent** : on allume des bûchers funéraires. Leur vent chaud porte le dragon, souffle la cendre qui recouvre les choses, et leur fumée attire les charognards. |
| Cimetière des Rois | développer | **L'ordre des rois** : sonner les cloches des tombes dans l'ordre des règnes, lu dans les emblèmes, sans sonner l'usurpateur. |
| Tours Foudroyées | retourner | **Guider la foudre** : dresser un paratonnerre appelle l'éclair, qui fend le fer ; ce qu'il libère tombe, et il faut le rattraper. |
| Cryptes | conclure | **La fuite éclairée** : on allume en descendant, la crypte s'effondre après le Veilleur, et on remonte en fuyant, éclairé par ce qu'on a allumé. |

Le contrat « toutes les reliques, puis la sortie » reste ; c'est une décision tranchée. Ce qui change, c'est **le chemin vers chaque relique** : une énigme différente pour chacune, douze en tout.

## Matrice anti-répétition

| | Terres | Cimetière | Tours | Cryptes |
|---|---|---|---|---|
| L'idée | le feu fait le vent | l'ordre des rois | guider la foudre | la fuite éclairée |
| Geste mis en avant | le feu, outil à distance | frapper et lire | tirer le levier, s'écarter, plonger | courir et voler sous pression |
| Matière nouvelle | le bûcher et la cendre qu'il souffle | la cloche et l'emblème | le paratonnerre et le fer scellé | l'effondrement |
| Pression dominante | aucune : on apprend | la réflexion (une erreur réveille un ennemi) | l'impact qu'on appelle soi-même | la montre |
| Forme du parcours | une ligne, et des montées qu'on fabrique | des allers-retours pour lire (le Carré au centre) | deux étages, ciel ouvert (la carte refaite) | descendre, puis remonter par un autre chemin |
| Lumière | les feux allumés restent | la lune, l'orage | l'éclair | le noir, les braseros |
| Indice des secrets | la fumée | le son creux | le courant d'air | la lueur |
| Moment d'histoire | les morts qu'on n'a pas brûlés | les noms que plus personne ne lit | le seul feu qui ne vient pas de toi | il n'y avait rien, et il reprit son vol |

Règle tenue : sur les quatre premières lignes, aucune case n'est partagée par deux niveaux.

## Le langage des secrets

Partout, **une fuite trahit un creux** : ce qui s'échappe d'une paroi (fumée, son creux, courant d'air, lueur) dit qu'il y a un vide derrière. La fissure visible garde son sens : un mur qui cède.

## Le secret méta : la chronique (proposé)

Un fragment de chronique dans chaque niveau, caché derrière l'indice de ce niveau. Lignes en brouillon :
- I (Terres) : « IL VINT PAR LE CIEL, SUR UN DRAGON NOIR. »
- II (Cimetière) : « IL PRIT UNE COURONNE QUI N'ÉTAIT PAS LA SIENNE. »
- III (Tours) : « IL VOULUT AUSSI LE CIEL. »
- IV (Cryptes) : « ET IL DESCENDIT CHERCHER CE QUI VEILLE. »

Avec les quatre fragments du même acte, une tombe cachée s'ouvre dans l'arène juste après le Veilleur, avant l'effondrement. Elle porte l'emblème effacé de l'usurpateur du Cimetière, et un dragon gravé : « ICI REPOSE CELUI QUI REVIENT. »

Le nouveau cycle de l'épilogue devient littéral : le dragonnier est l'usurpateur, et il revient. Qui ne trouve pas les fragments garde la fin telle qu'elle est (« il n'y avait rien ») : ils ajoutent du sens, ils n'en retirent pas.

## Rejouer : l'acte II

La difficulté entre les actes reste celle qui est tranchée (plus d'ennemis, plus résistants, sans signe distinctif). En plus, **mêmes lieux, autres réponses**, pour qu'une énigme déjà résolue ne se rejoue pas à l'identique :
- d'autres emplacements pour les reliques et les bûchers ;
- une autre dynastie au Cimetière ;
- d'autres paratonnerres dans les Tours ;
- un autre chemin de fuite dans les Cryptes.

Ce ne sont que des données par acte.

## Le coût, et ce que le moteur de mécanismes devra savoir faire

**Aucune des quatre idées ne demande d'animation nouvelle** : elles réutilisent le feu, la ruée, le piqué, le levier et la prise au contact. Il faut surtout des mécanismes et des images, plus quelques touches de moteur :
- un charognard attiré par la fumée ;
- le piqué qui fend un sol fragile ;
- une relique qui tombe ;
- un crâne qui brise un mur fissuré ;
- la fuite. Voici la liste des besoins réels pour l'étape 2 (Rouages).

**Déclencheurs**
- le feu ou la ruée sur un objet ;
- se poser sur une case ;
- un piqué sur un sol fragile (à ajouter : aujourd'hui, en descente, une case fragile arrête le dragon) ;
- une relique prise, ou toutes ;
- un ennemi vaincu ;
- le Veilleur vaincu ;
- un objet qui entre à l'écran ;
- une minuterie écoulée ;
- la foudre sur un paratonnerre ;
- la charge d'un ennemi contre une case.

**Effets**
- allumer (une lumière qui reste) ;
- faire naître une colonne de cendre, et emporter les tas de cendre qui s'y trouvent ;
- ouvrir ou lever à distance (herse, grille, cage, mausolée) ;
- fendre le fer ;
- jouer une note accordée ;
- réveiller ou lâcher un ennemi ;
- attirer des ennemis vers un point ;
- faire tomber un objet qu'on rattrape ;
- remettre un groupe à zéro ;
- faire apparaître ou disparaître des cases (éboulis, brèche) ;
- lancer une minuterie ;
- jouer l'épilogue en vol.

**Conditions**
- une suite ordonnée ;
- un élément interdit ;
- tous dans un délai ;
- toutes les reliques ;
- une variante par acte.

Aujourd'hui, un seul lien existe (« le levier lève la herse la plus proche »), codé en dur. Tout le reste passera par des liens nommés dans la carte.

**Images à peindre** (Pixel Artist, validées sur planche avant branchement) :
- bûcher, fumée, tas de cendre, gibet ;
- cloche, cinq emblèmes, tombes royales, stèle, dalle ;
- paratonnerre, fer scellé, cage, impact de foudre ;
- brasero, éboulis, crânes-carillons, brèche ;
- quatre fragments de chronique, et la tombe cachée.

## À trancher par Florian

1. **Chaque fiche** : on garde, on change, ou on prend l'idée de rechange (écrite en bas de chaque fiche).
2. **Le secret méta** : le dragonnier est l'usurpateur qui revient. Oui, non, ou une autre histoire.
3. **Cryptes** : les trois reliques ouvrent la grille de l'arène (aujourd'hui, elles n'ouvrent rien). C'est la règle des reliques, appliquée au dernier niveau.
4. **Le dragonnier à pied** (catalogue F4 : il descend du dragon et passe là où le grand ne passe pas). Il n'est placé nulle part, parce qu'il coûte un deuxième personnage animé. Idée à garder pour plus tard, ou non.
