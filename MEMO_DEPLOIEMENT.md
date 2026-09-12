# MÉMO : Comment déployer le site web

Ce fichier est un aide-mémoire pour la mise à jour du site.
**L'ancienne méthode via le bouton "Publier" dans l'interface web de Firebase ne fonctionne plus et ne doit plus être utilisée.**

---

## La nouvelle procédure (fiable)

La mise à jour se fait maintenant en deux ou trois étapes via des lignes de commande.

### 1. Compiler l'application

Avant toute chose, il faut "construire" la version la plus récente du site.
Cette commande rassemble tout le code dans le dossier `out/` prêt à être envoyé.

`npm run build`

---

### 2. Déployer sur l'environnement de TEST (Optionnel mais recommandé)

Pour vérifier que tout fonctionne bien avant de mettre en ligne pour le public.

`firebase hosting:channel:deploy studio`

- **URL de test permanent :** [https://gestion-exellence--studio.web.app](https://gestion-exellence--studio.web.app)

---

### 3. Déployer sur le site PUBLIC

Une fois que tout a été validé sur le site de test, cette commande met à jour le site principal.

`firebase deploy --only hosting`

- **URL du site public :** [https://gestion-exellence.web.app](https://gestion-exellence.web.app)
