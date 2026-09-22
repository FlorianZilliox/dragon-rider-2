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
6. **Le chevauchement.** Tête et cavalier encaissent les à-coups avec un temps de retard. La queue fouette et se soulève dans la chute. Les ailes s'ouvrent grand à la surprise du vide.

## Les allures (le piège qui a coûté le plus)

- **Marche : pas latéral à quatre temps**, dans l'ordre arrière gauche, avant gauche, arrière droite, avant droite. Au pas, une seule patte levée à la fois ; chaque pied reste posé les trois quarts du temps. L'arrière entraîne l'avant du même côté, pas l'inverse. Les pattes du fond se placent presque derrière celles de devant (profil), pas au milieu du ventre comme les pieds d'une table.
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
3. **Le diagramme des appuis.** Imprimer, sur un cycle, quelles pattes sont en l'air : c'est la seule vérification fiable de l'ordre des pas.
4. **Le détecteur de fentes** (`outils/tests/fentes.mjs`). Il compte les pixels du fond enfermés dans la silhouette, par animation.
5. **L'inspection** (`outils/tests/inspection.mjs`). Elle repère les sauts d'image, les tressautements au sous-pixel (dessiner à `round(x − cam) + round(cam)`) et les à-coups de caméra.
6. **Des aides de test** : forcer une posture (`plier(dos, onde)`), déclencher un coup, lire la posture calculée. Et comparer avec les références : Muybridge pour les allures réelles, Simba pour les poses, Toothless pour l'attitude (félin, la tête qui exprime).
7. **Assembler hors écran les pièces qui tournent** (le tronc articulé), puis les poser d'un bloc : sous une rotation globale, sinon, des raccords s'ouvrent.

## Où est le code de référence

Dans Dragon Rider, `src/js/dragon-rendu.js` : `posture()` choisit les paramètres par état, `dessinerPosture()` assemble les pièces et le tronc articulé, `dessinerPattes()` gère la cinématique inverse à deux segments et les appuis imposés. `src/js/dragon.js` : `secondaires()` contient les ressorts. Côté outil, `pixel_artist/pixel_artist.py` : `decouper`, `jointures_sans_couture`, `sans_ilots`.

Chantier annoncé : faire de ce moteur de marionnette un module générique livré avec Pixel Artist (os, chaînes, membres, ressorts), pour d'autres jeux. Mettre ce skill à jour quand il existera.
