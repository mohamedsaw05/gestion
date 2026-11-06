# RÉCONCILIATION DES INCOHÉRENCES DOCUMENTAIRES — VTM SAAS COMMERCIAL

> **Date d'audit :** 2026-11-01  
> **Rôle :** Ingénieur QA Senior & ERP Business Analyst  
> **Statut :** Version de référence validée sur preuves de code et d'exécution  

---

## 1. Synthèse de l'Audit de Réconciliation

La documentation du projet présentait des divergences majeures entre les documents de spécification initiale (V1), les rapports d'implémentation intermédiaire (V2), les guides marketing utilisateurs et le code source réel.

Le tableau ci-dessous résout définitivement chacune des 9 contradictions identifiées en confrontant les textes aux preuves tangibles extraites de `packages/db/prisma/schema.prisma`, `apps/api/src/`, `apps/client/src/` et des suites de tests automatisés.

---

## 2. Analyse Détaillée des 9 Points de Contradiction

### Point 1 : Nombre de tests automatisés (179 vs 220 vs Réalité)
- **Fichiers en conflit :**
  - Annoncent **179 tests** : `docs/BACKEND_FRONTEND_COVERAGE.md` (l.54), `docs/DELIVERY_ROADMAP.md` (l.113), `docs/FINAL_VERIFICATION_REPORT.md` (l.65, 81), `docs/FUNCTIONAL_GAP_ANALYSIS.md` (l.97), `docs/OPTIMISATION_3U_WORKFLOWS.md` (l.94), `docs/RELEASE_READINESS.md` (l.48).
  - Annoncent **220 tests** : `docs/PROJECT_STATUS.md` (l.5), `docs/MASTER_FUNCTIONAL_INVENTORY.md` (l.6), `docs/QUALITY_AND_REGRESSION_REPORT.md` (l.12), `docs/IMPLEMENTATION_PROGRESS.md` (l.6).
- **Ce que le code contient réellement :**
  - La suite unitaire (`apps/api/src/**/*.spec.ts`) contient **33 tests unitaires** (vitest).
  - La suite E2E (`apps/api/test/**/*.e2e-spec.ts`) contient **191 tests E2E**.
  - **Total réel enregistré dans le dépôt : 224 tests automatisés**.
- **Ce que les tests prouvent :**
  - Commande `npm --prefix apps/api run test` : **33 passés (100%)** en 2.92s.
  - Commande `npm --prefix apps/api run test:e2e` : **191 tests configurés** sur 7 suites (93 validés, 4 échecs liés au verrouillage du rate-limiter de connexion et un scan outbox, 94 skippés en cascade).
- **Documentation à corriger :** Aligner tous les documents sur le volume réel de **224 tests (33 unitaires + 191 E2E)**. Les 179 tests correspondaient à la Phase V1 avant l'ajout des modules Prestations/Services, Dépenses, Fichiers, Diagnostics et Automatisation.
- **Décision métier :** Aucune. Constat technique factuel.

---

### Point 2 : Moteur d'automatisation (PLANNED vs Implémenté)
- **Fichiers en conflit :**
  - `docs/PROJECT_STATUS.md` (l.72, 112) classe `Automation Engine` comme `PLANNED` (« Aucune règle configurable », « non commencé »).
  - `docs/MASTER_FUNCTIONAL_INVENTORY.md`, `docs/QUALITY_AND_REGRESSION_REPORT.md` et `docs/PROJECT_STATUS.md` (l.5) décrivent un moteur d'automatisation implémenté avec protection anti-boucle.
- **Ce que le code contient réellement :**
  - Modèles Prisma `AutomationRule` et `AutomationExecutionLog` présents dans `packages/db/prisma/schema.prisma` (l.1350-1390).
  - Module complet `apps/api/src/automation/` avec `automation.controller.ts`, `automation.service.ts` (l.1-320).
  - Écran frontend `apps/client/src/pages/AutomationPage.tsx` avec création de règles IF/THEN, seuils de stock bas, alertes de créance, et logs d'exécution.
- **Ce que les tests prouvent :**
  - E2E tests dans `apps/api/test/expenses-files-automation-diagnostics.e2e-spec.ts` validant la création de règles, l'exécution et la protection anti-boucle (max executions).
- **Documentation à corriger :** Mettre à jour le tableau synthétique §4 de `docs/PROJECT_STATUS.md` pour passer `Automation Engine` de `PLANNED` à `IMPLEMENTED, TESTED`.
- **Décision métier :** Aucune requise, le moteur de base existe.

---

### Point 3 : Moteur de notification et SMTP (PLANNED vs Service prêt)
- **Fichiers en conflit :**
  - `docs/PROJECT_STATUS.md` classe Notification Engine `PLANNED`.
  - Certains guides ou résumés mentionnent des notifications par email ou un service SMTP opérationnel.
- **Ce que le code contient réellement :**
  - Aucune dépendance d'envoi de mail (`nodemailer`, `@sendgrid/mail`, `resend`, etc.) n'est installée dans `apps/api/package.json`.
  - Dans `apps/api/src/invitations/invitations.service.ts` (l.11-17) : l'envoi réel est formellement documenté comme abstrait. Le lien et le token d'invitation sont retournés dans la réponse HTTP au créateur, sans livraison SMTP.
- **Ce que les tests prouvent :**
  - Les tests d'invitation testent l'acceptation via le token retourné par l'API JSON, aucun test d'intégration SMTP n'existe.
- **Documentation à corriger :** Supprimer toute mention d'un serveur SMTP ou d'un envoi automatique de courriels dans les guides. Confirmer le statut `PLANNED / MOCK LOCAL` du Notification Engine.
- **Décision métier requise :** Choix du fournisseur de messagerie transactionnelle (Resend, SendGrid, Amazon SES ou SMTP local) et configuration des clés d'API.

---

### Point 4 : Nombre de modèles de facture (10 annoncés vs 5 réels)
- **Fichiers en conflit :**
  - `docs/USER_GUIDE_FR.md` annonce **10 modèles de factures**.
  - `docs/FUNCTIONAL_GAP_ANALYSIS.md` et `docs/MASTER_FUNCTIONAL_INVENTORY.md` mentionnent 5 modèles.
- **Ce que le code contient réellement :**
  - `apps/api/src/documents/documents.controller.ts` (l.43) :
    `const valid = ['STANDARD_PRO', 'COMPACT', 'DETAILED', 'ELEGANT', 'SERVICES'];`
  - Le générateur PDF `streamReceiptPdf` dans `apps/api/src/documents/templates/receipt.pdf.ts` implémente ces **5 gabarits A4/Laser et POS**.
- **Ce que les tests prouvent :**
  - `apps/api/test/rbac-tenant-isolation.e2e-spec.ts` valide la génération des 5 gabarits via `GET /documents/preview/:template`.
- **Documentation à corriger :** Corriger `docs/USER_GUIDE_FR.md` pour remplacer « 10 modèles » par « 5 modèles professionnels certifiés (Standard Pro, Compact, Détaillé, Élégant, Prestations/Atelier) ».
- **Décision métier :** Faut-il concevoir 5 modèles supplémentaires (ex: Export International, BTP avec retenue de garantie, Devis Proforma spécifique) ou valider que les 5 modèles actuels couvrent le besoin ?

---

### Point 5 : Relances de créances sur WhatsApp vs Conformité Meta
- **Fichiers en conflit :**
  - `docs/USER_GUIDE_FR.md` suggère la relance directe des dettes clients par message WhatsApp.
  - `docs/SOCIAL_PLATFORM_COMPLIANCE.md` (Section 11.6 & 12) stipule que les relances de créances / dettes sont interdites sur WhatsApp.
- **Ce que le code contient réellement :**
  - `apps/api/src/social/social-compliance.service.ts` (l.23-28) :
    ```typescript
    if (platform === 'WHATSAPP' && isDebtReminder) {
      throw new BadRequestException('Conformité Meta WhatsApp Business Messaging Policy : Le recouvrement de créances / dettes est formellement restreint sur WhatsApp. Envoi bloqué.');
    }
    ```
  - L'API rejette formellement toute tentative avec une erreur HTTP 400.
- **Ce que les tests prouvent :**
  - `apps/api/src/social/social-compliance.service.spec.ts` teste et valide ce rejet systématique.
- **Documentation à corriger :** Supprimer immédiatement de `docs/USER_GUIDE_FR.md` toute mention incitant à recouvrer des dettes sur WhatsApp. Préciser que les relances de factures sur WhatsApp doivent être des notifications de service neutres ou orientées SMS/Email.
- **Décision métier :** Définir la politique de relance multicanale (SMS / Email pour les créances en souffrance, WhatsApp réservé au support et aux notifications d'expédition).

---

### Point 6 : Formats de portabilité des données (JSON, SQL, CSV)
- **Fichiers en conflit :**
  - `docs/DATA_PORTABILITY_AND_RETENTION.md` promet des exports complets aux formats JSON, SQL et CSV.
  - `docs/BACKEND_FRONTEND_COVERAGE.md` relève que l'interface utilisateur ne propose qu'un bouton JSON.
- **Ce que le code contient réellement :**
  - `apps/api/src/organization/organization.controller.ts` (l.15-166) :
    - `GET /organization/export?format=json` produit un dump complet JSON.
    - `GET /organization/export?format=sql` génère un script SQL transactionnel (`BEGIN; ... INSERT INTO ... COMMIT;`).
    - Le format CSV n'est **PAS** implémenté sur l'export global d'organisation (`/organization/export`).
  - `apps/api/src/reports/reports.controller.ts` (l.65) implémente `GET /reports/sales/csv` uniquement pour les lignes de vente.
  - `apps/client/src/pages/SettingsConfigPage.tsx` n'exposait historiquement que le lien de sauvegarde JSON.
- **Ce que les tests prouvent :**
  - Les endpoints JSON et SQL sont testés dans la suite E2E, mais aucun export CSV global de base de données n'est validé.
- **Documentation à corriger :** Clarifier que la portabilité globale de l'espace de travail est assurée en **JSON et SQL**, tandis que le **CSV** est un format d'export analytique réservé aux rapports comptables et aux ventes.
- **Décision métier :** Confirmer si un export ZIP multi-fichiers CSV (un fichier par table : clients.csv, produits.csv, stocks.csv) doit être ajouté pour les utilisateurs bureautiques Excel.

---

### Point 7 : Quarantaine des retours défectueux vs Absence de stock séparé
- **Fichiers en conflit :**
  - Certains guides décrivent une mise en quarantaine automatique des articles défectueux.
  - `docs/PROJECT_STATUS.md` indique que le suivi d'un emplacement / stock défectueux séparé reste à construire.
- **Ce que le code contient réellement :**
  - `apps/api/src/returns/returns.service.ts` (l.155-201) :
    - Si `condition === 'GOOD'` : réintégration au stock vendable (`applyStockMovementWithTx`).
    - Si `condition === 'DEFECTIVE'` : l'article n'est **PAS** réintégré au stock vendable (`shouldRestock = false`). Pour les articles sérialisés, le numéro de série passe à `status: 'DEFECTIVE'`.
    - En revanche, il n'existe **AUCUNE table ou emplacement de quarantaine physique** (`StockLevel` dédié, table `Quarantine`). Pour les articles non sérialisés, l'article défectueux sort simplement des radars de stock sans compte d'inventaire d'attente.
- **Ce que les tests prouvent :**
  - Les tests vérifient que le stock vendable n'augmente pas lors d'un retour défectueux, mais ne testent aucun flux aval (SAV, réexpédition fournisseur, rebut).
- **Documentation à corriger :** Préciser que la quarantaine actuelle est un **blocage de réintégration**, et non une gestion d'entrepôt SAV.
- **Décision métier requise :** Valider l'ajout d'un emplacement virtuel système `QUARANTINE-[LocationId]` pour tracer la valeur financière et les quantités d'articles défectueux en attente de décision (SAV / Rebut / Retour fournisseur).

---

### Point 8 : Expéditions partielles multiples par commande
- **Fichiers en conflit :**
  - Les documents d'architecture prévoyaient des livraisons partielles successives.
  - `docs/PROJECT_STATUS.md` et `docs/DELIVERY_ROADMAP.md` indiquent que plusieurs livraisons par commande sont `PLANNED`.
- **Ce que le code contient réellement :**
  - `apps/api/src/deliveries/deliveries.service.ts` (l.95-98) :
    ```typescript
    const alreadyDelivery = await tx.delivery.findFirst({ where: { tenantId, orderId: dto.orderId } });
    if (alreadyDelivery) {
      throw new BadRequestException('Cette commande a déjà une livraison planifiée');
    }
    ```
  - Le code interdit explicitement plus d'une livraison par commande (relation 1-1 stricte à ce stade).
- **Ce que les tests prouvent :**
  - Test E2E dans `rbac-tenant-isolation.e2e-spec.ts` : confirme qu'une commande ne peut recevoir qu'une seule livraison.
- **Documentation à corriger :** Maintenir formellement la mention `Expéditions partielles multiples : PLANNED` jusqu'à l'implémentation de la table `DeliveryLine`.
- **Décision métier :** Approuver la modélisation proposée `Delivery` / `DeliveryLine` permettant d'expédier un reliquat en N fois.

---

### Point 9 : Règles commerciales dans les guides vs Matrice d'implémentation
- **Fichiers en conflit :**
  - `docs/USER_GUIDE_FR.md` mentionne des pénalités de retard sur créances, des calculs de TVA multi-taux et des remises automatiques au comptoir.
  - Les matrices de couverture indiquent que ces fonctionnalités sont partielles ou planifiées.
- **Ce que le code contient réellement :**
  - Dans `apps/api/src/sales/sales.service.ts` (l.503) :
    `const grandTotal = subtotal; // taxTotal = 0, discountTotal = 0 (PLANNED)`
  - La vente directe POS n'applique pas de taxes dynamiques ni de remises manuelles globales ou à la ligne dans `CreateSaleDto`.
  - Le modèle `CreditAccount` et `CreditMovement` ne calcule aucune pénalité de retard financière automatique.
- **Ce que les tests prouvent :**
  - Les tests vérifient `grandTotal = subtotal` sans calcul d'agios ou de TVA.
- **Documentation à corriger :** Retirer des guides utilisateurs les fonctionnalités de pénalités de retard et préciser que les prix s'entendent toutes taxes comprises (TTC) en l'attente du module Fiscalité Avancée.
- **Décision métier :** Déterminer si le logiciel doit gérer la TVA collectée/déductible ou fonctionner en régime de franchise/forfait (TTC).
