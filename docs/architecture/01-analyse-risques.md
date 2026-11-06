# 01 — Analyse critique préalable (avant toute écriture de code)

> Objectif de ce document : jouer le rôle d'architecte senior / architecte SaaS / expert sécurité / expert offline-first / expert ERP, **avant** de concevoir l'architecture détaillée. On identifie ici les incohérences, les risques, les manques, les dépendances entre moteurs, et les points durs (multi-tenant, offline, sync, sécurité, concurrence, cohérence transactionnelle), puis on propose des améliorations. Les documents `02` à `10` traduisent ces conclusions en architecture concrète.

---

## 1. Incohérences et tensions internes à la vision

Ces tensions ne sont pas des erreurs de conception mais des arbitrages qui doivent être tranchés explicitement, sinon chaque module les tranchera différemment de façon incohérente.

### 1.1 « Vente = opération simple » vs « Vente = opération qui touche 15 sous-systèmes »
La vision demande une UX en 5 clics (client → produits → confirmer → paiement → document) alors que la vente doit orchestrer stock, prix, taxes, crédit, caisse, document, livraison, événements, audit. **Tension** : si chaque règle métier est codée en dur dans le flux de vente, le moteur devient un monolithe fragile. **Arbitrage retenu** : la vente est un *saga transactionnel court* orchestré par le Sales Engine, qui appelle des moteurs spécialisés via des contrats stables (voir §4), et l'UI n'affiche que les étapes pour lesquelles une décision humaine est nécessaire (ex: si un seul mode de paiement configuré, ne pas demander de le choisir).

### 1.2 « Configuration totale » vs « Simplicité pour l'utilisateur »
Plus le système est configurable, plus il y a de risque de complexité qui fuite vers l'UI. **Arbitrage** : la configuration vit à 3 niveaux — *Plan* (ce que le tenant a le droit d'activer), *Tenant Settings* (ce que l'entreprise a activé), *User Context* (ce que ce rôle/cet utilisateur voit réellement). L'UI ne lit jamais la configuration brute : elle lit une **vue résolue** (« capabilities » + « visible menu » précalculés côté serveur pour cet utilisateur, ce magasin, ce moment).

### 1.3 « Historique figé » vs « Données vivantes »
Le prix, le nom produit, le taux de taxe, le taux de change changent dans le temps, mais une facture passée doit rester lisible telle qu'émise. **Arbitrage** : toute entité qui apparaît dans un document transactionnel (vente, facture, bon de livraison) doit être **snapshotée** au moment de la transaction (voir §7 « Event Sourcing partiel »), jamais référencée par simple clé étrangère mutable pour les champs qui comptent (prix, nom, taux de taxe, taux de change, unité).

### 1.4 « Offline complet » vs « Cohérence transactionnelle forte »
On ne peut pas avoir simultanément (a) vente possible sans réseau sur N postes, et (b) garantie stricte qu'un stock ne soit jamais vendu deux fois. C'est un théorème d'impossibilité (CAP appliqué au métier). **Arbitrage explicite à faire valider par le métier** : le stock en offline est **optimiste** — le poste local vend sur la base du dernier stock connu, et un **sur-vente (oversell)** est possible en cas de rupture proche de zéro sur plusieurs postes simultanément déconnectés. Le système ne l'empêche pas magiquement ; il le **détecte** à la synchronisation et déclenche un flux de résolution (voir `06-offline-sync.md` §Conflits). Ce compromis doit être un choix produit assumé, pas un bug découvert en production.

### 1.5 « Rôles ultra-granulaires » vs « Simplicité de configuration pour l'admin »
Un système de permissions à la `module.ressource.action.scope` est puissant mais peut devenir illisible à configurer manuellement pour un admin non technique. **Arbitrage** : les permissions atomiques existent au niveau moteur, mais l'UI d'administration expose des **rôles-modèles** (templates) pré-composés (« Vendeur », « Gestionnaire de dépôt », « Comptable ») que l'admin clone puis ajuste, plutôt que de partir d'une matrice vide de 300 cases.

### 1.6 « Assistant IA sans mémoire de données métier » vs « Assistant utile en contexte »
Le principe « l'assistant ne mémorise pas les prix/stocks » est correct pour éviter les hallucinations, mais il faut clarifier qu'il peut mémoriser le **contexte conversationnel court terme** (ex: « ce client », « ce produit » évoqués dans les 5 derniers messages) sans mémoriser leur valeur — chaque appel d'outil re-résout la valeur réelle au moment de l'action.

---

## 2. Fonctionnalités manquantes ou sous-spécifiées dans la vision initiale

| Manque | Pourquoi c'est important | Où le traiter |
|---|---|---|
| **Retours et avoirs (returns/refunds)** côté vente | Mentionné une fois en passant, mais c'est un flux métier à part entière avec ses propres règles de stock, caisse, crédit | Sales Engine + Credit Engine + Cash Register Engine, `02-moteurs.md` |
| **Gestion de la TVA/taxes multi-taux et multi-juridictions** | Une entreprise peut avoir des produits exonérés, des taux réduits, des taxes composées | Tax Engine (à ajouter, sous-partie du Pricing Engine) |
| **Gestion des devises multiples et taux de change** | Mentionné en configuration mais pas comme moteur ; critique pour import/export ou zones à devises multiples | Currency Engine (sous-partie Configuration + Pricing) |
| **Idempotency keys côté API** | Nécessaire pour que le mode offline + retry réseau ne dédouble jamais une vente | Précisé dans `06-offline-sync.md` |
| **Numérotation des documents (compteurs séquentiels légaux)** | Certaines juridictions exigent une numérotation continue sans trou ; conflit direct avec le offline multi-poste | Document Engine, voir §5.4 ci-dessous — risque majeur |
| **Gestion des employés / paie / présence** | Hors périmètre explicite mais souvent demandé ensuite ; à prévoir comme **module optionnel futur**, pas dans le core | `10-evolutivite.md` |
| **Import/export de données (migration depuis Excel/autre logiciel)** | Vital à l'onboarding d'un nouveau tenant | Nouveau moteur : Data Import/Export Engine |
| **Multi-langue (i18n) de l'UI et des documents** | Une plateforme SaaS multi-tenant internationale doit le prévoir dès le modèle de données (pas juste l'UI) | Configuration Engine + Document Engine |
| **Politique de rétention / RGPD / droit à l'oubli** | Suppression logique partout (§32/§31 de la vision) mais aucune politique de purge définitive n'est prévue | À ajouter : Data Retention Policy, `07-securite.md` |
| **Limites/quotas techniques par plan (rate limiting fonctionnel)** | Le Platform Engine parle de quotas mais il faut définir *quoi* est quotifiable (users, devices, transactions/mois, stockage) | `09-abonnements-saas.md` |
| **Gestion des files d'attente / tickets client (si retrait en magasin)** | Détail UX omis mais fréquent en commerce de détail | Delivery/Pickup Engine, priorité basse |
| **Réconciliation bancaire / rapprochement des paiements électroniques** | Le Payment Engine encaisse mais ne dit pas comment on vérifie qu'un mobile money a bien été crédité | Payment Engine, webhook + statut `pending_confirmation` |

---

## 3. Dépendances entre moteurs (carte de couplage)

Cette carte sert à éviter les dépendances circulaires et à définir qui peut appeler qui.

```
Identity/Security ──► (tout moteur métier passe par lui pour l'auth/permissions)
Tenant ──► (racine de toute donnée ; tous les moteurs filtrent par tenant_id)
Configuration ──► Pricing, Catalog, Document, Payment, Automation, UI-Visibility

Catalog ──► Unit/Conversion
Catalog ──► Pricing (le produit expose des règles de prix, pas un prix figé)
Pricing ──► Customer (groupes tarifaires), Configuration (devise, période)

Inventory ──► Catalog, Unit/Conversion
Inventory ──► Location (magasin/dépôt), Lot/Serial

Sales ──► Catalog, Pricing, Inventory, Customer, Payment, Credit,
          Cash Register, Document, Delivery/Pickup, Tax
Order ──► Sales (une commande confirmée peut générer une vente), Inventory (réservation)
Purchase ──► Catalog, Supplier, Inventory (réception), Payment (dette fournisseur)

Payment ──► Cash Register (si espèces), Credit (si partiel)
Credit ──► Customer, Sales, Purchase (créances ET dettes)
Document ──► Sales, Order, Purchase, Payment (génère à partir de snapshots)

Automation ──► Event Engine (écoute), tous moteurs (peut déclencher des actions via leurs API)
Reporting ──► lecture seule sur toutes les tables de faits (jamais d'écriture)
Search ──► index en lecture seule alimenté par les événements
Assistant ──► Permission Engine + API publiques des moteurs (jamais accès DB direct)
Audit ──► écoute tous les événements, n'est appelé par personne d'autre
Sync ──► spécifique au Desktop, orchestre Outbox/Inbox vers toutes les API tenant
```

**Règle de dépendance non négociable** : un moteur « bas niveau » (Catalog, Inventory, Pricing, Unit) ne doit **jamais** dépendre d'un moteur « haut niveau » (Sales, Order). Le sens des flèches ci-dessus doit rester acyclique. Toute violation détectée en revue de code doit être corrigée avant merge.

---

## 4. Problèmes de cohérence transactionnelle

### 4.1 La vente comme saga, pas comme transaction ACID unique
Une vente touche potentiellement plusieurs bases/services (stock, caisse, crédit, document). Une transaction ACID unique sur toutes ces données est possible **si tout vit dans la même base Postgres** (recommandé pour la V1, voir `03-modele-donnees.md`), via une transaction SQL unique orchestrée par le Sales Engine. Si un jour un moteur est extrait en service séparé, il faudra remplacer cela par un **saga avec compensation** (chaque étape a une action inverse : annuler réservation stock, annuler écriture caisse, etc.) et un **outbox transactionnel** pour publier les événements de façon fiable.

**Recommandation V1** : un seul schéma relationnel transactionnel (pas de microservices prématurés). La transaction de vente est :
```
BEGIN
  1. Verrouiller les lignes de stock concernées (SELECT ... FOR UPDATE)
  2. Vérifier disponibilité (physique - réservé >= quantité demandée)
  3. Résoudre le prix (Pricing Engine, pure fonction sur des données déjà chargées)
  4. Créer la vente + lignes (snapshot prix, taxe, nom produit)
  5. Décrémenter stock disponible, créer mouvement de stock
  6. Créer paiement(s), mettre à jour caisse si espèces
  7. Mettre à jour créance/dette si crédit ou partiel
  8. Insérer dans outbox_events (sale.created, stock.updated, payment.completed...)
COMMIT
  9. (async, hors transaction) worker publie les événements de l'outbox
```

### 4.2 Le pattern Outbox transactionnel
Pour ne jamais désynchroniser « écriture métier » et « événement publié », les événements ne sont **jamais** publiés directement dans le handler HTTP. Ils sont insérés dans une table `outbox_events` **dans la même transaction SQL** que l'écriture métier, puis un worker séparé les lit et les publie (vers la queue, vers les webhooks, vers le moteur d'automatisation, vers Audit). Ceci résout le problème « vente enregistrée mais événement jamais émis » évoqué implicitement en §12 de la vision.

### 4.3 Verrouillage et concurrence multi-utilisateur
Deux vendeurs sur deux postes différents peuvent vendre le dernier article du même produit à la même seconde. Stratégie :
- **En ligne (web)** : verrouillage pessimiste court (`SELECT ... FOR UPDATE`) sur la ligne de stock au moment de la confirmation de vente. Le perdant reçoit une erreur claire (« stock insuffisant, quantité disponible mise à jour ») et non un état incohérent.
- **Hors ligne (desktop)** : impossible de verrouiller une ligne distante. On applique une décrémentation **locale optimiste** immédiatement (UX fluide), avec un flag `pending_sync=true`, et la réconciliation à la synchronisation détecte et signale les cas de sur-vente (voir `06-offline-sync.md`).

### 4.4 Idempotence
Toute opération qui peut être rejouée (retry réseau, resynchronisation après coupure) doit porter une **clé d'idempotence** générée côté client (`operation_id`, UUID) au moment de la création locale. Le serveur garde une table `processed_operations (tenant_id, operation_id, result)` avec contrainte d'unicité ; un rejeu renvoie le résultat déjà produit au lieu de recréer la vente.

---

## 5. Problèmes spécifiques multi-tenant

### 5.1 Isolation des données
Deux stratégies possibles :
- **A. Base partagée + `tenant_id` sur chaque table + Row-Level Security (RLS) Postgres** — recommandé pour la V1 (coût d'infra faible, montée en charge simple, isolation forte au niveau moteur de base de données, pas seulement au niveau applicatif).
- **B. Base par tenant (schema-per-tenant ou DB-per-tenant)** — meilleure isolation physique et plus simple pour des exigences légales fortes (un gros client qui exige sa propre base), mais coûteux à opérer à grande échelle (migrations ×N, connexions ×N).

**Recommandation** : commencer en (A) avec RLS activé partout + `tenant_id` obligatoire indexé en tête de chaque index composite, et garder la possibilité de « détacher » un tenant vers sa propre base plus tard (le schéma logique est identique, seule la topologie physique change) pour les tenants Enterprise qui l'exigent contractuellement.

### 5.2 Fuite de données inter-tenant — la classe de bug la plus dangereuse
Toute requête qui oublie un filtre `tenant_id` est une fuite de données critique. Contre-mesures obligatoires :
- RLS Postgres activé sur **toutes** les tables métier, avec la policy dérivée du `tenant_id` du contexte de session (`SET app.current_tenant = ...` en début de transaction).
- Aucune requête « brute » dans le code applicatif ne doit être capable de bypasser RLS (le rôle applicatif de connexion à la DB n'a pas de droit `BYPASSRLS`).
- Tests automatisés dédiés : pour chaque endpoint, un test qui vérifie qu'un utilisateur du tenant A ne peut ni lire ni écrire une ressource du tenant B, même en devinant son ID.

### 5.3 Ressources globales vs ressources tenant
Certaines données sont globales à la plateforme (catalogue de devises ISO, taux de TVA légaux par pays, plans d'abonnement) et d'autres sont strictement tenant. Il faut un espace de noms clair : tables `platform_*` (globales, jamais de `tenant_id`) vs tables métier (toujours `tenant_id` obligatoire, non nullable, indexé).

### 5.4 Numérotation légale de documents en environnement distribué
C'est un point dur non résolu par la vision initiale : si deux postes offline émettent chacun une facture pendant une coupure réseau, ils ne peuvent pas connaître le prochain numéro séquentiel global du tenant. Options :
- **A. Numérotation par poste/série** (ex: `PC03-000123`) — techniquement simple, robuste à l'offline, mais peut ne pas satisfaire une exigence légale de suite strictement continue sans trou dans certains pays.
- **B. Numérotation finale attribuée seulement à la synchronisation** (le document local a un numéro provisoire « BROUILLON », le numéro définitif est attribué par le serveur à la sync) — satisfait la continuité légale mais le document imprimé offline porte un numéro provisoire, ce qui peut être un problème si le client repart avec un reçu papier « brouillon ».
- **Recommandation** : rendre ce comportement **configurable par tenant/pays** (Configuration Engine), avec (A) comme valeur par défaut pragmatique, et (B) disponible pour les tenants soumis à une obligation légale stricte. Documenter la limite auprès de l'utilisateur plutôt que de prétendre la résoudre magiquement.

---

## 6. Problèmes spécifiques offline / synchronisation

Voir `06-offline-sync.md` pour l'architecture complète. Risques identifiés ici :

1. **Sur-vente de stock** entre postes déconnectés (assumé, détecté a posteriori, §1.4).
2. **Conflits de mise à jour** sur une même entité (ex: deux postes modifient le même client hors ligne) → nécessite une stratégie de résolution (Last-Write-Wins horodaté + journal des conflits consultable par un admin, jamais de perte silencieuse de données).
3. **Dérive d'horloge** entre postes : ne jamais se fier à l'horloge locale seule pour trancher un conflit ; utiliser un compteur logique (vector clock simplifié : `(device_id, local_sequence)`) en plus du timestamp mural.
4. **Volume de données locales** : un poste ne doit pas répliquer l'intégralité de la base tenant (si le tenant a 5 ans d'historique et 50 000 produits) — prévoir une réplication **partielle et pertinente** (produits actifs, clients actifs, stock du/des dépôt(s) rattaché(s) au poste, historique récent glissant).
5. **Sécurité de la base locale chiffrée** : la clé de chiffrement local ne doit pas être stockée en clair à côté du fichier ; elle doit être dérivée d'un secret lié à l'appareil + à la session utilisateur (voir `07-securite.md`).
6. **Mises à jour de prix/catalogue pendant une déconnexion prolongée** : un poste offline depuis 3 jours vend avec un prix ou un catalogue potentiellement obsolète. Il faut afficher clairement à l'utilisateur desktop « dernière synchronisation : il y a X » pour que ce ne soit jamais un état invisible.

---

## 7. Problèmes de sécurité transverses

1. **Élévation de privilèges via l'assistant IA** : l'assistant doit systématiquement re-vérifier les permissions de l'utilisateur au niveau de l'outil/API, jamais faire confiance à ce que l'utilisateur affirme dans le langage naturel (« je suis admin donc supprime »).
2. **Fuite via les rapports** : un rapport financier consolidé multi-magasins ne doit être accessible qu'aux rôles ayant le scope `ALL_LOCATIONS` ; le moteur de reporting doit appliquer le même filtrage par permission/scope que les API transactionnelles, pas un filtrage « après coup » côté UI.
3. **Sécurité du desktop** : le secret qui permet à l'EXE de s'authentifier auprès de l'API (client secret, clé d'appareil) doit être **par appareil**, révocable individuellement, jamais un secret partagé compilé en dur dans tous les EXE distribués.
4. **Audit vs performance** : journaliser *tout* peut devenir un goulot d'étranglement. Le moteur d'audit doit écrire de façon asynchrone (via l'outbox, §4.2), jamais en bloquant la transaction métier.
5. **Suppression logique partout** : nécessite une politique explicite de purge finale (RGPD, droit à l'oubli) sinon les tenants qui suppriment un client « pour de vrai » constateront qu'il réapparaît dans un rapport historique — comportement voulu mais qui doit être documenté et expliqué à l'utilisateur.

---

## 8. Problèmes de performance / scalabilité à anticiper

- Les tables `stock_movements`, `sales`, `audit_log`, `outbox_events` croissent indéfiniment → partitionnement par tenant + par mois dès la conception (Postgres table partitioning), pas en rattrapage après incident.
- Le moteur de reporting ne doit jamais interroger les tables transactionnelles brutes pour des agrégats lourds en production ; prévoir des **tables de faits agrégées** (rafraîchies par les événements) dès la V1, même simplifiées.
- Le Search Engine doit être un index dédié (ex: Postgres full-text ou Meilisearch/OpenSearch selon volumétrie), pas des `LIKE '%...%'` sur les tables transactionnelles.

---

## 9. Recommandations de méthode pour la suite

1. Valider explicitement avec le porteur produit les arbitrages du §1 (surtout 1.4 sur-vente offline et 5.4 numérotation légale), car ce sont des décisions produit, pas seulement techniques.
2. Construire d'abord le **noyau transactionnel** (Tenant, Identity/RBAC, Catalog, Inventory, Pricing, Sales, Payment, Document) en mono-base Postgres avec RLS, **avant** d'introduire l'offline desktop et l'automatisation avancée — ces deux derniers sont des multiplicateurs de complexité qui doivent s'appuyer sur un noyau déjà stable et testé.
3. Écrire les contrats d'événements (noms, payloads) tôt et les versionner, car l'Automation Engine, l'Audit Engine, le Reporting et la Sync en dépendent tous.
4. Ne pas commencer le Desktop EXE avant que l'API et le modèle offline (idempotence, outbox, conflits) soient stabilisés côté serveur — le desktop est un client exigeant de cette API, pas un projet indépendant.

Voir la suite dans `02-moteurs.md` (catalogue détaillé des moteurs) et les documents thématiques `03` à `10`.
