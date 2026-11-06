# Validation hebdomadaire des abonnements — état d’implémentation

## État actuel

Le modèle `PlatformSubscription` conserve en base le tenant, le plan, le statut et les dates de période. Les changements administratifs et le règlement de facture mettent à jour ces données côté serveur. Les autorisations ne doivent pas être déterminées par le navigateur ou le stockage local.

## Fonction non livrée

Il n’existe pas encore de fiche persistante par tenant avec dernière vérification, prochaine vérification à sept jours, version des droits et état de validation. La revalidation périodique obligatoire avant opérations commerciales, l’invalidation coordonnée de cache et le mode dégradé lecture/export en cas d’indisponibilité ne sont pas implémentés comme exigé. Aucun cache hebdomadaire ne doit être annoncé comme actif.

## Exigences pour la mise en œuvre

Créer une fiche d’entitlement versionnée en base, la vérifier côté serveur à l’authentification et à échéance, invalider immédiatement cette fiche après suspension, paiement ou changement de plan, et refuser les opérations sensibles si une vérification échue échoue. Tester les échéances, les mutations administratives, l’indisponibilité et la falsification côté client avant d’activer cette optimisation.

