# Rapport de Test de Charge & Concurrence (Partie 9)

**Date d'exécution :** 21 Octobre 2026  
**Environnement :** Staging / Local Dédié  
**Outil :** `scripts/load-test.ts` (Vitest / Node.js Performance Hooks)  
**Base de données :** PostgreSQL 16 (RLS actif, isolation multi-tenant)  
**API :** NestJS (HTTP / Keep-Alive)  

---

## 1. Objectifs & Cadre de Test

Conformément aux exigences du cahier des charges :
- **Scénario A (Pic de concurrence) :** 100 opérations de vente lancées à la même milliseconde contre la même boutique/tenant.
- **Scénario B (Échelle & navigation) :** 2 000 requêtes réparties sur les flux réels (recherche catalogue avec texte, alertes opérationnelles, mouvements de stock, dépenses, tableaux de bord consolidés).
- **Contrôle contradictoire d'intégrité :** Vérification automatique en base de l'absence de survente (zéro stock négatif) et de l'intégrité des ventes enregistrées.

---

## 2. Résultats Mesurés & Métriques Réelles

### Scénario 1 : Pic de Concurrence (100 Ventes Simultanées)
- **Requêtes envoyées :** 100 requêtes concurrentes via `Promise.all`
- **Durée totale du pic :** 1 061 ms
- **Débit mesuré lors du burst :** 94 req/seconde
- **Latences :**
  - **p50 (médiane) :** 839 ms
  - **p95 :** 997 ms
  - **p99 :** 1 004 ms
- **Garantie d'invariance :** Le verrouillage pessimiste sur la ligne de stock empêche rigoureusement toute sur-vente concurrente. Les requêtes concurrentes sans stock disponible sont rejetées proprement avec code `400 Bad Request` sans blocage de base ni écriture orpheline.

### Scénario 2 : Épreuve d'Échelle (2 000 Requêtes de Session)
- **Requêtes traitées :** 2 000 requêtes
- **Requêtes réussies (200 OK) :** 2 000 (100 %)
- **Requêtes échouées :** 0 (0,00 %)
- **Durée totale d'exécution :** 18 258 ms (18,25 secondes)
- **Débit soutenu :** 110 requêtes / seconde
- **Latences :**
  - **p50 (médiane) :** 413 ms
  - **p95 :** 701 ms
  - **p99 :** 853 ms

---

## 3. Contrôle d'Intégrité Post-Charge (PostgreSQL RLS)

Après exécution des 2 100 requêtes de charge et concurrence :
- **Niveaux de stock négatifs interdits :** 0 (aucun produit en stock négatif)
- **Ventes enregistrées de manière intègre :** 69 ventes
- **Fuites inter-tenants :** 0 (l'isolation RLS a été maintenue à 100% sous charge)
- **Intégrité de l'audit log :** Chaque transaction réussie a généré son événement outbox correspondant.

---

## 4. Limites Réelles & Recommandations d'Exploitation

1. **Capacité mono-instance Node.js :** Le serveur NestJS sur une seule instance absorbe ~110 req/s soutenu. Pour dépasser 500 req/s en production, activer le cluster mode PM2 ou le dimensionnement horizontal (K8s/Docker Swarm).
2. **Pool de connexions PostgreSQL :** Dimensionné à `connection_limit=20` par défaut. Pour 2 000 utilisateurs connectés simultanés en production, PgBouncer est recommandé pour le multiplexage transactionnel.
