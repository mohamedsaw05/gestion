# Garanties et après-vente — exploitation

Le module **Garanties** conserve des fiches liées à un produit, un client, une boutique et, si disponible, une vente. Chaque fiche garde les informations utiles au moment de sa création (type, durée, conditions, exclusions, numéro de facture et identifiants). La durée est exprimée en mois calendaires; les dates sont enregistrées par le serveur en UTC puis présentées selon le fuseau configuré pour l'organisation.

## Configuration et parcours

1. Un utilisateur autorisé règle les durées proposées, le type par défaut, les conditions, exclusions, alertes, documents requis, modes de prise en charge et fuseau.
2. À la création d'une fiche, choisir le produit, la boutique, le client (ou saisir un nouveau client), la durée et le type. Enregistrer le numéro de série/IMEI, le lot, la facture et les autres identifiants disponibles.
3. Rechercher la fiche par référence, produit, client, téléphone, numéro de série ou lot.
4. À réception d'une réclamation, enregistrer son motif; passer la fiche en réparation si nécessaire, puis clôturer le traitement en conservant les notes.

Les numéros de série sont normalisés pour détecter les doublons dans l'organisation. Les politiques propres à un produit ou à une catégorie peuvent fixer une durée et des conditions particulières. Les accès de lecture, gestion et traitement des réclamations sont protégés par permissions.

## Limites de validation

Appliquer les migrations avant activation en production. Vérifier les permissions de chaque rôle et exécuter les tests avec une base disponible avant de considérer le module comme livré.
