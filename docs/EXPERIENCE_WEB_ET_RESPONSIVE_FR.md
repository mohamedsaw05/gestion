# Expérience Web et responsive

## État livré dans la version 1.0.2

Le client React conserve la navigation latérale sur grand écran et dispose déjà d’un tiroir mobile dans `Layout`. Le tableau de bord a été repris pour utiliser les routes de rapports et de ventes, présenter des états sans données plutôt que des chiffres de maquette, afficher une évolution journalière réelle et se réorganiser en une ou deux colonnes aux largeurs étroites. Le sélecteur propose jour, semaine, mois, année et dates personnalisées. L’interface indique l’état réseau et l’heure de dernière synchronisation connue; elle n’annonce jamais une vente hors ligne comme enregistrée.

## Règles d’adaptation

Les règles ajoutées au tableau de bord sont dans `src/index.css`. Les panneaux passent en une colonne sous 850 px; les KPI passent en deux colonnes et les filtres s’empilent sur téléphone. Les tableaux des pages métier doivent rester contenus dans leur propre zone de défilement ou devenir des cartes lorsque la page le permet.

## Vérification

La compilation client passe. Des captures de navigateur et une vérification Playwright des largeurs 360–1440 px ne sont pas encore produites dans cette livraison. Une revue visuelle réelle doit être faite sur les pages Caisse, Vente, Stock, Dépenses, Documents et Paramètres avant de qualifier le responsive de complet.

