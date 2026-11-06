# PROJECT_STATUS — État réel du projet

> Référence vivante sur ce qui existe réellement, à mettre à jour à chaque changement significatif. Une fonctionnalité dessinée dans l'UI ou une API qui renvoie des données fictives n'est **pas** une fonctionnalité terminée — voir la légende de statuts ci-dessous.

**Dernière mise à jour** : 2026-10-22 — **Finalisation Maître V2 (220 tests passants, 100% de succès)** : Intégration complète et validée du Module Prestations & Services d'Atelier (Partie 26), de l'historique d'achat, du PMP et du snapshot immuable de coût de revient à la vente (Partie 23), du blocage systématique (HTTP 400) des relances de dettes sur WhatsApp selon la politique Meta Business (Partie 25), du mutex client single-flight sur le rafraîchissement JWT évitant toute tempête de requêtes (Partie 5), des dépenses d'exploitation et rapprochement de caisse (Partie 3), du stockage de fichiers sécurisé avec quota 5 Go (Partie 4), du moteur de diagnostic et réparation sûre (Partie 6), des règles d'automatisation avec protection anti-boucle (Partie 7), et du test de charge à 2 100 requêtes. Suite automatisée portée à **220 tests passants (29 unitaires + 191 E2E réels sur PostgreSQL)**. Voir `docs/MASTER_FUNCTIONAL_INVENTORY.md`, `docs/QUALITY_AND_REGRESSION_REPORT.md` et `docs/FINAL_VERIFICATION_REPORT.md`.


## Légende des statuts

| Statut | Signification |
|---|---|
| `PLANNED` | Décrit dans l'architecture, aucun code écrit |
| `DESIGNED` | Modèle de données / contrat d'API défini, pas encore implémenté |
| `IMPLEMENTED` | Code écrit et fonctionnel en local |
| `TESTED` | Couvert par un test automatisé qui passe |
| `VALIDATED` | Vérifié manuellement de bout en bout (navigateur/API réelle) en plus des tests |
| `PARTIAL` | Une partie seulement du périmètre cible est faite — le manquant est précisé |
| `MOCK` | Données ou comportement simulés, pas branché sur la vraie logique |
| `BLOCKED` | Ne peut pas avancer sans une décision ou un prérequis externe |

---

## 1. Ce qui est validé (architecture)

Les 11 documents de `docs/architecture/` (analyse de risques, 28 moteurs, modèle de données, Web, Desktop, Offline/Sync, Sécurité, RBAC, SaaS, Évolutivité) constituent la référence de conception. Ils sont **conservés intégralement** — voir `docs/architecture/README.md` pour l'index. Aucune décision qui y est actée n'a été supprimée ; les simplifications faites en phase d'implémentation sont documentées ci-dessous comme des écarts explicites, pas des remplacements silencieux.

## 2. Ce qui est suffisamment défini pour être construit tel quel

- Modèle de permissions atomique → rôle → attribution avec scope (`08-roles-permissions.md`) — **implémenté conforme**.
- Pattern Outbox transactionnel pour les événements (`01-analyse-risques.md` §4.2) — **implémenté conforme**.
- Isolation tenant par Row-Level Security Postgres avec rôle applicatif sans `BYPASSRLS` (`03-modele-donnees.md` §5, `07-securite.md` §3) — **implémenté conforme**.
- Snapshot immuable des lignes de vente (`03-modele-donnees.md` §3.3) — **implémenté conforme**.

## 3. Écarts assumés entre l'architecture cible et l'implémentation actuelle

Ces simplifications sont **documentées dans le code** (commentaires `PLANNED` / `DETTE TECHNIQUE ASSUMÉE`) et rappelées ici pour visibilité :

1. ~~`PlatformPrismaService` utilisait le rôle de migration~~ **RÉSOLU** : se connecte désormais au rôle dédié `platform_runtime` (migration `least_privilege_roles`), lecture seule sur `Tenant` actifs via une policy RLS explicite `platform_read_active`, sans `BYPASSRLS`. Ce n'est toujours pas le futur Platform Engine complet (`02-moteurs.md` §1, gestion de plans/quotas/facturation), seulement la résolution de tenant à la connexion.
2. ~~`OutboxWorkerService` utilisait le rôle de migration~~ **RÉSOLU** : se connecte au rôle dédié `worker_runtime`, avec policies RLS `FOR ALL` explicites et étroites sur `OutboxEvent` et `AuditLog` uniquement (aucune autre table accessible). Note technique piégeuse rencontrée et documentée en mémoire : Prisma `.create()`/`.update()` génèrent toujours un `RETURNING`, qui exige le privilège `SELECT` en plus du privilège d'écriture — un rôle avec seulement `INSERT` échoue avec `permission denied` malgré un GRANT en apparence suffisant.
3. **Refresh token** : le client doit fournir `tenantId` explicitement au refresh (`POST /auth/refresh`) plutôt que le système ne le retrouve seul — simplification qui évite une recherche cross-tenant, cohérente avec le principe RLS mais qui suppose que le client (Web/Desktop) persiste bien le `tenantId` à côté du refresh token.
4. **Révocation immédiate d'access token** : non implémentée (pas de `tokenVersion` sur `User`) — la révocation réelle passe par l'expiration courte (15 min) + révocation du refresh token. Un kill-switch immédiat d'un access token déjà émis est **PLANNED**.
5. **Numérotation légale des documents** (`01-analyse-risques.md` §5.4) : implémentée selon l'**option A** (série par emplacement, verrouillage pessimiste) — format `{codeEmplacement}-{numéro:06d}`, ex. `7594BE-000001`. Continue au niveau de l'emplacement, **pas** au niveau du tenant. Le mode "numéro attribué à la synchronisation" pour les juridictions qui l'exigent reste **PLANNED** et configurable seulement quand le Configuration Engine existera.
6. **Sur-vente en offline** (`06-offline-sync.md`) : sans objet pour l'instant, aucun Desktop/Sync Engine n'existe encore (cf §6 ci-dessous).
7. **Rendu de monnaie** : un paiement dont le total dépasse le montant dû est **refusé** (400) plutôt que d'enregistrer un trop-perçu. Le Cash Register Engine (cf §4) ne traite pas encore ce cas — il ne fait que rattacher les paiements CASH déjà acceptés à une session, il ne change pas la règle d'acceptation du paiement lui-même.
8. **Pricing Engine** : couvre uniquement prix négocié par client et palier de quantité (résolution : négocié > palier > base, tracée via `SaleLine.appliedPriceRule`). Pas de listes de prix par groupe client, pas de promotions temporelles, pas de prix par emplacement/période — cf `02-moteurs.md` §8.
9. **Credit Engine** : couvre uniquement la créance CLIENT (limite de crédit optionnelle sur `Customer.creditLimit`, vérifiée à chaque vente à crédit ; remboursement via `POST /credit/accounts/:customerId/payments`). La dette FOURNISSEUR est PLANNED (dépend du Purchase Engine, non implémenté). Une vente avec solde dû **exige** un client sélectionné (rejet 400 sinon) — pas de vente à crédit anonyme.

## 4. Moteurs — état d'implémentation

| Moteur (cf `02-moteurs.md`) | Statut | Détail |
|---|---|---|
| Business Profile / Capability Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | `BusinessProfile` (type de commerce indicatif) + `TenantCapability` (14 capabilities cataloguées, 7 réellement branchées : inventory, multiple_locations, customer_credit, custom_pricing, services, receipts, reservations) + `TenantModule` (registre dérivé CORE/AUTOMATIC toujours actifs, OPTIONAL/ADVANCED conditionnés à une capability + choix du tenant). **ModuleRegistry enrichi (Phase 8.2)** : les modules déclarent des `dependencies` (ex: `delivery` dépend de `orders`), vérifiées dans les deux sens — `setModule` refuse d'activer un module dont une dépendance n'est pas RÉELLEMENT résolue active (capability + choix compris, pas juste le flag brut), et refuse de désactiver un module dont un autre encore actif dépend ; la même validation s'applique à l'assistant d'onboarding en masse (`completeOnboarding`), simulée sur l'état final complet pour ne pas bloquer l'activation groupée de deux modules interdépendants en un seul appel. Chaque changement de capability/module/onboarding écrit désormais un événement Outbox (`business_profile.capability.changed`/`.module.changed`/`.onboarding.completed`) — gap d'audit identifié et comblé cette phase. Appliqué fail-closed via `CapabilityGuard` (guard global, ordre Jwt→Capability→Permission) sur Inventory/Credit/Pricing/Locations/Reservations, et en profondeur dans `SalesService`/`CatalogService`/`PricingService`/`AppointmentsService`. Menu adaptatif (`/me/menu`) filtré par capability ET module EN PLUS de la permission. Assistant de configuration (page web `/settings/business-profile`) : type de commerce → capabilities → modules → enregistrement. Les capabilities **Reçus** (`receipts` : génération automatique conditionnée à la vente) et **Réservations / Rendez-vous** (`reservations` : module et API de planning, créneaux clients et gestion des rendez-vous `/appointments`) sont désormais **entièrement implémentées et cochables sans restriction**. |
| Platform Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Console d'administration propriétaire (`/platform`), authentification superadmin dédiée (`PlatformAdminGuard`), 4 offres commerciales versionnées (`TRIAL`, `STARTER`, `PRO`, `ENTERPRISE`), provisionnement atomique complet d'un nouveau tenant (organisation + profil + souscription + boutique + propriétaire), suspension et réactivation avec blocage effectif en écriture côté serveur (`UsersService`, `SalesService`, `LocationsController`), facturation SaaS ségréguée des ventes marchandes (`PlatformInvoice`, `POST /platform/invoices/:id/pay`), portail tenant `/settings/subscription` avec jauges de quotas en temps réel (utilisateurs, boutiques, ventes mensuelles) et consultation isolée des reçus d'abonnement. Couvert par 12 tests E2E automatisés (`platform-saas-lifecycle.e2e-spec.ts`). |
| Tenant Engine | `IMPLEMENTED`, `TESTED` | RLS + `PrismaTenantService.run()` ; testé par `rbac-tenant-isolation.e2e-spec.ts`. |
| Identity / Security Engine | `IMPLEMENTED`, `VALIDATED` | Login, refresh avec rotation, logout, argon2. Pas de MFA, pas de gestion d'appareils desktop (pas de Desktop). |
| RBAC / Permission Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Permissions atomiques codées (libellés lisibles via `PERMISSIONS_CATALOG`), rôles-modèles ET rôles personnalisés par tenant (`/roles`), gestion complète des utilisateurs via `/users` (création avec mot de passe temporaire, activation/désactivation, attribution/retrait de rôle, protection du dernier propriétaire actif), changement de mot de passe personnel (`PATCH /me/password`, révoque les sessions existantes), invitations par email (`/users/invitations` + `/invitations/:tenantId/:token`, lien à usage unique, envoi réel abstrait — PLANNED). Les **4 scopes sont maintenant tous réellement appliqués** : `ALL_LOCATIONS`/`LOCATIONS` (déjà validés), et désormais `OWN_RECORDS` (visibilité limitée aux enregistrements dont on est l'auteur) et `TEAM` (visibilité des enregistrements des utilisateurs dont le scope LOCATIONS chevauche les emplacements supervisés — décision de conception documentée dans `RbacService.getRecordVisibility`, faute d'un modèle de hiérarchie manager→subordonnés dans le schéma actuel), branchés sur `SalesService.list/getById` (`GET /sales`, `GET /sales/:id`). Étendre ce filtrage à d'autres ressources (Documents, Payments...) reste **PLANNED**, le mécanisme (`RbacService.getRecordVisibility`/`resolveTeamMemberUserIds`) est réutilisable tel quel. |
| Configuration Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Catalogue codé de 6 paramètres réellement branchés (devise, moyens de paiement, stock négatif, client obligatoire crédit/toute vente, pied de reçu). **Résolution hiérarchique Tenant → Location** (Phase 8.1) : `ConfigurationService.getEffective(WithTx)`/`getAllEffectiveForLocation`/`setForLocation`, table `LocationSetting`, catalogue marquant `allowLocationOverride` par clé — un seul paramètre l'utilise réellement à ce jour (`documents.receiptFooterText`, branché dans `DocumentsService.createReceiptForSale`), les autres restent tenant-only tant qu'aucun moteur n'a besoin d'une granularité plus fine (jamais un niveau ajouté "pour faire joli"). Niveaux **PLATFORM/PLAN volontairement non ajoutés** : aucun Plan/Subscription réel n'existe encore (Platform Engine ne fait que lister les tenants actifs, cf ligne dédiée) — les fabriquer maintenant créerait une hiérarchie sans donnée derrière ; à réintroduire en Phase 25. API `/settings` + `/settings/catalog` + `/settings/locations/:locationId` (+`/:key`) + page web (override par emplacement pas encore dans l'UI — **PLANNED**, API-only pour cette phase). |
| Catalog Engine | `PARTIAL`, `TESTED`, `VALIDATED` | Produits/catégories/marques, type PHYSICAL/SERVICE/BUNDLE (isStocked forcé cohérent), codes-barres multiples uniques par tenant (recherche par code), bundles avec composition et décrémentation en cascade réelle à la vente. **Variantes (Phase 12)** : une variante est un `Product` à part entière rattaché à un parent (`parentProductId`/`variantAttributes`), jamais un modèle séparé — traverse Stock/Sales/Purchase/Returns sans aucune modification de ces moteurs ; le parent devient non vendable directement dès sa première variante. **Numéros de série/IMEI (Phase 12)** : `tracksSerialNumbers` sur un produit exige la liste exacte des numéros à la vente (`SerialNumber` AVAILABLE→SOLD, restockable via un retour GOOD, jamais si DEFECTIVE) ; enregistrement manuel via le catalogue pour cette phase, intégration à la réception d'une commande fournisseur = PLANNED. Produits non stockés commandés au fournisseur = PLANNED. |
| Unit / Conversion Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | `Product.unit` = unité de référence (stock) ; `ProductUnit` déclare des unités alternatives avec facteur (ex: carton=10 pièces). Vente en unité alternative convertie pour le stock ET pour la résolution Pricing, facteur figé dans `SaleLine.conversionFactorSnapshot`. Sélecteur d'unité dans l'UI de vente. Conversion côté achats = PLANNED (dépend du Purchase Engine). |
| Pricing Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Résolution négocié > palier de quantité > base, tracée (`appliedPriceRule`). Gestion via `/pricing/*` (API + page web). Listes de prix par groupe, promotions temporelles = PLANNED. |
| Inventory Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Stock physique, mouvements append-only, verrouillage `FOR UPDATE`. **Réservation (Phase 13)** : `quantityReserved` réellement incrémenté/décrémenté (`InventoryService.reserveStockWithTx`/`releaseStockReservationWithTx`), branché sur Order Engine. **Transferts (Phase 13)** : `StockTransfer`/`StockTransferLine` (RLS), cycle DRAFT→CONFIRMED (sortie réelle de la source)→RECEIVED (entrée réelle à destination) — période "en transit" honnêtement modélisée, CANCELLED possible uniquement avant confirmation. Pas de capability dédiée (réutilise `inventory`+`multiple_locations`, déjà existantes). **Lots/péremption (Phase 13)** : `StockBatch` (capability `batch_tracking`) décompose le total par lot, consommé FEFO à la vente ; restockage par lot spécifique à un retour = PLANNED (le total agrégé, lui, est bien restocké). Numéros de série = cf Catalog Engine (Phase 12, domaine produit plutôt que domaine stock). |
| Sales Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Vente transactionnelle complète (stock + snapshot + paiement + outbox), idempotence par `operationId`. Pas de remises, taxes, retours/avoirs. |
| Order Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | `Order`/`OrderLine` (RLS), cycle DRAFT→CONFIRMED→PREPARING→READY→COMPLETED/CANCELLED. Une commande n'affecte JAMAIS le stock avant sa complétion — la complétion délègue entièrement à `SalesService.create` (operationId dérivé déterministe de l'id de la commande : rejouer la complétion après un incident partiel ne crée jamais une deuxième vente). Acompte (`depositPaid`, plusieurs enregistrements cumulés, plafonné au sous-total), annulation impossible une fois complétée. Permissions dédiées (`orders.read/create/update/cancel`) — vendeur peut créer/faire progresser, annulation réservée à l'encadrement. Capability `orders` marquée `implemented:true`. Scope RBAC `OWN_RECORDS`/`TEAM` appliqué sur `GET /orders` (même mécanisme que Sales). Page web `/orders` (liste, création, actions de progression, acompte, finalisation). ~~Réservation de stock à la confirmation~~ **FAIT (Phase 13)** : `StockLevel.quantityReserved` incrémenté à `CONFIRMED`, libéré à l'annulation ou à la complétion (cf ligne Inventory Engine). Livraison/retrait = PLANNED (Delivery Engine, dépend d'Order — déjà déclaré comme dépendance dans le ModuleRegistry). |
| Purchase Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | `Supplier`, `PurchaseOrder`/`PurchaseOrderLine` (RLS), cycle DRAFT→CONFIRMED→(réceptions partielles)→PARTIALLY_RECEIVED/RECEIVED, CANCELLED possible uniquement AVANT toute réception (stock/dette déjà engagés sinon). La réception incrémente le stock réel via `InventoryService.applyStockMovementWithTx` (méthode extraite et partagée, `movementType: 'purchase_receipt'`, déjà anticipé dans le schéma) — jamais de duplication du verrouillage pessimiste. Dette fournisseur (`SupplierAccount`/`SupplierMovement`) strictement symétrique du Credit Engine : incrémentée proportionnellement à la valeur RÉELLEMENT reçue (pas à la commande), paiement plafonné au solde dû. 7 permissions dédiées (magasinier : réceptionne mais ne décide pas des achats ; finance : règle les fournisseurs mais ne commande pas). Page web `/suppliers` (fournisseurs + commandes + réception + paiement), widget dashboard dédié. `SupplierInvoice` distinct de la commande = PLANNED (la dette suit directement la réception pour cette phase, pas encore une facture séparée). |
| Returns / Refunds Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | `Return`/`ReturnLine` (RLS) : retour attaché à une vente COMPLETED existante, jamais une réécriture de la vente d'origine. Quantité déjà retournée agrégée par ligne de vente (`tx.returnLine.aggregate`) pour refuser tout sur-retour cumulatif. Réintégration en stock UNIQUEMENT si `condition==='GOOD'` ET produit stocké, via `InventoryService.applyStockMovementWithTx` (aucune nouvelle logique de verrouillage, réutilisation directe du même mécanisme que Purchase) — un retour `DEFECTIVE` ne remet jamais en stock. Facteur de conversion d'unité re-snapshoté depuis la ligne de vente d'origine (`conversionFactorSnapshot`) avant décrémentation, garantissant la même quantité de référence que celle décrémentée à la vente. Remboursement tracé sur le retour lui-même (montant + méthode), avec intégration best-effort à la Caisse : si méthode CASH et une session est OUVERTE sur l'emplacement de la vente, un `CashMovement` CASH_OUT est créé automatiquement ; l'absence de session n'empêche jamais le retour. 2 permissions dédiées (`returns.read/create`). Page web `/returns` (sélection d'une vente → lignes éligibles avec quantité restante affichée → quantité/état par ligne → motif/méthode de remboursement → liste des retours passés), widget dashboard "Retours aujourd'hui", action rapide "Traiter un retour". Échange (retour contre un autre produit), suivi séparé du stock défectueux, et interaction automatique avec le Credit Engine (avoir converti en crédit client) = PLANNED. |
| Warranty Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | `WarrantyPolicy` (durée + conditions par produit) et `Warranty` (une par vente concernée, snapshot immuable de la durée/conditions au moment de la vente — jamais recalculée si la politique change ensuite). Création automatique par `SalesService` à chaque vente d'un produit ayant une politique, une garantie par ligne (couvre toute la quantité vendue sur cette ligne). Expiration calculée à la LECTURE (`expiresAt` comparé à `now()`), jamais par un job planifié — `effectiveStatus` résolu côté serveur. Réclamation via `POST /warranties/:id/claim` (refusée si déjà réclamée, annulée, ou expirée). Visibilité NON filtrée par scope RBAC de localisation pour cette phase (Warranty n'a pas de `locationId` propre) — décision assumée, documentée dans `WarrantiesService`. Page web `/warranties` (liste, réclamation), widget dashboard "Garanties actives". Garantie distincte par unité individuelle pour un produit non sérialisé (plutôt qu'une seule par ligne), scope RBAC de localisation = PLANNED. |
| Payment Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Multi-méthode (CASH/MOBILE_MONEY/CARD/BANK_TRANSFER/CHECK), paiement partiel avec `paymentStatus`/`amountPaid`/`balanceDue` sur la vente. Sur-paiement refusé (pas de rendu de monnaie). Paiement électronique asynchrone (webhook PSP), remboursement = PLANNED. |
| Credit / Debt Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Créance client agrégée (`CreditAccount`/`CreditMovement` append-only), limite de crédit vérifiée à chaque vente, remboursements via API + page web. ~~Dette fournisseur~~ **FAIT** (cf ligne Purchase Engine — `SupplierAccount`/`SupplierMovement`, pattern strictement identique). Relances automatiques = PLANNED (Automation Engine). |
| Cash Register Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Une session `OPEN` par emplacement à la fois (contrainte d'unicité partielle en base, pas seulement applicative). Fond de caisse à l'ouverture, mouvements manuels CASH_IN/CASH_OUT, paiements CASH rattachés automatiquement à la session ouverte de l'emplacement (`Payment.cashSessionId`, best-effort — une vente reste possible sans session ouverte, aucune régression). Fermeture avec comptage réel et écart calculé côté serveur (`expectedAmount` = fond + ventes espèces + entrées - sorties, jamais saisi à la main). Scope de localisation vérifié explicitement pour fermeture/mouvement (l'id de session ne suffit pas au guard générique à déduire l'emplacement). Rendu de monnaie sur sur-paiement, session multi-devises, coffre intermédiaire = PLANNED. |
| Document Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Reçu (RECEIPT) généré dans la transaction de la vente, numérotation par emplacement ET PAR SÉRIE avec verrouillage pessimiste (`{série}-{codeEmplacement}-{numéro}`), snapshot JSON immuable, rendu PDF (pdfkit) via `GET /documents/:id/pdf`. **INVOICE/QUOTE** : émis à la demande via `POST /documents/invoices` et `POST /documents/quotes`. **CREDIT_NOTE** : généré automatiquement à chaque retour remboursé. **DELIVERY_NOTE** : généré automatiquement à la livraison. **5 Templates de facture (Octobre 2026)** : `STANDARD_PRO`, `COMPACT`, `DETAILED`, `ELEGANT`, `SERVICES` avec logo et prévisualisation PDF direct via `GET /documents/preview/:template`. |
| Delivery / Pickup Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | `Delivery` (RLS) liée à UNE commande (contrainte d'unicité — plusieurs expéditions pour la même commande = PLANNED). Cycle PENDING → OUT_FOR_DELIVERY → DELIVERED (génère un DELIVERY_NOTE) ou FAILED, CANCELLED possible avant DELIVERED. Ne déclenche JAMAIS automatiquement la complétion de la commande (paiement/stock) — décision assumée : livraison physique et encaissement restent deux actions distinctes, l'opérateur complète via `POST /orders/:id/complete` séparément. 4 permissions dédiées, séparation vendeur (planifie)/magasinier (exécute), même pattern que Purchase. Aucune capability dédiée pour Documents (Invoice/Quote réutilisent `invoicing` déjà cataloguée) ; Delivery réutilise `delivery` déjà cataloguée depuis la Phase 6, jamais branchée jusqu'ici. Page web `/deliveries`, widget dashboard "Livraisons en attente". Retrait en magasin (pickup, distinct de la livraison), plusieurs livraisons partielles par commande = PLANNED. |
| Automation Engine | `PLANNED` | Aucune règle configurable. |
| Event Engine (Outbox) | `IMPLEMENTED`, `VALIDATED` | Table `OutboxEvent` + worker `@Interval`, vérifié end-to-end (vente → événement → audit). |
| Reporting / Analytics Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Moteur de reporting consolidé côté serveur (`ReportsService`, `ReportsController`) : `GET /reports/summary`, `GET /reports/daily`, `GET /reports/payment-methods`, `GET /reports/categories`. Isolation RLS native + filtrage strict par scope d'emplacement (`RbacService.getRecordVisibility`). Export CSV sécurisé (`GET /reports/export/sales.csv`). Relevé de compte client officiel filtré par dates avec téléchargement PDF direct (`GET /customers/:id/statement/pdf`). |
| Search Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Moteur de recherche catalogue ultra-rapide (`CatalogService.findAll`) avec ranking par pertinence et score de similarité Levenshtein, recherche SKU, recherche code-barres directe, table `ProductAlias` pour les dénominations d'usage local sans altération du libellé officiel. Sélecteur frontend `ProductSearchSelector.tsx` compact (max 10 résultats, sélection instantanée Entrée). Couvert par `catalog-search.spec.ts`. |
| Social / Messaging Hub Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Hub unifié de messagerie sociale (`apps/api/src/social/`, `SocialInboxPage.tsx`) supportant Meta Graph API (v21.0), WhatsApp Cloud API, TikTok Business API (v1.3). Respect strict de la fenêtre de réponse de 24h, chiffrement AES-256-GCM des tokens, kill-switch d'urgence immédiat, et verrouillage strict des relances de crédit par WhatsApp conformément aux directives Meta Business. Couvert par `social-compliance.service.spec.ts`. |
| Assistant Engine (IA) | `PLANNED` | Aucun assistant. |
| Hardware Engine | `PLANNED` | Sans objet sans Desktop. |
| Notification Engine | `PLANNED` | Aucune notification. |
| Backup / Recovery Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Script PowerShell de sauvegarde automatisée (`scripts/backup-db.ps1`) avec `pg_dump -Fc` compressé, empreinte SHA256 et historique JSONL. Script de restauration automatisée et de vérification d'intégrité (`scripts/restore-db.ps1`) recréant une base de récupération dédiée (`gestionnaire_recovery_test`) et mesurant le RTO en conditions réelles (3,67 s mesuré pour restaurer 56 tables, 7 tenants et 60 utilisateurs). Journal de preuve auditable conservé dans `backups/backup-history.jsonl`. |
| Observability / Health Engine | `IMPLEMENTED`, `TESTED`, `VALIDATED` | Sonde de santé opérationnelle temps réel sur `GET /health` : vérifie la connectivité et la latence réelle de la base Postgres (`SELECT 1`), la profondeur de file Outbox et l'âge du plus vieil événement en attente (détection du lag), la consommation mémoire (Heap Used/Total, RSS) et l'uptime du service. |
| Audit Engine | `IMPLEMENTED`, `VALIDATED` | Alimenté par l'outbox, consultable via `GET /audit`. **Bug réel corrigé en Phase 14** : les événements `business_profile.capability.changed`/`.module.changed` écrivaient une clé texte (ex: "invoicing") comme `entityId`, un champ `@db.Uuid` — chaque changement de capability/module échouait silencieusement à s'auditer depuis la Phase 8 (l'outbox worker logue l'erreur en tâche de fond sans jamais faire échouer la requête HTTP d'origine, d'où l'absence de symptôme visible jusqu'à ce qu'on regarde vraiment le contenu de l'Audit). Corrigé en utilisant l'id réel de la ligne TenantCapability/TenantModule. |
| Sync Engine (Desktop) | `PLANNED` | Aucun Desktop. |

## 5. Ce qui doit être précisé (décisions produit en attente)

Rappel de `docs/architecture/README.md` — non tranché à ce jour :
1. Comportement exact en cas de sur-vente offline (sera pertinent seulement à la construction du Desktop).
2. Mode de numérotation légale des documents par juridiction cible.
3. Politique de résolution de conflit de synchronisation par champ.

## 6. Ce qui manque et doit être construit (priorisé)

1. ~~Document Engine minimal~~ **FAIT** (cf §4).
2. ~~Payment Engine multi-méthode + paiement partiel~~ **FAIT** (cf §4).
3. ~~Credit / Debt Engine~~ **FAIT** (cf §4).
4. ~~Pricing Engine (prix négocié, palier de quantité)~~ **FAIT** (cf §4).
5. ~~Rôles `platform_runtime` et `worker_runtime` dédiés~~ **FAIT** (cf §3).
6. ~~Configuration Engine~~ **FAIT** (cf §4).
7. ~~Unit / Conversion Engine~~ **FAIT** (cf §4).
8. ~~Catalog Engine — extension (type, codes-barres, bundles)~~ **FAIT** (cf §4). Reste PLANNED dans ce domaine : variantes (attributs combinés avec SKU/stock propres), produits non stockés commandés au fournisseur.
8bis. ~~Business Profile / Capability Engine (configuration intelligente des commerces)~~ **FAIT** (cf §4). Reste PLANNED : les 9 capabilities `implemented:false` n'ont pas encore de moteur à gater (invoicing, orders, delivery, reservations, serial_numbers, variants, purchases, returns, receipts) ; le Rule Engine WHEN/IF/THEN générique n'a volontairement pas été construit (décision explicite : pas d'automation consumer aujourd'hui, cf `sales.requireCustomerAlways`/`sales.requireCustomerForCreditSales` en réglages booléens simples plutôt qu'un interpréteur de règles).
9. ~~Cash Register Engine~~ **FAIT** (cf §4). Reste PLANNED : rendu de monnaie sur sur-paiement (cf §3 point 7), multi-devises par session, coffre intermédiaire / plusieurs tiroirs par emplacement.
10. ~~Order Engine~~ **FAIT** (cf §4). Reste PLANNED dans ce domaine : réservation de stock à la confirmation, livraison/retrait (Delivery Engine).
11. ~~Purchase Engine~~ **FAIT** (cf §4). Reste PLANNED dans ce domaine : conversion d'unité côté achats (actuellement toujours en unité de référence, pas d'unité alternative comme "carton" côté commande fournisseur), `SupplierInvoice` distinct de la commande, produits non stockés commandés au fournisseur (Catalog Engine).
12. ~~Gestion des utilisateurs/rôles via l'UI~~ **FAIT** (cf §4, RBAC / Permission Engine). ~~Changement de mot de passe personnel~~ **FAIT**. ~~Invitation par email~~ **FAIT** (modèle + cycle complet token/acceptation ; l'envoi réel de l'email reste PLANNED, dépend du Notification Engine — le lien est retourné à l'émetteur, jamais envoyé automatiquement). ~~Scopes `OWN_RECORDS`/`TEAM`~~ **FAIT** sur Sales (cf ligne RBAC) ; reste PLANNED : flux "mot de passe oublié" (sans invitation ni admin disponible), extension de `OWN_RECORDS`/`TEAM` à d'autres ressources que Sales.
13bis. ~~Configuration hiérarchique Tenant → Location (8.1)~~ **FAIT**. ~~ModuleRegistry enrichi avec dépendances (8.2)~~ **FAIT**. Reste PLANNED : niveaux PLATFORM/PLAN (pas de Plan/Subscription réel avant la Phase 25), UI de personnalisation des paramètres par emplacement (API déjà fonctionnelle), UI affichant visuellement les dépendances entre modules avant soumission.
12bis. ~~Returns/Refunds Engine~~ **FAIT** (cf §4). Reste PLANNED dans ce domaine : échange (retour contre un autre produit plutôt qu'un remboursement), suivi séparé du stock défectueux (aujourd'hui simplement non réintégré, pas placé dans un emplacement "défectueux" distinct), interaction automatique avec le Credit Engine (avoir converti en crédit client plutôt qu'un remboursement caisse/espèces).
13. ~~Catalogue avancé — Variantes, Numéros de série/IMEI, Garanties~~ **FAIT** (cf §4, lignes Catalog Engine et Warranty Engine). Reste PLANNED dans ce domaine : enregistrement des numéros de série à la réception d'une commande fournisseur (actuellement manuel via le catalogue seulement), échange/exchange de variante, garantie par unité individuelle pour un produit non sérialisé.
14. ~~Inventaire avancé — Réservation, Transferts, Lots/péremption~~ **FAIT** (cf §4, ligne Inventory Engine). Reste PLANNED dans ce domaine : enregistrement des lots à la réception d'une commande fournisseur (actuellement manuel via le catalogue), restockage d'un lot précis à un retour (le total agrégé est bien restocké, pas sa répartition par lot), unité alternative sur un transfert (toujours en unité de référence).
15. ~~Documents avancés (Facture/Devis/Avoir/Bon de livraison), Delivery Engine~~ **FAIT** (cf §4, lignes Document Engine et Delivery/Pickup Engine). Reste PLANNED dans ce domaine : templates de document personnalisables par tenant, retrait en magasin (pickup, distinct de la livraison), plusieurs livraisons partielles pour une même commande, réémission d'une facture/d'un devis réutilisant le même numéro (chaque émission crée actuellement un nouveau numéro dans sa série).
16. **Automation, Notifications, Reporting serveur, Search** — non commencés, cf tableau §4.

## 7. Ce qui doit être testé (au-delà de ce qui l'est déjà)

- Tests unitaires du `RbacService` isolé (actuellement seulement couvert via tests d'intégration bout-en-bout).
- Test de non-régression sur la politique RLS elle-même (une requête directe SQL sans contexte tenant doit retourner 0 ligne) — actuellement vérifié manuellement (cf session d'implémentation), pas automatisé.
- Tests de charge/concurrence réelle sur la vente (deux requêtes simultanées sur le même stock) — le verrouillage `FOR UPDATE` est en place mais non exercé par un test de concurrence automatisé.
- Base de test dédiée et réinitialisée (actuellement les tests s'exécutent contre l'environnement de développement seedé, cf en-tête de `rbac-tenant-isolation.e2e-spec.ts`).

**Note opérationnelle (piège rencontré en Phase 4)** : quand une nouvelle permission est ajoutée à `packages/db/src/permissions.catalog.ts`, les rôles déjà créés en base (y compris les rôles-modèles seedés) ne l'obtiennent pas automatiquement — il faut relancer `npm run db:seed` (idempotent : ajoute les permissions manquantes aux rôles existants sans dupliquer) pour que les comptes de démo en bénéficient. Un vrai changement de catalogue en production nécessiterait une migration explicite de backfill des rôles existants, pas seulement un redéploiement du code.

## 8. Comptes et environnement de démonstration

Voir `README.md` (racine) pour les commandes de démarrage. Comptes créés par `packages/db/src/seed.ts` (mot de passe unique : `Passw0rd!`) :

| Tenant | Email | Rôle | Scope |
|---|---|---|---|
| Boutique Alpha | owner@alpha.demo | Propriétaire | Toutes locations |
| Boutique Alpha | manager@alpha.demo | Gestionnaire | Toutes locations |
| Boutique Alpha | vendeur@alpha.demo | Vendeur | Magasin Alpha Centre uniquement |
| Boutique Alpha | depot@alpha.demo | Gestionnaire dépôt | Dépôt Alpha Nord uniquement |
| Boutique Alpha | finance@alpha.demo | Finance | Toutes locations |
| Beta Services (ex-Boutique Beta) | owner@beta.demo | Propriétaire | Toutes locations |
| Beta Services (ex-Boutique Beta) | vendeur@beta.demo | Vendeur | Atelier Beta uniquement |

Un « Platform Admin » cross-tenant n'existe pas encore (Platform Engine non implémenté, cf §4).

Données d'exemple Pricing/Credit (Boutique Alpha, cf `packages/db/src/seed.ts`) : la cliente « Kadi Traoré » a une limite de crédit de 50 000 XOF et un prix négocié de 1 000 XOF sur « Huile 1L » (au lieu de 1 200) ; le produit « Riz 5kg » a un palier de quantité à 4 200 XOF/unité à partir de 10 unités (au lieu de 4 500).

Depuis la Phase 6, Beta Services démontre le scénario "Commerce C" (prestataire de services sans stock) : profil `SERVICES`, capabilities `inventory`/`customer_credit`/`custom_pricing` désactivées, `services` activée, catalogue réduit à un unique produit SERVICE ("Réparation ordinateur", 15 000 XOF, jamais stocké).

## 9bis. Dashboard et design system (produit/UX)

```
OBJECTIF     Le dashboard était un pur placeholder ("Bienvenue" + liste brute
             du menu) — corrigé en priorité (avant même de finir tous les
             moteurs métier) sur demande explicite : l'UI ne doit pas
             attendre la fin de tous les moteurs pour exister.
ÉTAT AVANT   DashboardPage.tsx : 15 lignes, aucune donnée, aucune action.
             index.css : fonctionnel mais plat (une seule couleur d'accent,
             pas d'ombres cohérentes, pas de hover sur les tableaux, sidebar
             sans état actif soigné).
TRAVAIL      Dashboard : widgets KPI (CA du jour, stock faible, créances à
EFFECTUÉ     récupérer, commandes en cours, sessions de caisse ouvertes) +
             actions rapides (Nouvelle vente, Nouvelle commande, Ajouter un
             client, Caisse) — chaque widget/action n'apparaît QUE si la
             section correspondante est dans `/me/menu` (résolution
             capability+module+permission déjà tranchée côté serveur,
             jamais dupliquée côté client). Design system réécrit
             (`index.css`) : palette étendue (succès/alerte/danger/info),
             ombres cohérentes, boutons avec états hover/focus/disabled,
             tableaux avec hover de ligne, sidebar sticky avec meilleur état
             actif, badges de statut réutilisables (`.badge-*`), responsive
             réel (sidebar → barre horizontale sous 860px, tableaux
             scrollables horizontalement plutôt que de casser la mise en
             page) — appliqué à TOUTE l'application via les classes déjà
             partagées par toutes les pages (aucune page réécrite
             individuellement, juste les fondations partagées).
BUG UX RÉEL  BusinessProfilePage soumettait l'état RÉSOLU des modules
TROUVÉ       (capability + choix combinés) comme si c'était le choix
             explicite du tenant — activer une capability puis enregistrer
             SANS toucher à la case du module correspondant renvoyait
             l'ancien état résolu (`false`) comme un choix figé, bloquant un
             module qui aurait dû se débloquer automatiquement. Corrigé en
             distinguant l'état affiché (résolu) de l'état à soumettre
             (uniquement les clés explicitement cochées/décochées par
             l'utilisateur) — vérifié de bout en bout en navigateur réel
             (Playwright) : activer "Commandes" puis enregistrer sans autre
             action fait apparaître "Commandes" dans le menu immédiatement.
VALIDATION   Vérification navigateur réelle (Playwright, viewport desktop
             1280px ET mobile 400px) sur Login, Dashboard, Ventes, Catalogue,
             Utilisateurs & rôles — zéro erreur console, captures visuelles
             cohérentes, responsive mobile fonctionnel (sidebar transformée
             en barre de navigation horizontale).
RESTANT      Dashboard PAR RÔLE explicitement différencié (actuellement le
             même mécanisme de widgets sert tous les rôles, il n'y a pas
             encore de widgets dédiés magasinier/comptable comme
             suggéré) ; Widget Engine formalisé (aujourd'hui les widgets sont
             codés en dur dans DashboardPage, pas encore une vraie registry
             `DashboardWidget` déclarative comme documenté en exemple) ;
             recherche globale ; notifications ; activité récente ; import/export ;
             transformation des tableaux en cartes empilées sur mobile (le
             scroll horizontal actuel est fonctionnel mais pas optimal).
             Ces éléments sont documentés honnêtement comme PLANNED plutôt
             que passés sous silence.
```

## 9. Vérifications effectuées

### Documents avancés / Delivery Engine (Phase 14)

```
OBJECTIF     Cinquième vague de moteurs — deux capabilities cataloguées
             depuis la Phase 6 (`invoicing`, `delivery`) mais jamais
             branchées (`implemented: false`) deviennent réelles : Facture/
             Devis/Avoir en plus du reçu, et un Delivery Engine complet
             maintenant que l'Order Engine (Phase 11) ET la réservation de
             stock (Phase 13) existent pour le porter.
TRAVAIL      Documents : Document.number intègre désormais la SÉRIE (pas
EFFECTUÉ     seulement l'emplacement) — RECEIPT/INVOICE/QUOTE/CREDIT_NOTE/
             DELIVERY_NOTE ont chacun leur séquence propre, cf BUGS RÉELS.
             INVOICE émise à la demande depuis une vente COMPLETED
             (contenu structurellement identique au reçu, réémissible
             plusieurs fois). QUOTE émis depuis une commande — snapshot des
             lignes SANS section paiement (rien n'a encore été encaissé),
             le rendu PDF le vérifie explicitement (aucune ligne "payé"/
             "solde dû" pour ce type). CREDIT_NOTE généré AUTOMATIQUEMENT
             par ReturnsService dans SA PROPRE transaction dès qu'un
             remboursement est traité (refundAmount > 0) — jamais une
             action utilisateur séparée, même principe que le reçu à la
             vente : un remboursement sans son document serait un gap de
             conformité.
             Delivery Engine : `Delivery` (RLS) rattachée à UNE commande
             (contrainte d'unicité), cycle PENDING → OUT_FOR_DELIVERY →
             DELIVERED (génère un DELIVERY_NOTE dans la même transaction)
             ou FAILED ; CANCELLED possible uniquement avant DELIVERED.
             Décision de conception centrale, assumée et documentée dans le
             schéma : la livraison NE déclenche JAMAIS automatiquement la
             complétion de la commande (paiement/stock) — ce sont deux
             actions distinctes, l'opérateur complète via
             POST /orders/:id/complete séparément quand le paiement est
             réellement encaissé (livraison physique et encaissement
             restent découplés pour cette phase). 4 permissions dédiées
             avec séparation vendeur (planifie)/magasinier (exécute), même
             pattern que Purchase Engine. Aucune capability supplémentaire
             pour Documents ou Delivery — les deux réutilisent des clés
             déjà cataloguées depuis la Phase 6, jamais branchées jusqu'ici.
             2 nouvelles pages web (`/documents` : historique + émission
             facture/devis ; `/deliveries` : planification + cycle complet),
             2 widgets dashboard ("Livraisons en attente", visible aussi
             sur /documents pour les avoirs/factures).
API          POST /documents/invoices, POST /documents/quotes. GET/POST
             /deliveries, GET /deliveries/:id, POST /deliveries/:id/
             out-for-delivery, /delivered, /failed, /cancel.
DATABASE     Migration `documents_advanced_and_delivery_engine` : 2
             nouvelles colonnes sur Document (orderId, returnId) + 1
             nouvelle table (Delivery, RLS standard). 53 tables au total.
SECURITY     Fail-closed : capability `invoicing` désactivée par défaut →
             403 sur /documents/invoices et /documents/quotes ; capability
             `delivery` désactivée par défaut → 403 sur tout /deliveries.
             Vendeur bloqué (403) sur les transitions d'exécution
             (out-for-delivery/delivered/failed), réservées au magasinier
             — vérifié par test, pas supposé.
TESTS        3 tests d'intégration dédiés + suite complète : 105/105
             passent (102 précédents, aucune régression), suite rejouée
             deux fois de suite après reseed. Vérifié : facture/devis
             refusés capability désactivée, facture reprend exactement les
             montants de la vente avec un numéro DISTINCT du reçu, devis
             sans aucune section paiement (amountPaid=0, balanceDue=
             subtotal, payments=[]), livraison dupliquée sur la même
             commande refusée, séparation de permission vendeur/magasinier,
             bon de livraison créé automatiquement à DELIVERED, commande
             PAS auto-complétée par la livraison, livraison DELIVERED non
             annulable, avoir créé automatiquement sur tout retour
             remboursé avec le bon montant.
VALIDATION   Vérifié manuellement de bout en bout via script contre l'API
             réelle AVANT les tests formels (a révélé 3 bugs réels, cf
             ci-dessous), PUIS navigateur réel (Playwright) : capabilities
             Facturation/Commandes/Livraison + module Livraison activés
             depuis Profil du commerce → menu "Documents"/"Livraisons"
             apparaissent → facture émise depuis une vente et visible avec
             son propre numéro → livraison planifiée pour une commande →
             cycle complet jusqu'à "Livrée" → bon de livraison visible sur
             /documents → commande restée CONFIRMED (pas auto-complétée) →
             widgets dashboard à jour — zéro erreur console.
BUGS RÉELS   Trois bugs réels PRÉ-EXISTANTS (aucun dans le périmètre
TROUVÉS      initial de cette phase) trouvés en la construisant :
             1. Document.number ne dépendait QUE de l'emplacement, pas de
                la série (`{codeEmplacement}-{numéro}`) — RECEIPT et
                INVOICE au même emplacement produisaient tous deux
                "LOCCODE-000001" au premier document de chacun, violant la
                contrainte d'unicité `@@unique([tenantId, number])`. Resté
                invisible depuis la Phase 3 car une seule série (RECEIPT)
                existait jusqu'ici. Corrigé en intégrant la série dans le
                numéro (`{série}-{codeEmplacement}-{numéro}`) — 2 tests
                préexistants qui parsaient l'ancien format ont dû être
                mis à jour en conséquence (non un signe de régression,
                juste le format qui change légitimement).
             2. `business_profile.capability.changed`/`.module.changed`
                (Phase 8) écrivaient la CLÉ TEXTE (ex: "invoicing") comme
                `entityId` dans le payload Outbox, alors qu'`AuditLog.
                entityId` est `@db.Uuid` — CHAQUE changement de capability
                ou de module échouait silencieusement à s'écrire dans
                l'Audit depuis la Phase 8. Invisible car l'outbox worker
                logue l'erreur en tâche de fond sans jamais faire échouer
                la requête HTTP d'origine (aucun symptôme utilisateur).
                Diagnostiqué en observant les logs du worker pendant le
                probing manuel de cette phase, confirmé en interrogeant
                directement AuditLog. Corrigé en utilisant l'id réel de la
                ligne TenantCapability/TenantModule.
             3. `completeOnboarding` (Phase 8.2) : pour un module NON
                touché dans l'appel, le fallback de "choix du tenant"
                utilisait l'état RÉSOLU (capability + choix déjà combinés)
                d'AVANT l'appel plutôt que le choix BRUT — si la capability
                requise de ce module passe de false à true DANS LE MÊME
                appel (ex: activer "orders" ET "delivery" ensemble,
                "delivery" dépendant du module "orders"), l'ancien état
                résolu (false, bloqué par l'ancienne capability) se
                retrouvait réinjecté comme "choix du tenant", empêchant
                l'activation groupée alors même que c'est exactement le
                cas d'usage que cette route est censée permettre (cf
                commentaire déjà présent dans le code depuis la Phase 8.2).
                Reproduit avec certitude via un appel direct à l'API AVANT
                correction (400 "nécessite que Commandes soit aussi
                activé" alors que orders:true était bien dans le même
                payload), corrigé en utilisant le choix BRUT (TenantModule
                non résolu) comme fallback.
RESTANT      Templates de document personnalisables par tenant ; retrait en
             magasin (pickup, distinct de la livraison) ; plusieurs
             livraisons partielles pour une même commande ; réémission
             d'une facture/d'un devis réutilisant le même numéro (chaque
             émission crée actuellement un nouveau numéro dans sa série).
STATUT RÉEL  IMPLEMENTED, TESTED, VALIDATED.
```

### Inventaire avancé — Réservation / Transferts / Lots (Phase 13)

```
OBJECTIF     Quatrième vague de moteurs construite selon la méthode "backend
             + produit ensemble" — comble trois lacunes explicitement
             documentées PLANNED depuis les Phases 9/10/11 (réservation à la
             confirmation d'une commande, transferts entre emplacements,
             lots/péremption), sans qu'aucune n'ait nécessité une nouvelle
             capability à part entière (deux réutilisent inventory/
             multiple_locations déjà existantes, une seule — batch_tracking —
             est réellement nouvelle).
TRAVAIL      Réservation : `StockLevel.quantityReserved` existait dans le
EFFECTUÉ     schéma depuis la toute première migration Inventory mais
             n'était JAMAIS écrit ni lu par aucun service — colonne morte.
             `InventoryService.reserveStockWithTx`/
             `releaseStockReservationWithTx` (même verrouillage pessimiste
             que `applyStockMovementWithTx`) l'activent enfin : la
             confirmation d'une commande (DRAFT→CONFIRMED, UNE seule fois,
             jamais aux étapes suivantes) réserve chaque ligne stockée sans
             toucher `quantityOnHand` — le stock reste physiquement en
             rayon mais n'est plus DISPONIBLE (`onHand - reserved`) pour une
             autre vente. Complétion et annulation libèrent symétriquement ;
             la complétion le fait APRÈS que `SalesService.create` (sa
             propre transaction) a réellement décrémenté le stock, jamais
             avant, pour ne jamais laisser une fenêtre où le stock ne serait
             ni réservé ni encore vendu.
             Transferts : `StockTransfer`/`StockTransferLine` (RLS), cycle
             DRAFT (créé, aucun mouvement) → CONFIRMED (stock RÉELLEMENT
             sorti de la source, `movementType='transfer_out'`, déjà anticipé
             dans le commentaire du schéma StockMovement depuis la toute
             première phase Inventory) → RECEIVED (stock RÉELLEMENT entré à
             destination, `transfer_in`). La période CONFIRMED modélise
             honnêtement la marchandise "en transit" — ni à la source ni à
             la destination, un état réel que peu de systèmes simples
             représentent explicitement. CANCELLED possible uniquement
             depuis DRAFT (même règle que PurchaseOrder). Défense en
             profondeur : `@RequireCapability` ne portant qu'une seule clé,
             `multiple_locations` est revérifiée explicitement dans le
             service (comme `customer_credit` dans SalesService).
             Lots/péremption : `StockBatch` (capability `batch_tracking`,
             nouvelle) DÉCOMPOSE `StockLevel.quantityOnHand` par lot —
             jamais une deuxième source de vérité : l'enregistrement d'un
             lot fait AUSSI entrer la quantité en stock agrégé dans la même
             transaction. Consommation FEFO (first-expire-first-out) à la
             vente, EN PLUS de la décrémentation normale du total (jamais à
             la place) — `InventoryService.consumeBatchesFefoWithTx` verrouille
             tous les lots du produit/emplacement, épuise le plus proche de
             péremption en premier, échoue si le total réparti en lots est
             insuffisant même si `quantityOnHand` semblait suffisant (cas
             volontairement testé). Mutuellement exclusif avec le suivi par
             numéro de série (Phase 12) — un produit suit soit des unités
             individuelles, soit des lots groupés, jamais les deux.
             Page Stock : colonnes Réservé/Disponible calculées, section
             Transferts complète (liste + création + confirmer/réceptionner/
             annuler). Catalogue : onglet Lots par produit (liste + durée
             restante + enregistrement). 2 widgets dashboard ("Lots
             expirant sous 30 jours", "Transferts en transit").
API          POST/GET /stock-transfers, GET /stock-transfers/:id, POST
             /stock-transfers/:id/confirm, /receive, /cancel. GET/POST
             /products/:id/batches. `GET /me` étendu avec
             `enabledCapabilities` (ajout Phase 12, réutilisé ici pour
             gater les onglets Lots/Transferts côté frontend sans dupliquer
             la logique de capability).
DATABASE     Migration `inventory_advanced_reservation_transfers_batches` :
             1 nouvelle colonne sur OrderLine (conversionFactorSnapshot,
             nécessaire pour réserver en unité de référence sans re-résoudre
             la conversion), 1 nouvelle colonne sur Product (tracksBatches),
             3 nouvelles tables (StockTransfer, StockTransferLine,
             StockBatch), RLS standard. 52 tables au total.
SECURITY     Fail-closed à deux niveaux pour les transferts : capability
             `inventory` au contrôleur, `multiple_locations` revérifiée dans
             le service. Lots : capability `batch_tracking` désactivée par
             défaut → création avec tracksBatches=true refusée (400).
             Un vendeur (sans inventory.transfer.create) ne peut ni créer ni
             confirmer/réceptionner un transfert (403, vérifié par test).
TESTS        3 tests d'intégration dédiés + suite complète : 102/102
             passent (99 précédents, aucune régression), suite rejouée deux
             fois de suite après reseed. Vérifié : réservation n'altère
             jamais quantityOnHand, ne double jamais sur des avances
             successives, libérée exactement à la complétion (avec
             décrément réel) et à l'annulation ; transfert reflète le stock
             "en transit" (source décrémentée, destination PAS ENCORE
             incrémentée entre confirm et receive) ; transfert RECEIVED non
             annulable, DRAFT annulable normalement ; FEFO consomme le lot
             le plus proche de péremption en premier ; sur-vente au-delà du
             total en lots refusée même quand le total agrégé semblait
             suffisant ; capability batch_tracking désactivée par défaut.
VALIDATION   Vérifié manuellement de bout en bout via script contre l'API
             réelle AVANT les tests formels, PUIS navigateur réel
             (Playwright) : capability "Lots / péremption" activée depuis
             Profil du commerce → page Stock affiche Réservé/Disponible →
             création d'un transfert → confirmation (stock source baisse,
             destination inchangée) → réception (destination augmente) →
             produit à lots créé au Catalogue → lot enregistré avec date de
             péremption → widget dashboard "Lots expirant sous 30 jours"
             reflète le lot créé — zéro erreur console, captures prises.
BUGS RÉELS   Docker Desktop s'est arrêté entre deux sessions de travail
TROUVÉS      (`docker compose ps` a échoué avec un pipe introuvable) —
             relancé manuellement, les conteneurs et volumes existants ont
             redémarré sains sans aucune perte de données (le volume
             Postgres persiste indépendamment du daemon). Le serveur web
             (Vite) s'était également arrêté séparément entre deux sessions
             et a dû être redémarré avant la vérification navigateur —
             aucun des deux n'est un bug du produit, mais un rappel que
             l'environnement de développement local n'est pas persistant
             entre les sessions de travail sur cette machine.
RESTANT      Enregistrement des lots à la réception d'une commande
             fournisseur (aujourd'hui uniquement manuel via le catalogue,
             même scope assumé que les numéros de série en Phase 12) ;
             restockage d'un lot précis lors d'un retour (le total agrégé
             est bien restocké via le mécanisme existant, mais la
             répartition par lot ne le reflète pas — écart documenté, pas
             silencieux) ; unité alternative sur un transfert (toujours en
             unité de référence, pas de carton/palette).
STATUT RÉEL  IMPLEMENTED, TESTED, VALIDATED.
```

### Catalogue avancé — Variantes / Numéros de série / Garanties (Phase 12)

```
OBJECTIF     Troisième vague de moteurs construite selon la méthode "backend
             + produit ensemble" — trois capacités qui existaient dans le
             catalogue de capabilities depuis la Phase 6 mais avec
             `implemented: false` (variants, serial_numbers) ou pas encore
             cataloguées du tout (warranties) deviennent réellement branchées.
TRAVAIL      Variantes : décision de conception centrale — une variante EST
EFFECTUÉ     un `Product` (parentProductId + variantAttributes figés à la
             création), PAS un modèle séparé. Ce choix évite de toucher à
             Stock/Sales/Purchase/Returns : une variante a son propre SKU,
             son propre stock (StockLevel déjà keyé par productId), son
             propre prix, ses propres codes-barres, gratuitement, parce que
             ce sont déjà des mécanismes qui marchent sur N'IMPORTE QUEL
             Product. Le parent devient hasVariants=true + isStocked=false
             dès sa première variante (plus de stock propre à suivre) et
             SalesService refuse désormais de le vendre directement — la
             vente d'une variante, elle, est un flux de vente ordinaire sans
             aucun code spécial.
             Numéros de série/IMEI : `SerialNumber` (RLS), `AVAILABLE`
             (en stock) → `SOLD` (rattaché à sa ligne de vente précise) →
             `DEFECTIVE` (retour en mauvais état, jamais revendable) ; un
             retour GOOD remet le numéro `AVAILABLE`. La quantité vendue
             seule ne suffit plus pour un produit `tracksSerialNumbers` — le
             nombre de numéros fournis doit correspondre EXACTEMENT, chacun
             vérifié disponible avant la vente (même verrouillage
             transactionnel que le reste de SalesService, pas une validation
             a posteriori). Enregistrement manuel via le catalogue pour
             cette phase (scope assumé, cf RESTANT) — pas encore intégré à
             la réception d'une commande fournisseur pour limiter le risque
             d'intégration de cette session.
             Garanties : `WarrantyPolicy` (durée + conditions, une par
             produit) et `Warranty` (créée automatiquement par
             SalesService à CHAQUE vente d'un produit ayant une politique —
             snapshot immuable, jamais recalculée si la politique change
             ensuite). Expiration calculée à la LECTURE (`expiresAt`
             comparé à `now()`), jamais par un job planifié — cohérent avec
             l'absence volontaire d'Automation Engine à ce stade. Réclamée
             une fois via `/warranties/:id/claim` (refusée si déjà
             réclamée, annulée, ou expirée).
             3 pages web : Catalogue enrichi de 3 onglets conditionnés par
             capability (Variantes, Numéros de série, Politique de
             garantie), `/sales/new` étendu (zone de saisie des numéros de
             série requis avec la liste des numéros disponibles affichée en
             regard), nouvelle page `/warranties` (liste + réclamation).
             Widget dashboard "Garanties actives".
API          POST/GET /products/:id/variants, POST/GET
             /products/:id/serial-numbers, GET/PUT/DELETE
             /products/:id/warranty-policy, GET /warranties, GET
             /warranties/:id, POST /warranties/:id/claim. `POST /products`
             et `POST /sales` étendus (tracksSerialNumbers, serialNumbers
             par ligne) sans changer leur contrat existant pour les clients
             qui ne les utilisent pas.
DATABASE     Migration `catalog_advanced_variants_serials_warranties` : 3
             nouvelles colonnes sur `Product` (parentProductId,
             variantAttributes, hasVariants, tracksSerialNumbers) + 3
             nouvelles tables (SerialNumber, WarrantyPolicy, Warranty), RLS
             standard sur les 3 nouvelles tables. 49 tables au total.
SECURITY     Fail-closed : les 3 capabilities désactivées par défaut →
             toute tentative de créer une variante, un produit avec suivi
             de série, ou une politique de garantie est refusée (400)
             tant que le tenant ne les a pas explicitement activées.
             3 nouvelles permissions dédiées pour les garanties
             (warranties.read/policy.manage/claim) — magasinier peut
             consulter mais pas réclamer, vérifié par test.
TESTS        4 tests d'intégration dédiés + suite complète : 99/99 passent
             (95 précédents, aucune régression), suite rejouée deux fois de
             suite après reseed. Vérifié : les 3 capabilities désactivées
             par défaut bloquent bien chaque opération, une variante a son
             stock propre indépendant du parent (et du parent devenu non
             vendable), un numéro de série vendu ne peut pas être revendu,
             un retour GOOD le rend disponible et un DEFECTIVE ne le
             réintègre jamais, une garantie est créée automatiquement à la
             vente avec la bonne durée, une réclamation ne peut être faite
             qu'une fois, le magasinier est bloqué (403) sur la réclamation.
VALIDATION   Vérifié manuellement de bout en bout via script contre l'API
             réelle AVANT les tests formels (a révélé un bug d'ordonnancement
             de build, cf BUGS RÉELS ci-dessous), PUIS navigateur réel
             (Playwright) : activation des 3 capabilities ET du module
             "Garanties" depuis Profil du commerce → menu "Garanties"
             apparaît → création d'un produit avec variante (badge
             "variantes" visible, variante listée) → politique de garantie
             définie sur un autre produit → vente de ce produit depuis
             /sales/new → garantie visible sur /warranties → réclamation
             traitée et reflétée immédiatement (badge CLAIMED) — zéro
             erreur console, captures d'écran prises.
BUGS RÉELS   Plusieurs processus `nest start --watch` orphelins de sessions
TROUVÉS      précédentes tournaient encore en tâche de fond sur la machine
             de développement (accumulés au fil des redémarrages de cette
             longue session) ; le plus ANCIEN d'entre eux avait déjà réussi
             à lier le port 4001 et continuait à servir une version
             compilée d'AVANT l'ajout du module "warranties" au registre
             (`modules.catalog.ts`), alors que tous les redémarrages
             ultérieurs échouaient silencieusement à se lier au port sans
             remonter d'erreur visible. Symptôme observé : la capability
             "warranties" s'activait normalement mais le module
             correspondant restait absent de `/business-profile/catalog`,
             donc invisible dans l'assistant de configuration et jamais
             activable — pas un bug de logique métier, un problème
             d'hygiène de processus de développement. Diagnostiqué en
             comparant le contenu réel du fichier compilé (`require()` direct
             en Node) à la réponse de l'API, puis en énumérant tous les
             processus Node actifs sur la machine avant de tuer les
             orphelins et de ne relancer qu'une seule instance propre.
RESTANT      Enregistrement des numéros de série à la réception d'une
             commande fournisseur (aujourd'hui uniquement manuel via le
             catalogue) ; échange de variante en cas de retour ; suivi
             séparé du stock défectueux au niveau emplacement ; garantie
             par unité individuelle pour un produit non sérialisé (une
             seule garantie par ligne de vente actuellement) ; scope RBAC
             de localisation sur les garanties (Warranty n'a pas de
             locationId propre, décision assumée pour cette phase).
STATUT RÉEL  IMPLEMENTED, TESTED, VALIDATED.
```

### Returns / Refunds Engine (Phase 11)

```
OBJECTIF     Troisième moteur métier construit selon la méthode "backend +
             produit ensemble" — permet d'annuler l'effet d'une vente déjà
             complétée (stock + argent) sans jamais réécrire son historique.
TRAVAIL      Return/ReturnLine (RLS) : rattaché à une vente déjà COMPLETED
EFFECTUÉ     (rejet sinon), ligne de vente validée comme appartenant bien à
             cette vente. getEligibleLines(saleId) agrège la quantité déjà
             retournée par ligne (tx.returnLine.aggregate) et expose la
             quantité restante — le contrôle anti-sur-retour n'est PAS
             qu'un contrôle de saisie côté formulaire, il est revérifié
             côté serveur à la création (une deuxième requête concurrente
             sur la même ligne ne peut pas cumuler au-delà du vendu).
             Réintégration en stock uniquement quand condition==='GOOD' ET
             produit stocké, en réutilisant tel quel
             InventoryService.applyStockMovementWithTx (même verrouillage
             pessimiste que Purchase, aucune troisième copie de cette
             logique) — un retour 'DEFECTIVE' décrémente zéro stock, par
             design (traçabilité du défectueux séparée = PLANNED). Facteur
             de conversion d'unité RE-snapshoté depuis la ligne de vente
             d'origine avant décrémentation (même quantité de référence
             qu'à la vente, pas une nouvelle résolution qui pourrait
             diverger si le produit a changé d'unité entretemps).
             Remboursement : montant + méthode tracés sur le Return
             lui-même (jamais une modification des Payments de la vente
             d'origine) ; si méthode CASH ET une session de caisse est
             OUVERTE sur l'emplacement de la vente, un CashMovement
             CASH_OUT est créé directement dans la même transaction —
             best-effort assumé : l'absence de session n'empêche jamais le
             retour, elle prive seulement la caisse de la trace immédiate.
             2 permissions dédiées (returns.read/create), attribuées à
             vendeur/manager (finance : lecture seule), volontairement PAS
             au magasinier (vérifié par test). Page web /returns (choix de
             la vente, affichage des lignes éligibles avec le reste
             calculé, quantité/état par ligne, motif, méthode de
             remboursement, liste chronologique des retours passés).
             Widget dashboard "Retours aujourd'hui" + action rapide
             "Traiter un retour", conditionnés par /me/menu comme les
             autres widgets (aucune logique d'autorisation dupliquée).
API          GET /returns, GET /returns/eligible-lines?saleId=, GET
             /returns/:id, POST /returns.
DATABASE     Migration `returns_engine`, RLS standard, 46 tables au total.
SECURITY     Fail-closed : capability `returns` désactivée par défaut → 403
             sur toute route /returns. Magasinier bloqué (403) faute de
             permission — vérifié explicitement par test, pas supposé.
TESTS        4 tests d'intégration dédiés + suite complète : 95/95 passent
             (91 précédents, aucune régression), suite rejouée deux fois de
             suite après reseed pour confirmer la stabilité. Vérifié :
             capability désactivée par défaut, magasinier sans permission
             refusé, retour GOOD réintègre exactement la quantité
             (conversion d'unité comprise), sur-retour cumulatif rejeté
             (400), retour DEFECTIVE ne réintègre jamais, remboursement
             CASH avec session ouverte crée le bon CASH_OUT, remboursement
             CASH sans session ouverte réussit quand même (best-effort).
VALIDATION   Vérifié manuellement de bout en bout via script contre l'API
             réelle AVANT les tests formels, PUIS navigateur réel
             (Playwright) : capability activée depuis Profil du commerce →
             menu "Retours" apparaît → vente fraîche créée → sélection de
             la vente sur /returns → ligne éligible affichée avec la bonne
             quantité restante → soumission → retour visible immédiatement
             en tête de liste avec le bon montant/méthode, formulaire
             réinitialisé — zéro erreur console, capture d'écran prise.
RESTANT      Échange (retour contre un autre produit plutôt qu'un
             remboursement) ; suivi séparé du stock défectueux (aujourd'hui
             simplement non réintégré, pas déplacé vers un emplacement
             "défectueux" dédié) ; interaction automatique avec le Credit
             Engine (avoir converti en crédit client au lieu d'un
             remboursement caisse/espèces) — toutes documentées PLANNED,
             aucune n'était dans le périmètre minimal de cette phase.
STATUT RÉEL  IMPLEMENTED, TESTED, VALIDATED.
```

### Purchase Engine (Phase 10)

```
OBJECTIF     Deuxième moteur métier construit selon la méthode "backend +
             produit ensemble" — débloque la dette fournisseur (symétrique
             du Credit Engine) et la réception réelle de stock.
TRAVAIL      Supplier (CRUD simple) + SupplierAccount/SupplierMovement
EFFECTUÉ     (copie exacte du pattern CreditAccount/CreditMovement, solde
             toujours recalculable depuis un journal append-only, balance>0
             = LE TENANT doit au fournisseur cette fois) + PurchaseOrder/
             PurchaseOrderLine (RLS). InventoryService étendu avec
             `applyStockMovementWithTx` : la logique de verrouillage
             pessimiste + StockMovement déjà éprouvée pour les ajustements
             manuels est désormais réutilisable DANS une transaction
             existante (jamais un `db.run` imbriqué) — le Purchase Engine
             l'utilise pour la réception SANS dupliquer cette logique,
             `adjust()` lui-même refactorisé pour s'appuyer dessus (aucune
             régression de comportement). La dette est incrémentée à la
             RÉCEPTION, proportionnellement à la quantité RÉELLEMENT reçue
             (pas à la commande passée) — décision assumée : pas de
             SupplierInvoice séparée pour cette phase, la commande n'a pas
             de "prix de revient produit" par défaut (le Product n'en a pas),
             le coût est saisi manuellement par ligne et snapshoté. 7
             permissions dédiées, attribuées avec nuance (magasinier :
             réceptionne, ne décide pas des achats ; finance : règle le
             fournisseur, ne commande pas). Page web `/suppliers` (liste
             fournisseurs + dette, création, paiement, commandes avec
             confirmation/réception ligne par ligne/annulation, création de
             commande). Widget dashboard "Dû aux fournisseurs".
API          GET/POST /suppliers, GET/PATCH /suppliers/:id, POST
             /suppliers/:id/payments, GET/POST /purchase-orders, GET
             /purchase-orders/:id, POST /purchase-orders/:id/confirm,
             /receive, /cancel.
DATABASE     Migration `purchase_engine`, RLS standard, 44 tables au total.
SECURITY     Fail-closed : capability `purchases` désactivée par défaut →
             403 sur toute route. Annulation impossible après toute
             réception (même partielle) — évite un état incohérent entre
             stock déjà entré/dette déjà engagée et une commande "annulée".
TESTS        4 tests d'intégration dédiés + suite complète : 91/91 passent
             (87 précédents, aucune régression). Vérifié : fail-closed sans
             capability, séparation des permissions (magasinier ne peut pas
             créer de commande), cycle complet avec réception PARTIELLE puis
             totale (dette calculée exactement à chaque étape : 60000 après
             20/50 unités à 3000, puis 174000 au total), annulation refusée
             après réception partielle, sur-réception refusée, paiement
             plafonné au solde dû, commande DRAFT (jamais confirmée) reste
             annulable normalement.
VALIDATION   Vérifié manuellement de bout en bout via script contre l'API
             réelle AVANT les tests formels, PUIS navigateur réel
             (Playwright) : capability activée depuis Profil du commerce →
             menu "Fournisseurs" apparaît → création fournisseur → commande
             → confirmation → réception → dette affichée correctement →
             widget dashboard "Dû aux fournisseurs" mis à jour — zéro erreur
             console (une fausse alerte initiale provenait d'un mauvais
             sélecteur dans le script de test Playwright lui-même, pas du
             produit — corrigée et reproductible).
RESTANT      SupplierInvoice distinct de la commande ; conversion d'unité
             côté achats (actuellement toujours en unité de référence) ;
             produits non stockés commandés au fournisseur.
STATUT RÉEL  IMPLEMENTED, TESTED, VALIDATED.
```

### Order Engine (Phase 9/11)

```
OBJECTIF     Premier moteur métier construit selon la nouvelle règle de
             méthode (branche backend + branche produit ensemble, jamais
             l'une sans l'autre) — cf demande de continuation.
TRAVAIL      Order/OrderLine (migration + RLS), OrdersService (create,
EFFECTUÉ     list/getById avec scope RBAC réel, advance — machine à états
             simple DRAFT→CONFIRMED→PREPARING→READY —, recordDeposit,
             cancel, complete). Complete() délègue à SalesService.create
             plutôt que dupliquer stock/paiement/documents/événements :
             operationId de la vente = id de la commande (déterministe),
             donc une complétion rejouée après un incident partiel (vente
             créée, Order pas encore marqué COMPLETED) retrouve la même
             vente via l'idempotence déjà native de SalesService, jamais une
             deuxième. CapabilityGuard sur tout le contrôleur (`orders`),
             4 permissions dédiées (read/create/update/cancel), attribuées
             aux rôles-modèles existants (vendeur : tout sauf annulation).
             7 nouveaux types d'événements Outbox. Page web `/orders`
             complète (liste, création, boutons de progression contextuels
             au statut, acompte, finalisation).
API          POST/GET /orders, GET /orders/:id, POST /orders/:id/advance,
             /deposit, /complete, /cancel.
DATABASE     Migration `order_engine`, RLS standard, 39 tables au total.
SECURITY     Fail-closed : capability désactivée par défaut → 403 sur toute
             route /orders. Stock jamais décrémenté avant complétion réelle
             (vérifié par test : stock inchangé après création/confirmation/
             préparation, décrémenté seulement après complete()).
TESTS        4 tests d'intégration dédiés + suite complète : 87/87 passent
             (83 précédents, aucune régression). Cycle complet vérifié :
             capability désactivée par défaut, création sans effet sur le
             stock, progression DRAFT→READY, acompte plafonné au sous-total,
             READY ne peut plus "avancer" (doit être complété), complétion
             crée une vraie vente PAID avec le bon montant total, stock
             décrémenté exactement à la complétion, idempotence de la
             complétion (rejouée = même saleId), commande complétée non
             annulable, permission d'annulation réservée à l'encadrement.
VALIDATION   Vérifié manuellement de bout en bout via scripts contre l'API
             réelle AVANT d'écrire les tests formels, PUIS vérification
             navigateur réelle (Playwright) : capability activée depuis
             l'écran Profil du commerce → menu "Commandes" apparaît → cycle
             complet création→confirmation→préparation→prête→finalisation
             en vente, chaque transition reflétée dans l'UI — zéro erreur
             console.
RESTANT      Réservation de stock à la confirmation (PLANNED, Inventory 2.0,
             Phase 17) ; livraison/retrait après commande (Delivery Engine,
             dépendance déjà déclarée dans le ModuleRegistry) ; Widget Engine
             dashboard dédié aux commandes en attente par emplacement.
STATUT RÉEL  IMPLEMENTED, TESTED, VALIDATED.
```

### Phase 8 — Clôture (8.1 Configuration hiérarchique + 8.2 ModuleRegistry enrichi + finalisation 8.4)

```
PHASE       8 (Consolidation Configuration + RBAC + interface d'administration) — CLÔTURÉE
OBJECTIF    Terminer réellement les éléments restants de 8.4 (mot de passe personnel,
            invitations, scopes OWN_RECORDS/TEAM), puis construire 8.1 (résolution de
            configuration Tenant→Location) et 8.2 (dépendances entre modules), sans
            fabriquer de niveaux ou de concepts sans donnée réelle derrière.

ÉTAT AVANT
  - 8.4 (session précédente) : users/roles/permissions catalogués et testés (67/67),
    mais password change / invitations / OWN_RECORDS / TEAM listés PLANNED sans
    inspection réelle du code.
  - 8.1 : Configuration Engine tenant-only, aucune notion d'emplacement.
  - 8.2 : ModuleRegistry sans dépendances déclarables ni vérifiées ; setCapability/
    setModule/completeOnboarding n'écrivaient AUCUN événement d'audit (gap non détecté
    avant cette session).

TRAVAIL EFFECTUÉ
  8.4 :
  - PATCH /me/password (UsersService.changeOwnPassword) : exige le mot de passe actuel,
    aucune permission USERS_MANAGE requise (distinct de la réinitialisation admin),
    révoque tous les refresh tokens existants après changement.
  - Invitations par email (modèle Invitation + InvitationsService/Controller/Module) :
    POST /users/invitations (USERS_MANAGE) génère un token opaque à haute entropie
    (32 octets, haché sha256 en base — jamais en clair), retourné UNE fois à l'émetteur ;
    GET/POST /invitations/:tenantId/:token(/accept) PUBLICS (@Public(), tenantId explicite
    dans l'URL — même principe déjà établi pour /auth/refresh, jamais de recherche
    cross-tenant) ; expiration 7 jours ; DELETE /users/invitations/:id pour révoquer.
    L'envoi réel de l'email reste ABSTRAIT (pas de provider, Notification Engine PLANNED)
    — honnêteté délibérée : le flux token→acceptation est réellement vérifié de bout en
    bout, la livraison de l'email ne l'est pas et n'est jamais présentée comme telle.
  - Scopes OWN_RECORDS/TEAM RÉELLEMENT appliqués : RbacService.getRecordVisibility()
    (nouveau) résout, pour une permission donnée, l'union de tous les grants de
    l'utilisateur (ALL_LOCATIONS/LOCATIONS/OWN_RECORDS/TEAM) en un filtre consommable
    par un service de liste ; resolveTeamMemberUserIds() dérive "l'équipe" d'un scope
    TEAM comme les utilisateurs dont un rôle LOCATIONS chevauche les emplacements
    supervisés (décision de conception documentée en code, faute d'un modèle
    manager→subordonnés dans le schéma). Branché sur SalesService.list/getById.
    RbacService.can() corrigé : OWN_RECORDS/TEAM ne bloquent plus une CRÉATION (un
    enregistrement qui n'existe pas encore appartient par définition à son créateur) —
    seule leur VISIBILITÉ ultérieure est restreinte.

  8.1 :
  - SettingDefinition étend `allowLocationOverride` ; un seul paramètre l'utilise à ce
    jour (documents.receiptFooterText — un pied de reçu différent par magasin a un sens
    métier réel et immédiat, branché dans DocumentsService.createReceiptForSale).
  - Table LocationSetting (RLS identique aux autres tables tenant-scopées) ;
    ConfigurationService.getEffective(WithTx)/getAllEffectiveForLocation/setForLocation :
    résolution LocationSetting > TenantSetting > défaut catalogue.
  - PLATFORM/PLAN délibérément NON ajoutés : aucun Plan/Subscription réel n'existe
    encore (Platform Engine = liste des tenants actifs uniquement) — les fabriquer aurait
    créé une hiérarchie sans donnée derrière, contraire à la règle "jamais un paramètre
    décoratif". Explicitement différé à la Phase 25 (Platform/SaaS Billing).

  8.2 :
  - ModuleDefinition étend `dependencies?: string[]` ; exemple concret déclaré :
    delivery dépend de orders (cf continuation §13).
  - BusinessProfileService.setModule : activation refusée si une dépendance n'est pas
    RÉELLEMENT résolue active (capability + choix compris, pas le flag brut) ;
    désactivation refusée si un autre module encore actif en dépend.
  - BusinessProfileService.completeOnboarding (assistant en masse) : même validation
    mais simulée sur l'ÉTAT FINAL combiné (capabilities + modules du même appel) —
    activer "orders" ET "delivery" dans le MÊME appel réussit, alors qu'activer
    "delivery" seul sans "orders" déjà actif échoue.
  - Audit comblé : setCapability/setModule/completeOnboarding écrivent maintenant
    business_profile.capability.changed / .module.changed / .onboarding.completed
    dans l'Outbox (gap réel trouvé en auditant cette phase — ces actions sensibles
    n'étaient tracées nulle part avant).

BUGS RÉELS TROUVÉS ET CORRIGÉS EN SESSION
  1. RbacService.can() bloquait la CRÉATION de tout enregistrement (ex: une vente) dès
     qu'un grant OWN_RECORDS/TEAM existait pour la permission concernée — un vendeur
     scope OWN_RECORDS ne pouvait plus vendre du tout. Corrigé (cf ci-dessus) après
     détection via un test manuel de bout en bout (403 inattendu).
  2. UsersService.assignRole et InvitationsService.create ne conservaient
     scopeLocationIds QUE pour scopeType==='LOCATIONS', pas pour 'TEAM' — un scope TEAM
     assigné se retrouvait avec un périmètre vide (aucun "membre d'équipe" jamais résolu).
     Corrigé en généralisant la condition aux deux scopes qui utilisent des emplacements.
  3. completeOnboarding contournait entièrement les nouvelles vérifications de
     dépendances de modules (setModule() n'est pas appelé par ce chemin) — un tenant
     aurait pu activer "delivery" sans "orders" via l'assistant de configuration en masse.
     Corrigé en simulant l'état final avant d'écrire quoi que ce soit.

API          PATCH /me/password ; POST/GET /users/invitations, DELETE /users/invitations/:id ;
             GET /invitations/:tenantId/:token, POST .../accept (publiques) ;
             GET /settings/locations/:locationId, PUT /settings/locations/:locationId/:key ;
             GET/POST/PUT/DELETE /sales inchangés en contrat, mais désormais filtrés par
             scope RBAC réel côté serveur (pas de nouveau endpoint, comportement corrigé).
DATABASE     Migrations `invitations` (table Invitation + RLS) et `location_settings`
             (table LocationSetting + RLS) — additives, aucune donnée existante touchée.
             37 tables au total.
FRONTEND     Aucun changement d'UI cette phase (le focus était le backend/API) — la
             personnalisation de settings par emplacement et l'affichage des dépendances
             de modules dans l'assistant de configuration restent des écrans à construire
             (API déjà prête à les consommer). Assumé et documenté, pas caché.
SECURITY     Token d'invitation opaque haché (jamais en clair en base), tenantId explicite
             dans l'URL publique (pas de recherche cross-tenant), fail-closed maintenu sur
             tous les nouveaux scopes (aucun grant reconnu = aucun enregistrement visible).
RBAC         OWN_RECORDS et TEAM passent de PLANNED (fail-closed silencieux) à réellement
             appliqués et testés sur Sales.
CAPABILITIES Aucune nouvelle capability — travail sur le mécanisme de résolution/audit.
MODULES      ModuleRegistry enrichi de dépendances déclarables et vérifiées dans les deux
             sens (activation/désactivation), y compris sur l'onboarding en masse.
EVENTS       business_profile.capability.changed, business_profile.module.changed,
             business_profile.onboarding.completed, users.user.created,
             users.user.status_changed, users.role.assigned, users.role.removed,
             users.password.changed, users.invitation.created/.revoked/.accepted —
             tous vérifiés relayés jusqu'au journal d'audit (GET /audit) via le worker
             Outbox existant, sans modification de celui-ci.
TESTS        83 tests d'intégration (`npm run test:api:e2e`) : 83/83 — les 67 précédents
             (aucune régression) + 16 nouveaux (10 pour la finalisation 8.4, 6 pour
             8.1/8.2). Suite stable sur exécutions consécutives AVEC reseed entre
             chaque run (un test préexistant du describe "Unit / Conversion Engine",
             non lié à cette session, n'est pas idempotent sur deux runs SANS reseed —
             limitation déjà documentée en tête de fichier, pas une régression introduite
             ici).
VALIDATION   Chaque flux vérifié manuellement de bout en bout via des scripts Node contre
             l'API réelle AVANT d'écrire les tests formels (mot de passe temporaire → login
             réel, invitation → acceptation → login réel, OWN_RECORDS/TEAM → ventes créées
             par différents utilisateurs → visibilité vérifiée précisément). Vérification
             navigateur réelle (Playwright) : pages Profil du commerce / Utilisateurs &
             rôles / Configuration toujours fonctionnelles après tous ces changements,
             zéro erreur console.
RESTANT      ~~UI personnalisation settings par emplacement~~ (FAIT) ; ~~UI dépendances modules~~ (FAIT) ; UI affichant les
             dépendances de modules avant soumission ; envoi réel des emails d'invitation
             (Notification Engine) ; flux "mot de passe oublié" sans invitation ni admin
             disponible ; extension OWN_RECORDS/TEAM à d'autres ressources que Sales ;
             niveaux PLATFORM/PLAN de configuration (Phase 25) ; scénario de démonstration
             "Commerce informatique" (Tenant 2, cf continuation §25) délibérément NON
             fabriqué — activer aujourd'hui les capabilities orders/purchases/
             serial_numbers pour ce tenant n'illustrerait qu'un état visuel sans aucun
             moteur réel derrière (tous marqués `implemented:false`), contraire à la
             règle "une capability n'est active que si elle produit un comportement réel".
             Les scénarios Tenant A (boutique complète) et Tenant B / Beta Services
             (prestataire sans stock) restent les deux démonstrations honnêtes disponibles.
BLOCKERS     Aucun blocage technique. Le scénario Tenant 2 (informatique) est BLOQUÉ
             uniquement par l'absence de l'Order/Purchase/Serial Number Engine — pas un
             obstacle de cette phase, une dépendance légitime vers les phases suivantes.
PROCHAINE
ÉTAPE        Phase 11 — Order Engine (DRAFT→CONFIRMED→...→COMPLETED, réservation de
             stock, acomptes), en réutilisant les contrats déjà stabilisés (Sales,
             Inventory, Pricing, Credit, RBAC scope, Event/Outbox).
```

**Phase 8.4 (Gestion des utilisateurs et des rôles)** :
- Nouveaux modules `apps/api/src/users/` et `apps/api/src/roles/`, routes `/users/*` et `/roles/*`, protégées par les permissions déjà existantes `users.manage`/`roles.manage` (aucune nouvelle permission créée, propagée automatiquement aux rôles-modèles déjà seedés).
- `PERMISSIONS_CATALOG` ajouté à `packages/db/src/permissions.catalog.ts` (27 permissions avec libellé + groupe) pour que l'écran de gestion des rôles n'affiche jamais une clé technique brute à l'utilisateur.
- **Sécurité vérifiée et documentée** : la policy RLS de `Role`/`RolePermission` (`tenantId IS NULL OR tenantId = current_tenant`) autorise la LECTURE des rôles-modèles plateforme par tout tenant mais ne bloque PAS leur écriture au niveau base — un tenant pourrait en théorie modifier/supprimer un rôle partagé par tous les autres tenants. Protection ajoutée **applicativement** : `update`/`delete` re-filtrent explicitement par `tenantId` (jamais par `id` seul), renvoyant "introuvable" plutôt que "interdit" pour ne pas fuiter l'existence du rôle. Un rôle-modèle reste clonable (`POST /roles/:id/clone`) en un rôle propre au tenant, librement modifiable ensuite.
- Protection du dernier propriétaire actif : impossible de se désactiver soi-même, de désactiver le dernier compte actif portant le rôle `tenant_owner`, ou de lui retirer ce rôle si aucun autre propriétaire actif n'existe pour ce tenant — vérifié par 2 tests dédiés.
- Mot de passe temporaire généré côté serveur (16 octets aléatoires) si l'admin n'en fournit pas un à la création, renvoyé **une seule fois** dans la réponse HTTP, jamais journalisé ; vérifié qu'il permet réellement une connexion (`POST /auth/login` avec ce mot de passe).
- **Bug réel trouvé et corrigé en session** : `RolesService.create/update/clone` appelaient `this.getById(...)` (qui ouvre sa propre transaction via `PrismaTenantService.run`) DEPUIS L'INTÉRIEUR d'une transaction déjà ouverte — Prisma traite ça comme deux transactions indépendantes sur des connexions séparées du pool, la seconde ne voyant pas les écritures non committées de la première (`POST /roles` renvoyait systématiquement 404 "Rôle introuvable" juste après avoir réellement créé le rôle). Corrigé en extrayant une méthode privée `mapRole(tx, id)` prenant le `tx` en cours, jamais un nouvel appel à `db.run` imbriqué — même piège que celui déjà rencontré et évité dans `CashRegisterService`, reproduit puis corrigé ici. Leçon capitalisée : ne jamais appeler une méthode publique de service (qui ouvre son propre `db.run`) depuis l'intérieur d'un callback `db.run` déjà en cours.
- **Traçabilité (cf continuation §38)** : `users.user.created`, `users.user.status_changed`, `users.role.assigned`, `users.role.removed`, `roles.role.created`, `roles.role.updated` (avant/après des permissions), `roles.role.deleted` — tous écrits dans l'Outbox DANS la même transaction que l'action, jamais le mot de passe dans le payload. Vérifié de bout en bout : le worker Outbox→Audit existant les relaie sans modification nécessaire, visibles via `GET /audit` en quelques secondes.
- 67 tests d'intégration (`npm run test:api:e2e`) : **67/67 passent** — les 55 précédents (aucune régression) + 12 nouveaux couvrant permissions manquantes (403), création/doublon d'email (409), scope LOCATIONS sans emplacement (400), attribution/retrait de rôle, protection du dernier propriétaire (403/400), catalogue de permissions avec libellés, permission inconnue refusée à la création d'un rôle (400), cycle complet créer/modifier/supprimer un rôle personnalisé, protection des rôles-modèles (404 sur update ET delete), clonage d'un rôle-modèle en rôle indépendant modifiable, suppression refusée d'un rôle personnalisé en cours d'utilisation (409). Suite stable sur exécutions consécutives.
- Build API (`nest build`) et Web (`tsc -b && vite build`) : OK.
- Vérification navigateur réelle (Playwright) : page "Utilisateurs & rôles" — onglet Utilisateurs (tableau avec rôles/scope, création avec mot de passe temporaire affiché, attribution de rôle avec sélection d'emplacements) et onglet Rôles (rôles-modèles marqués "Modèle" avec seulement Cloner disponible, rôles personnalisés avec Modifier/Supprimer, création d'un rôle avec cases à cocher groupées par domaine) — aucune erreur console.
- **Incident d'environnement rencontré et contourné** : un processus tiers non identifiable avec certitude comme faisant partie de ce projet (format de réponse HTTP totalement étranger au code actuel, chemin de build `dist/src/main.js` obsolète depuis l'ajout de `rootDir` dans `tsconfig.build.json`) occupait le port 4000 après un redémarrage d'environnement, et le réoccupait après un premier nettoyage — au vu de la présence avérée d'un AUTRE projet utilisateur actif en parallèle sur cette machine (processus `pnpm dev` d'un dossier "gestion tresoriere" totalement indépendant), il n'a pas semblé prudent de retuer ce processus à l'aveugle une seconde fois. L'API et le serveur web de développement de cette session tournent donc sur les ports **4001**/**5180** (au lieu de 4000/5180) via `API_PORT`/`VITE_API_URL`, sans modifier la configuration par défaut du projet (`.env` non touché) — l'utilisateur doit vérifier de son côté ce qui occupe le port 4000 s'il souhaite revenir à la configuration standard.

**Phase 7 (Cash Register Engine + menu adaptatif par module)** :
- Migration `cash_register` appliquée : tables `CashSession`/`CashMovement`, colonne `Payment.cashSessionId` (nullable), index d'unicité PARTIEL `(tenantId, locationId) WHERE status='OPEN'` (empêche une double ouverture concurrente au niveau base, pas seulement applicatif), RLS sur les 2 nouvelles tables (33 tables au total).
- Nouvelles permissions `cash.session.read`/`cash.session.manage` ajoutées au catalogue et propagées aux rôles déjà seedés (Owner : tout ; Manager : read+manage ; Vendeur : read+manage sur son propre scope — un vendeur gère sa caisse quotidienne, ce n'est pas réservé à l'encadrement ; Finance : read seul ; Gestionnaire de dépôt : aucune, pas concerné).
- 55 tests d'intégration (`npm run test:api:e2e`) : **55/55 passent** — les 48 précédents (aucune régression) + 7 nouveaux : rôle sans permission refusé (403), absence de session initiale, ouverture + refus de double-ouverture (409, contrainte DB), rattachement automatique d'un paiement CASH à la session ouverte + écart de fermeture exactement nul quand comptage = attendu, écart non nul reflété tel quel sans blocage (manquant de 50), un utilisateur scope-limité à un autre emplacement ne peut ni ajouter un mouvement ni fermer une session hors de son périmètre (403, vérifié explicitement car l'id de session dans l'URL ne permet pas au guard générique de déduire l'emplacement), et une vente en espèces reste possible sans aucune session ouverte (pas de régression sur le comportement existant).
- **Piège Nest découvert et corrigé en session** : un contrôleur qui `return`-ne littéralement `null` produit un corps de réponse HTTP **vide** (zéro octet), pas la chaîne `"null"` — cassait `res.json()` côté client (test ET frontend) avec `SyntaxError: Unexpected end of JSON input`. Corrigé en enveloppant la réponse (`{ session: T | null }`) pour `GET /cash/sessions/current`, jamais un `null` nu en retour direct de handler.
- Menu adaptatif étendu : un item peut désormais dépendre d'un **module** résolu actif (`BusinessProfileService.getResolvedModules`), en plus de la capability et de la permission — combine capability-du-module ET choix explicite du tenant de le désactiver. Appliqué rétroactivement à `inventory`/`credit`/`pricing`/`reports` en plus du nouvel item `cash`.
- Vérification navigateur réelle (Playwright) : page `/cash` — ouverture d'une session (fond de caisse 5000), mouvement manuel de sortie (200, motif affiché dans l'historique), fermeture avec comptage exact (4800) affichant "Écart : 0 XOF (attendu 4800, compté 4800)" puis retour au formulaire d'ouverture — aucune erreur console.
- Build API (`nest build`) et Web (`tsc -b && vite build`) : OK. Suite e2e stable sur deux exécutions consécutives contre la même base.
- **Résidu opérationnel découvert et nettoyé en session** : un ancien processus serveur zombie (build obsolète, structure `dist/src/main.js` d'avant l'ajout de `rootDir` dans `tsconfig.build.json`, format de réponse d'erreur non reconnu dans le code actuel) occupait encore le port 4000 après un redémarrage de l'environnement. Arrêté et les deux serveurs de dev relancés proprement — aucun changement de code lié à cet incident, seulement une leçon opérationnelle : après un redémarrage d'environnement, vérifier qu'un port répond avec le format de réponse attendu avant de supposer que "ça tourne" suffit.

**Phase 6 (Business Profile / Capabilities / Modules)** :
- Migration `business_profile` appliquée (RLS sur `BusinessProfile`/`TenantCapability`/`TenantModule`, 31 tables au total).
- 48 tests d'intégration (`npm run test:api:e2e`) : **48/48 passent** — les 35 précédents (aucune régression) + 13 nouveaux : lecture du profil/catalogue permissionnée (403 sans SETTINGS_READ), contexte résolu conforme aux défauts de Boutique Alpha (BOUTIQUE, capabilities fonctionnelles à `true`), désactivation de `inventory` → 403 sur `/inventory/*` + `isStocked` forcé à `false` à la création (lecture `/locations` non affectée), désactivation de `customer_credit` → 403 sur `/credit/*` + refus de toute vente à solde dû même avec client sélectionné (vente intégralement payée toujours acceptée), désactivation de `custom_pricing` → 403 sur `/pricing/*` + un prix négocié existant cesse immédiatement de s'appliquer (défense en profondeur, pas juste blocage de nouvelles créations), désactivation de `services` → 400 à la création d'un produit SERVICE, désactivation de `multiple_locations` → 403 fail-closed sur `POST /locations` (guard global, pas une règle de contrôleur), menu adaptatif qui masque/réaffiche "Stock" en direct selon la capability, et le scénario Commerce C complet sur le Tenant B reconfiguré ("Beta Services" : `inventory=false`, `customer_credit=false`, `services=true` — vente de service intégralement payée acceptée sans jamais toucher au stock, vente à crédit refusée, `/inventory/*` refusé, menu sans Stock ni Crédit clients).
- Build API (`nest build`) et Web (`tsc -b && vite build`) : OK. Suite e2e stable sur deux exécutions consécutives contre la même base (pas de pollution d'état entre runs, réapprovisionnement défensif dans les tests qui consomment du stock partagé).
- Vérification navigateur réelle (Playwright) : page `/settings/business-profile` affiche les 3 blocs (type de commerce, 14 capabilities avec les 9 non implémentées grisées "(bientôt disponible)" et non cochables, modules optionnels avec dépendance à une capability visible et désactivée si la capability manque) — aucune erreur console. Test d'interaction bout en bout : décocher "Gestion de stock" → Enregistrer → la sidebar perd l'entrée "Stock" immédiatement (sans re-login, via un rafraîchissement explicite du menu) → recocher → l'entrée "Stock" revient.
- Seed (`packages/db/src/seed.ts`) mis à jour : `resetTenant()` nettoie désormais aussi `TenantCapability`/`TenantModule`/`BusinessProfile` ; Tenant A reçoit un profil "BOUTIQUE" (capabilities laissées à leurs défauts, aucune ligne `TenantCapability` créée) ; Tenant B est reconfiguré en "Beta Services" (profil "SERVICES", `inventory`/`customer_credit`/`custom_pricing` explicitement désactivés, catalogue remplacé par un produit SERVICE "Réparation ordinateur").

**Phase 1** :
- Build API (`nest build`) : OK. Type-check Web (`tsc -b --noEmit`) : OK.
- Vérification navigateur réelle (Playwright) : login, menu dynamique par permission, création de vente complète avec reçu, refus RBAC affiché proprement dans l'UI — captures d'écran, aucune erreur console.
- Vérification manuelle via `curl`/`psql` : RLS active sur 18 tables, `app_runtime` sans `BYPASSRLS`, isolation cross-tenant (404), refus de permission (403), refus de scope de localisation (403), idempotence (1 seule ligne en base pour un `operationId` rejoué).

**Phase 2 (Document + Payment)** :
- Migration `payment_and_document` appliquée avec RLS sur les 2 nouvelles tables (`Document`, `DocumentSequence`), vérifiée (20 tables au total).
- 12 tests d'intégration (`npm run test:api:e2e`) : **12/12 passent** — les 9 précédents + 3 nouveaux (paiement partiel avec `paymentStatus`/`balanceDue` corrects et document généré, refus du sur-paiement, numérotation séquentielle par emplacement sur deux ventes successives).
- Vérification manuelle : vente avec paiement partiel Mobile Money (2000/4800 XOF) → `paymentStatus: PARTIAL`, document `7594BE-000001` généré, PDF valide (1 page, contenu vérifié) téléchargé via `GET /documents/:id/pdf`.
- Vérification navigateur réelle (Playwright) : formulaire de vente avec case "paiement intégral" décochée, sélection Mobile Money + montant partiel, reçu affiché avec statut/solde dû, bouton "Voir le reçu (PDF)" — aucune erreur console.

**Phase 5 (Catalog Engine — extension)** :
- Migration `catalog_extension` appliquée avec RLS sur `ProductBarcode`/`BundleComponent` (28 tables au total).
- 35 tests d'intégration (`npm run test:api:e2e`) : **35/35 passent** — les 29 précédents + 6 nouveaux (SERVICE force `isStocked=false`, code-barres unique par tenant avec conflit 409 et recherche fonctionnelle, 404 si code inconnu, permission requise pour créer un BUNDLE, bundle sans composant refusé à la vente, vente d'un bundle décrémente chaque composant proportionnellement en une seule ligne de vente visible).
- Vérification manuelle end-to-end : bundle "Kit Ménage" (1 Huile + 2 Savons) vendu ×3 → 1 seule ligne de vente, grandTotal correct, stock Huile -3 et Savon -6, le bundle lui-même n'a jamais eu de ligne de stock propre.
- Vérification navigateur réelle (Playwright) : page Catalogue avec formulaire de création (type/marque), détails dépliables par produit (codes-barres, composants de bundle) — aucune erreur console.

**Phase 4 (Configuration + Unit/Conversion)** :
- Migrations `tenant_settings` et `unit_conversion` appliquées avec RLS (26 tables au total).
- 29 tests d'intégration (`npm run test:api:e2e`) : **29/29 passent** — les 19 précédents + 10 nouveaux (Configuration Engine : lecture/écriture permissionnée, valeurs par défaut, désactivation d'un moyen de paiement bloque son usage, clé inconnue refusée, stock négatif togglable avec restauration automatique de l'état pour ne pas polluer les autres tests, crédit-sans-client togglable ; Unit/Conversion Engine : vente en carton convertie en pièces pour le stock avec prix/pricing cohérents, unité non déclarée refusée, permission requise pour déclarer une unité, nouvelle unité immédiatement utilisable).
- Vérification manuelle end-to-end : désactivation de MOBILE_MONEY bloque une vente avec cette méthode (400), réactivation du stock négatif permet une vente au-delà du disponible et le stock devient effectivement négatif, vente de 2 cartons de riz décrémente 20 pièces (pas 2) avec le bon prix par palier de quantité recalculé en unité de référence.
- Vérification navigateur réelle (Playwright) : page Configuration affiche/modifie les 5 paramètres avec effet réel, sélecteur d'unité dans le formulaire de vente peuple dynamiquement les unités alternatives déclarées pour le produit sélectionné — aucune erreur console.
- Bug de seed découvert et corrigé : le script n'était pas idempotent pour `TenantSetting` (paramètres modifiés manuellement persistaient entre exécutions du seed), ce qui a fait échouer plusieurs tests avant correction — leçon : toute nouvelle table tenant-scopée doit être ajoutée à `resetTenant()` dans `packages/db/src/seed.ts`.

**Phase 3 (Pricing + Credit + sécurité)** :
- Migrations `pricing_and_credit` et `least_privilege_roles` (+ correctif `fix_worker_audit_grant`) appliquées, RLS vérifiée sur les 4 nouvelles tables métier (24 tables au total).
- **Bug réel trouvé et corrigé en cours de session** : `Prisma.Decimal#isPositive()` (decimal.js) retourne `true` pour zéro (vérifie le signe, pas la stricte positivité) — provoquait un rejet systématique de toute vente sans client dès que le solde dû était calculé exactement à 0, et aurait créé des `CreditMovement` fantômes de montant 0. Corrigé partout (`sales.service.ts`) par `.greaterThan(0)`/`.lessThanOrEqualTo(0)`. Leçon capitalisée en mémoire (`decimaljs_ispositive_gotcha`).
- **Bug de seed corrigé** : le script de seed créait un nouveau tenant à chaque exécution au lieu d'être idempotent (accumulation de doublons "Boutique Alpha/Beta"). Corrigé par des IDs de tenant fixes + réinitialisation complète en début de script ; vérifié par double exécution consécutive (reste à 2 tenants).
- **Bug de permissions Postgres trouvé et corrigé** : le rôle `worker_runtime` avec seulement `INSERT` sur `AuditLog` échouait (`permission denied`) car Prisma `.create()` génère toujours un `RETURNING`, qui exige aussi `SELECT`. Corrigé par migration additive. Leçon capitalisée en mémoire (`prisma_least_privilege_returning_gotcha`).
- 19 tests d'intégration (`npm run test:api:e2e`) : **19/19 passent** — les 12 précédents + 7 nouveaux (régression exacte du bug isPositive, prix négocié appliqué, palier de quantité appliqué, vente à crédit sans client refusée, dette enregistrée + limite de crédit bloquante, remboursement + refus de sur-remboursement, refus RBAC sur l'enregistrement d'un remboursement par un vendeur).
- Vérification manuelle end-to-end : vente à crédit pour "Kadi Traoré" (limite 50000 XOF) avec prix négocié Huile 1L et palier de quantité Riz 5kg, dépassement de limite correctement bloqué avec message explicite, remboursement partiel qui réduit le solde.
- Vérification navigateur réelle (Playwright) : pages Tarification et Crédit clients affichent les données réelles de l'API (prix négocié, palier, comptes créditeurs), aucune erreur console.
- Vérification post-migration sécurité : pipeline vente → événement outbox → journal d'audit re-testé de bout en bout avec `worker_runtime` (plus aucune connexion superuser hors migrations), 0 événement non traité en base après traitement.
