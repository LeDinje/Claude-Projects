# Contribuer à Bimmer Bible

Le site est entièrement statique : des pages HTML, une feuille de style commune et des fichiers de données en JavaScript. Pas de compilation. Pour le voir, ouvrez `index.html` dans un navigateur, ou servez le dossier avec n'importe quel serveur statique (par exemple `npx http-server bible-bmw`).

## Organisation

```
bible-bmw/
  index.html                 accueil
  assets/site.css            socle commun : couleurs, polices, en-tête, onglets, boutons, tableaux
  data/moteurs.js            catalogue des moteurs (page Moteurs)
  data/pieces-<moteur>.js    pièces et références d'un moteur
  moteurs/index.html         catalogue
  moteurs/<code>/index.html  fiche d'un moteur (onglets Présentation, Fonctionnement, Pièces…)
```

## Ajouter un moteur au catalogue

Ajoutez une ligne dans `data/moteurs.js`. Laissez `fiche: null` tant que la fiche n'existe pas ; la carte s'affiche alors « Fiche à venir ».

## Ajouter ou corriger une référence de pièce

Chaque pièce de `data/pieces-<moteur>.js` a :

- `groupe` et `sousGroupe` : le classement du catalogue BMW, tel qu'on le voit sur RealOEM (11 Moteur, 12 Électricité moteur, 13 Alimentation, 17 Refroidissement, 18 Échappement…) ;
- `refs` : une ou plusieurs références à 11 chiffres, sans espaces, avec leur `role` (variante, côté, ancienne référence remplacée…) ;
- `statut` : voir ci‑dessous ;
- `sources` : d'où vient le numéro (nom et lien) ;
- `vis` : la partie du moteur à montrer en 3D (`rods`, `crank`, `pistons`, `heads`, `valvetrain`, `manifolds`, `block`).

### Statuts

| Statut | Quand l'utiliser |
|---|---|
| `verifiee` | Numéro lu sur le diagramme RealOEM du bon groupe, pour un véhicule identifié (numéro de châssis). Mettez le lien du diagramme dans `sources`. |
| `recoupee` | Numéro d'origine BMW trouvé sur au moins deux fiches de revendeurs spécialisés. |
| `a-confirmer` | Une seule source, ou variante pas encore identifiée. |
| `a-renseigner` | Pièce listée, pas encore de numéro. |

Règles :

- Ne jamais écrire un numéro de mémoire. Chaque numéro a une source.
- Quand une référence est remplacée par BMW, gardez l'ancienne avec le rôle « ancienne référence, remplacée ».
- Les références de pièces du commerce (ARP, BE Bearings, NGK…) vont dans `note`, pas dans `refs`.

### Vérifier sur RealOEM

1. Sur realoem.com, entrez les 7 derniers caractères du numéro de châssis, ou choisissez le modèle (par exemple M3 E92, S65).
2. Ouvrez le groupe (11 Moteur…) puis le sous-groupe (Bielle et coussinets…).
3. Relevez le numéro, la quantité et les remarques (plage de production, variante).
4. Passez le statut à `verifiee` et ajoutez le lien du diagramme dans `sources`.

## Créer la fiche d'un nouveau moteur

Copiez `moteurs/s65/` vers `moteurs/<code>/`, remplacez le contenu de l'onglet Présentation et créez `data/pieces-<code>.js`. La simulation 3D (`s65.js`) est propre au S65 : pour un autre moteur, on commencera par les onglets Présentation et Pièces, puis on adaptera la 3D (nombre de cylindres, angle du V, ordre d'allumage).
