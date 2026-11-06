# Pharmacie, alimentation, lots et numéros de série

## Enregistrer la traçabilité

Activez `batch_tracking` ou `serial_numbers` uniquement si l’organisation en a besoin et si son offre le permet. Le modèle `StockBatch` conserve le numéro du lot, produit, emplacement, quantité et date de péremption; le modèle `SerialNumber` représente une unité identifiée individuellement. Les codes-barres produits sont maintenus séparément du numéro de lot: un code produit n’identifie pas automatiquement un lot précis.

À la réception, vérifiez code produit, fournisseur, quantité, lot, dates et emplacement. À la vente ou à une sortie, choisissez le lot attendu et conservez le lien avec l’opération. Faites une vérification physique avant toute correction de quantité. Pour une série individuelle, ne réutilisez jamais l’identifiant d’un autre article.

## Péremption et rappels

Utilisez les alertes d’approche de péremption et de péremption passée pour organiser les rotations. Séparez physiquement les produits périmés et bloquez leur vente selon les procédures applicables au métier. Les dates saisies doivent être relues par une deuxième personne pour les produits réglementés. La méthode FEFO (première péremption, première sortie) est une règle d’exploitation utile, mais une entreprise doit confirmer que le parcours de vente de sa version sélectionne bien le lot attendu.

## Lecteurs et codes

Les scanners en mode clavier peuvent remplir un champ code-barres si le champ est actif. Un QR peut contenir un format qui ne correspond pas au SKU; validez le contenu avant d’en faire une clé. La lecture caméra n’est pas annoncée comme disponible tant qu’une API et le terminal n’ont pas été vérifiés. Un code-barres produit, un identifiant de lot et un numéro de série restent des données distinctes.

## Limites de vérification

Les tables lot, série, code-barres et alertes existent. Cette version n’apporte pas un parcours clinique de conformité pharmaceutique, une sérialisation GS1 certifiée, une intégration à un scanner modèle précis ni des essais physiques. Les exigences réglementaires locales et la traçabilité obligatoire doivent être validées avant usage dans une pharmacie ou une chaîne alimentaire.
