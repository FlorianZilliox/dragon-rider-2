---
name: jeu-moteur-2d-pwa
description: "Construire ou restructurer un jeu 2D HTML5 (canvas) jouable partout : code en modules ES assemblé par esbuild, PWA installable et hors ligne qui se met à jour correctement, contrôles tactiles fluides en paysage, rendu pixel parfait, performance mobile, robots de test (Chrome sans fenêtre) et publication GitHub Pages. À utiliser dès qu'on démarre un jeu web 2D, qu'on le passe en PWA, que la croix tactile « n'est pas fluide » ou que le jeu « freeze » sur mobile, qu'une mise à jour n'arrive pas sur le téléphone, qu'on veut le rendre modulaire, plus rapide, testé automatiquement ou publié en ligne."
---

# Moteur de jeu 2D web : PWA, mobile, tests

Architecture de Dragon Rider (`github.com/FlorianZilliox/dragon-rider-2`), à reprendre telle quelle pour un nouveau jeu : les fichiers cités y sont.

## Architecture

- **`src/index.html`** minimal : l'écran (`<canvas>`), la manette, les liens du manifeste. **`src/styles.css`** factorisé par jetons.
- **`src/js/*.js`** : des modules ES, un par domaine. Entrées, écran, son, niveau, terrain, décor, personnage et son rendu, ennemis, monde, partie, interface, titre, appareil, et un `main.js` qui contient la boucle.
- **L'état partagé** est un seul objet `J`, dans `etat.js`, pour ce qui change en jeu. Les constantes vivent dans `config.js`, y compris **la seule liste des niveaux** : une clé par niveau, qui nomme sa carte, son décor et sa roche.
- **`outils/construire.mjs`** (esbuild) produit `dist/`, la PWA. Les données (sprites, décors, cartes) sont injectées à l'assemblage dans un module virtuel `donnees.js`, et les images restent des fichiers.
- **Commandes** : `npm run build`, `npm run dev` (serveur local qui reconstruit), `npm test`.
- **Des garde-fous visibles** : une carte ou un décor manquant affiche un message en clair dans le jeu, jamais un écran noir. Une erreur d'assemblage indique le fichier et la ligne.
- **Des aides de test** exposées sous `#essai` (`window.__essai`) : poser le personnage, ouvrir les portes, déclencher un coup, lire la posture.

## PWA qui se met vraiment à jour

- **Manifeste** : `display: fullscreen`, `orientation: landscape`, icônes composées à partir des sprites du jeu (dont une masquable).
- **Service worker « le réseau d'abord »** : chaque fichier est redemandé en révalidation, avec un délai de 3 s, puis le cache prend le relais hors ligne. Le cache est versionné par empreinte.
  - Pourquoi : un service worker « cache d'abord » laissait le téléphone sur l'ancienne version. L'utilisateur voyait encore l'ancien niveau.
- **Recharger tout seul, à l'écran titre**, quand une nouvelle version prend la main, jamais en pleine partie. Chercher les mises à jour au retour dans l'application.
- **Tester le hors-ligne pour de vrai** : couper le réseau et recharger. Tester aussi la mise à jour : publier un changement, puis vérifier qu'il s'affiche au lancement suivant.
- **Une seule sortie**, la PWA. Elle s'installe aussi sur ordinateur (Chrome, Edge, Safari « Ajouter au Dock ») : un fichier HTML autonome en plus devient inutile.

## Mobile

- **Paysage seulement** : en portrait, un message « Tournez l'appareil », et la partie se met en pause.
- **Des pixels tous égaux** : un nombre entier de pixels physiques par pixel du jeu (`round(hauteur × dpr / 232)`), et la toile calée sur la grille physique. L'interface s'écarte de l'encoche (`env(safe-area-inset-*)`).
- **La croix se joue au glissé**. Une seule zone par main, suivie en `pointermove` avec capture du pointeur ; 8 directions en secteurs de 45° et une zone morte au centre. Des boutons séparés empêchaient le pouce de glisser et figeaient des directions.
- **Les boutons** : le bouton le plus proche du doigt, dans un rayon généreux, avec le glissé d'un bouton à l'autre. Plusieurs doigts à la fois, et une vibration légère.
- **Pas de double-tape** au tactile pour les gestes : ils se déclenchaient par accident.
- **iOS** : `preventDefault` sur `touchstart` et `touchmove` (ni loupe, ni zoom), `gesturestart` bloqué. Le son se débloque au `pointerup` et au `touchend`, pas au `pointerdown`.
- **Écran maintenu allumé** (Wake Lock). Pause quand on quitte l'application ou qu'un appel arrive. Plein écran au premier toucher dans un navigateur.
- **L'appui qui valide un menu ne doit pas agir en jeu** : il faut relâcher la touche avant.

## Performance : compter les appels de dessin

Sur mobile, ce sont les appels de dessin par image qui coûtent, pas les pixels. Les mesurer avec `outils/tests/perf.mjs` (processeur ralenti ×4, 90 s de jeu, mémoire, images lentes). Dragon Rider est passé de 918 à environ 150 appels par image :
- le terrain est peint **une fois par niveau**, en bandes de 256 px, et chaque image n'en recopie que 2 ou 3. Une bande n'est repeinte que si un mur s'effondre ;
- les formes faites de centaines de petits rectangles (pattes, ombre tramée) passent par un **pinceau hors écran** (tampon de pixels puis `putImageData`), soit un seul appel de dessin ;
- les petits sprites répétés (cœurs, ovales) sont préparés **une fois en image** ;
- pour le son, une seule sortie maîtresse, et chaque nœud est débranché à la fin de son son (Safari les accumulait) ;
- pas d'allocations par image dans la boucle : on vide les ensembles, on ne les recrée pas.

## Robots de test (Chrome sans fenêtre, protocole CDP)

Tous vivent dans `outils/tests/`. `chrome.mjs` trouve Chrome sur la machine, `serveur.mjs` sert `dist/` sur un port libre, et chaque robot accepte `-`, `#raccourcis` ou une adresse (http, https, file).

| Robot | Ce qu'il fait |
|---|---|
| `mobile.mjs` | Téléphone simulé : manette au glissé, portrait, hors-ligne, pixels entiers. |
| `titre.mjs` | Écran titre et menu. |
| `traverser.mjs` | Un robot qui joue en lisant la carte ; option `reliques`. Il ne sait pas résoudre un niveau non linéaire. |
| `scenario.mjs` | Suite d'actions : `nav:N[:1]`, `poser`, `voler`, `tenir`, `tap`, `shot`, `etat`, `eval`. |
| `inspection.mjs` | Poses, tressautements, caméra. |
| `perf.mjs` | Banc de performance. |
| `bande.mjs` | Bandes d'images. |
| `fentes.mjs` | Fentes aux jointures d'une marionnette. |
| `rendu.mjs` | Postures figées en PNG ; `--comparer` deux versions au pixel près. |
| `cycle.mjs` | Les images exactes d'une foulée ou d'un battement, et le diagramme des appuis. |
| `survol.mjs` | Traverse un niveau en vol à altitude de croisière : blocages, souffle épuisé. |

- **Lancer les robots l'un après l'autre** quand ils mesurent du temps : une page cachée se met en pause.
- **Vérifier après la toute dernière retouche** : un écran noir a été livré après une modification de dernière minute.

## Publication

- **Seulement sur demande explicite** de l'utilisateur, et sous le nom de dépôt convenu (Dragon Rider v2 : `dragon-rider-2`, la v1 intacte).
- **GitHub Pages construit par GitHub Actions** : `.github/workflows/publier.yml` fait `npm ci`, `npm run build` et publie `dist/` à chaque envoi sur `main`.
- **Après publication**, vérifier le site en ligne : les fichiers répondent, le jeu se charge, le cache hors ligne est rempli.
- **Jamais de secret dans le dépôt** : `.env` est ignoré, l'historique vérifié avant le premier envoi, les commits signés avec une adresse noreply. Les images d'autrui ne sont jamais publiées.

## Portabilité

Aucun chemin propre à la machine, des erreurs expliquées en clair avec l'action à faire, des dépendances gérées par `npm install`. Toujours penser au scénario « une autre machine, une autre personne, dans six mois ».
