# 🐾 Miaou

Prototype web expérimental pour apprendre les vocalisations d'un chat et construire progressivement un dictionnaire personnalisé **texte ↔ signaux audio**.

## Fonctions du MVP

- 🧠 Mode entraînement permanent
- 🔊 Lecture de stimuli audio importés
- 🎙️ Enregistrement de la réponse du chat via le micro
- 🏷️ Annotation du comportement et de l'intention supposée
- 🐱 Chat → Texte (heuristique provisoire)
- 💬 Texte → Chat (sélection du stimulus ayant le meilleur historique)
- 📚 Historique local et export JSON
- 🔒 Données conservées dans le navigateur pour ce MVP

## Limite importante

Ce projet ne prétend pas traduire une langue féline universelle. Il cherche à apprendre des associations propres à un animal via des essais répétés et des observations humaines.

## Lancer en local

Le micro du navigateur demande généralement un contexte sécurisé (`https://`) ou `localhost`.

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Déploiement GitHub Pages

1. Pousser ce dépôt sur GitHub.
2. Ouvrir **Settings → Pages**.
3. Choisir **Deploy from a branch** puis `main` / `/ (root)`.
4. Ouvrir l'URL GitHub Pages générée et autoriser le micro.

## Prochaines étapes

- stockage audio réel avec IndexedDB ;
- détection automatique de vocalisation et silence ;
- spectrogrammes Mel ;
- embeddings audio et clustering ;
- score de confiance par intention ;
- profils multi-chats ;
- synchronisation facultative ;
- PWA installable sur mobile.
