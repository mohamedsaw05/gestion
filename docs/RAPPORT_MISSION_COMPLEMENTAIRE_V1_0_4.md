# Rapport de livraison — Mission complémentaire VTM 1.0.4

**Date :** 5 novembre 2026  
**Archive :** `release/VTM-Gestionnaire-Commercial-Render-1.0.4.zip`

## Éléments livrés

- Tarification centrale administrable depuis Super Admin, avec offres de 3, 6, 12 et 24 mois, calcul backend, historique et périodes calendaires. Les durées 1 et 2 mois sont refusées par le service de facturation.
- Site vitrine, souscription client, support et console plateforme raccordés aux paramètres commerciaux centralisés. Les tarifs et horaires fixes obsolètes ont été retirés des données structurées du site.
- Centre d’apprentissage, support, documents commerciaux, paramètres de modules, lots/séries et périphériques : implémentations présentes dans les espaces client et API.
- Guides demandés ajoutés sous leurs noms de fichiers officiels dans `docs/`.
- Version du package portée à 1.0.4 et configuration Render conservée dans l’archive.

## Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| Tests unitaires API | Réussite : 19 fichiers, 96 tests |
| Tests E2E API | Non exécutables dans cet environnement : l’appel à `127.0.0.1:4000` a échoué avec `EACCES`. 191 tests ont été ignorés et les 25 suites E2E ont signalé cet échec de connexion. |
| Compilation production shared, db, API, client, admin et site | Réussite |
| Création et extraction de l’archive ZIP | Réussite |
| Scan de secrets du package | Aucun secret détecté |
| Fichiers livrés | 1 415 |
| Taille | Environ 25,6 Mo |
| SHA-256 | Enregistré dans `release/SHA256SUMS.txt` lors de la fabrication du ZIP |

## Limites de vérification

Le test E2E dépend d’une API joignable localement sur le port 4000 et n’a pas pu valider le comportement contre un serveur réel dans cet environnement. Aucun périphérique physique n’a été connecté : la compatibilité matérielle spécifique d’un scanner ou d’une imprimante reste à confirmer sur le modèle et le poste concernés.
