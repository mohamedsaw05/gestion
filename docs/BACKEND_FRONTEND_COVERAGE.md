# Couverture Backend & Frontend (Backend-Frontend Coverage Matrix)
## Gestionnaire SaaS Universel de Commerce

Ce document établit la correspondance exacte entre les écrans utilisateurs, les routes d'API, les services métier, les tables de base de données, les permissions et les tests automatisés au **18 octobre 2026**.

---

## 1. Application Client (`apps/client`)

| Écran / Page | Route Client | Méthode & Endpoint API | Service Backend | Tables Prisma | Permissions Requises | Test Validé |
|---|---|---|---|---|---|---|
| **Tableau de Bord** | `/` | `GET /reports/dashboard`<br>`GET /alerts`<br>`GET /alerts/count`<br>`GET /me/onboarding-status`<br>`PATCH /me/onboarding-dismiss` | `ReportsService`<br>`AlertsService`<br>`MeService` | `Sale`, `Payment`, `StockLevel`, `CreditAccount`, `TenantSetting` | `reports.view` | E2E reports, unitaire alerts & onboarding |
| **Point de Vente (POS)** | `/pos` | `GET /catalog?search=&limit=10`<br>`POST /sales`<br>`POST /stock-transfers`<br>`GET /documents/:number` | `CatalogService`<br>`SalesService`<br>`StockTransferService`<br>`DocumentService` | `Product`, `StockLevel`, `Sale`, `SaleLine`, `Payment`, `Document`, `StockTransfer` | `sales.create`, `documents.view` | E2E sales, `catalog-search.spec.ts` |
| **Historique Ventes** | `/sales` | `GET /sales`<br>`GET /sales/:id`<br>`POST /returns` | `SalesService`<br>`ReturnsService` | `Sale`, `SaleLine`, `Payment`, `Return`, `ReturnLine` | `sales.view`, `returns.create` | E2E sales & returns |
| **Catalogue Articles** | `/products` | `GET/POST/PUT /products`<br>`POST /products/import`<br>`GET/POST/DELETE /catalog/:id/aliases`<br>`GET/POST /units` | `CatalogService`<br>`UnitsService` | `Product`, `Category`, `ProductBarcode`, `ProductAlias`, `ProductUnit` | `catalog.view`, `catalog.manage` | E2E catalog, `catalog-search.spec.ts` |
| **Stocks & Dépôts** | `/inventory` | `GET /inventory/stock`<br>`GET /inventory/movements`<br>`POST /inventory/adjust`<br>`POST /inventory/reconcile`<br>`GET /inventory/valuation` | `InventoryService` | `StockLevel`, `StockMovement`, `StockTransfer`, `StockBatch` | `inventory.view`, `inventory.adjust` | E2E inventory & completion |
| **Sessions de Caisse** | `/cash` | `GET /cash/sessions/current`<br>`POST /cash/sessions/open`<br>`POST /cash/sessions/:id/close`<br>`POST /cash/sessions/:id/movements` | `CashRegisterService` | `CashSession`, `CashMovement`, `Payment` | `cash.view`, `cash.manage` | E2E cash |
| **Contacts & Clients** | `/customers` | `GET /customers`<br>`GET/PUT/DELETE /customers/:id`<br>`POST /customers`<br>`POST /customers/merge`<br>`GET /customers/:id/statement`<br>`GET /customers/:id/statement/pdf` | `CustomersService` | `Customer`, `CreditAccount`, `Sale`, `CreditMovement` | `customers.view`, `customers.manage` | E2E completion, test PDF statement |
| **Prestations & Atelier (P26)** | `/services` | `GET/POST /services`<br>`GET /services/stats`<br>`GET/PATCH /services/:id`<br>`POST/DELETE /services/:id/items`<br>`POST /services/:id/bill` | `ServicesService` | `ServiceOrder`, `ServiceOrderItem`, `StockMovement`, `Sale` | `services.view`, `services.manage` | `profitability-and-services.e2e-spec.ts` |
| **Rentabilité & Marges (P23)** | `/products` (onglet Marges) | `GET /products/:id/profitability`<br>`GET /products/:id/purchases`<br>`GET /products/:id/sales` | `CatalogService` | `Product`, `SaleLine` (`costPriceSnapshot`), `PurchaseOrderLine` | `catalog.view` | `profitability-and-services.e2e-spec.ts` |
| **Dépenses d'Exploitation (P3)** | `/expenses` | `GET/POST /expenses`<br>`GET /expenses/summary`<br>`PATCH /expenses/:id/approve`<br>`PATCH /expenses/:id/reject` | `ExpensesService` | `Expense`, `CashMovement`, `CashSession` | `expenses.view`, `expenses.manage` | `expenses-files-automation-diagnostics.e2e-spec.ts` |
| **Fichiers & Quota 5 Go (P4)** | `/files` | `GET/POST /files/upload`<br>`GET /files/storage/usage`<br>`GET /files/:id/download`<br>`DELETE /files/:id` | `FilesService` | `FileStorage` | `files.view`, `files.upload` | `expenses-files-automation-diagnostics.e2e-spec.ts` |
| **Diagnostics & Réparations (P6)** | `/diagnostics` | `POST /diagnostics/scan`<br>`GET /diagnostics/scans/:id`<br>`POST /diagnostics/repair` | `DiagnosticsService` | `SystemDiagnosticScan`, `DiagnosticFinding` | Rôle `OWNER` / admin | `expenses-files-automation-diagnostics.e2e-spec.ts` |
| **Moteur d'Automatisation (P7)** | `/automation` | `GET/POST /automation/rules`<br>`POST /automation/rules/:id/test`<br>`PATCH /automation/rules/:id/toggle`<br>`GET /automation/logs` | `AutomationService` | `AutomationRule`, `AutomationLog` | `automation.view`, `automation.manage` | `expenses-files-automation-diagnostics.e2e-spec.ts` |
| **Créances & Dettes** | `/credit` | `GET /credit/accounts`<br>`POST /credit/accounts/:id/payments`<br>`POST /credit/accounts/:id/remind` | `CreditService` | `CreditAccount`, `CreditMovement`, `Customer`, `TenantSetting` | `credit.view`, `credit.repay` | E2E credit, `social-compliance.service.spec.ts` |
| **Boîte de Réception Sociale** | `/social` | `GET /social/conversations`<br>`GET /social/conversations/:id/messages`<br>`POST /social/conversations/:id/messages`<br>`POST /social/kill-switch` | `SocialService`<br>`SocialComplianceService` | `SocialAccount`, `SocialConversation`, `SocialMessage`, `SocialConsent` | `social.read`, `social.reply`, `social.manage` | `social-compliance.service.spec.ts` |
| **Achats & Fournisseurs** | `/suppliers` | `GET/POST /suppliers`<br>`GET/POST /purchase-orders`<br>`POST /purchase-orders/:id/confirm`<br>`POST /purchase-orders/:id/receive` | `SuppliersService`<br>`PurchaseService` | `Supplier`, `SupplierAccount`, `PurchaseOrder`, `PurchaseOrderLine`, `StockMovement` | `purchases.view`, `purchases.manage` | E2E PO |
| **Commandes Clients** | `/orders` | `GET/POST /orders`<br>`POST /orders/:id/advance`<br>`POST /orders/:id/deposit`<br>`POST /orders/:id/complete` | `OrdersService` | `Order`, `OrderLine`, `StockLevel`, `Document` | `orders.view`, `orders.manage` | E2E orders |
| **Retours & Avoirs** | `/returns` | `GET /returns/eligible-lines`<br>`POST /returns`<br>`GET /documents/:number` | `ReturnsService`<br>`DocumentService` | `Return`, `ReturnLine`, `StockMovement`, `Document` | `returns.view`, `returns.create` | E2E returns |
| **Livraisons** | `/deliveries` | `GET/POST /deliveries`<br>`POST /deliveries/:id/out-for-delivery`<br>`POST /deliveries/:id/delivered` | `DeliveriesService` | `Delivery`, `Order`, `Document` | `delivery.view`, `delivery.manage` | E2E deliveries |
| **Rapports & Statistiques** | `/reports` | `GET /reports/sales-by-product`<br>`GET /reports/sales-by-payment-method`<br>`GET /reports/sales-by-seller`<br>`GET /reports/cash-summary` | `ReportsService` | `Sale`, `SaleLine`, `Payment`, `CashSession` | `reports.view` | E2E reports |
| **Équipe & Permissions** | `/roles` | `GET /users`<br>`GET/POST /roles`<br>`POST /users/invitations` | `RbacService`<br>`UsersService` | `User`, `Role`, `RolePermission`, `UserRole`, `Invitation` | `roles.view`, `roles.manage`, `users.manage` | E2E RBAC |
| **Paramètres & Factures** | `/settings` | `GET/PUT /settings`<br>`GET/POST /locations`<br>`GET /organization/export`<br>`GET /documents/preview/:template` | `SettingsService`<br>`LocationsService`<br>`DocumentsService`<br>`OrganizationController` | `TenantSetting`, `Location`, `TenantModule`, `Tenant` | `settings.manage` | E2E completion, test PDF templates |
| **Journal d'Audit** | `/audit` | `GET /audit` | `AuditService` | `AuditLog`, `OutboxEvent` | `audit.view` | E2E audit |

---

## 2. Console Superadmin SaaS (`apps/admin`)

| Écran / Page | Route Admin | Méthode & Endpoint API | Service Backend | Tables Prisma | Permissions Requises | Test Validé |
|---|---|---|---|---|---|---|
| **Connexion Plateforme** | `/login` | `POST /platform/auth/login` | `PlatformAuthService` | `PlatformAdminUser` | Compte Superadmin valide | E2E platform |
| **Gestion des Tenants** | `/tenants` | `GET/POST /platform/tenants`<br>`POST /platform/tenants/:id/suspend`<br>`POST /platform/tenants/:id/reactivate`<br>`POST /platform/tenants/:id/plan` | `PlatformTenantService` | `Tenant`, `PlatformSubscription`, `PlatformPlan`, `PlatformInvoice` | Rôle `SUPERADMIN` | E2E platform |
| **Plans & Tarifs** | `/plans` | `GET/POST /platform/plans` | `PlatformPlansService` | `PlatformPlan` | Rôle `SUPERADMIN` | E2E platform |
| **Abonnements & Quotas** | `/subscriptions` | `GET /platform/subscriptions`<br>`GET /platform/invoices` | `PlatformBillingService` | `PlatformSubscription`, `PlatformInvoice` | Rôle `SUPERADMIN` | E2E platform |
| **Santé & Système** | `/health` | `GET /health`<br>`GET /metrics` | `HealthService` | Base de données, statut connexions | Rôle `SUPERADMIN` / `SUPPORT` | E2E platform |

---

## 3. Synthèse de Couverture des Tests Réels

- **Tests unitaires et intégration API** : **29 tests** (100% de réussite).
- **Tests E2E sur base PostgreSQL réelle (port 4000)** : **150 tests** (100% de réussite).
- **Total général validé** : **179 tests passants**.
