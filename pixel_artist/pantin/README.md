# Pantin : le moteur de marionnette de Pixel Artist

`pixel_artist.py` redessine un personnage en pixel art et le découpe en **os**. **Pantin** le fait vivre dans un jeu HTML5 (canvas 2D) : le jeu décrit à chaque image l'angle et le décalage de quelques os, et Pantin calcule toute la chaîne, dessine les pièces dans l'ordre et y insère ce que le jeu peint lui-même (des membres en cinématique inverse).

Deux fichiers, sans aucune dépendance : `pantin.js` et `pinceau.js`. Copier le dossier `pantin/` dans le projet et l'importer en module ES. Dragon Rider s'en sert pour son dragon : `src/js/dragon-pieces.js` pour le chargement, `src/js/dragon-rendu.js` pour le dessin.

## 1. La recette : un squelette

Dans la recette de `pixel_artist.py` (exemple : `pixel_artist/dragon.json`), chaque **pièce** d'une pose est un os :

| Champ | Rôle |
|---|---|
| `nom`, `role` | Le nom de l'os, et un rôle libre que le jeu interprète (`tete`, `aile`, `tronc`…). |
| `poly` | La zone découpée, en pixels de la planche, relatifs à son ancre. |
| `pivot` | L'articulation, autour de laquelle l'os tourne. |
| `parent` | L'os qui le porte. Sans parent, c'est le **corps**, la racine (tout ce qu'aucune pièce n'a pris). |
| `z` | L'ordre de dessin. Négatif : derrière le corps. |
| `axe` | Pour une aile : la ligne d'attache le long de laquelle elle se replie (l'étirement suit cet axe). |
| `double` | Une copie du côté opposé (l'aile du fond), dessinée derrière tout, plus sombre. |
| `variantes` | La même pièce prise dans d'autres images du modèle (têtes d'attaque, gueule ouverte). |

- **L'ordre des pièces fixe la priorité de découpe** : une pièce ne prend que les pixels que les précédentes n'ont pas pris. Les grandes pièces qui servent de fond (les segments du tronc, de grands rectangles) viennent donc en dernier.
- **Un tronc articulé**, c'est deux pièces de plus : `croupe` et `poitrail`, avec un pivot aux reins et au garrot. On y accroche ensuite la queue (`parent: croupe`), la tête et le cavalier (`parent: poitrail`). Le milieu reste le corps.
- **Des membres dessinés par le jeu** se déclarent dans `membres` : l'os qui les porte, l'attache (hanche, épaule), le côté (`loin`), la patte avant ou arrière (`avant`), la place dans le pas (`pas`), le `z`. Leur dessin (longueurs des segments, épaisseurs, teintes) se règle dans `membre`, à la racine de la recette.

À la découpe, Pixel Artist garantit trois choses et les vérifie :
1. **Des jointures sans couture.** Pour chaque paire de pièces qui se touchent, celle du dessous reçoit une **doublure** sous l'autre. Entre une pièce et son parent, celle du dessus reçoit aussi un **recouvrement** de ses vrais pixels. En mouvement, aucune fente ne s'ouvre.
2. **Aucun pixel qui flotte.** Un petit morceau détaché d'une pièce revient à la pièce voisine qu'il touche. S'il ne touche rien, c'est une poussière de l'image, et il est retiré.
3. **Au repos, l'image est identique au modèle, au pixel près.** Sinon, l'outil le signale avec le nombre de pixels en cause.

## 2. Charger

```js
import { chargerPantin } from './pantin/pantin.js';
const perso = chargerPantin(description, imageAtlas, {
  teintes: { blanc: '#ffffff', fantome: '#646464' },   // des jeux de silhouettes : flash d'un coup, traînée…
  reteintes: { loin: 0.55, dessous: 1.2 },             // des versions plus sombres ou plus claires, dans la palette
});
```

`description` est le JSON écrit par `pixel_artist.py`, `imageAtlas` son image, déjà chargée. `perso.poses[nom]` donne les os d'une pose (`parNom`, `ordre`, `membres`) et `perso.membre` le style des membres. Une erreur de recette, par exemple un parent qui n'existe pas, lève une erreur qui la nomme.

## 3. Dessiner une image

Le jeu place d'abord le canvas dans le repère de la pose : la position, le retournement, le tangage. Puis il règle les os :

```js
const cadre = perso.poses.sol.cadre({
  os: {
    corps:    { dx: 0, dy: 1 },                  // la racine : déplace tout
    croupe:   { rot: 0.05 },  poitrail: { rot: -0.08 },
    tete:     { rot: -0.1, dy: 2, variante: -1, miroir: false },
    aile:     { rot: 0, sx: 1, sy: 0.6, image: null },   // sy < 0 : l'aile passe dessous (image: 'dessous')
    queue:    { rot: 0.2 },
  },
  double: { dx: 2.5, dy: -1.5, sx: 0.95, sy: 0.92, image: 'loin' },   // la copie du côté opposé
});
cadre.dessiner(ctx, 'normal', {
  calques: [{ z: -0.5, dessiner: (ctx, cadre) => { /* pattes du fond */ } },
            { z: 0.5,  dessiner: (ctx, cadre) => { /* pattes de devant */ } }],
  apres: (os, ctx, variante) => { /* dans le repère de l'os, après son image : une paupière… */ },
});
```

- Chaque réglage est facultatif. `rot` est un angle en radians autour du pivot. `dx` et `dy` sont un décalage, arrondi au pixel. `sx` et `sy` étirent la pièce, le long de son axe si elle en a un. `miroir` retourne l'os autour de son pivot (une tête qui regarde déjà de l'autre côté pendant un demi-tour). `variante` choisit une variante, `image` une reteinte, `cache` masque l'os.
- **Chaque os suit toute sa lignée** : le bout de la queue suit le milieu de la queue, qui suit la croupe, qui suit le corps.
- **Les calques** du jeu s'insèrent avant le premier os de `z` plus grand.
- `cadre.porte('croupe', [x, y])` donne la place d'un point porté par un os dans le repère de la pose (une hanche). `cadre.versOs` fait l'inverse.
- L'origine de la pose est calée sur un pixel entier : une pièce à cheval sur deux pixels serait échantillonnée au gré des arrondis, avec des colonnes doublées ou perdues.

## 4. Membres, allures, ressorts

| Fonction | Rôle |
|---|---|
| `ik2(hx, hy, fx, fy, l1, l2, sens)` | Cinématique inverse à deux segments : de la hanche vers le pied visé. Renvoie hanche, genou, pied. Hors d'atteinte, le membre se tend. |
| `peindreMembres(pinceau, liste, style, teintes)` | Peint les membres en gros pixels (contour, chair, liseré, griffes), en un seul appel de dessin. |
| `pas(phase, { appui, foulee, levee, amp })` | La place d'un pied dans son cycle, par rapport à sa hanche. Posé, il reste planté au sol ; levé, il file en arc. |
| `ressort(o, cle, cible, raideur, amorti, dt, min, max)` | Un ressort amorti : `o[cle]` tend vers la cible, sa vitesse est `o[cle + 'V']`. Une impulsion : `o.teteYV -= 30`. |
| `demiTour(fs, mini)` | La largeur pendant un demi-tour : jamais une feuille de papier. |
| `silhouette`, `reteinter` | Une image toute d'une couleur, ou reteinte dans la palette. |
| `pinceau(l, h)` | Peindre des centaines de petits rectangles hors écran, puis les poser d'un coup. |

**Viser les pieds dans le repère de la pose, pas dans celui du corps.** Quand le corps descend (atterrissage, accroupi), les hanches descendent avec lui, les pieds restent au sol et les genoux plient.

**Les allures d'un quadrupède** : `pas` 0, 0,25, 0,5, 0,75 (arrière près, avant près, arrière loin, avant loin), avec un appui de 0,75 au pas et d'environ 0,6 en course. Jamais deux pieds qui se posent ensemble : un galop par paires, sur un corps massif, fait « rhinocéros ».

## 5. Vérifier

Les robots de Dragon Rider (`outils/tests/`) s'adaptent à un autre jeu :
- `rendu.mjs` : des postures figées enregistrées en PNG, puis `--comparer` deux versions au pixel près ;
- `fentes.mjs` : les pixels du fond enfermés dans la silhouette, pendant chaque animation ;
- `bande.mjs` : des bandes d'images, pour juger le mouvement (jamais une capture fixe).
