# Exemple : démarrer un nouveau jeu avec Pixel Artist

Mini-projet autonome : `style.txt` (style commun), `briefs/collines.json` (une image à générer), `recettes/decor.json` (sa pixelisation : deux plans de parallaxe et une pièce animée). Pour ne rien dépenser, les sources de `sources/` sont dessinées par code (`fabriquer_sources.py`) au lieu d'être générées.

Depuis le dossier qui contient `pixel_artist/` :

1. Vérifier le projet sans rien payer : `python3 pixel_artist/generer.py pixel_artist/exemple --essai`
2. Pixeliser : `python3 pixel_artist/pixeliser.py pixel_artist/exemple/recettes/decor.json`, puis regarder `sortie/decor-apercu.png`.
3. Passer aux vraies images (payant) : `python3 pixel_artist/generer.py pixel_artist/exemple`, puis dans la recette écrire `"source": "collines"` et ajouter `"sources": "../generes/manifest.json"`.

Nouveau jeu : copier ce dossier, réécrire `style.txt`, les briefs et la recette. Tout est détaillé dans `../README.md`.
