# 05 — Architecture Desktop (Partie D)

## 1. Principe fondamental

Le desktop **n'est pas** un site Web ouvert dans une fenêtre (pas un simple wrapper Electron autour de la SPA sans logique locale). C'est une application avec son propre **Local Core** capable de fonctionner en autonomie complète pendant une coupure réseau prolongée, avec une base de données locale chiffrée, une file d'opérations en attente, et un moteur de synchronisation bidirectionnelle.

## 2. Schéma en couches

```
┌──────────────────────────────────────────────┐
│                  UI Desktop                   │  (même langage de composants que le Web
│         (même logique d'affichage adaptatif   │   si possible, pour cohérence UX et
│          par permission que le Web)           │   mutualisation du code d'interface)
└───────────────────────┬────────────────────────┘
                         │  appels locaux (pas HTTP direct systématique)
┌───────────────────────▼────────────────────────┐
│                  LOCAL CORE                     │
│  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ Local       │  │ Local       │  │ Hardware  │ │
│  │ Business    │  │ Query       │  │ Engine    │ │
│  │ Engines     │  │ Cache       │  │ (adapters)│ │
│  │ (sous-ensemble│ (lecture)   │  └───────────┘ │
│  │ des moteurs │  └────────────┘                │
│  │ serveur :   │                                │
│  │ Sales, Inv, │  ┌────────────┐  ┌───────────┐ │
│  │ Pricing lite│  │ Local      │  │ Local      │ │
│  └────────────┘  │ Outbox     │  │ Inbox      │ │
│                   │ (à envoyer)│  │ (reçu du   │ │
│                   └────────────┘  │  cloud)    │ │
│                                    └───────────┘ │
│  ┌──────────────────────────────────────────┐   │
│  │   Encrypted Local DB (SQLite chiffré)     │   │
│  └──────────────────────────────────────────┘   │
└───────────────────────┬────────────────────────┘
                         │  quand réseau disponible
┌───────────────────────▼────────────────────────┐
│                 SYNC ENGINE                     │
│   push(local_outbox) / pull(cursor) / conflicts │
└───────────────────────┬────────────────────────┘
                         │ HTTPS/TLS
                         ▼
                   API CLOUD (identique à celle du Web)
```

## 3. Local Core : ce qu'il contient réellement

- **Local Business Engines** : une réimplémentation *allégée* des moteurs critiques pour la vente au comptoir sans réseau — Sales, Inventory (vue locale), Pricing (résolution à partir du dernier référentiel synchronisé), Cash Register. Les moteurs non critiques en usage déconnecté (Reporting avancé, Automation complexe, Search global) restent des clients de l'API cloud et se dégradent proprement hors ligne (message clair « fonctionnalité nécessitant une connexion »).
- **Encrypted Local DB** : SQLite avec chiffrement au repos (SQLCipher ou équivalent), schéma miroir simplifié des tables serveur pertinentes pour ce poste (voir §4, réplication partielle).
- **Local Outbox** : table locale des opérations effectuées hors ligne, chacune avec un `operation_id` (UUID v7 généré localement), un `device_id`, un `local_sequence` croissant, en attente d'envoi.
- **Local Inbox / cursor** : dernière position connue de la réplication descendante (curseur basé sur un `sync_token` serveur, pas sur une horloge murale).
- **Hardware Engine** : seul le desktop a un accès fiable et direct aux périphériques physiques (imprimante ticket, tiroir-caisse, scanner USB) — c'est une raison structurante de l'existence même du desktop, au-delà de l'offline.

## 4. Réplication descendante partielle et pertinente

Un poste ne réplique pas tout le tenant. Il réplique :
- le catalogue **actif** (produits non archivés) et les règles de prix qui le concernent ;
- les clients **actifs**, éventuellement filtrés si le tenant a un volume massif (récemment actifs) ;
- le stock des **emplacements rattachés** à ce poste/cet utilisateur (pas le stock de tous les dépôts du tenant) ;
- un historique glissant récent (ex: 90 jours) des ventes/mouvements pour les besoins de consultation locale, pas l'historique complet.

Ce périmètre de réplication est lui-même configurable (Configuration Engine, au niveau du profil d'appareil) — un poste « caisse boutique » n'a pas le même périmètre qu'un poste « gestion dépôt central ».

## 5. Identité et sécurité de l'appareil

- Chaque appareil possède un **identifiant et un secret propres**, générés à l'enrôlement (jamais un secret partagé compilé dans tous les EXE distribués — cf risque §7.3 de `01-analyse-risques.md`).
- La clé de chiffrement de la base locale est dérivée d'un secret lié à l'appareil **et** à la session utilisateur courante (pas stockée en clair à côté du fichier `.db`) — voir détail dans `07-securite.md`.
- Un appareil révoqué (perdu/volé/compromis) est bloqué à la prochaine tentative de synchronisation ; ses opérations en attente non encore synchronisées restent visibles côté admin pour investigation, mais ne sont plus acceptées automatiquement.

## 6. Mise à jour de l'application

- Mécanisme d'auto-update signé (vérification de signature avant application), avec possibilité de rollback si une mise à jour casse la compatibilité avec l'API cloud courante.
- Compatibilité de version applicative vérifiée à chaque synchronisation : l'API cloud peut refuser une synchronisation venant d'une version desktop trop ancienne et exiger une mise à jour (garde-fou contre la dérive de protocole de sync).

## 7. Ce que le desktop NE fait PAS

- Il ne contient pas de copie du code serveur complet des moteurs non critiques à l'usage déconnecté (Reporting avancé, Automation, Assistant IA) — ces fonctionnalités nécessitent une connexion et se dégradent explicitement.
- Il ne stocke jamais de secret serveur global (clé API plateforme, credentials de base de données cloud) — uniquement son propre secret d'appareil, scellé et révocable individuellement.
- Il ne prétend pas garantir l'absence totale de rétro-ingénierie de l'exécutable (cf §30 de la vision) — la protection réelle repose sur : logique sensible côté serveur, secrets hors client, authentification forte par appareil, signature et suppression des symboles de debug à la distribution.
