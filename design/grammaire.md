# Grammaire de Dragon Rider

Ce que le dragon sait faire, ce à quoi le monde répond, et ce qui est tranché. Les mesures sont lues dans le code (septembre 2026), pas dans le README. Les autres outils (cartes, mécanismes, vérificateur de niveaux) partent d'ici. Méthode : skill `jeu-scenariste`.

## Le héros : le dragon noir et son dragonnier

Gabarit : 3 cases de haut au sol (une case = 16 px). Il enjambe seul une marche d'une case. 5 cœurs.

**Portée verticale** : une montée à souffle plein fait ≈ 413 px, soit ≈ 26 rangées. Dans une carte de 22 rangées (Terres, Cimetière, Cryptes), il atteint donc tout depuis le sol : un courant n'y débloque jamais la hauteur. Seules les Tours (46 rangées) contraignent la montée.

| Geste | Commande | Mesures | Ce qu'il fait au monde |
|---|---|---|---|
| Voler | croix | 170 px/s à plat, 118 px/s en montée, 215 px/s en piqué (`config.js`, `V`) | Il se pose sur le sol et les corniches, et traverse les corniches par-dessous. |
| Souffle (endurance) | — | 7 s à plat (≈ 75 cases), 3,5 s en montée. Il se recharge au sol, dans une colonne de cendre et à l'autel (`SOUFFLE`). Épuisé, le dragon ne peut que planer vers le bas. | Borne toute montée : au-delà, il faut un sol ou un courant. |
| Marcher, courir | croix, au sol | 85 et 150 px/s | Il enjambe une case. |
| Saut, super saut | ↑ au sol ; ↓ tenu 0,25 s puis ↑ | impulsion 270 px/s ; × 1,3 en super saut (`dragon.js`) | — |
| Cracher le feu | X (maintenu : rafale) | boule à 390 px/s qui vit 1,3 s, soit ≈ 500 px (≈ 31 cases) ; un tir toutes les 0,3 s. Au sol, le feu part droit ; en vol, il suit l'inclinaison du corps, bornée à ≈ 15° vers le haut (0,26 rad, `cPitch`) : **il ne tire jamais à la verticale**. À bout portant, la gueule touche directement la pierre ou le levier (`cracher()`). | Il brise un mur fissuré, tire un levier, tue les ennemis. |
| Ruée | C, ou deux fois ← / → | ≈ 7 cases en 0,3 s (430 px/s, qui ralentit). Coûte ¼ du souffle ; une seule par envol, rechargée au sol, dans la cendre ou à l'autel ; 0,6 s entre deux ; invulnérable 0,3 s. Depuis le sol, elle part en diagonale montante. | Elle brise un mur fissuré, tire un levier, traverse les ennemis. |
| Piqué éclair | ↓ + C en vol | une ruée en diagonale descendante | Il brise un mur fissuré devant lui, **pas un sol fissuré sous lui** : en descente, une case fragile l'arrête comme la roche (`deplacerVol`). |
| S'agripper, se hisser | pousser vers un rebord en arrivant trop bas | 0,28 s de prise, 0,62 s de hisse. Il faut 3 rangées libres au-dessus et 2 cases de plateforme. | — |
| Se poser sur un autel | — | Le dragon doit être au sol, à moins de 26 px de l'autel. | Il allume l'autel (un seul allumé à la fois) : cœurs et souffle pleins, et reprise ici après une défaite. |

Une contrainte d'animation (tranchée) : il y a un dragonnier sur le dos. Aucun geste ne met le dos à l'envers : ni looping, ni tonneau, ni roulade.

## Le monde : les matières

| Matière | Case | Déclencheur | Effet |
|---|---|---|---|
| Roc, tour peinte | `#` `\|` | — | Bloque. |
| Corniche | `=` | — | On la traverse par-dessous, on s'y pose. |
| Pics | `^` | le contact | Un cœur en moins, et on rebondit. Le souffle est remis à ½ au moins, de quoi s'extraire. |
| Mur fissuré | `x` | feu, ruée | Tout le groupe de cases qui se touchent s'effondre d'un bloc. |
| Colonne de cendre | `~` | la présence | Porte vers le haut ; rend le souffle et la ruée. |
| Herse et levier | `H` `l` | feu ou ruée sur le levier | Lève **la herse la plus proche**. Ce lien est codé en dur : aucun câblage explicite. |
| Gouffre | bas de la carte | la chute | Un cœur en moins, et retour au dernier sol sûr. |
| Autel | `f` | se poser | Voir plus haut. |
| Relique | `r` | le contact | Compteur. Quand toutes sont prises, la porte `E` monte de la brume au son du glas. |
| Cœur | `h` | le contact | + 1 vie. |
| Pénombre | `obscurite` du niveau | la profondeur | L'ombre s'épaissit avec les rangées. La lumière vient du dragon, de son feu, des autels allumés, des explosions, des crânes ardents, et de la lueur des âmes, des spectres et des reliques. |
| Orage | Cimetière, Tours | toutes les 8 à 15 s | L'éclair blanchit le ciel et révèle les gargouilles, avec le tonnerre. C'est seulement visuel : il n'agit sur rien. |

## Les ennemis (`ennemis.js`)

| Ennemi | Case | Où il vit | Son schéma |
|---|---|---|---|
| Charognard | `c` | perché sur les sommets | Il guette et repère le dragon de loin (≈ 280 px). Il se ramasse, s'arrache, pique en arc en U par où était le dragon, puis remonte et fuit. |
| Volée de corbeaux | `v` | en plein ciel (Tours) | 3 corbeaux, 4 dès l'acte II, qui surgissent du bord de l'écran devant le dragon. |
| Chauve-souris | `b` | sous un vrai plafond | Pendue, la tête en bas ; puis un zigzag vif vers le dragon. |
| Âme errante | `a` | dans le vide | Un huit lent autour de son point ; elle luit. |
| Spectre | `s` | dans le vide | Il dérive, lanterne basse. Il la lève pour s'effacer, puis réapparaît dans le dos du dragon. |
| Crâne ardent | `k` | dans les galeries | Il tremble et vise (on le voit venir), puis charge. Il se brise sur la pierre. |
| Le Veilleur | `V` | l'arène, au bout des Cryptes | 22 points de vie, des éventails de tirs, des invocations, et une rage à la fin. |

## Le langage des secrets (proposé, à valider)

- **Fissure visible** : un mur qui cède au feu ou à la ruée. Cet indice existe déjà.
- **Une fuite trahit un creux** : ce qui s'échappe d'une paroi dit qu'il y a un vide derrière. La forme de la fuite suit le niveau, la règle reste la même :
  - de la fumée dans les Terres ;
  - un son creux dans le Cimetière ;
  - un courant d'air (de la cendre qui file) dans les Tours ;
  - une lueur dans les Cryptes.

## Ce qui est tranché (décisions de Florian, ne se rouvrent pas)

- **Structure.** Les niveaux (Terres, Cimetière, Tours, Cryptes, puis le Veilleur) forment un acte. L'acte II rejoue les mêmes niveaux, plus durs. La difficulté ne monte qu'entre les actes : plus d'ennemis, plus résistants, sans aucun signe distinctif. « Niveau 2 » désigne le Cimetière, jamais l'acte II.
- **La porte de sortie** n'apparaît qu'avec toutes les reliques du niveau.
- **Direction artistique.** Noir et blanc en majorité, gris tramé, profondeur par la valeur, ruines gothiques. Le feu et le sang sont les seules couleurs (image de référence 16_26_26).
- **Le ton.** Un monde nihiliste. Épilogue : « AU FOND DE LA CRYPTE, IL N'Y AVAIT RIEN… LE DRAGONNIER REPRIT SON VOL. » Puis un nouveau cycle.
- **Les cartes d'origine** des Terres, du Cimetière et des Cryptes ont seulement été allongées : ne pas les redessiner. Les Tours ont été refaites le 2026-09-22 (commit 66cc703 : ciel ouvert, perchoirs, un seul géant, le Beffroi, volées de corbeaux).
- **Les commandes.** Les lettres des boutons sont les touches (X feu, C ruée). PWA, mobile en paysage.

## Diagnostic de répétition (cartes au 2026-09-22)

| Niveau | Contrat | Murs fissurés | Colonnes de cendre | Leviers / herses | Ce qu'on y fait |
|---|---|---|---|---|---|
| Terres (300 × 22) | 3 reliques → porte | 2 | 4 | 0 | voler, éviter les gouffres, casser 2 murs |
| Cimetière (300 × 22) | 3 reliques → porte | 1 | 3 | 0 | pareil |
| Tours (272 × 46, refaites le 2026-09-22) | 3 reliques → porte | 2 | 6 | 2 / 2 | pareil, plus 2 raccourcis |
| Cryptes (273 × 22) | 3 reliques, qui n'ouvrent rien : l'arène se déclenche à l'approche | 3 | 1 | 0 | pareil, puis le Veilleur |

Le même contrat partout, trois matières, et le feu ne sert qu'à tuer et à casser. Les décors et les ennemis changent ; les actions, non.
