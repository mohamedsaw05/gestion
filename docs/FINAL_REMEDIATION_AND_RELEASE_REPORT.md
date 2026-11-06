# Rapport de remédiation et livraison — VTM 1.0.2

**Date :** 4 novembre 2026  
**Version :** `VTM-Gestionnaire-Commercial-Render-1.0.2.zip`  
**État :** archive fabriquée, compilée et extraite avec vérification de ses fichiers critiques. La mission multi-supports n’est pas intégralement achevée.

## Réalisé dans cette version

- Le tableau de bord n’utilise plus les chiffres, produits, ventes et répartitions de démonstration codés en dur. Il interroge les routes `reports/summary`, `reports/daily` et `sales`, respecte les accès présents dans le menu et affiche les valeurs inconnues comme `—`.
- Les filtres jour, semaine, mois, année et période personnalisée alimentent les dates des rapports. Une actualisation est faite au chargement, au focus, au retour réseau et toutes les 45 secondes. Le statut réseau et l’heure de synchronisation sont affichés.
- Les panneaux du tableau de bord se réorganisent sur tablette et téléphone. Le reste des pages métier demande encore une revue responsive visuelle complète.
- Le client Web inclut un manifeste PWA, icônes 180/192/512 px, un bouton d’installation lorsque le navigateur le propose et un service worker. Celui-ci met en cache le shell et des assets statiques de même origine; il exclut l’API, l’authentification et les requêtes avec en-tête Authorization.
- Les source maps Vite sont désactivées en production.
- La version racine passe de 1.0.1 à 1.0.2. Le paquet 1.0.1 est conservé séparément.
- La route de liste des ventes accepte un paramètre `limit` validé et borné à 100; le tableau de bord demande cinq ventes récentes au lieu de charger l’historique entier.
- Le bandeau global affiche le nom réel de l’organisation plutôt que des boutiques fictives sans effet.

## Vérifications

| Contrôle | Résultat |
|---|---|
| `npm run build:client` | Compilation TypeScript et Vite réussie; bundle principal ~1,23 Mo avec avertissement >500 Ko |
| Compilation complète release (shared/API/client/admin/site) | PASS via `npm run release:package`; avertissement de bundle client principal ~1,23 Mo |
| Packaging, scan de secrets et intégrité ZIP | PASS; 1 342 fichiers, 9 exclus; archive extraite, manifeste/service worker/icônes/docs critiques présents |
| Tests unitaires API | PASS après l’ajout du paramètre `limit`: 17 fichiers, 86 tests |
| E2E API | 191 tests passés dans la vérification précédente; pas relancés après cette itération |
| Tests navigateur aux largeurs 360–1440 px / orientations | Non exécutés; aucune capture réelle de navigateur jointe |
| Vérification d’installation PWA sur appareils | Non exécutée |
| Réinstallation et recompilation du ZIP extrait | Non exécutée; le script de release contrôle extraction et fichiers critiques seulement |

## À intégrer ensuite

- Les pages Vente, Caisse, Stock, Catalogue, Dépenses, Documents et Paramètres doivent être vérifiées visuellement sur les résolutions et orientations demandées; des corrections locales sont probablement nécessaires.
- La PWA est le client Web installé, pas une application native. Aucun packaging Tauri/Electron ni Capacitor/Android/iOS n’est inclus.
- Le temps réel SSE/WebSocket, l’écran de supervision mobile dédié au directeur, l’état des utilisateurs/sessions et les notifications mobiles configurables ne sont pas livrés. L’actualisation actuelle est périodique.
- Aucune base locale métier concurrente n’est créée; les opérations restent en ligne et la source centrale est l’API avec PostgreSQL.
- La protection frontend repose sur la séparation backend, l’absence de secrets dans le bundle et l’absence de source maps. Le JavaScript compilé livré au navigateur reste inspectable; l’obfuscation n’est pas une garantie de confidentialité.

## Limites héritées à garder visibles

Les limites fonctionnelles de la mission 1.0.1 (entitlement hebdomadaire, attributions groupées, événements festifs indépendants et registre idempotent, archivage durable du reset) restent ouvertes et sont décrites dans le rapport précédent et les documents métier dédiés.

