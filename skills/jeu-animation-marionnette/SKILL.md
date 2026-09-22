---
name: jeu-animation-marionnette
description: "Animer un personnage ou une créature de jeu 2D en marionnette (pièces découpées, pivots, ressorts, cinématique inverse) avec une souplesse de dessin animé : corps articulé, jointures sans couture, allures crédibles (marche, course), chocs, chutes, saut, actions sur le décor (s'agripper, déraper, se cabrer). À utiliser dès qu'une animation paraît raide, bricolée, « en carton » ou « comme une feuille de papier », qu'on veut une animation « à la Aladdin / Roi Lion sur Mega Drive », qu'on anime un quadrupède, un dragon, un cavalier, des ailes, une queue, ou qu'on parle de rig, cutout, sprite animé, cycle de marche ou mouvement secondaire."
---

# Animation de marionnette 2D, souple et crédible

Leçons de Dragon Rider : un dragon quadrupède ailé, avec son dragonnier sur le dos, animé par pièces à partir d'un sprite redessiné par Pixel Artist (`pixel_artist/pixel_artist.py`, dans `github.com/FlorianZilliox/dragon-rider-2`). Le niveau visé : les jeux Disney de la Mega Drive (Aladdin, Le Roi Lion). L'utilisateur juge l'animation avant tout le reste : c'est ce qu'on voit tout le temps.

## Les principes, et pourquoi

1. **Le corps n'est jamais une planche.** Un tronc d'une seule pièce rend toute animation raide, parce que tout le reste s'y accroche.
   - Articuler le tronc en segments, comme une queue : croupe, milieu, poitrail, qui pivotent autour des reins et du garrot.
   - Chaque pièce accrochée suit son segment : queue et pattes arrière pour la croupe ; tête, ailes, cavalier et pattes avant pour le poitrail.
   - Décaler des tranches verticales sans les faire tourner ne suffit pas : l'œil lit encore une planche.
2. **Des jointures sans couture.** Quand une pièce bouge, sa découpe ne doit jamais ouvrir de fente sur le fond. À la découpe, selon l'ordre d'empilement (z) :
   - la couche du dessous reçoit une **doublure** : sa matière est prolongée sous l'autre ;
   - la couche du dessus reçoit un **recouvrement** : elle déborde un peu, avec ses vrais pixels.
   Au repos, l'image doit rester identique au pixel près. Il faut le vérifier.
3. **Exagérer, puis borner.** À l'échelle du jeu (environ 230 px de haut), un pli de 2 px est invisible.
   - Doubler ou tripler les amplitudes, comme Disney.
   - Borner ensuite les angles pour éviter l'absurde, par exemple la tête enfoncée dans le sol.
4. **Le poids.** Les animateurs de *Dragons* ralentissaient les cycles de 15 à 20 % pour que les dragons pèsent. Rien de précipité pour une bête lourde : un cabré dure une seconde.
5. **Ressorts pour les chocs, rythme direct pour les cycles.**
   - Les mouvements secondaires sont des ressorts peu amortis : colonne (creuser, voûter, onduler), tête, cavalier, segments de queue.
   - Des impulsions les lancent : atterrissage proportionnel à la vitesse d'impact, coup reçu, recul du feu, ruée, vide sous les pattes.
   - Les rythmes réguliers (pas, battements d'ailes) s'appliquent directement à la pose. Un ressort les filtrerait et les décalerait.
6. **Le chevauchement.** Tête et cavalier encaissent les à-coups avec un temps de retard. La queue fouette et se soulève dans la chute. Les ailes s'ouvrent grand à la surprise du vide. Le bout de l'aile suit le bras avec un temps de retard (une aile en deux segments) : il fouette à chaque battement.
7. **Rien ne passe sous le sol.** Borner les angles ne suffit pas : au cabré, la queue passait sous le sol, et à l'atterrissage lourd, le menton. Une garde vérifie le point le plus bas des pièces contre le vrai sol et relève l'os fautif. Au cabré, la queue se pose en appui, comme un trépied.

## Les allures (le piège qui a coûté le plus)

- **Marche : pas latéral à quatre temps**, dans l'ordre arrière gauche, avant gauche, arrière droite, avant droite. Au pas, une seule patte levée à la fois ; chaque pied reste posé les trois quarts du temps. L'arrière entraîne l'avant du même côté, pas l'inverse. Les pattes du fond se placent presque derrière celles de devant (profil), pas au milieu du ventre comme les pieds d'une table.
- **Le corps suit les pieds.** Chaque ceinture (hanches, épaules) s'enfonce juste après la pose de ses pieds et remonte quand la patte passe sous elle. Au pas latéral, les épaules ont un quart de foulée de retard : les deux ceintures se balancent à contretemps et le dos tangue, comme celui d'un cheval. La tête et le cavalier compensent et restent presque de niveau. Un rythme sinusoïdal posé à côté des pieds, sans lien avec eux, ne se lit pas comme une marche.
- **Chaque pied qui se pose envoie une impulsion dans les ressorts.** Une patte arrière fait plier le dos et rebondir la queue ; une patte avant tasse le cavalier, hoche la tête et fait frémir l'aile repliée. Le mouvement secondaire naît des appuis au lieu d'être une ondulation plaquée.
- **Course : le même pas à quatre temps, plus vif.** Jamais deux pieds posés ensemble. Un galop par paires, sur un corps massif aux pattes courtes, fait « rhinocéros ». L'erreur a été commise deux fois : ne pas la réintroduire en voulant enrichir.
- Monté, le dos reste presque horizontal (le cavalier), la tête stable, les pattes rasent le sol.
- Départ : une poussée tassée. Arrêt en pleine course : dérapage arc-bouté, pattes avant en butée, griffes dans la poussière.

## Contraintes d'un personnage monté

Rien ne met le dos à l'envers : pas de roulade. Pour un gros choc au sol, le modèle est le **cheval monté qui se cabre**.
- Les pattes arrière glissent, les pattes avant battent l'air, les ailes s'ouvrent pour l'équilibre, la queue plaque.
- Le cavalier se couche sur l'encolure.
- Puis les pattes avant retombent lourdement, et la bête secoue la tête.

## Postures et verbes, d'après Simba (Le Roi Lion)

La planche de Simba adulte (The Spriters Resource) est une référence image par image.

| Verbe | Déroulé | Pour le jeu |
|---|---|---|
| Rugissement (feu au sol) | Il se ramasse, la tête recule, puis tout le corps plonge en avant, ailes écartées. | Le cavalier se tasse. |
| Saut | Tassement franc, puis détente où tout le corps s'étire. | Réception par les pattes avant d'abord, écrasement selon la hauteur de chute. |
| Coup reçu | Cabré, pour un personnage monté (voir plus haut). | |
| Prise de rebord | Le personnage arrive trop bas contre une plateforme, en poussant vers elle : griffes sur l'arête, pattes arrière qui pédalent, puis hisse (monter d'abord, passer par-dessus ensuite). | Les points d'appui des griffes sont fixés dans le monde et reconvertis dans le repère de la pose : les griffes ne glissent pas pendant que le corps pivote. |
| Mourir, s'accroupir, regarder autour de soi | Gestes de repos variés : jamais une boucle de deux images. | |

## La boucle de travail, les yeux ouverts

1. **Un atelier.** Un mode d'affichage (`#atelier`) qui ne montre que le personnage sur un fond uni, sans le clignotement d'invulnérabilité.
2. **Des bandes d'images** (`outils/tests/bande.mjs`). Ne jamais juger une animation sur une capture fixe : un défaut de battement d'ailes est passé inaperçu ainsi.
3. **Le diagramme des appuis et les images exactes** (`outils/tests/cycle.mjs`). Imprimer, sur un cycle, quelles pattes sont en l'air : c'est la seule vérification fiable de l'ordre des pas. L'outil rend aussi l'image exacte de chaque phase (`__essai.image`), sans dépendre du chronomètre. Faire de même pour les gestes courts, à leur moment fort (sommet du cabré, impact), c'est là que se cachent les défauts.
4. **Le détecteur de fentes** (`outils/tests/fentes.mjs`). Il compte les pixels du fond enfermés dans la silhouette, par animation.
5. **L'inspection** (`outils/tests/inspection.mjs`). Elle repère les sauts d'image, les tressautements au sous-pixel (dessiner à `round(x − cam) + round(cam)`) et les à-coups de caméra.
6. **Des aides de test** : forcer une posture (`plier(dos, onde)`), déclencher un coup, lire la posture calculée. Et comparer avec les références : Muybridge pour les allures réelles, Simba pour les poses, Toothless pour l'attitude (félin, la tête qui exprime).
7. **Assembler hors écran les pièces qui tournent** (le tronc articulé), puis les poser d'un bloc : sous une rotation globale, sinon, des raccords s'ouvrent.

## Le moteur : Pixel Artist découpe, Pantin anime

Tout est générique, réutilisable pour un autre personnage ou un autre jeu : copier `pixel_artist/` (dépôt `github.com/FlorianZilliox/dragon-rider-2`).
- **La recette décrit un squelette** (`pixel_artist/dragon.json`) : chaque pièce est un os (polygone, pivot, `parent`, `z`, `axe`, `double`, `variantes`). Le tronc articulé, ce sont deux pièces `croupe` et `poitrail`, placées en dernier dans la liste (la priorité de découpe). Les membres peints par le jeu se déclarent dans `membres` (os porteur, attache, côté, place dans le pas).
- **`pixel_artist.py` découpe et vérifie** : des doublures entre toutes les pièces qui se touchent, un recouvrement entre une pièce et son parent. Un petit morceau détaché revient à la pièce voisine (retirer les îlots avait supprimé de vrais pixels de contour). Il signale tout écart au repos avec le modèle.
- **Pantin anime** (`pixel_artist/pantin/pantin.js`, mode d'emploi dans `pantin/README.md`) : la chaîne des os, les jeux de teintes, la copie opposée, les variantes, les calques du jeu insérés selon leur `z`, `porte` et `versOs`, `ik2`, `peindreMembres`, `pas`, `ressort`, `demiTour`.
- **Dans Dragon Rider** : `src/js/dragon-rendu.js` (`posture()` choisit les réglages par état, `reglerOs()` les traduit en os, `dessinerPattes()` vise les pieds), `src/js/dragon.js` (`secondaires()`, les ressorts).

## Pièges déjà rencontrés

- **L'ancre à un demi-pixel.** Une pièce posée à cheval sur deux pixels est échantillonnée au gré des arrondis : des colonnes doublées ou perdues, qui changent d'une image à l'autre. Pantin cale l'origine de la pose sur un pixel entier.
- **Les pieds visés dans le repère du corps** au lieu de celui de la pose : quand le corps descendait, les pattes s'enfonçaient dans le sol au lieu de plier. Les hanches sont portées par le tronc ; les pieds visent le vrai sol, dans le monde.
- **Des pattes en bâtons.** Des segments fins sous un corps massif font bricolé. Il faut une cuisse épaisse, une articulation marquée, un modelé et des griffes.
- **Une pose couchée qui fait des roues.** Des pattes repliées en boules sous le ventre se lisent comme des roues. Couché, les pattes s'allongent au sol, l'avant vers l'avant, l'arrière vers l'arrière.
- **Un robot resté bloqué** : un Chrome sans fenêtre d'un test précédent occupait le port. Fermer les navigateurs de test orphelins avant de conclure à un bug.
- **Une refonte du moteur se prouve** : des postures figées rendues avant et après (`outils/tests/rendu.mjs --comparer`), la comparaison au repos avec la recomposition des pièces de Pixel Artist (0 pixel d'écart), les fentes, et des bandes d'images côte à côte.
