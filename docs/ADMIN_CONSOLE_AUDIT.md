# AUDIT DE LA CONSOLE PROPRIÉTAIRE (SUPERADMIN) ET GOUVERNANCE PLATEFORME — VTM

**Document de référence :** `docs/ADMIN_CONSOLE_AUDIT.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Application inspectée :** `apps/admin/` et contrôleurs `apps/api/src/platform/`

---

## 1. PÉRIMÈTRE ET ARCHITECTURE DE LA CONSOLE SUPERADMIN

L'espace SuperAdmin de VTM est une application React autonome (`apps/admin`), déployée séparément du portail client et protégée par des routes dédiées sous le préfixe `/platform/*`.

### Matrice des Fonctionnalités d'Administration Plateforme

| Fonctionnalité | Route API | Rôle Exigé | Données Modifiées | Confirmation & Audit | Risque / Évaluation |
|---|---|---|---|---|---|
| **Connexion SuperAdmin** | `POST /platform/auth/login` | Rôle `SUPERADMIN` | `PlatformAdminSession` | JWT dédié avec claim `isSuperAdmin: true` | **Robuste**. Séparé des JWT clients. |
| **Création d'Organisation (Tenant)** | `POST /platform/tenants` | `SUPERADMIN` | `Organization`, `User` (Propriétaire), `Location` | Envoi d'email d'invitation avec token sécurisé | **Conforme**. Le mot de passe n'est pas créé par l'admin. |
| **Gestion des Abonnements** | `PUT /platform/tenants/:id/plan` | `SUPERADMIN` | `TenantSubscription`, `SubscriptionHistory` | Historisé dans `AuditLog` | **Conforme**. Quotas mis à jour dynamiquement. |
| **Suspension / Déblocage d'un Tenant** | `POST /platform/tenants/:id/suspend` | `SUPERADMIN` | `Organization.status = 'SUSPENDED'` | Immédiat, journalisé | **Conforme**. Déconnexion instantanée des utilisateurs. |
| **Gestion de la Période d'Essai** | `PUT /platform/tenants/:id/trial` | `SUPERADMIN` | `Organization.trialEndsAt` | Journalisé | **Conforme**. Prolonge ou clôture l'essai sans perte de données. |
| **Diagnostics & Scans Intégrité** | `GET /platform/diagnostics/scan` | `SUPERADMIN` | Lecture seule | Rapport d'incohérences (orphelins, soldes) | **Sécurisé** (Scan non-destructif). |
| **Réparation Automatique** | `POST /platform/diagnostics/repair` | `SUPERADMIN` | Recalcul de soldes | Double confirmation requise | **Sécurisé** (Ne touche pas aux écritures comptables). |
| **Réinitialisation Globale** | `POST /platform/reset-all` | `SUPERADMIN` | `deleteMany` sur TOUTES les tables de TOUS les tenants | Saisie de code de confirmation | **DANGER EXTRÊME S0-01 (DÉTAILLÉ CI-DESSOUS)**. |

---

## 2. AUDIT CRITIQUE DE LA ROUTE `POST /platform/reset-all` (RISQUE S0-01)

### Analyse du Code Source
- **Localisation :** `apps/api/src/platform/platform-tenants.service.ts:167`
- **Implémentation actuelle :**
  ```typescript
  async resetAllPlatformData() {
    // Supprime les données de TOUTES les organisations sans filtre de tenantId !
    await this.prisma.saleLine.deleteMany({});
    await this.prisma.payment.deleteMany({});
    await this.prisma.document.deleteMany({});
    await this.prisma.sale.deleteMany({});
    await this.prisma.stockMovement.deleteMany({});
    await this.prisma.creditMovement.deleteMany({});
    // ...
  }
  ```

### Failles Identifiées
1. **Absence de garde d'environnement :** Aucune vérification de `process.env.NODE_ENV === 'production'`. Ce code peut être exécuté sur le cluster de production réel.
2. **Impact catastrophique :** Une seule requête autorisée avec ce rôle efface l'intégralité de l'historique commercial, des factures légales et des stocks de **toutes les entreprises clientes**.
3. **Recommandation Formelle :**
   - Interdire catégoriquement cette route si `NODE_ENV === 'production'`.
   - Limiter tout reset à un environnement explicitement flagué `IS_QA_ENV === 'true'`.
   - Remplacer le reset global par un reset strict unitaire (`POST /platform/tenants/:id/reset-test-data`) avec vérification préalable que le tenant est un tenant de démonstration (`isDemoTenant === true`).

---

## 3. PRINCIPE DE MOINDRE PRIVILÈGE ET SUPPORT CLIENT

L'audit des outils de support a vérifié l'impersonation (connexion au compte client pour assistance) :
- **Constat :** L'impersonation directe n'expose pas le mot de passe du client (un jeton d'assistance temporaire est généré).
- **Point d'attention :** Les actions effectuées par le technicien support sous impersonation doivent être explicitement taguées `actedBySuperAdmin: true` dans la table `AuditLog` afin de protéger la responsabilité juridique du commerçant en cas de litige financier.
