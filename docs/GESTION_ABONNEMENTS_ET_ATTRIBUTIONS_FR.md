# Abonnements et attributions

## État persistant

Les plans, abonnements et factures SaaS sont conservés dans PostgreSQL. Un abonnement relie un tenant à un plan, un statut et une période. Le changement de plan met à jour l’abonnement et peut créer une facture. Le règlement manuel d’une facture est réconcilié côté serveur.

## Limites

Les durées sont actuellement gérées principalement par période d’abonnement et changement de plan. L’ajout arbitraire de plusieurs mois/années, les attributions groupées, l’annulation d’une attribution distincte, les quotas globaux de cadeaux et une clé d’idempotence pour chaque attribution ne sont pas encore disponibles comme workflow complet. Les événements festifs ne doivent donc pas être assimilés à un moteur général d’attribution.

## Contrôles opérationnels

Vérifier le tenant, le plan, le statut, les dates de période et la facture associée dans la console avant toute modification. Les webhooks de paiement doivent être vérifiés cryptographiquement et idempotents avant activation d’un fournisseur; une notification du navigateur n’est pas une preuve de paiement.

