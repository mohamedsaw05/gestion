# 10 — Architecture d'évolution (Partie I)

## 1. Principe directeur

Un nouveau module doit pouvoir être ajouté en **ajoutant du code**, jamais en **modifiant** le contrat d'un moteur existant de façon cassante. Ceci est rendu possible par trois disciplines déjà posées dans les documents précédents :

1. **Contrats d'événements versionnés** (`02-moteurs.md`) — un nouveau module s'abonne aux événements existants sans que les producteurs aient besoin de savoir qu'il existe.
2. **API interne stable par moteur** — un nouveau moteur appelle les moteurs existants via leurs fonctions publiques documentées, jamais via un accès direct à leurs tables.
3. **API publique versionnée** (`04-architecture-web.md` §3) — un changement cassant crée une nouvelle version plutôt que de modifier l'existante.

## 2. Exemple : ajouter un module de fidélité (Loyalty) sans casser l'existant

1. Nouveau moteur `Loyalty Engine`, nouvelles tables `loyalty_accounts`, `loyalty_movements` (append-only, même pattern que Credit Engine).
2. Il s'abonne à `sales.sale.completed` (Event Engine existant, aucune modification du Sales Engine requise) pour créditer des points.
3. Il expose sa propre API interne (`getLoyaltyBalance`, `redeemPoints`) que le Sales Engine peut *optionnellement* appeler si le module est activé (`Configuration.isModuleEnabled(tenantId, "loyalty")`) — via un point d'extension explicite (ex: liste de « discount providers » que le Pricing Engine interroge), pas via une modification du cœur du Pricing Engine à chaque nouveau type de réduction.
4. Le module ajoute ses propres permissions atomiques (`loyalty.account.read`, `loyalty.points.redeem`) au catalogue versionné — les rôles existants ne les ont pas par défaut, un admin les ajoute s'il active le module.
5. Aucune migration destructive sur les tables existantes ; le module est entièrement additif.

## 3. Points d'extension explicites à prévoir dès le noyau

Pour éviter que chaque nouveau module oblige à modifier un moteur central, prévoir dès la conception des **points d'extension** (interfaces/hooks explicites) aux endroits où la vision anticipe déjà de la croissance :
- **Pricing Engine** : liste ouverte de « providers de règles de prix/réduction » (permet Loyalty, coupons, futures promotions complexes sans toucher au cœur).
- **Payment Engine** : liste ouverte de « méthodes de paiement » (permet d'ajouter un nouveau PSP sans modifier le moteur).
- **Document Engine** : templates personnalisables + types de documents extensibles (permet d'ajouter un type de document régional sans toucher au moteur).
- **Automation Engine** : catalogue d'actions en liste blanche, extensible par moteur (chaque nouveau moteur déclare les actions qu'il expose à l'automatisation).
- **Hardware Engine** : interface d'adapter par catégorie de périphérique (permet d'ajouter un fabricant sans toucher au code appelant).

## 4. Modules futurs explicitement anticipés (hors périmètre V1, mais compatibles)

| Module futur | Point d'ancrage déjà prévu |
|---|---|
| Application mobile | Consomme la même API publique versionnée que le Web ; RBAC et Tenant Engine inchangés |
| E-commerce / marketplace | Nouveau canal de vente qui crée des `orders` via l'API Order Engine existante ; catalogue et pricing réutilisés tels quels |
| Comptabilité | Consommateur du Reporting Engine + des tables de faits, potentiellement via export vers un plan comptable configurable (Configuration Engine) |
| Fidélité | Voir §2 ci-dessus |
| Réservation / location | Nouveau moteur proche d'Order Engine (états différents : réservé → en cours → rendu), réutilise Inventory pour le suivi de disponibilité |
| Gestion de services (RDV, prestations) | Extension du Catalog Engine (déjà prévu pour les produits « service ») + nouveau moteur de planning |
| API publique pour intégrateurs tiers | Réutilise l'API publique versionnée existante, avec une couche d'API keys/OAuth applicative dédiée aux tiers, distincte de l'auth utilisateur |
| Paiement en ligne (e-commerce) | Nouveau « provider » du Payment Engine, cf §3 |
| Logistique avancée (tournées) | Extension du Delivery/Pickup Engine, cf `02-moteurs.md` §17 |
| BI / IA avancée | Consommateur en aval du Reporting Engine et de l'Event Engine, jamais un accès direct aux tables transactionnelles |
| Gestion RH / paie | Nouveau domaine largement indépendant, ne réutilise que Tenant/Identity/RBAC comme socle commun |

## 5. Discipline de migration de schéma

- Migrations additives par défaut (ajout de colonne nullable, ajout de table) déployables sans coordination avec le code applicatif en cours d'exécution.
- Une migration destructive (renommage, suppression de colonne) suit toujours le motif *expand → migrate → contract* : ajouter le nouveau, faire cohabiter ancien et nouveau le temps de migrer les données et le code consommateur, puis seulement retirer l'ancien dans un déploiement ultérieur séparé.
- Aucune migration ne doit verrouiller une table volumineuse en production de façon bloquante (utiliser les techniques de migration en ligne de Postgres : ajout de contrainte `NOT VALID` puis validation asynchrone, index `CONCURRENTLY`).

## 6. Gouvernance des contrats

- Le catalogue d'événements et le catalogue de permissions atomiques sont des artefacts versionnés en revue de code au même titre que le code — toute modification (ajout, et *a fortiori* renommage/suppression) passe par une revue explicite de son impact sur les consommateurs existants (Automation, Audit, Reporting, Sync).
- Un événement ou une permission ne sont jamais supprimés silencieusement ; ils sont dépréciés (marqués, documentés, avec une période de transition) avant retrait effectif.
