# REGISTRE OFFICIEL DES RISQUES QA & VULNÉRABILITÉS — VTM SAAS

**Document de référence :** `docs/QA_RISK_REGISTER.md`  
**Date d'audit contradictoire :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Méthodologie :** Analyse d'impact financier, sécurité multi-tenant, intégrité des stocks et résilience SaaS  
**Échelle de gravité :**  
- **S0 (Bloquant / Catastrophique) :** Risque direct d'effacement global, perte financière sèche ou fuite multi-tenant.  
- **S1 (Majeur) :** Concurrence transactionnelle, doublon de vente, anomalie d'idempotence ou passerelle bloquée.  
- **S2 (Moyen) :** Incohérence UI/Backend, absence de localisation/i18n, déconnexion de feature flags.  
- **S3 (Mineur / Dette technique) :** Goulot de performance sous forte charge, optimisation d'index ou logs superflus.

---

## 1. RISQUES S0 — CRITIQUES (INTÉGRITÉ GLOBALE & FINANCIÈRE)

### S0-01 : Route de Réinitialisation Globale Non Protégée en Production
- **Fichier & Ligne :** [platform-tenants.service.ts:167](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/apps/api/src/platform/platform-tenants.service.ts#L167) et `platform-tenants.controller.ts:109`.
- **Scénario :** Un utilisateur disposant du rôle `SUPERADMIN` (ou un attaquant ayant compromis un jeton admin) appelle `POST /platform/reset-all`.
- **Comportement actuel :** Le service lance un `deleteMany` direct sans filtre `where: { tenantId }` sur toutes les tables de ventes, clients, stocks, crédits et factures de **TOUTES les entreprises clientes hébergées**.
- **Comportement attendu :** Cette route doit refuser catégoriquement de s'exécuter si `NODE_ENV === 'production'`. Elle doit exiger une confirmation cryptographique et être bridée à un environnement sandbox de test.
- **Impact :** Perte de données irréversible sur l'ensemble de la base de production du SaaS.
- **Statut de résolution :** Détecté à l'audit. En attente d'arbitrage.

### S0-02 : Décaissement d'Espèces sur Retour d'une Vente à Crédit non Réglée
- **Fichier & Ligne :** [returns.service.ts:258](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/apps/api/src/returns/returns.service.ts#L258).
- **Scénario :** Un client achète un produit à crédit (solde dû = 100 000 FCFA, acompte = 0). Le lendemain, il ramène l'article et demande un retour. L'opérateur valide le retour avec mode de remboursement `CASH`.
- **Comportement actuel :** Le système peut décaisser des espèces physiques du tiroir-caisse sans vérifier si le client avait préalablement payé.
- **Comportement attendu :** Le retour doit prioritairement solder la dette du client (`DEBT_CANCELLATION`). Tout remboursement d'espèces est strictement interdit si le client n'a pas déboursé d'argent réel.
- **Impact :** Fraude interne ou perte financière immédiate au tiroir-caisse.

---

## 2. RISQUES S1 — MAJEURS (CONCURRENCE, IDEMPOTENCE & PASSERELLES)

### S1-01 : Collision d'Idempotence POS Multi-Onglets (`operationId`)
- **Fichier & Ligne :** [NewSalePage.tsx:78-85](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/apps/client/src/pages/NewSalePage.tsx#L78-L85).
- **Scénario :** Un caissier ouvre deux onglets sur le même magasin dans son navigateur pour préparer deux ventes simultanées.
- **Comportement actuel :** `getStoredOperationId(locId)` utilise la clé partagée `vtm_pending_sale_op_${locId}` dans `localStorage`. La validation de la vente A dans l'onglet 1 attribue l'idempotence. Lorsque l'onglet 2 soumet la vente B, le serveur reconnaît l'identifiant de la vente A et renvoie la facture A au client B !
- **Comportement attendu :** L'identifiant d'idempotence doit être généré par panier (`cartId`) et isolé dans le state React ou `sessionStorage` propre à chaque onglet.
- **Impact :** La vente B n'est jamais enregistrée, confusion de tickets au comptoir.

### S1-02 : Concurrence et Double Reprise d'un Panier Suspendu (`HeldCart`)
- **Fichier & Ligne :** [held-carts.service.ts:112-140](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/apps/api/src/sales/held-carts.service.ts#L112-L140).
- **Scénario :** Deux caissiers voient le même panier suspendu dans la liste et cliquent simultanément sur "Reprendre le panier".
- **Comportement actuel :** L'API exécute `tx.heldCart.findFirst(...)` puis `tx.heldCart.update(...)`. En isolation PostgreSQL par défaut (`READ COMMITTED`), `findFirst` ne bloque pas la ligne. Les deux caissiers lisent le statut `HELD` et les deux valident la reprise.
- **Comportement attendu :** Mise à jour conditionnelle atomique : `tx.heldCart.updateMany({ where: { id, tenantId, status: 'HELD' }, data: { status: 'RESUMED' } })` avec rejet si `count === 0`.
- **Impact :** Double vente d'un même panier, risque de décrémentation erronée de stock.

### S1-03 : Passerelles Webhooks CinetPay et Wave Non Raccordées Côté Serveur
- **Fichier & Ligne :** [platform-webhooks.service.ts:85](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/apps/api/src/platform/platform-webhooks.service.ts#L85).
- **Scénario :** Réception d'un webhook entrant de confirmation Mobile Money émis par CinetPay ou Wave.
- **Comportement actuel :** Le code ne prend en charge que `stripe` et `paystack`. Il lève une exception `BadRequestException("Fournisseur de paiement non supporté")`.
- **Comportement attendu :** Décodeur et validateur cryptographique de signature dédiés pour CinetPay et Wave.
- **Impact :** Les paiements Mobile Money automatisés de ces opérateurs ne valident pas automatiquement les commandes.

---

## 3. RISQUES S2 — MOYENS (EXPÉRIENCE UTILISATEUR & GOUVERNANCE)

### S2-01 : Absence Totale de Traduction Anglaise dans l'Interface React
- **Fichiers :** L'ensemble des 67 composants UI de `apps/client/src/`.
- **Scénario :** Un utilisateur anglophone se connecte à la plateforme.
- **Comportement actuel :** Aucun sélecteur de langue, 100% des libellés et boutons sont en français en dur.
- **Impact :** Impossibilité d'adresser les marchés anglophones (Ghana, Nigeria, etc.) sans refonte i18n.

### S2-02 : Déconnexion de l'Activation des Modules (Frontend vs Backend)
- **Fichier :** `apps/client/src/lib/modules.config.ts`.
- **Scénario :** L'administrateur désactive un module sur le tenant en base de données.
- **Comportement actuel :** Le frontend conserve les modules dans le `localStorage` du navigateur. Le menu reste affiché jusqu'à ce que le cache local soit vidé manuellement.

---

## 4. RISQUES S3 — MINEURS (PERFORMANCE & DETTE TECHNIQUE)

### S3-01 : Saturation du Pool de Connexions DB sous Pic de Charge
- **Composant :** Prisma Client & PostgreSQL 16.
- **Scénario :** 100 requêtes transactionnelles par seconde lors d'un pic d'activité.
- **Comportement actuel :** Les 20 connexions directes du pool Prisma peuvent saturer temporairement.
- **Recommandation :** Intercaler PgBouncer en mode transaction pooling.
