# 🔒 Réinitialisation Opérationnelle Multi-Tenant & Isolation de Sécurité (VTM SaaS)

## 1. Contexte & Problématique Résolue

Dans les versions antérieures, l'opération de réinitialisation posait deux risques majeurs :
1. **Risque d'Effacement Global Non Voulu :** L'existence d'un reset global (`/platform/reset`) pouvant vider l'ensemble des tenants en production en cas de mauvaise manipulation ou de script malveillant.
2. **Besoin d'un Reset Ciblé par Organisation :** Les gérants et le Super Administrateur avaient besoin de repartir à zéro pour **une seule boutique / organisation spécifique** (par exemple après une phase de test pilote ou une clôture d'exercice), tout en conservant scrupuleusement l'existence du tenant, ses abonnements, ses accès utilisateurs, son nom de marque, ses logos et ses configurations fondamentales.

---

## 2. Architecture de la Réinitialisation Opérationnelle d'Organisation

### 2.1. Protection Stricte en Production du Reset Global
- L'endpoint `POST /platform/reset` est désormais **strictement verrouillé** par :
  ```typescript
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_PLATFORM_RESET !== 'true') {
    throw new ForbiddenException(
      'La réinitialisation globale de la plateforme est formellement interdite en production.'
    );
  }
  ```
- Seul l'environnement de test/développement avec variable d'environnement explicite `ALLOW_PLATFORM_RESET=true` peut invoquer cet endpoint.

---

### 2.2. Workflow de Réinitialisation d'un Tenant Unique (`POST /platform/tenants/:id/reset`)

La procédure pour un tenant spécifique suit un protocole de sécurité en **5 étapes transactionnelles** :

1. **Prévisualisation en Mode Dry-Run (`GET /platform/tenants/:id/reset-preview`) :**
   - Calcule et retourne le comptage exact de toutes les données opérationnelles qui seront purgées, réparties par domaine métier :
     - **Ventes & Caisse :** `sales`, `payments`, `heldCarts`, `cashRegisters`, `cashSessions`, `expenses`.
     - **Stocks & Produits :** `stockMovements`, `stockBatches`, `products`, `units`.
     - **Documents & Commandes :** `documents`, `orders`, `purchaseOrders`, `returns`, `deliveries`.
     - **Tiers & Crédits :** `suppliers`, `creditAccounts`, `customers`.
     - **Services, Fichiers & Divers :** `services`, `appointments`, `storedFiles`, `socialMessages`, `automationLogs`.
   - Fournit également le nom exact de l'organisation et son statut.

2. **Génération & Export Préalable de Sauvegarde (`GET /platform/tenants/:id/backup`) :**
   - Télécharge un instantané complet chiffrable au format JSON (`vtm-backup-<tenantId>-<timestamp>.json`) contenant l'ensemble des enregistrements de l'organisation avant toute suppression.

3. **Double Consentement & Phrase de Confirmation Déterministe :**
   - L'administrateur doit obligatoirement cocher la case attestant qu'une sauvegarde a été effectuée (`backupConfirmed: true`).
   - L'administrateur doit saisir au caractère près la phrase exacte :
     `CONFIRMER REINITIALISATION <Nom_Organisation>`
   - Le système compare la phrase normalisée côté backend (en cas d'écart, l'opération est immédiatement rejetée avec le code `VTM-SEC-004`).

4. **Ré-authentification Obligatoire par Mot de Passe Super Admin :**
   - Même si l'administrateur possède un token JWT actif, son mot de passe actuel doit être transmis et vérifié par Argon2 (`verify(admin.passwordHash, dto.adminPassword)`).
   - En cas d'échec d'authentification : rejet avec le code `VTM-AUTH-002`.

5. **Exécution Transactionnelle Atomique dans l'Ordre des Dépendances Clés Étrangères (FK) :**
   La purge s'exécute dans un bloc Prisma transactionnel strict (`prisma.$transaction`) :
   1. `HeldCart`
   2. `Delivery`
   3. `Return`
   4. `SaleItem` & `Sale`
   5. `Payment`
   6. `Document`
   7. `OrderItem` & `Order`
   8. `PurchaseOrderItem` & `PurchaseOrder`
   9. `Supplier`
   10. `CreditAccount`
   11. `StockMovement`
   12. `StockBatch`
   13. `Product`
   14. `Unit`
   15. `CashMovement`, `CashSession` & `CashRegister`
   16. `Expense`
   17. `Appointment` & `Service`
   18. `StoredFile`, `SocialMessage`, `AutomationLog`
   19. **Réinitialisation des Séquences de Documents :** `DocumentSequence` (`RECEIPT`, `INVOICE`, `QUOTE`, etc.) sont remis à 0 (`lastNumber = 0`, `nextNumber = 1`).
   20. **Re-génération automatique du Dépôt et de la Boutique par défaut** si supprimés.
   21. **Journal d'Audit Immuable (`AuditLog`) :** Inscription d'un journal d'audit haute sécurité avec l'ID du Super Admin, l'action `TENANT_OPERATIONAL_RESET`, l'IP source, et les métriques de suppression.

---

## 3. Données Scrupuleusement Préservées (Garantie de Pérennité du Compte)

Les éléments suivants ne sont **JAMAIS supprimés** lors du reset opérationnel :
- ✅ **L'entité `Tenant` :** ID, slug, statut d'activation, dates de validité.
- ✅ **Configurations & Paramètres (`TenantSetting`) :** Nom commercial (`organization.legalName`), logo (`branding.logoUrl`), devise (`XOF`), fuseau horaire (`Africa/Ouagadougou`), coordonnées téléphoniques et postales.
- ✅ **Modèles de Facture :** 5 gabarits professionnels (`CLASSIC`, `MODERN`, `MINIMAL`, `THERMAL`, `SERVICE`).
- ✅ **Comptes Utilisateurs & Rôles :** Tous les identifiants gérants, caissiers, magasiniers et leurs permissions d'accès.
- ✅ **Abonnement & Licence SaaS :** Historique de facturation de la plateforme, statut d'essai gratuit ou forfait actif.

---

## 4. Endpoints API Concernés

| Méthode | Route | Description | Sécurité |
| :--- | :--- | :--- | :--- |
| `GET` | `/platform/tenants/:id/reset-preview` | Dry-run : comptages des données cibles | Super Admin uniquement |
| `GET` | `/platform/tenants/:id/backup` | Téléchargement du JSON de sauvegarde | Super Admin uniquement |
| `POST` | `/platform/tenants/:id/reset` | Exécution transactionnelle de la purge | Super Admin + Argon2 + Phrase |
| `POST` | `/platform/reset` | Reset global plateforme | **Bloqué en Production** |

---

## 5. Interface Console Admin (`apps/admin`)

Dans l'onglet **Organisations**, chaque ligne de tenant dispose désormais d'un bouton d'action dédié **"Réinitialiser Données"**.
Ce bouton ouvre un modal immersif en 5 phases guidées :
1. Vue d'ensemble du risque et tableau récapitulatif des volumes d'enregistrements.
2. Bouton de téléchargement instantané du fichier de sauvegarde.
3. Case à cocher de confirmation de sauvegarde.
4. Champ de saisie dynamique exigeant `CONFIRMER REINITIALISATION <Tenant>`.
5. Champ de mot de passe administrateur avec vérification temps réel.
