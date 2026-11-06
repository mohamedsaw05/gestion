# 06 — Architecture Offline et Synchronisation (Partie E)

Ce document explicite les points laissés en suspens (assumés, pas magiquement résolus) dans `01-analyse-risques.md` §1.4 et §6.

## 1. Comment une vente fonctionne sans Internet

1. L'utilisateur compose le panier ; le Local Core résout le prix à partir du **dernier référentiel de prix synchronisé** (Pricing Engine local, lecture seule sur les données répliquées).
2. Le Local Core vérifie le stock **local** connu (`stock_levels` répliqué pour les emplacements rattachés à ce poste) — c'est une vérification **optimiste**, pas une garantie serveur.
3. La vente est créée localement avec :
   - un `id` UUID v7 définitif (généré côté client, pas d'attente d'un ID serveur) ;
   - un `operation_id` unique (clé d'idempotence) ;
   - `device_id`, `local_sequence` (compteur local croissant par appareil) ;
   - `synced_at = NULL`, `pending_sync = true`.
4. La transaction locale (SQLite) applique immédiatement : décrément du stock local, écriture du mouvement de stock local, mise à jour de la caisse locale, génération du document (numérotation provisoire ou par série, cf `01-analyse-risques.md` §5.4).
5. L'opération complète (vente + lignes + paiement + mouvement de stock) est sérialisée comme **une seule entrée** dans le `local_outbox`, pas une par table — pour que son application côté serveur reste atomique.
6. L'utilisateur obtient son reçu immédiatement ; l'UI affiche un indicateur discret « en attente de synchronisation » sur les opérations non confirmées par le cloud, jamais un blocage de l'usage.

## 2. Comment le stock local fonctionne

Le stock local est une **projection répliquée**, pas une source de vérité. Il existe deux notions à ne jamais confondre :
- **Stock local connu** : dernière valeur reçue du serveur + mouvements locaux appliqués depuis, encore non confirmés.
- **Stock serveur réel** : la vérité, incluant les mouvements des autres postes non encore visibles localement.

Le Local Core ne bloque jamais une vente sur la base d'un stock local à zéro si le tenant a configuré l'autorisation de vente en négatif (configurable), mais alerte visuellement (« stock local à 0, vérifiez la disponibilité réelle si possible »).

## 3. Comment plusieurs postes travaillent hors ligne simultanément

Chaque poste opère de façon totalement indépendante sur sa copie locale. Il n'y a **aucune coordination entre postes déconnectés** (pas de réseau local requis entre eux) — toute coordination passe exclusivement par le cloud, plus tard, à la reconnexion de chacun. C'est un choix délibéré de simplicité : ne pas construire un second protocole de consensus pair-à-pair en plus de la synchronisation cloud.

## 4. Protocole de synchronisation

### 4.1 Push (montée)
```
POST /sync/push
{
  device_id, tenant_id,
  operations: [
    { operation_id, local_sequence, type: "sale.create", payload: {...} },
    ...
  ]
}
```
Le serveur traite chaque opération **dans l'ordre du `local_sequence`** pour un même `device_id` (ordre causal garanti par appareil). Pour chaque opération :
- Vérifie `processed_operations (tenant_id, operation_id)` → si déjà traitée, renvoie le résultat déjà connu (idempotence, pas de retraitement).
- Sinon, exécute la même transaction que le Sales Engine online (§4.1 de `01-analyse-risques.md`), avec une différence clé : le contrôle de stock ne **bloque pas** l'opération si le stock devient négatif à cause d'un concours entre postes — il **enregistre un flag `oversold = true`** sur le mouvement de stock et poursuit (voir §6 ci-dessous). Bloquer rétroactivement une vente déjà remise au client offline n'a pas de sens métier.
- Renvoie le statut serveur définitif de chaque opération (accepté / accepté avec avertissement `oversold` / rejeté pour raison métier explicite, ex: client bloqué).

### 4.2 Pull (descente)
```
GET /sync/pull?since=<cursor>
→ { changes: [...], next_cursor }
```
Le `cursor` est un jeton opaque serveur (pas un timestamp mural — évite les problèmes de dérive d'horloge), basé sur la position dans le flux d'événements pertinents pour le périmètre de réplication de cet appareil (§4 de `05-architecture-desktop.md`).

### 4.3 Ordre des opérations : push avant pull
À chaque cycle de synchronisation, le poste **pousse d'abord ses opérations locales**, puis **tire** l'état à jour — ainsi ses propres opérations sont reflétées dans ce qu'il reçoit en retour (y compris les avertissements de conflit les concernant).

## 5. Détection et résolution des conflits

Deux classes de conflits :

### 5.1 Conflit de mise à jour concurrente (ex: deux postes modifient le même client hors ligne)
- Chaque enregistrement répliqué porte une **version logique** (`version_vector` simplifié : `(entity_id, last_writer_device_id, last_writer_sequence)`), pas seulement un timestamp.
- Stratégie par défaut : **Last-Write-Wins horodaté serveur** (le serveur tranche à la réception, sur la base de l'heure serveur de réception, pas de l'heure locale du poste) **+ journalisation systématique du conflit** dans `sync_conflicts` (jamais de perte silencieuse — l'ancienne valeur perdante reste consultable).
- Pour les champs sensibles (ex: limite de crédit d'un client, prix d'un produit), le conflit est **remonté à un administrateur** plutôt que résolu automatiquement — configurable par champ/entité selon criticité.

### 5.2 Conflit de sur-vente de stock (oversell)
- N'est **pas empêché a priori** (impossible sans coordination temps réel entre postes déconnectés, cf §1.4 de `01-analyse-risques.md`).
- **Détecté** à la synchronisation : si la somme des décréments reçus de plusieurs postes dépasse le stock serveur disponible au moment considéré, le mouvement de stock concerné est marqué `oversold = true` et un événement `inventory.stock.oversold` est émis.
- **Traité** par un flux de résolution explicite exposé au gestionnaire : proposer un réapprovisionnement, contacter le client concerné, ou accepter la rupture. Le système ne décide jamais seul d'annuler une vente déjà remise à un client.

## 6. Éviter les doublons

- `operation_id` unique par tenant (contrainte d'unicité en base, cf `03-modele-donnees.md` §7) — un retry réseau qui renvoie la même opération est absorbé sans effet dupliqué.
- Le `local_sequence` par appareil permet de détecter un trou (opération manquante) ou une régression (horloge/état local corrompu) et de refuser la synchronisation de ce poste jusqu'à investigation, plutôt que d'accepter un état incohérent.

## 7. Reprise après interruption

La synchronisation est conçue pour être interrompue à tout moment sans corruption :
- Le push traite les opérations une par une côté serveur (chacune dans sa propre transaction courte) et accuse réception opération par opération — une coupure réseau en cours de push ne fait perdre que les opérations non encore accusées, qui seront retentées au prochain cycle (idempotence garantissant l'absence de doublon).
- Le pull reprend toujours depuis le dernier `cursor` accusé localement, jamais depuis zéro.

## 8. Ce que ce protocole ne garantit pas (limites assumées et à communiquer au métier)

- Pas de garantie de non-sur-vente en cas de rupture de stock proche de zéro avec plusieurs postes déconnectés simultanément.
- Pas de numérotation légale strictement continue sans configuration spécifique par tenant/pays (cf `01-analyse-risques.md` §5.4).
- Fraîcheur du catalogue/prix limitée par l'ancienneté de la dernière synchronisation réussie — l'UI desktop doit toujours afficher clairement « dernière synchronisation : … » pour que ce ne soit jamais un état invisible pour l'utilisateur.
