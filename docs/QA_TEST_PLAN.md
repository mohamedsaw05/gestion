# PLAN GLOBAL DE TESTS QA ET D'ASSURANCE DE QUALITÉ — VTM SAAS

> **Date d'approbation :** 2026-11-01  
> **Auditeur / Responsable :** Ingénieur QA Senior & Responsable SRE  
> **Objectif :** Cadre d'exécution systématique couvrant les 8 niveaux d'assurance qualité (A à H)  

---

## 1. Niveaux de Tests & Stratégie d'Exécution

### A. Tests Unitaires (Logique Métier Pure & Calculs)
- **Objectif :** Valider l'exactitude mathématique, les règles de calcul et les convertisseurs sans dépendance réseau ni base de données.
- **Périmètre :**
  - Calcul de prix par unité alternative (`UnitsService.resolveUnit`) avec facteurs décimaux stricts.
  - Snapshot de coût de revient (`costPriceSnapshot`) et calcul de marge brute.
  - Validation des formats monétaires (`decimal.js` : interdiction formelle de `Decimal.isPositive()` pour tester > 0).
  - Génération et validation des tokens opaques d'invitation et refresh tokens (Argon2id).
  - Validation de conformité des messages sociaux (`SocialComplianceService.spec.ts`).
- **Commande :** `npm --prefix apps/api run test`
- **Critère de succès :** 100% de réussite, 0 avertissement.

---

### B. Tests d'Intégration (PostgreSQL Réel, RLS & Transactions)
- **Objectif :** Éprouver les contraintes relationnelles, les transactions interactives et l'isolation Row-Level Security (RLS).
- **Périmètre :**
  - Isolation multi-tenant stricte : exécution sous rôle `app_runtime` avec `SET LOCAL app.current_tenant_id = '...'`.
  - Atomisme de la vente : vérification du rollback complet si l'une des écritures (paiement, mouvement de stock, outbox) échoue.
  - Table append-only `CreditMovement` et `SupplierMovement` : interdiction des `UPDATE` et `DELETE` physiques.
  - Stockage de fichiers avec vérification du quota de 5 Go par espace de travail.
  - Outbox Pattern : insertion synchrone de l'événement dans la transaction métier, puis dépilement asynchrone par le worker.
- **Environnement :** Base PostgreSQL dédiée de développement / test (jamais de mock en mémoire).

---

### C. Tests End-to-End (Parcours Utilisateurs Complets)
- **Objectif :** Tester la chaîne complète API / Base de données sur des scénarios réels d'exploitation.
- **Scénarios prioritaires :**
  1. *Parcours Vente Comptoir* : Ouverture session de caisse -> Ajout articles variés (simples, avec variantes, sérialisés, par lots FEFO) -> Paiement fractionné (Cash + Mobile Money) -> Génération reçu PDF -> Clôture de caisse avec contrôle d'écart.
  2. *Parcours Devis vers Facture* : Émission devis client -> Acompte partiel -> Passage en préparation -> Livraison -> Complétion en vente avec respect du prix négocié initial.
  3. *Parcours Réapprovisionnement Fournisseur* : Bon de commande fournisseur -> Réception avec écart de quantité -> Calcul du Prix Moyen Pondéré (PMP) -> Augmentation du stock vendable -> Écriture de la dette fournisseur.
  4. *Parcours SAV & Atelier* : Enregistrement appareil client (`ServiceOrder`) -> Diagnostic technique -> Consommation de pièces détachées du stock -> Facturation de la main d'œuvre -> Restitution au client avec décharge signée.
- **Commande :** `npm --prefix apps/api run test:e2e`

---

### D. Tests Négatifs & Tentatives d'Incursion
- **Objectif :** Prouver que toute action illégitime ou incohérente est systématiquement rejetée.
- **Cas d'épreuve :**
  - Tentative de lecture ou de modification d'un enregistrement appartenant à un autre tenant (doit renvoyer 404 Not Found, jamais 403 pour éviter la fuite d'existence).
  - Vente avec quantité négative ou égale à zéro (doit renvoyer 400 Bad Request).
  - Saisie d'une quantité décimale sur un article géré en pièces entières (`isFractional: false`).
  - Utilisation d'un numéro de série déjà vendu ou inexistant.
  - Tentative de validation d'un paiement avec un montant négatif.
  - Annulation d'une commande déjà finalisée (`COMPLETED`).

---

### E. Tests de Concurrence & Verrouillage
- **Objectif :** Valider l'intégrité face aux requêtes simultanées de multiples terminaux.
- **Scénarios d'épreuve :**
  1. **Dernière unité vendable :** Deux caisses lancent simultanément (`Promise.all`) une vente de 1 unité sur un article dont le stock disponible est de 1.
     - *Résultat attendu :* Exactement 1 succès (201), exactement 1 refus (400), stock final = 0.
  2. **Triage anti-deadlock (40P01) :** Deux ventes contenant chacune deux articles A et B, mais ajoutés dans des ordres inversés (Vente 1: A puis B ; Vente 2: B puis A).
     - *Résultat attendu :* Tri déterministe préalable des lignes, exécution sans aucun deadlock PostgreSQL.
  3. **Double clic caissier :** Deux envois de la même vente avec la même clé d'idempotence (`operationId`).
     - *Résultat attendu :* Une seule vente créée, la seconde requête renvoie la vente déjà existante.

---

### F. Tests de Résilience & Pannes
- **Objectif :** S'assurer de la reprise d'activité sans corruption ni travail orphelin.
- **Scénarios d'épreuve :**
  1. **Arrêt brutal pendant une vente :** Interruption du processus de base de données pendant l'exécution de `SalesService.create`.
     - *Résultat attendu :* Aucune écriture partielle. PostgreSQL rollback à 100%.
  2. **Perte de réseau après commit :** La vente est commitée en base mais la connexion réseau client se coupe avant réception de la réponse HTTP.
     - *Résultat attendu :* La réémission de la requête avec le même `operationId` retrouve la vente et réédite le document sans décompter le stock deux fois.
  3. **Incident d'impression :** L'imprimante thermique tombe en panne ou n'a plus de papier après la vente.
     - *Résultat attendu :* Le document reste stocké et réimprimable à volonté via `GET /documents/:id/pdf` sans recréer de mouvement financier.

---

### G. Tests de Charge & Performance
- **Objectif :** Garantir la fluidité sous forte sollicitation multi-boutiques.
- **Conditions préalables :** Environnement de staging isolé, base pré-remplie avec 50 tenants, 10 000 articles et 50 000 lignes d'historique.
- **Profils de test :**
  - **Profil 1 (Comptoir intense) :** 100 ventes simultanées réparties sur 10 magasins.
    - *Critères de passage :* Débit > 50 ventes/sec, latence p95 < 250ms, 0 corruption de stock.
  - **Profil 2 (Recherche catalogue) :** 100 recherches simultanées avec autocomplétion et filtres de catégorie.
    - *Critères de passage :* Latence p95 < 80ms.
  - **Profil 3 (Rafraîchissement JWT massif) :** Simulation de 500 caisses se reconnectant à l'ouverture.
    - *Critères de passage :* Le mutex client single-flight empêche toute tempête de requêtes, CPU API < 60%.

---

### H. Tests de Récupération & Intégrité Comptable
- **Objectif :** Valider la conformité des données après l'exécution de scénarios complexes.
- **Contrôles post-tests :**
  - La somme des mouvements de stock (`StockMovement.quantity`) est rigoureusement égale à la variation de `StockLevel.quantityOnHand`.
  - La somme des mouvements d'espèces en caisse (`CashMovement`) est égale au solde théorique de fermeture de session.
  - Le solde du compte client (`CreditAccount.balance`) est exactement égal à la somme algébrique des lignes `CreditMovement`.
  - Zéro événement outbox bloqué en statut d'erreur permanente sans alerte diagnostique.
