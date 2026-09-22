# Modèles : grammaire, fiche d'intention, matrice

À copier dans le dossier `design/` du jeu :
- `design/grammaire.md` ;
- `design/README.md` pour l'acte et la matrice ;
- `design/niveaux/<cle>.md`, une fiche par niveau.

## 1 · La grammaire du jeu (`design/grammaire.md`)

La source de vérité de ce que le héros sait faire et de ce à quoi le monde répond. Les outils la liront : la carte (jeu-level-design), puis le moteur de mécanismes et le vérificateur de niveaux quand ils existeront.

```markdown
# Grammaire de <jeu>

## Le héros
| Geste | Commande | Mesures (lues dans le code, fichier:ligne) | Ce qu'il fait au monde |
|---|---|---|---|
| … | … | vitesse, portée, durée, coût, en cases | casse, actionne, allume… |

Gabarit : taille en cases, marche franchie seule, hauteur de saut, endurance (en secondes et en cases).

## Le monde : les matières
| Matière | Case ou objet | Déclencheur | Effet |
|---|---|---|---|

## Les ennemis
| Ennemi | Où il vit | Son schéma | Ce qu'il peut faire au monde |
|---|---|---|---|

## Le langage des secrets
Chaque indice, et ce qu'il veut toujours dire.

## Ce qui est tranché (ne se rouvre pas)
Structure, direction artistique, ton, contraintes de l'utilisateur, avec leur date.

## Diagnostic de répétition
| Niveau | Contrat (ce qu'il faut pour sortir) | Matières présentes (comptées) | Gestes utiles | Ce qu'on y fait |
```

Les mesures se lisent **dans le code**, pas dans le README : un README peut dater.

## 2 · La fiche d'intention d'un niveau (`design/niveaux/<cle>.md`)

La fiche bloque la suite, comme la fiche d'intention du pipeline Sillage : **aucune carte n'est dessinée avant que l'utilisateur l'ait validée**. Une page au plus.

```markdown
# <Nom du niveau> — « <phrase du titre> »

Statut : proposée | validée le AAAA-MM-JJ | refusée (pourquoi)

**Rôle dans l'acte** : introduire | développer | retourner | conclure — en une phrase.

**L'idée** : une phrase. Elle naît de la phrase du titre.

**Geste mis en avant** : un geste qui existe déjà. **Matière nouvelle** : une seule.

## Les quatre temps
1. Introduire (section, colonnes) : la première rencontre, sans danger, avec la solution en vue.
2. Développer : …
3. Retourner : la règle change de sens ou de contexte.
4. Conclure : tout ce qu'on a appris, sous pression.

## Les reliques (ou artefacts qui ouvrent la sortie) : une énigme différente chacune
| Artefact | Où | L'énigme | Ce qu'il faut avoir compris |

## Les secrets, en trois couches
1. Visible et inaccessible : …
2. Caché, avec son indice : …
3. Méta (fragment réparti entre les niveaux) : …

## Le moment d'histoire
Ce que le joueur comprend du monde en traversant ce niveau, sans dialogue.

## Ce que ce niveau ne doit pas être
Les contre-exemples : ce qui appartient à un autre niveau, ce que l'utilisateur a déjà refusé.

## Rejouer (si le jeu fait rejouer ce niveau)
Mêmes lieux, autres réponses : ce qui change.

## Sur la carte
Ajouts localisés ou carte neuve (ne redessiner que si l'utilisateur l'a demandé), et par section, ce qui s'ajoute.

## Coût
Données / Rouages / Image / Animation / Moteur, poste par poste. Ce que le moteur de mécanismes devra savoir faire.

## De rechange
Une autre idée (fiche du catalogue), si celle-ci ne convainc pas.

## Graphe des énigmes
Qui ouvre quoi, du départ à la sortie (le « puzzle dependency chart » de Ron Gilbert) :
départ → A → (B et C) → sortie.
```

## 3 · L'acte et la matrice anti-répétition (`design/README.md`)

```markdown
# <jeu> — conception des niveaux

## L'acte en quatre temps
| Niveau | Rôle | L'idée |

## Matrice anti-répétition
| | Niveau 1 | Niveau 2 | … |
|---|---|---|---|
| L'idée | | | |
| Geste mis en avant | | | |
| Matière nouvelle | | | |
| Pression dominante | | | |
| Forme du parcours | | | |
| Lumière | | | |
| Indice des secrets | | | |
| Moment d'histoire | | | |

Règle : deux niveaux ne partagent jamais la même case sur les quatre premières lignes.

## Le secret méta
## Ce que le moteur de mécanismes devra savoir faire (déclencheurs, effets, conditions)
## À trancher par l'utilisateur
```
