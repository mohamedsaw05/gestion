# Architecture — Gestionnaire universel de commerce

Ce dossier contient la phase d'architecture (analyse + conception) réalisée **avant** toute écriture de code applicatif, conformément à la règle fondamentale du projet : comprendre les risques et dépendances avant de coder.

> **Statut d'implémentation** : une première phase de code existe désormais (noyau transactionnel + Web MVP), construite sur cette architecture sans en modifier les décisions. Voir [`../PROJECT_STATUS.md`](../PROJECT_STATUS.md) pour l'état réel moteur par moteur, et [`../../README.md`](../../README.md) pour démarrer l'environnement de développement.

## Ordre de lecture recommandé

1. **[01-analyse-risques.md](01-analyse-risques.md)** — Analyse critique préalable : incohérences à trancher, fonctionnalités manquantes, carte des dépendances entre moteurs, problèmes de cohérence transactionnelle, multi-tenant, offline/sync, sécurité, performance. **À lire en premier** — c'est la base de tous les arbitrages pris dans les documents suivants.
2. **[02-moteurs.md](02-moteurs.md)** — Catalogue complet des 28 moteurs (Platform, Tenant, Identity, RBAC, Configuration, Catalog, Unit, Pricing, Inventory, Sales, Order, Purchase, Payment, Credit, Cash Register, Document, Delivery/Pickup, Automation, Event, Reporting, Search, Assistant IA, Hardware, Notification, Backup, Observability, Audit, Sync), chacun avec objectif, responsabilités, données, dépendances, API, événements, règles, risques.
3. **[03-modele-donnees.md](03-modele-donnees.md)** — Choix technologique (Postgres multi-tenant + RLS), grandes entités et relations, principes structurants (event-sourcing partiel sur stock/crédit, snapshot immuable, suppression logique, partitionnement).
4. **[04-architecture-web.md](04-architecture-web.md)** — Flux Navigateur → API → Auth → Tenant → Permission → Business Engine → Database, UI adaptative par rôle.
5. **[05-architecture-desktop.md](05-architecture-desktop.md)** — EXE → Local Core → Base locale chiffrée → Outbox/Inbox → Sync → Cloud, ce que le desktop est et n'est pas.
6. **[06-offline-sync.md](06-offline-sync.md)** — Le document le plus critique : comment une vente fonctionne sans réseau, détection/résolution des conflits, protocole push/pull, limites assumées (sur-vente possible, détectée a posteriori).
7. **[07-securite.md](07-securite.md)** — Authentification, autorisation, isolation tenant, chiffrement, gestion des secrets/appareils/sessions, protection du desktop distribué, audit, rétention.
8. **[08-roles-permissions.md](08-roles-permissions.md)** — Modèle permission atomique → rôle → attribution avec scope → évaluation, avec exemple concret de création de rôle personnalisé.
9. **[09-abonnements-saas.md](09-abonnements-saas.md)** — Paiement → création tenant → activation → compte admin → invitations → quotas par plan.
10. **[10-evolutivite.md](10-evolutivite.md)** — Comment ajouter un module (exemple : Fidélité) sans casser l'existant, points d'extension prévus, modules futurs anticipés, discipline de migration de schéma.

## Décisions structurantes à valider avec le porteur produit avant implémentation

Ces points sont des arbitrages produit, pas seulement techniques — voir le détail dans `01-analyse-risques.md` §1 :

- **Sur-vente en offline** (§1.4) : le système ne l'empêche pas magiquement en cas de déconnexion multi-poste simultanée ; il la détecte et la traite après coup. À valider explicitement.
- **Numérotation légale des documents** (§5.4) : par poste/série (par défaut) vs numéro définitif attribué à la synchronisation — configurable par tenant/pays, à choisir selon les juridictions ciblées en premier.
- **Résolution des conflits de données** (`06-offline-sync.md` §5) : Last-Write-Wins horodaté serveur avec journalisation systématique, remontée manuelle pour les champs critiques.

## Méthode de développement recommandée

1. Noyau transactionnel d'abord : Tenant, Identity/RBAC, Catalog, Inventory, Pricing, Sales, Payment, Document — en mono-base Postgres avec RLS.
2. Contrats d'événements et catalogue de permissions écrits et versionnés tôt (Automation, Audit, Reporting, Sync en dépendent tous).
3. Desktop et Offline/Sync construits **après** stabilisation de l'API serveur — ce sont des clients exigeants de cette API, pas un projet parallèle indépendant.
4. Aucun code métier dupliqué entre Web et Desktop : le Local Core desktop réimplémente uniquement les moteurs critiques à l'usage déconnecté (Sales, Inventory, Pricing lite, Cash Register), tout le reste reste un client de l'API cloud.
