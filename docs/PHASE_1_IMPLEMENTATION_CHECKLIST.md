# Checklist de livraison — Phase 1

Cette liste suit l'ordre du brief « Mission de développement obligatoire ». Aucune tâche de la phase 2 ne doit commencer avant validation complète de phase 1.

## Diagnostic préalable

| Tâche | Statut | Preuve / blocage |
| --- | --- | --- |
| Vérifier le correctif `start:prod` (`dist/main.js`) | CORRIGÉE | Le script de démarrage utilise maintenant l'extension `.js`. |
| Vérifier l'alignement PostgreSQL local sur Docker Compose | CORRIGÉE | Les URLs locales pointent sur `localhost:5442`; Docker Desktop reste inaccessible dans l'environnement. |
| Éviter l'arrêt de Nest si PostgreSQL est absent à l'initialisation | CORRIGÉE | La roue festive conserve sa configuration mémoire par défaut; le worker outbox journalise un avertissement et retente au cycle suivant. |
| Identifier et vérifier l'instance occupant le port 4000 et `/health` | BLOQUÉE AVEC JUSTIFICATION | Le sandbox refuse l'accès aux sockets locaux (`EACCES`); le second lancement retourne `EADDRINUSE`. Aucun processus arbitraire n'a été arrêté. |

## Phase 1 — Versements progressifs / Achat par tranches

| Tâche | Statut | Preuve / blocage |
| --- | --- | --- |
| Modèle persistant de dossier, versements, références et traçabilité | IMPLÉMENTÉ — NON VALIDÉ | Modèles et migration `20261106000000_progressive_purchases`; vérifier migration contre une vraie base. |
| API tenant-scopée, permissions, validation et concurrence/idempotence | IMPLÉMENTÉ — NON VALIDÉ | Routes et service dans `apps/api/src/progressive-purchases`; compilation complète à confirmer. |
| Reçu individuel rattaché à chaque versement | IMPLÉMENTÉ — NON VALIDÉ | Snapshot et route PDF par mouvement; vérifier rendu et contenu sur données réelles. |
| Application du solde à une vente réelle sans double comptabilisation | IMPLÉMENTÉ — NON VALIDÉ | Passage par `SalesService` avec paiement interne `PROGRESSIVE_BALANCE`; tests transactionnels requis. |
| Retrait, annulation, remboursement et reliquat traçables | PARTIEL | Remboursement et annulation traçables; aucune politique organisationnelle de reliquat encore configurable. |
| Interface, recherche, statistiques, filtres et aide contextuelle | IMPLÉMENTÉ — NON VALIDÉ | Page API branchée et build client réussi; tests d'interaction requis. |
| Tests métier, concurrence et stock/finance | NON COMMENCÉE | À ajouter et exécuter lorsque PostgreSQL est disponible pour les E2E. |
| Documentation d'exploitation | RÉDIGÉE — NON VALIDÉE | `docs/VERSEMENTS_PROGRESSIFS_FR.md`. |

## Phase 1 — Garanties & Après-vente

| Tâche | Statut | Preuve / blocage |
| --- | --- | --- |
| Remplacer la page de démonstration locale par une interface API réelle | IMPLÉMENTÉ — NON VALIDÉ | `WarrantiesPage` passe par l'API, sans stockage local ni enregistrements de démonstration; build client réussi. |
| Paramétrage persistant des règles et durées | IMPLÉMENTÉ — NON VALIDÉ | Modèle `WarrantyConfiguration`, migration et routes de configuration ajoutés. |
| Création depuis l'interface, sélection client/produit et création rapide produit | IMPLÉMENTÉ — NON VALIDÉ | Formulaire connecté à l'API, y compris client sans fiche et ajout rapide de produit; parcours à vérifier. |
| Identifiants multiples, numéros de série normalisés et non-doublonnés | IMPLÉMENTÉ — NON VALIDÉ | Champs/snapshots et contrainte d'unicité partielle dans migration; tests requis. |
| Horodatage serveur UTC, échéance en mois calendaires et fuseau organisation | IMPLÉMENTÉ — NON VALIDÉ | Calcul serveur par mois calendaire; date d'affichage selon configuration. |
| Réclamations, réparation, alertes et statuts | PARTIEL | Réclamation/réparation/clôture et compteurs présents; alertes sont visibles dans les statistiques mais aucune notification asynchrone n'est configurée. |
| Tests métier et documentation | NON COMMENCÉE | Tests dédiés à ajouter; guide `docs/GARANTIES_APRES_VENTE_FR.md` rédigé mais non validé avec utilisateur/base réelle. |

## Règle de passage

La phase 1 reste ouverte tant que toutes ses tâches ne sont pas **VALIDÉES** avec code, persistance, permissions, tests et documentation. La fin du brief fourni survient au milieu de la section 4.6 (« même si le client ») ; les exigences après ce point ne sont donc pas connues et ne sont pas présumées satisfaites.
