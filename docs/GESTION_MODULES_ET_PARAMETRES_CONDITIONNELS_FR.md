# Modules, paramètres et rapports conditionnels

## Trois contrôles distincts

Un module indique une fonction visible et activable dans une organisation; une capability représente le droit fonctionnel lié au plan et au profil; une permission autorise un rôle donné à effectuer une action. Pour qu’une opération soit valide, les contrôles applicables doivent tous réussir. Masquer un lien de navigation n’est pas une protection: les routes API protégées contrôlent permissions et capabilities côté serveur.

## Activer ou désactiver

Dans **Paramètres → Modules**, vérifiez les dépendances, recommandations et fonctions concernées avant de modifier l’état. Désactiver un module retire ses liens et empêche les fonctions gardées côté serveur. Cela ne doit pas servir à supprimer les historiques. Après réactivation, les données et paramètres conservés doivent être réévalués avec les permissions de l’organisation.

Les menus API sont construits à partir des autorisations et modules activés; les pages sensibles utilisent aussi des routes protégées. Les paramètres métier restent dans les catalogues déclarés, tandis que les pages de formation filtrent les guides connus associés aux modules désactivés. Une nouvelle fonctionnalité doit ajouter son module, sa capability, ses permissions, ses contrôles API et ses tests; un simple nouveau lien ne suffit pas.

## Rapports et recherche

N’ajoutez pas un rapport vide pour un module inactif. L’écran et les endpoints doivent filtrer les données accessibles et la période sélectionnée. Une recherche, notification ou action ajoutée à un module doit appliquer les mêmes règles d’accès. Les accès directs à une URL doivent aboutir à une route autorisée ou au refus, jamais à un écran opérable non protégé.

## Audit et conservation

Les modifications de modules sont journalisées avec l’acteur et l’état avant/après dans le moteur de profil commercial. Avant de désactiver une fonction, exportez les données si une obligation interne l’exige. La réactivation ne restaure pas une permission retirée à un utilisateur; les droits sont vérifiés séparément.

## Limites de couverture

Le registre de modules et le CapabilityGuard existent, mais la couverture n’est pas uniforme pour toutes les anciennes pages, recherches, widgets et alertes. Toute nouvelle route doit recevoir un test d’accès API. Les rapports conditionnels doivent être vérifiés module par module avant toute promesse exhaustive.
