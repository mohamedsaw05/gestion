# Centre d’apprentissage et formation

## Démarrer

Ouvrez **Centre d’aide** après connexion. Le parcours de première utilisation conserve chaque case cochée dans `LearningProgress`, avec une clé par organisation, utilisateur et étape. Il présente 15 étapes: espace, entreprise, profil commercial, boutiques, catégories, articles, stocks, clients, fournisseurs, moyens de paiement, utilisateurs, permissions, caisse, première vente et rapports. Les étapes rattachées à un module désactivé sont masquées.

## Apprendre par rôle et par module

Le centre propose des tutoriels et des fiches opératoires avec objectif, prérequis, déroulé, exemple et conseil. Les guides sont filtrables par métier; le profil utilisateur est utilisé comme rôle initial et le filtre reste modifiable. Les guides Stock, Crédit, Caisse, Achats, Dépenses, Rapports et Documents sont retirés de la liste lorsque leur module correspondant est désactivé. Chaque fiche et épisode peut être marqué terminé; la progression est enregistrée par l’API `/learning/progress` et reprise après reconnexion.

Pour comprendre une donnée, partez de son opération source: ventes et paiements déterminent le chiffre d’affaires encaissé, alors que la marge dépend du coût enregistré; le stock disponible résulte des entrées, sorties, transferts et ajustements validés; le solde client est le reste dû après les règlements. Vérifiez toujours la période et la boutique sélectionnées avant de comparer un rapport.

## Formation interactive et sécurité

Le guide propose une découverte persistante et des démonstrations vidéo. Une démonstration ne doit pas être testée sur des ventes ou des stocks de production: utilisez une organisation de test lorsque l’opération peut avoir des conséquences financières. Cette version ne crée pas encore de bac à sable isolé en un clic; aucun bouton de formation ne doit simuler une vente réelle.

## Limites à connaître

Les ressources éditoriales existantes couvrent les fonctions disponibles, mais leur exhaustivité par rôle doit être validée à mesure que les modules évoluent. Les étapes sont sauvegardées par case et par guide; le suivi de position seconde par seconde dans une vidéo et le lancement d’une visite guidée contrôlant les boutons de chaque page ne sont pas implémentés. Les opérateurs doivent continuer à utiliser l’aide contextuelle et les procédures métier de leur entreprise.
