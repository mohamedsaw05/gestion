# Versements progressifs — exploitation

Le module **Versements progressifs** conserve un dossier client et un grand livre de mouvements. Un dépôt crée un reçu propre au mouvement; les reçus restent consultables depuis l'historique du dossier. Les mouvements enregistrent le solde avant et après l'opération et une clé d'opération protège les dépôts et remboursements contre une répétition réseau.

## Parcours opérateur

1. Ouvrir un dossier pour un client, une boutique et une devise.
2. Enregistrer chaque dépôt avec son mode et, si utile, sa référence externe. Imprimer ou télécharger le reçu du dépôt concerné.
3. Choisir l'article et vérifier le prix indiqué avant le retrait.
4. Lorsque le solde couvre le prix, confirmer le retrait. Le système crée une vente réelle et décrémente le stock dans le flux de vente existant.
5. Pour rendre des fonds, utiliser l'action de remboursement et conserver le reçu de remboursement.

Les dépôts historiques ne sont pas réaffectés à une session de caisse lors du retrait. Une opération échouée peut être rejouée avec la même clé d'idempotence. Les dossiers et mouvements sont isolés par organisation et soumis aux permissions du module.

## Limites de validation

La migration doit être appliquée avant activation en production. La livraison reste en phase 1 tant que les tests transactionnels/concurrence, la vérification avec une base disponible et le parcours d'exploitation ne sont pas validés.
