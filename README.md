# 🐾 Miaou

Prototype web expérimental pour apprendre les vocalisations d'un chat et construire progressivement un dictionnaire personnalisé **texte ↔ signaux audio**.

## v0.3 — écoute automatique après le stimulus

Cette version conserve la bibliothèque automatique et ajoute une boucle d'entraînement beaucoup plus rapide :

- 🎲 choix automatique d'un son d'entraînement ;
- 🔊 lecture de sons publics distants depuis la base DESRA sur Zenodo ;
- 🛟 sons intégrés générés localement en secours si Internet ou la source distante ne répond pas ;
- 🎙️ le micro est préparé avant la lecture, puis l’enregistrement démarre automatiquement dès la fin du stimulus ;
- ⏱️ l’écoute automatique dure 6 secondes (arrêt manuel possible plus tôt) ;
- 🧠 mémorisation du stimulus, de sa source, du comportement et de l'intention supposée ;
- 💬 Texte → Chat peut rejouer le meilleur signal appris lorsqu'il est encore disponible ;
- 📚 historique local et export JSON ;
- 🔒 les données d'entraînement restent dans le navigateur pour ce MVP.

## Utilisation

1. Ouvre **Entraînement**.
2. Appuie sur **🎲 Choisir automatiquement**.
3. Appuie sur **▶ Jouer + écouter automatiquement**.
4. Le micro est préparé, le son est joué, puis l’enregistrement démarre immédiatement à la fin du stimulus pendant 6 secondes. Tu peux l’arrêter plus tôt.
5. Écoute éventuellement la réponse enregistrée puis indique le comportement observé et, si tu veux, une intention supposée.
6. Appuie sur **💾 Enregistrer l'essai**.

Répète les essais dans des contextes différents. Une absence de réaction est également une donnée utile.

## Source audio publique

Le prototype référence quelques fichiers de la **Database of Environmental Sounds for Research Activities (DESRA)** publiée sur Zenodo : https://zenodo.org/records/2622626

Les fichiers distants sont lus depuis leur source et ne sont pas redistribués dans ce dépôt. Vérifie les conditions/licences du dépôt source avant toute redistribution ou utilisation commerciale.

## Important

Miaou ne prétend pas traduire une langue féline universelle. Le but est de construire un modèle personnalisé à partir de répétitions, de contexte et de validation humaine.
