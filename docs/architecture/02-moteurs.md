# 02 — Catalogue des moteurs (Architecture complète des moteurs)

Chaque moteur est documenté selon le gabarit imposé : Nom, Objectif, Responsabilités, Données utilisées, Dépendances, API internes, Événements produits, Événements consommés, Règles importantes, Risques.

Convention de nommage des événements : `domaine.entite.action` au passé (ex: `sales.sale.completed`). Convention API interne : ce sont des appels de fonction/service in-process en V1 (mono-base), conçus comme s'ils étaient déjà des appels réseau (payloads sérialisables, pas de partage d'objets mutables) pour permettre une extraction future en service séparé sans réécriture.

---

## 1. Platform Engine

- **Objectif** : administrer la plateforme SaaS elle-même (au-dessus des tenants) : entreprises inscrites, plans, licences, facturation SaaS, activation/suspension.
- **Responsabilités** : cycle de vie des tenants (création, suspension, résiliation), gestion des plans et fonctionnalités activables, facturation de l'abonnement SaaS, quotas globaux, supervision multi-tenant pour l'équipe interne (support, ops).
- **Données utilisées** : `platform_tenants`, `platform_plans`, `platform_subscriptions`, `platform_invoices`, `platform_feature_flags`.
- **Dépendances** : aucune dépendance descendante ; c'est la racine. Dépend uniquement du Payment Engine (pour encaisser l'abonnement SaaS lui-même, en tant que client de sa propre plateforme ou via un PSP externe).
- **API internes** : `createTenant()`, `suspendTenant()`, `changePlan()`, `checkQuota(tenantId, quotaKey)`, `isFeatureEnabled(tenantId, featureKey)`.
- **Événements produits** : `platform.tenant.created`, `platform.tenant.suspended`, `platform.subscription.renewed`, `platform.subscription.expired`, `platform.plan.changed`.
- **Événements consommés** : `payment.saas_invoice.paid` (déclenche réactivation), `payment.saas_invoice.failed` (déclenche relance puis suspension après délai de grâce).
- **Règles importantes** : un tenant suspendu passe en lecture seule (pas de perte de données, blocage des écritures) avant suppression définitive après un délai contractuel ; changer de plan ne doit jamais supprimer de données déjà créées, seulement bloquer la création de nouvelles si quota dépassé.
- **Risques** : logique de facturation SaaS mêlée à la logique métier du tenant si mal isolée ; à garder strictement séparée du Payment Engine « métier » (celui qui encaisse les clients du tenant).

---

## 2. Tenant Engine

- **Objectif** : matérialiser et faire respecter l'isolation multi-tenant à travers tout le système.
- **Responsabilités** : création de la structure initiale d'un tenant (magasin par défaut, caisse par défaut, rôles-modèles), résolution du contexte tenant à chaque requête, application de la Row-Level Security.
- **Données utilisées** : `tenants`, et injecte `tenant_id` comme filtre implicite sur toutes les tables métier.
- **Dépendances** : Platform Engine (existence et statut du tenant).
- **API internes** : `resolveTenantContext(request) -> TenantContext`, `bootstrapTenant(tenantId)`.
- **Événements produits** : `tenant.provisioned`, `tenant.deprovisioned`.
- **Événements consommés** : `platform.tenant.created`.
- **Règles importantes** : toute connexion DB applicative exécute `SET app.current_tenant_id = :id` avant toute requête ; aucune requête métier n'est légale sans ce contexte positionné.
- **Risques** : voir `01-analyse-risques.md` §5.2 (fuite inter-tenant) — c'est le risque n°1 de tout le système.

---

## 3. Identity / Security Engine

- **Objectif** : authentifier les utilisateurs et les appareils, gérer les sessions et leur cycle de vie.
- **Responsabilités** : inscription/invitation d'utilisateurs, authentification (mot de passe, éventuellement MFA), gestion des sessions et tokens (access/refresh), enregistrement et révocation des appareils (desktop), rotation des secrets.
- **Données utilisées** : `users`, `credentials`, `sessions`, `devices`, `mfa_factors`.
- **Dépendances** : Tenant Engine (un utilisateur appartient à un tenant, sauf les comptes plateforme internes).
- **API internes** : `authenticate(credentials) -> Session`, `refreshToken(refreshToken)`, `registerDevice(tenantId, userId, deviceFingerprint)`, `revokeDevice(deviceId)`, `revokeSession(sessionId)`.
- **Événements produits** : `identity.user.created`, `identity.user.login_succeeded`, `identity.user.login_failed`, `identity.device.registered`, `identity.device.revoked`, `identity.session.revoked`.
- **Événements consommés** : `platform.tenant.suspended` (révoque toutes les sessions actives du tenant).
- **Règles importantes** : un appareil révoqué doit être bloqué à la prochaine tentative de synchronisation, pas seulement à la prochaine connexion interactive ; les tokens ont une durée de vie courte (access token) + rotation (refresh token) ; verrouillage progressif après tentatives échouées.
- **Risques** : gestion naïve des sessions offline (un token désynchronisé peut rester valide localement plus longtemps que voulu) — voir `07-securite.md`.

---

## 4. RBAC / Permission Engine

- **Objectif** : décider, pour un utilisateur donné, une action donnée, sur une ressource donnée, dans un contexte donné (magasin/dépôt), si l'action est autorisée.
- **Responsabilités** : définition des permissions atomiques (`module.ressource.action`), gestion des rôles (rôles-modèles + rôles personnalisés par tenant), attribution de scope (ALL_LOCATIONS, une ou plusieurs locations, OWN_RECORDS, TEAM), évaluation rapide (`can(user, permission, context)`).
- **Données utilisées** : `permissions` (catalogue statique versionné dans le code), `roles`, `role_permissions`, `user_roles`, `permission_scopes`.
- **Dépendances** : Tenant Engine, Identity Engine.
- **API internes** : `can(userId, permissionKey, context) -> boolean`, `getEffectivePermissions(userId) -> PermissionSet`, `getVisibleMenu(userId) -> MenuTree` (utilisé par le Frontend pour l'UI adaptative, voir `03-architecture-web.md`).
- **Événements produits** : `rbac.role.created`, `rbac.role.updated`, `rbac.user_role.assigned`, `rbac.user_role.revoked`.
- **Événements consommés** : aucun (source de vérité).
- **Règles importantes** : le catalogue des permissions atomiques est **codé et versionné** (pas configurable en base librement) pour rester cohérent avec le code qui les vérifie réellement ; ce qui est configurable, c'est la composition en rôles et l'attribution de scope. Toute vérification de permission se fait côté serveur, jamais uniquement côté UI (l'UI adaptative n'est qu'un confort, pas un mécanisme de sécurité).
- **Risques** : dérive entre permissions déclarées et permissions réellement vérifiées dans le code (mitigé par des tests d'intégration qui parcourent chaque endpoint et vérifient qu'il appelle bien `can()`).

Voir le détail complet du modèle de permissions dans `08-roles-permissions.md`.

---

## 5. Configuration Engine

- **Objectif** : permettre à chaque tenant d'adapter le comportement du système sans toucher au code.
- **Responsabilités** : stockage hiérarchique de configuration (plateforme → plan → tenant → magasin), résolution de la configuration effective, exposition d'un « feature toggle » par module.
- **Données utilisées** : `tenant_settings` (clé/valeur typée + JSON pour les structures complexes : modes de paiement actifs, devises, taxes, unités, règles de workflow).
- **Dépendances** : Tenant Engine, Platform Engine (pour savoir ce que le plan autorise de configurer).
- **API internes** : `getSetting(tenantId, key, contextOverrides)`, `setSetting(tenantId, key, value)`, `isModuleEnabled(tenantId, moduleKey)`.
- **Événements produits** : `config.setting.changed`, `config.module.enabled`, `config.module.disabled`.
- **Événements consommés** : `platform.plan.changed` (peut désactiver des modules non couverts par le nouveau plan).
- **Règles importantes** : aucune règle métier ne doit être codée en dur si elle est raisonnablement variable d'un tenant à l'autre (taux de taxe, mode de numérotation des documents, unité par défaut) — c'est le principe directeur de tout le projet (§7 de la vision).
- **Risques** : sur-configuration qui rend le système imprévisible à débugger ; contre-mesure = toute configuration a une valeur par défaut sûre et est documentée avec son impact.

---

## 6. Catalog Engine

- **Objectif** : représenter tout ce qui peut être vendu ou acheté (produit physique, service, produit virtuel, bundle).
- **Responsabilités** : gestion des produits, variantes, attributs, catégories, marques, codes-barres/SKU, produits composés/bundles, produits non stockés (commande directe fournisseur), cycle de vie (brouillon/actif/archivé).
- **Données utilisées** : `products`, `product_variants`, `product_attributes`, `categories`, `brands`, `barcodes`, `bundles`, `bundle_items`.
- **Dépendances** : Unit/Conversion Engine (chaque produit a une unité de référence), Tenant Engine.
- **API internes** : `createProduct()`, `getProduct(id)`, `searchProducts(query, filters)`, `resolveBundleComponents(bundleId, qty)`.
- **Événements produits** : `catalog.product.created`, `catalog.product.updated`, `catalog.product.archived`, `catalog.variant.created`.
- **Événements consommés** : aucun (source de vérité pour le référentiel produit).
- **Règles importantes** : un produit ne peut pas être supprimé physiquement s'il a été référencé dans une vente/commande (suppression logique uniquement, cf. §32) ; un produit « non stocké » (commande fournisseur à la vente) doit être identifiable explicitement pour que le Sales Engine ne bloque pas sur un contrôle de stock.
- **Risques** : explosion du nombre d'attributs/variantes si le modèle attribut n'est pas conçu en EAV léger dès le départ (voir `03-modele-donnees.md`).

---

## 7. Unit / Conversion Engine

- **Objectif** : gérer les unités de mesure et leurs conversions (carton/pièce, kg/g, litre/ml, etc.).
- **Responsabilités** : définition d'unités de base et d'unités dérivées avec facteur de conversion, résolution d'un prix/stock exprimé dans une unité de vente différente de l'unité de stock.
- **Données utilisées** : `units`, `unit_conversions` (unité source, unité cible, facteur, produit ou global).
- **Dépendances** : aucune (moteur bas niveau, utilitaire pur).
- **API internes** : `convert(quantity, fromUnit, toUnit, productId?) -> quantity`, `getSellableUnits(productId) -> Unit[]`.
- **Événements produits** : `unit.conversion_rule.created`.
- **Événements consommés** : aucun.
- **Règles importantes** : une conversion peut être spécifique à un produit (1 carton de ce produit = 24, mais un autre produit = 12) ; toujours stocker la quantité en unité de référence du stock en interne, convertir seulement à l'affichage/saisie.
- **Risques** : erreurs d'arrondi cumulées sur des conversions en chaîne — utiliser une arithmétique décimale exacte (jamais de float binaire) pour toutes les quantités et tous les montants.

---

## 8. Pricing Engine

- **Objectif** : déterminer le prix applicable à une ligne de vente donnée, de façon déterministe et traçable.
- **Responsabilités** : gestion des listes de prix (standard, grossiste, revendeur, contractuel), prix par palier de quantité, promotions, prix négociés ponctuels, résolution de la règle prioritaire.
- **Données utilisées** : `price_lists`, `price_list_items`, `customer_price_groups`, `quantity_breaks`, `promotions`, `promotion_rules`.
- **Dépendances** : Catalog Engine, Customer (groupes clients), Configuration Engine (devise, période active).
- **API internes** : `resolvePrice(productId, customerId, quantity, locationId, atDate) -> PriceResolution { unitPrice, appliedRule, discounts[] }`.
- **Événements produits** : `pricing.price_list.updated`, `pricing.promotion.activated`, `pricing.promotion.expired`.
- **Événements consommés** : `catalog.product.archived` (désactive les entrées de prix associées).
- **Règles importantes** : la résolution de prix est une **fonction pure et traçable** — le résultat doit indiquer *quelle règle* a été appliquée et pourquoi (audit et support client) ; l'ordre de priorité des règles est configurable mais doit avoir un ordre par défaut documenté (ex: prix négocié client > promotion > palier de quantité > liste de prix du groupe client > prix standard).
- **Risques** : règles de prix contradictoires non détectées à la configuration (ex: deux promotions actives incompatibles) — prévoir une validation à la création d'une règle qui alerte sur les chevauchements.

---

## 9. Inventory Engine

- **Objectif** : connaître à tout instant l'état réel et engagé du stock, par produit, par emplacement, par lot/série si applicable.
- **Responsabilités** : suivi des quantités (physique, réservée, disponible, en transit, bloquée, endommagée), mouvements (entrée, sortie, ajustement, transfert), réservations et leur expiration, inventaires physiques et écarts, valorisation du stock (FIFO/CUMP configurable), gestion des lots et dates d'expiration, numéros de série.
- **Données utilisées** : `stock_levels` (par produit × emplacement), `stock_movements` (journal append-only), `stock_reservations`, `lots`, `serial_numbers`, `stock_valuations`.
- **Dépendances** : Catalog Engine, Unit/Conversion Engine, Location (magasins/dépôts, partie de l'organisation du Tenant Engine).
- **API internes** : `getAvailable(productId, locationId)`, `reserve(productId, locationId, qty, refType, refId)`, `releaseReservation(reservationId)`, `commitMovement(type, lines[])`, `transfer(fromLocation, toLocation, lines[])`.
- **Événements produits** : `inventory.stock.updated`, `inventory.stock.low`, `inventory.movement.created`, `inventory.transfer.created`, `inventory.transfer.received`, `inventory.count.adjusted`.
- **Événements consommés** : `sales.sale.completed` (décrémente), `sales.sale.cancelled` / `sales.return.created` (incrémente), `purchase.receipt.completed` (incrémente).
- **Règles importantes** : `stock_movements` est **append-only**, jamais modifié ni supprimé (source de vérité pour reconstituer `stock_levels` à tout moment — c'est un event-sourcing partiel appliqué au stock, voir `03-modele-donnees.md`) ; `disponible = physique - réservé - bloqué` doit toujours être recalculable à partir du journal.
- **Risques** : sur-vente en environnement offline multi-poste (assumé, cf. `01-analyse-risques.md` §1.4 et §6) ; dérive entre `stock_levels` (cache) et le journal `stock_movements` si un correctif manuel est fait directement sur le cache — interdire toute écriture directe sur `stock_levels`, uniquement via mouvements.

---

## 10. Sales Engine

- **Objectif** : orchestrer une vente de bout en bout comme une opération métier cohérente et transactionnelle.
- **Responsabilités** : création de vente (comptant, crédit, partiel), application des prix/taxes/remises, décrémentation du stock, encaissement, mise à jour de la créance si besoin, déclenchement de la génération de document, gestion des retours/avoirs.
- **Données utilisées** : `sales`, `sale_lines` (avec snapshot prix/taxe/nom produit), `sale_payments`, `returns`, `return_lines`.
- **Dépendances** : Catalog, Pricing, Inventory, Customer, Payment, Credit, Cash Register, Document, Tax, Delivery/Pickup.
- **API internes** : `createSale(cart, customerId, locationId, paymentPlan) -> Sale`, `cancelSale(saleId, reason)`, `createReturn(saleId, lines[], reason)`.
- **Événements produits** : `sales.sale.created`, `sales.sale.completed`, `sales.sale.cancelled`, `sales.return.created`.
- **Événements consommés** : `payment.payment.completed` (si le paiement se fait en flux séparé, ex: mobile money asynchrone).
- **Règles importantes** : voir `01-analyse-risques.md` §4.1 — la vente est une transaction SQL unique qui couvre stock + créance + caisse, avec publication d'événements via outbox ; une vente confirmée est immuable dans ses lignes (une correction passe par un avoir/retour, jamais une édition rétroactive).
- **Risques** : couplage excessif si le Sales Engine réimplémente la logique des moteurs dépendants au lieu de les appeler — discipline d'architecture à faire respecter en revue de code.

---

## 11. Order Engine

- **Objectif** : gérer le cycle de vie d'une commande client, distinct d'une vente immédiate.
- **Responsabilités** : brouillon → confirmée → en préparation → prête → livrée/retirée → terminée, avec possibilité d'annulation ou de retour selon l'état ; réservation de stock associée à la confirmation.
- **Données utilisées** : `orders`, `order_lines`, `order_status_history`.
- **Dépendances** : Inventory (réservation), Customer, Sales (une commande terminée peut se transformer en vente ou générer un paiement), Delivery/Pickup.
- **API internes** : `createOrder()`, `confirmOrder(orderId)`, `transitionStatus(orderId, newStatus)`, `cancelOrder(orderId)`.
- **Événements produits** : `order.order.created`, `order.order.confirmed`, `order.order.ready`, `order.order.completed`, `order.order.cancelled`.
- **Événements consommés** : `inventory.stock.updated` (peut déclencher une notification « produit à nouveau disponible » pour une commande en attente).
- **Règles importantes** : machine à états stricte — les transitions non autorisées sont rejetées explicitement (pas de saut d'état silencieux) ; chaque transition est journalisée dans `order_status_history` avec qui/quand.
- **Risques** : confusion fonctionnelle Order vs Sale si l'équipe produit ne clarifie pas où s'arrête l'un et commence l'autre — règle retenue : Order = engagement/promesse, Sale = transaction financière effective (peut y avoir un Sale sans Order pour une vente comptoir directe, et un Order qui génère un Sale à la livraison).

---

## 12. Purchase Engine

- **Objectif** : gérer le cycle d'achat auprès des fournisseurs.
- **Responsabilités** : demande d'achat, commande fournisseur, réception (totale/partielle), facture fournisseur, mise à jour de la dette fournisseur, retours fournisseur.
- **Données utilisées** : `suppliers`, `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `supplier_invoices`, `supplier_prices`.
- **Dépendances** : Catalog, Inventory (réception = mouvement d'entrée), Payment/Credit (dette fournisseur), Supplier.
- **API internes** : `createPurchaseOrder()`, `receiveGoods(poId, lines[])`, `recordSupplierInvoice()`, `paySupplier()`.
- **Événements produits** : `purchase.order.created`, `purchase.receipt.completed`, `purchase.invoice.recorded`.
- **Événements consommés** : aucun.
- **Règles importantes** : une réception partielle laisse la commande fournisseur dans un état « partiellement reçue », traçable ligne par ligne ; le prix fournisseur au moment de la réception est snapshoté (pour la valorisation de stock), indépendamment du prix négocié plus tard.
- **Risques** : désynchronisation entre quantité commandée et quantité facturée si les écarts de réception ne sont pas explicitement gérés (sur-réception, sous-réception).

---

## 13. Payment Engine

- **Objectif** : encaisser et rembourser, indépendamment du canal (espèces, mobile money, carte, virement, chèque).
- **Responsabilités** : abstraction des méthodes de paiement configurables par tenant, gestion des statuts (pending, completed, failed, refunded), paiements partiels et multiples sur une même transaction, remboursements.
- **Données utilisées** : `payment_methods` (config tenant), `payments`, `payment_allocations` (répartition d'un paiement sur une ou plusieurs ventes/factures).
- **Dépendances** : Cash Register (si espèces), Credit Engine (si le paiement solde une créance).
- **API internes** : `recordPayment(amount, method, targetType, targetId)`, `refund(paymentId, amount, reason)`, `getPaymentStatus(paymentId)`.
- **Événements produits** : `payment.payment.created`, `payment.payment.completed`, `payment.payment.failed`, `payment.refund.completed`.
- **Événements consommés** : webhooks externes des PSP (mobile money/carte) traduits en `payment.payment.completed` ou `.failed` de façon asynchrone.
- **Règles importantes** : un paiement électronique asynchrone démarre en statut `pending` et n'est réputé encaissé qu'à confirmation (webhook ou vérification active) — ne jamais considérer une vente soldée tant que le paiement est `pending`.
- **Risques** : rapprochement bancaire non trivial si le PSP ne notifie pas de façon fiable — prévoir une vérification active périodique en filet de sécurité (voir manque identifié en `01-analyse-risques.md` §2).

---

## 14. Credit / Debt Engine

- **Objectif** : suivre les créances clients et les dettes fournisseurs dans le temps.
- **Responsabilités** : solde par client/fournisseur, échéances, historique de mouvements de créance, relances, statut (à jour, en retard, en contentieux).
- **Données utilisées** : `credit_accounts`, `credit_movements` (append-only), `payment_terms`.
- **Dépendances** : Customer, Supplier, Sales, Purchase, Payment.
- **API internes** : `getBalance(accountId)`, `recordDebit(accountId, amount, refType, refId)`, `recordCredit(accountId, amount, refType, refId)`, `getOverdueAccounts(locationId)`.
- **Événements produits** : `credit.balance.updated`, `credit.account.overdue`.
- **Événements consommés** : `sales.sale.completed` (si vente à crédit), `payment.payment.completed` (réduit la créance).
- **Règles importantes** : le solde est toujours recalculable à partir du journal `credit_movements` (append-only, même logique que le stock) ; une limite de crédit configurable par client peut bloquer une nouvelle vente à crédit (règle métier configurable, pas codée en dur).
- **Risques** : incohérence si un paiement et une vente à crédit ne sont pas traités dans la même transaction (cf §4.1 du document risques).

---

## 15. Cash Register Engine

- **Objectif** : gérer le cycle de vie d'une session de caisse physique.
- **Responsabilités** : ouverture (fond de caisse déclaré), enregistrement des mouvements (ventes espèces, entrées, sorties, retraits, dépôts), clôture avec calcul de l'écart entre solde attendu et solde réel compté.
- **Données utilisées** : `cash_registers`, `cash_sessions`, `cash_movements`.
- **Dépendances** : Payment Engine (source des encaissements espèces), Location.
- **API internes** : `openSession(registerId, openingFloat)`, `recordMovement(sessionId, type, amount)`, `closeSession(sessionId, countedAmount)`.
- **Événements produits** : `cash.session.opened`, `cash.session.closed`, `cash.session.discrepancy_detected`.
- **Événements consommés** : `payment.payment.completed` (méthode = espèces).
- **Règles importantes** : une session ne peut pas être rouverte après clôture (une correction se fait par un mouvement d'ajustement journalisé, pas par réédition de l'historique) ; un écart significatif déclenche automatiquement une alerte (Automation Engine).
- **Risques** : caisse partagée par plusieurs vendeurs sans session individuelle — décision produit à trancher (une session par caissier vs une session par poste physique).

---

## 16. Document Engine

- **Objectif** : générer tout document commercial à partir de données transactionnelles snapshotées, selon un modèle personnalisable.
- **Responsabilités** : génération de reçu, facture, devis, proforma, bon de livraison, bon de commande, avoir, reçu de paiement ; gestion de templates par tenant ; numérotation (voir règle §5.4 du document risques) ; export PDF/impression.
- **Données utilisées** : `document_templates`, `documents` (snapshot JSON du contenu au moment de l'émission + métadonnées), `document_sequences`.
- **Dépendances** : Sales, Order, Purchase, Payment (lecture seule, en aval), Configuration (mode de numérotation, mentions légales).
- **API internes** : `generateDocument(type, sourceType, sourceId, templateId?) -> Document`, `renderPdf(documentId)`, `voidDocument(documentId, reason)`.
- **Événements produits** : `document.document.generated`, `document.document.voided`.
- **Événements consommés** : `sales.sale.completed`, `purchase.receipt.completed`, `payment.payment.completed`.
- **Règles importantes** : un document généré est un **snapshot immuable** (JSON figé du contenu) — si le produit ou le client change de nom après coup, le document déjà émis ne change pas (cf §32 de la vision) ; l'annulation d'un document ne le supprime jamais, elle crée un état « annulé » traçable.
- **Risques** : numérotation légale en environnement distribué (voir `01-analyse-risques.md` §5.4) — risque majeur documenté, pas résolu magiquement.

---

## 17. Delivery / Pickup Engine

- **Objectif** : gérer l'acheminement d'une commande vers le client, par livraison ou par retrait.
- **Responsabilités** : suivi du cycle (préparation, transfert entre emplacements, notification, remise au client), gestion des points de retrait multiples, éventuelle gestion de tournées/livreurs (V2).
- **Données utilisées** : `fulfillments`, `fulfillment_status_history`, `pickup_points`.
- **Dépendances** : Order, Inventory (transfert entre dépôts), Notification Engine.
- **API internes** : `createFulfillment(orderId, method, targetLocation)`, `updateFulfillmentStatus()`.
- **Événements produits** : `fulfillment.fulfillment.ready`, `fulfillment.fulfillment.delivered`, `fulfillment.fulfillment.picked_up`.
- **Événements consommés** : `order.order.confirmed`, `inventory.transfer.received`.
- **Règles importantes** : le retrait dans un point différent du point de vente d'origine implique un transfert de stock inter-dépôts explicite, jamais une simple mise à jour de statut sans mouvement de stock réel.
- **Risques** : périmètre V1 à limiter (livraison simple + retrait) ; la gestion avancée de tournées/logistique est un module futur (`10-evolutivite.md`).

---

## 18. Automation Engine (Rules Engine)

- **Objectif** : permettre des règles `EVENT → CONDITION → ACTION` configurables sans code.
- **Responsabilités** : définition de règles par tenant, évaluation des conditions à réception d'un événement, exécution de l'action (appel d'API interne d'un autre moteur) avec garde-fous (permission de l'automatisation elle-même, limite de fréquence).
- **Données utilisées** : `automation_rules`, `automation_executions` (journal des déclenchements).
- **Dépendances** : Event Engine (écoute), tous les moteurs métier (exécute des actions via leurs API internes, jamais d'accès direct à leur base).
- **API internes** : `registerRule(trigger, conditions, actions)`, `evaluateAndExecute(event)`.
- **Événements produits** : `automation.rule.executed`, `automation.rule.failed`.
- **Événements consommés** : tous les événements métier pertinents (`inventory.stock.low`, `order.order.ready`, `payment.payment.completed`, etc.).
- **Règles importantes** : une action déclenchée automatiquement s'exécute avec les permissions d'un « compte système » explicite et journalisé (jamais en usurpant les permissions de l'utilisateur qui a causé l'événement d'origine) ; boucles infinies interdites — une action ne doit pas pouvoir redéclencher indéfiniment son propre trigger (détection de cycle + limite de profondeur).
- **Risques** : effets de bord difficiles à auditer si les règles sont trop puissantes — limiter le catalogue d'actions possibles à une liste blanche explicite par moteur, pas un accès générique à toute l'API interne.

---

## 19. Event Engine (Bus d'événements)

- **Objectif** : découpler les moteurs producteurs des moteurs consommateurs.
- **Responsabilités** : réception des événements depuis l'outbox transactionnel, distribution fiable aux abonnés (Automation, Audit, Reporting, Search, Sync, Notification), gestion de la relecture en cas d'échec d'un consommateur.
- **Données utilisées** : `outbox_events`, `event_subscriptions`, `event_delivery_log`.
- **Dépendances** : lit l'outbox alimenté par tous les autres moteurs.
- **API internes** : `publish(event)` (utilisé uniquement en interne par le worker outbox, jamais appelé directement par un moteur métier — c'est la table outbox qui fait foi), `subscribe(eventPattern, handler)`.
- **Événements produits** : n'en produit pas lui-même, il relaie.
- **Événements consommés** : tous.
- **Règles importantes** : livraison **at-least-once** — tout consommateur doit être idempotent (rejouer un événement déjà traité ne doit pas doubler son effet) ; ordre garanti seulement *par entité* (les événements concernant une même vente arrivent dans l'ordre), pas globalement.
- **Risques** : accumulation de retard si un consommateur est lent/en panne — isoler chaque abonné dans sa propre file pour qu'un consommateur défaillant ne bloque pas les autres.

---

## 20. Reporting / Analytics Engine

- **Objectif** : répondre aux questions d'analyse métier (ventes, marges, stock, créances) sans jamais écrire dans les données transactionnelles.
- **Responsabilités** : agrégation en tables de faits alimentées par les événements, exposition d'un moteur de requêtes dynamique (dimensions × mesures × filtres) plutôt que des rapports statiques figés.
- **Données utilisées** : `fact_sales`, `fact_stock_valuation`, `fact_cash_sessions`, `fact_credit` (tables dénormalisées en lecture), jamais d'écriture sur les tables source.
- **Dépendances** : Event Engine (source d'alimentation), RBAC (filtrage par scope).
- **API internes** : `query(dimensions[], measures[], filters[], dateRange) -> ResultSet`.
- **Événements produits** : aucun.
- **Événements consommés** : `sales.sale.completed`, `inventory.movement.created`, `payment.payment.completed`, `credit.balance.updated`, etc.
- **Règles importantes** : toute requête de reporting applique le même filtrage de permission/scope que les API transactionnelles (cf risque §7.2 du document risques) — jamais un accès « admin par défaut » sous prétexte que c'est de la lecture seule.
- **Risques** : dérive entre les tables de faits et la réalité si un événement est manqué — prévoir un job de réconciliation périodique qui recalcule un échantillon et alerte sur écart.

---

## 21. Search Engine

- **Objectif** : recherche globale rapide et pertinente à travers produits, clients, fournisseurs, commandes, ventes, factures.
- **Responsabilités** : indexation incrémentale alimentée par les événements, recherche full-text + filtres, reconnaissance de quelques intentions simples (« ventes aujourd'hui », « stock faible », « clients qui doivent ») routées vers le Reporting Engine plutôt que vers l'index texte.
- **Données utilisées** : index dédié (Postgres full-text en V1, migrable vers un moteur dédié si le volume l'exige), pas de table métier propre.
- **Dépendances** : Event Engine, RBAC (les résultats sont filtrés par scope avant retour).
- **API internes** : `search(query, tenantId, userScope) -> Results`.
- **Événements produits** : aucun.
- **Événements consommés** : tous les événements `*.created` / `*.updated` des entités indexables.
- **Règles importantes** : jamais de résultat exposé hors du scope de permission de l'utilisateur, même si l'entité existe et matche la requête textuellement.
- **Risques** : latence d'indexation (l'entité créée n'apparaît pas instantanément dans la recherche) — acceptable si documenté, sinon prévoir une indexation synchrone pour les cas critiques.

---

## 22. Assistant Engine (IA)

- **Objectif** : offrir une interface en langage naturel qui agit **via** les moteurs métier, jamais en les court-circuitant.
- **Responsabilités** : compréhension d'intention, résolution vers un outil (tool call) précis, vérification de permission avant exécution, demande de confirmation pour les actions sensibles, restitution du résultat réel.
- **Données utilisées** : aucune donnée métier persistée par l'assistant lui-même ; contexte conversationnel court terme uniquement (non source de vérité).
- **Dépendances** : RBAC (vérification systématique), API internes de tous les moteurs (en lecture et écriture selon permission), jamais d'accès direct à la base de données.
- **API internes** : expose un catalogue d'outils typés, un par capacité métier exposée (`getStockLevel`, `createSale`, `getCustomerBalance`, etc.), chacun mappé 1:1 sur une API interne déjà sécurisée par ailleurs.
- **Événements produits** : `assistant.action.executed`, `assistant.action.denied`.
- **Événements consommés** : aucun (agit à la demande).
- **Règles importantes** : toute action sensible (suppression, annulation, remboursement, changement de prix) passe par une étape de confirmation explicite affichée à l'utilisateur avant exécution ; l'assistant ne doit jamais formuler de réponse chiffrée (stock, prix, solde) sans l'avoir obtenue d'un appel d'outil dans le tour de conversation courant.
- **Risques** : injection de prompt via des données utilisateur affichées à l'assistant (ex: nom de produit contenant une instruction) — traiter toute donnée métier retournée par les outils comme donnée, jamais comme instruction, cf. consignes système génériques.

---

## 23. Hardware Engine

- **Objectif** : abstraire les périphériques (imprimantes, scanners, lecteurs codes-barres, balances, tiroirs-caisse, RFID) derrière une interface unique.
- **Responsabilités** : détection et configuration des périphériques par poste, pilotes/adapters par fabricant, file d'impression, gestion des erreurs matérielles.
- **Données utilisées** : `device_hardware_profiles` (config locale par poste, pas tenant-wide).
- **Dépendances** : s'exécute côté Desktop Local Core essentiellement (le Web peut piloter certains périphériques via WebUSB/WebSerial de façon plus limitée).
- **API internes** : `print(documentId, printerProfile)`, `readBarcode() -> code`, `readScale() -> weight`, `openCashDrawer()`.
- **Événements produits** : `hardware.device.error`, `hardware.print.completed`.
- **Événements consommés** : `document.document.generated` (déclenche l'impression automatique si configuré).
- **Règles importantes** : chaque adapter respecte une interface commune par catégorie de périphérique, pour ajouter un nouveau fabricant sans toucher au code métier appelant.
- **Risques** : hétérogénéité matérielle très large en environnements réels — prioriser les périphériques les plus demandés (imprimante ticket, scanner USB générique) avant les cas de niche (RFID).

---

## 24. Notification Engine

- **Objectif** : notifier les bonnes personnes au bon moment, tous canaux confondus.
- **Responsabilités** : notifications internes (in-app), email, SMS, push, éventuelles intégrations externes (WhatsApp Business API), gestion des préférences par utilisateur, anti-spam (regroupement, limite de fréquence).
- **Données utilisées** : `notification_templates`, `notifications`, `notification_preferences`.
- **Dépendances** : Event Engine, Configuration (canaux activés par tenant).
- **API internes** : `notify(userId|role|customerId, templateKey, payload, channels[])`.
- **Événements produits** : `notification.sent`, `notification.failed`.
- **Événements consommés** : `order.order.ready`, `inventory.stock.low`, `credit.account.overdue`, `automation.rule.executed` (actions de type notification).
- **Règles importantes** : jamais de donnée sensible (montant de crédit, contenu financier détaillé) en clair dans une notification push si le canal n'est pas garanti sécurisé — préférer un lien vers l'app authentifiée.
- **Risques** : coût et fiabilité des canaux externes (SMS/WhatsApp) variables selon pays — prévoir un fournisseur abstrait (interface commune, implémentation branchable).

---

## 25. Backup / Recovery Engine

- **Objectif** : garantir qu'aucune donnée n'est perdue durablement, côté cloud comme côté desktop.
- **Responsabilités** : sauvegardes automatiques chiffrées de la base cloud (continues + point-in-time recovery), sauvegarde de la base locale chiffrée du desktop, vérification périodique de restaurabilité (pas seulement de complétion du job).
- **Données utilisées** : métadonnées de sauvegarde (`backup_jobs`, `backup_verifications`), pas de table métier.
- **Dépendances** : infrastructure de stockage (hors périmètre applicatif), Observability Engine (alerte si échec).
- **API internes** : `triggerBackup()`, `verifyBackup(backupId)`, `restoreToPointInTime(timestamp)` (opération administrative sensible, jamais exposée à un tenant directement).
- **Événements produits** : `backup.completed`, `backup.failed`, `backup.verification.failed`.
- **Événements consommés** : aucun (tâche planifiée).
- **Règles importantes** : une sauvegarde non vérifiée n'est pas une sauvegarde fiable — un test de restauration automatisé doit tourner régulièrement, pas seulement à la demande en cas d'incident.
- **Risques** : coût de stockage croissant avec la rétention — définir une politique de rétention dégressive (quotidien 30j, hebdomadaire 6 mois, mensuel 3 ans) dès la conception.

---

## 26. Observability Engine

- **Objectif** : donner une visibilité opérationnelle sur la santé du système (pas sur les données métier des tenants).
- **Responsabilités** : logs structurés, métriques (latence API, taux d'erreur, profondeur des files d'événements), traces distribuées, santé de la base/queue/sync, alerting.
- **Données utilisées** : infrastructure d'observabilité (hors modèle de données métier).
- **Dépendances** : instrumente transversalement tous les moteurs (sans créer de dépendance métier inverse).
- **API internes** : `recordMetric()`, `logStructured()`, `healthCheck(component)`.
- **Événements produits** : `observability.alert.triggered`.
- **Événements consommés** : métriques techniques de tous les moteurs.
- **Règles importantes** : aucune donnée sensible (mot de passe, contenu de carte, montant précis lié à un client identifiable) ne doit apparaître en clair dans un log (cf §36 de la vision) — masquage systématique des champs sensibles à la source du log.
- **Risques** : sur-instrumentation qui dégrade la performance — échantillonnage des traces en production à volume élevé.

---

## 27. Audit Engine

- **Objectif** : répondre de façon fiable à « qui a fait quoi, quand, sur quoi, avant/après, depuis quel appareil ».
- **Responsabilités** : consommation de tous les événements métier pertinents, écriture d'un journal d'audit immuable avec diff avant/après pour les modifications, mise à disposition d'une consultation filtrable pour les administrateurs.
- **Données utilisées** : `audit_log` (append-only, partitionné par tenant et par mois).
- **Dépendances** : Event Engine (consommateur), RBAC (qui peut consulter l'audit).
- **API internes** : `queryAuditLog(filters)`.
- **Événements produits** : aucun (c'est un puits, pas une source).
- **Événements consommés** : tous les événements de mutation (`*.created`, `*.updated`, `*.deleted`, `*.cancelled`).
- **Règles importantes** : écriture asynchrone via l'outbox pour ne jamais ralentir la transaction métier (cf §7.4 du document risques) ; le journal d'audit lui-même n'est jamais modifiable, y compris par un super-admin (seule une purge légale documentée et elle-même auditée est possible).
- **Risques** : volumétrie — partitionnement et politique de rétention/archivage à froid dès la conception, pas en rattrapage.

---

## 28. Sync Engine (spécifique Desktop)

- **Objectif** : réconcilier l'état local d'un poste desktop avec l'état cloud, dans les deux sens, de façon fiable et idempotente.
- **Responsabilités** : réplication descendante partielle et pertinente (catalogue actif, clients actifs, stock des emplacements rattachés), file sortante (Outbox local) des opérations effectuées hors ligne, application ordonnée au serveur, détection et remontée des conflits.
- **Données utilisées** : `local_outbox`, `local_inbox_cursor`, `sync_conflicts`.
- **Dépendances** : toutes les API tenant côté serveur (en tant que client), Identity Engine (authentification de l'appareil).
- **API internes** : `pushOutbox()`, `pullChanges(sinceCursor)`, `resolveConflict(conflictId, resolution)`.
- **Événements produits** : `sync.push.completed`, `sync.pull.completed`, `sync.conflict.detected`.
- **Événements consommés** : côté serveur, tous les événements pertinents pour la réplication descendante.
- **Règles importantes** : voir `06-offline-sync.md` pour le détail complet (idempotence par `operation_id`, ordre causal par entité, résolution de conflit non silencieuse).
- **Risques** : c'est le moteur le plus complexe du système après Sales — à ne construire qu'une fois le noyau serveur stabilisé (cf recommandation méthode §9 du document risques).
