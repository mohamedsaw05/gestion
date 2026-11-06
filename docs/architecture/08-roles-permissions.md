# 08 — Architecture des rôles et permissions (Partie G)

## 1. Modèle en quatre couches

```
PERMISSION ATOMIQUE  →  ROLE (composition)  →  ATTRIBUTION (user_role + scope)  →  ÉVALUATION (can())
```

### 1.1 Permission atomique
Format : `module.ressource.action`. Catalogue codé et versionné (source de vérité, cf `02-moteurs.md` §4). Exemples déjà listés dans la vision :
```
inventory.stock.read
inventory.stock.adjust
inventory.transfer.create
sales.create
sales.cancel
sales.discount
customers.read
payments.create
reports.financial.read
```

### 1.2 Rôle
Un rôle est un **nom + une liste de permissions atomiques**. Deux catégories :
- **Rôles-modèles** (fournis par la plateforme, ex: « Vendeur », « Gestionnaire de dépôt », « Comptable ») — servent de point de départ, clonables.
- **Rôles personnalisés par tenant** — un admin clone un modèle puis ajoute/retire des permissions atomiques.

### 1.3 Attribution avec scope
Une attribution `user_role` lie un utilisateur à un rôle **avec un scope de localisation** :
```
ALL_LOCATIONS       — toutes les locations du tenant, présentes et futures
[loc_A, loc_B]      — une liste explicite de locations
OWN_RECORDS         — uniquement les enregistrements créés par l'utilisateur lui-même
TEAM                — les enregistrements de l'équipe hiérarchique de l'utilisateur
```
Un même utilisateur peut avoir plusieurs attributions (ex: « Vendeur » scope `[loc_A]` + « Gestionnaire dépôt » scope `[loc_B]`) — les permissions effectives sont l'union, mais le scope reste attaché à chaque rôle attribué (un gestionnaire dépôt B ne devient pas automatiquement gestionnaire dépôt A).

### 1.4 Évaluation
```
can(userId, "inventory.stock.adjust", { locationId: "loc_B" })
  → charge les attributions actives de userId
  → filtre celles dont la permission "inventory.stock.adjust" est incluse
  → vérifie que loc_B est dans le scope de l'une d'elles
  → true/false, jamais d'exception silencieuse : refus explicite journalisé si false sur une tentative d'action
```

## 2. Exemple concret : création d'un rôle personnalisé par un administrateur

Scénario de la vision : « Gestionnaire dépôt A » peut consulter/réceptionner/transférer/ajuster certaines quantités, mais ne peut pas supprimer, modifier les prix, voir les finances globales, gérer les utilisateurs.

Étapes UI (admin, pas besoin de compétence technique) :
1. Admin ouvre *Paramètres → Rôles → Nouveau rôle*, choisit le modèle « Gestionnaire de dépôt » comme point de départ (pré-coché avec un set de permissions cohérent).
2. Il décoche `inventory.stock.delete`, `pricing.price_list.write`, `reports.financial.read`, `users.manage`.
3. Il nomme le rôle « Gestionnaire dépôt A » et l'attribue à un utilisateur avec le scope `[Dépôt A]`.
4. Le système applique immédiatement : `getVisibleMenu()` pour cet utilisateur ne montrera plus les sections Finance/Utilisateurs, et toute tentative d'action hors scope ou hors permission sera refusée côté API avec un message explicite.

## 3. Pourquoi ce modèle plutôt qu'un modèle à rôles fixes

Un modèle à rôles fixes (« Admin / Vendeur / Gestionnaire ») ne peut pas exprimer les nuances réelles observées dans le métier (ex: un vendeur qui peut voir les clients mais pas leur solde de crédit détaillé). Le modèle permission-atomique + scope permet ces nuances **sans explosion combinatoire de rôles nommés** — le nombre de rôles nommés reste géré par le tenant (généralement 3 à 10), mais chacun est une composition fine.

## 4. Interaction avec l'UI adaptative

`getVisibleMenu(userId)` traduit le `PermissionSet` effectif en arbre de menu : une section de menu n'apparaît que si au moins une permission qu'elle regroupe est accordée dans au moins un scope. C'est le mécanisme concret qui réalise le principe de progressive disclosure (§38 de la vision) sans dupliquer la logique de permission entre le backend (sécurité réelle) et le frontend (confort d'affichage) — le frontend consomme la même source de vérité, il ne la réimplémente jamais.

## 5. Cas particuliers

- **Compte système** (utilisé par l'Automation Engine pour exécuter des actions automatiques) : un pseudo-utilisateur avec un `PermissionSet` explicite et restreint, jamais un accès total « pour que ça marche » — chaque automatisation est journalisée avec ce compte comme acteur, distinct de tout utilisateur humain (cf `02-moteurs.md` §18).
- **Assistant IA** : n'a pas de permission propre — il agit strictement avec le `PermissionSet` de l'utilisateur qui le sollicite, revérifié à chaque appel d'outil (cf `02-moteurs.md` §22).
- **Support plateforme (équipe interne)** : accès cross-tenant distinct du modèle RBAC tenant, avec son propre journal d'audit renforcé (toute consultation d'un tenant par le support est elle-même auditée et, idéalement, notifiée au tenant concerné).
