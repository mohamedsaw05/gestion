# Manuel d'Administration : Diagnostic & Réparation Contrôlée (Partie 6)

## 1. Principes Fondamentaux de Sécurité

1. **Scan en lecture seule par défaut :** Tout diagnostic s'exécute sans altération d'état.
2. **Réparation bornée & réversible :** Seules les actions idempotentes et sûres peuvent être automatisées.
3. **Interdiction Formelle d'Auto-Réparation Destructive :**
   - Interdiction d'inventer des mouvements de stock ou de forcer des soldes.
   - Interdiction de modifier ou supprimer des écritures comptables, des ventes ou des paiements.
   - Si une incohérence est constatée, elle est journalisée en état `CRITICAL` et préservée pour arbitrage humain.
4. **Journal d'Audit Systématique :** Chaque scan et chaque réparation enregistre l'utilisateur, l'horodatage, le périmètre (tenantId/plateforme) et le rapport exact des modifications.

---

## 2. Métriques Inspectées par le Scan

| Métrique | Seuil Normal (OK) | Seuil Avertissement | Seuil Critique | Action Recommandée |
| :--- | :--- | :--- | :--- | :--- |
| **Latence Base de Données** | < 50 ms | 50 ms - 500 ms | > 500 ms | Vérifier la saturation du pool ou les verrous |
| **Outbox en Attente** | < 50 événements | 50 - 100 événements | > 100 événements | Relancer le worker ou purger les bloqueurs |
| **Fichiers Manquants sur Disque** | 0 fichier | - | ≥ 1 fichier | Restauration depuis les sauvegardes objet |
| **Stocks Négatifs** | 0 article | - | ≥ 1 article | Réconciliation physique contradictoire |
| **Sessions de Caisse > 24h** | 0 session | ≥ 1 session | - | Rappel au caissier pour comptage et clôture |

---

## 3. Catalogue des Réparations Sûres Autorisées

### A. `RETRY_FAILED_OUTBOX`
- **Objectif :** Remettre en file d'attente les événements d'audit en échec temporaire.
- **Garde-fou :** Limité aux événements ayant moins de 5 tentatives pour éviter les boucles infinies.
- **Idempotence :** L'ingestion dans `AuditLog` est protégée par clé d'idempotence.

### B. `RECALCULATE_STOCK_PROJECTIONS`
- **Objectif :** Réconcilier les agrégats de stock projetés avec le journal immuable des mouvements (`StockMovement`).
- **Garde-fou :** Ne crée aucun mouvement fictif. En cas d'écart non explicable, émet une alerte critique sans écraser les données sources.

### C. `CLEANUP_ORPHAN_FILES`
- **Objectif :** Détecter et supprimer les résidus de fichiers physiques présents sur le disque sans métadonnées associées dans la table `StoredFile`.
- **Garde-fou :** Restreint strictement au dossier du tenant concerné (`/uploads/{tenantId}/`).

### D. `PURGE_TEMPORARY_CACHE`
- **Objectif :** Invalider les caches applicatifs et les projections transitoires en mémoire.
- **Garde-fou :** Opération sans perte de données persistées.
