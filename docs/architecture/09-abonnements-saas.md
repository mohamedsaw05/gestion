# 09 — Architecture des abonnements SaaS (Partie H)

## 1. Flux de bout en bout

```
Prospect choisit un plan
        │
        ▼
Paiement de l'abonnement (Payment Engine, en tant que PSP de la plateforme
        elle-même — flux distinct du Payment Engine "métier" utilisé par
        les tenants pour encaisser leurs propres clients)
        │
        ▼
Platform Engine : création du tenant (Tenant Engine.bootstrapTenant)
        - structure par défaut : 1 location (magasin), 1 caisse, devise par défaut
        - rôles-modèles pré-chargés (Admin, Vendeur, Gestionnaire)
        │
        ▼
Activation : le tenant passe en statut ACTIVE, quotas du plan appliqués
        │
        ▼
Création du compte administrateur initial (premier utilisateur, rôle Admin complet)
        │
        ▼
Invitation des autres utilisateurs par l'administrateur
        (email d'invitation → création de compte → attribution de rôle)
        │
        ▼
Utilisation limitée selon le plan (quotas : nombre d'utilisateurs, nombre
        d'appareils, nombre de transactions/mois, modules activables)
```

## 2. Ce qu'un plan définit

| Dimension | Exemples |
|---|---|
| **Quotas** | nombre max d'utilisateurs actifs, nombre max d'appareils desktop enrôlés, nombre de transactions/mois, volume de stockage documents |
| **Modules activables** | Delivery/Pickup avancé, Automation Engine (nombre de règles max), Reporting avancé, Assistant IA, multi-devise |
| **Support** | niveau de SLA, canaux de support disponibles |
| **Isolation** | base partagée (par défaut) vs base dédiée (plans Enterprise, cf `01-analyse-risques.md` §5.1) |

`Configuration Engine.isModuleEnabled(tenantId, moduleKey)` consulte en réalité deux niveaux : *le plan autorise-t-il ce module* (Platform Engine) *et* *le tenant l'a-t-il explicitement activé* (Tenant Settings) — un module peut être autorisé par le plan sans être activé par choix du tenant.

## 3. Vérification de quota en continu

`Platform Engine.checkQuota(tenantId, quotaKey)` est appelé **au point de création** de la ressource quotifiée (ex: à l'invitation d'un nouvel utilisateur, à l'enrôlement d'un nouvel appareil), pas seulement en rapport différé. Un dépassement bloque la création avec un message explicite invitant à changer de plan, jamais un blocage silencieux ou une dégradation de service inexpliquée.

## 4. Cycle de vie du tenant

```
CREATED → ACTIVE → (impayé) → GRACE_PERIOD (lecture seule, pas de perte de données)
        → SUSPENDED (accès bloqué, données conservées) → DELETED (après délai contractuel,
          purge définitive documentée, cf 07-securite.md §12)
```
Un changement de plan (upgrade/downgrade) ne supprime jamais de données déjà créées ; un downgrade qui rend un module indisponible le désactive (les données restent, en lecture historique si nécessaire) plutôt que de les effacer.

## 5. Séparation stricte facturation SaaS / facturation métier du tenant

Le Payment Engine qui encaisse l'abonnement de la plateforme (le tenant paie Anthropic-like SaaS provider) est **fonctionnellement distinct** du Payment Engine que le tenant utilise pour encaisser ses propres clients (cf `02-moteurs.md` §1 et §13) — même moteur technique réutilisable, mais deux contextes de facturation qui ne doivent jamais se mélanger dans les rapports ou les permissions (un vendeur du tenant ne doit jamais voir la facturation SaaS de son entreprise, c'est réservé à l'administrateur du tenant, voire uniquement à la plateforme).

## 6. Essai gratuit et provisionnement à froid

Un essai gratuit suit le même chemin de bootstrap qu'un abonnement payant (pas de code de provisionnement dupliqué), avec un plan spécial `TRIAL` porteur de quotas réduits et d'une date d'expiration qui déclenche automatiquement le passage en `GRACE_PERIOD` puis `SUSPENDED` si aucun paiement n'intervient — même machine à états que le cycle de vie normal.
