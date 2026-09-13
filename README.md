# Miaou v0.5

Prototype web expérimental pour apprendre les vocalisations d’un chat individuel.

## Nouveautés v0.5

- Installation automatique de la bibliothèque **CatMeows (440 miaulements)** depuis Zenodo.
- Les WAV sont décompressés dans le navigateur et conservés dans **IndexedDB** sur l’appareil : après l’installation initiale, les lectures sont locales et rapides.
- Sélection aléatoire qui évite autant que possible les sons utilisés récemment.
- Le contexte CatMeows est décodé depuis le nom de fichier : **brossage**, **attente de nourriture**, **isolement**.
- Après le son, l’enregistrement du chat démarre immédiatement et dure au maximum 6 secondes.
- Import manuel de `dataset.zip` disponible si Safari bloque le téléchargement automatique.

## Source CatMeows

CatMeows — University of Milan / Zenodo, DOI 10.5281/zenodo.4008297.
Le dépôt annonce 440 sons et précise un usage open access pour la recherche scientifique et les usages non commerciaux, avec attribution.

Les fichiers CatMeows ne sont pas redistribués dans ce dépôt GitHub : l’application les télécharge depuis Zenodo et les stocke localement dans le navigateur de l’utilisateur.

## Déploiement

Site statique compatible GitHub Pages. Aucun serveur requis.
