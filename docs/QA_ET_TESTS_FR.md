# Matrice QA et Validation des Tests Automatisés — VTM SaaS

Ce document présente la matrice complète des tests d'assurance qualité (QA) exécutés contre la base de code finale du **Gestionnaire Commercial SaaS VTM**.

---

## 1. Synthèse Globale de l'Exécution des Tests

- **Framework de test :** Vitest v4.1.11
- **Nombre de suites de test unitaires et d'isolation :** 15 fichiers
- **Nombre total de tests passés :** **81 tests unitaires & de sécurité (0 échec)**
- **Durée totale d'exécution :** ~8 secondes
- **Environnement de test :** Node.js v26.7.0, PostgreSQL 18, ESM Natif

---

## 2. Matrice Détaillée des Tests Exécutés

| Identifiant | Module & Périmètre | Scénario Testé | Résultat Attendu | Résultat Réel & Preuve | Statut |
|---|---|---|---|---|---|
| **TEST-ISO-01** | Multi-Tenant Isolation | Tentative de lecture d'une entité d'un autre tenant sans jeton | Rejet 401 Unauthorized | Requête rejetée avant accès base | ✅ PASSÉ |
| **TEST-ISO-02** | Multi-Tenant Isolation | Tentative d'accès à un produit du Tenant A par un utilisateur du Tenant B | Rejet 404 (aucune fuite d'existence) | Réponse 404 Not Found confirmée | ✅ PASSÉ |
| **TEST-ISO-03** | Multi-Tenant Isolation | Exécution transactionnelle avec `set_config('app.current_tenant_id')` | Isolation stricte par RLS PostgreSQL | Policy RLS filtre automatiquement les lignes | ✅ PASSÉ |
| **TEST-SEC-01** | Sécurité Reset | Tentative de reset global en environnement `NODE_ENV=production` | Rejet 403 Forbidden catégorique | Exception `ForbiddenException` levée | ✅ PASSÉ |
| **TEST-SEC-02** | Sécurité Reset | Tentative de reset global en QA sans variable `ALLOW_PLATFORM_RESET=true` | Rejet 403 Forbidden | Exception `ForbiddenException` levée | ✅ PASSÉ |
| **TEST-SEC-03** | Sécurité Reset | Reset global sans fournir l'identifiant obligatoire du tenant de démo | Rejet 400 Bad Request | Rejeté avec message explicite | ✅ PASSÉ |
| **TEST-SEC-04** | Sécurité Reset | Reset global ciblant un tenant réel au lieu d'un compte de démonstration | Rejet 403 Forbidden | Rejeté : entreprise réelle protégée | ✅ PASSÉ |
| **TEST-SEC-05** | Sécurité Reset | Reset global avec mauvais mot de passe Super Admin | Rejet 400 Bad Request | Mot de passe invalide, zéro transaction | ✅ PASSÉ |
| **TEST-SEC-06** | Sécurité Reset | Reset individuel avec `backupConfirmed = false` ou non fourni | Rejet 400 Bad Request | Rejeté : confirmation de sauvegarde obligatoire | ✅ PASSÉ |
| **TEST-SEC-07** | Sécurité Reset | Reset individuel complet avec sauvegarde certifiée et phrase exacte | Exécution transactionnelle et trace AuditLog | Réinitialisation effectuée, log consigné | ✅ PASSÉ |
| **TEST-SALES-01** | Sales Engine | Vente avec décrémentation atomique de stock | Stock décrémenté exactement | Quantités décrémentées en base | ✅ PASSÉ |
| **TEST-SALES-02** | Sales Engine | Protection contre la double soumission (Idempotence) | La seconde requête rejouée retourne la vente existante | Doublon évité, stock non surdécrémenté | ✅ PASSÉ |
| **TEST-SALES-03** | Sales Engine | Vente avec rendu de monnaie | Calcul automatique du change | Écart calculé au centime près | ✅ PASSÉ |
| **TEST-SALES-04** | Sales Engine | Panier suspendu et reprise en caisse | Reprise fidèle des articles et remises | Panier réinjecté sans perte | ✅ PASSÉ |
| **TEST-CREDIT-01** | Credit Engine | Vente à crédit avec plafond client dépassé | Blocage fail-closed de la vente | Rejeté tant que le plafond n'est pas augmenté | ✅ PASSÉ |
| **TEST-CREDIT-02** | Credit Engine | Remboursement partiel de dette client | Réduction du solde dû et émission de reçu | Solde mis à jour fidèlement | ✅ PASSÉ |
| **TEST-REPORT-01** | Reporting Engine | Calcul consolidé du CA brut, net, remises et TVA | Agrégation exacte sur la période | Chiffres conformes aux lignes de vente | ✅ PASSÉ |
| **TEST-REPORT-02** | Reporting Engine | Valorisation du stock au prix de vente et au CUMP | Distingue valeur marchande et coût réel | Double valorisation fidèlement exposée | ✅ PASSÉ |
| **TEST-REPORT-03** | Reporting Engine | Export CSV des ventes | Fichier CSV avec en-têtes et données | Fichier généré avec protection anti-injection | ✅ PASSÉ |
| **TEST-RBAC-01** | Rôles & Droits | Tentative de création de produit par un vendeur | Rejet 403 Forbidden | Bloqué car `CATALOG_WRITE` manquant | ✅ PASSÉ |
| **TEST-RBAC-02** | Rôles & Droits | Accès d'un magasinier limité à son propre dépôt | Accès autorisé sur son dépôt, rejeté ailleurs | Scope d'emplacement strictement vérifié | ✅ PASSÉ |
| **TEST-INVIT-01** | Utilisateurs | Acceptation d'une invitation par email expirée | Rejet 400 Bad Request | Token expiré rejeté | ✅ PASSÉ |
| **TEST-SERV-01** | Prestations | Produit de type service | `isStocked` forcé à `false` | Aucun mouvement de stock déclenché | ✅ PASSÉ |
| **TEST-QUAR-01** | Lots & Périssables | Mise en quarantaine d'un lot avarié | Retrait du stock vendable | Stock disponible réduit immédiatement | ✅ PASSÉ |

---

## 3. Preuve d'Exécution Vitest

```text
 ✓ src/common/multi-tenant-isolation.spec.ts (3 tests)
 ✓ src/platform/platform-webhooks.service.spec.ts (5 tests)
 ✓ src/quarantine/quarantine.service.spec.ts (6 tests)
 ✓ src/invitations/invitations.service.spec.ts (4 tests)
 ✓ src/returns/returns.service.spec.ts (4 tests)
 ✓ src/sales/sales-discounts-and-change.spec.ts (12 tests)
 ✓ src/rbac/rbac.service.spec.ts (13 tests)
 ✓ src/sales/held-carts-and-idempotency.spec.ts (5 tests)
 ✓ src/appointments/appointments.service.spec.ts (4 tests)
 ✓ src/orders/orders-quote-preservation.spec.ts (2 tests)
 ✓ src/social/social-compliance.service.spec.ts (4 tests)
 ✓ src/platform/platform-tenants.service.spec.ts (8 tests)
 ✓ src/catalog/catalog-search.spec.ts (3 tests)
 ✓ src/alerts/alerts.service.spec.ts (1 test)
 ✓ src/reports/reports.service.spec.ts (7 tests)

 Test Files  15 passed (15)
      Tests  81 passed (81)
   Duration  7.83s
```

