# Checklist de Préparation à la Mise en Production — SaaS VTM

**Date :** 1er Novembre 2026  
**Version candidate :** `v1.0.0-rc1`

---

## 1. Sécurité et Contrôles Critiques (S0 & S1)

- [x] **S0-01 :** Réinitialisation globale de la plateforme interdite en production (`NODE_ENV === 'production'`) côté serveur.
- [x] **S0-01 :** Effacement global `deleteMany({})` non borné éliminé. En QA/démo, le reset est strictement borné à un tenant de test explicitement nommé.
- [x] **S0-02 :** Remboursement en espèces sur crédit impayé interdit. Génération automatique d'un Avoir et réduction de créance.
- [x] **S0-02 :** Plafonnement strict du remboursement en espèces au montant réellement encaissé en espèces et disponible.
- [x] **S1-01 :** Clés d'idempotence POS isolées par onglet via `sessionStorage` (zéro collision inter-onglets).
- [x] **S1-01 :** Empreinte canonique complète de vente côté serveur (rejet `409 Conflict` si réutilisation de clé avec panier altéré).
- [x] **S1-02 :** Prise de possession atomique des paniers suspendus avec `updateMany` conditionnel (`count === 1`).
- [x] **RLS & Multi-Tenant :** Toutes les opérations applicatives exécutées via `PrismaTenantService.run()` avec variable de session `app.current_tenant_id`.

---

## 2. Intégrité des Données et Comptabilité

- [x] **Append-Only :** Mouvements de stock (`StockMovement`) et de crédit (`CreditMovement`) exclusivement créés en ajout. Aucune écriture historique modifiée.
- [x] **Quarantaine SAV :** Emplacements de type `QUARANTINE` isolés du stock vendable. Vente au comptoir depuis la quarantaine formellement bloquée.
- [x] **Modules & Droits :** Source de vérité serveur via `/me`. Désactivation d'un module masque l'interface sans perte de données en base. `CapabilityGuard` bloque tout appel API direct.

---

## 3. Qualité Logicielle et Builds

- [x] **Tests Unitaires API :** 15 suites de tests, 77/77 tests passés avec succès (0 échec, 0 ignoré).
- [x] **Build Backend :** `nest build` compilé sans erreur (Code 0).
- [x] **Build Frontend Client :** `tsc -b && vite build` terminé en 2.56s (Code 0).
- [x] **Build Frontend Admin :** `tsc -b && vite build` terminé en 1.02s (Code 0).
- [x] **Linter :** `oxlint` exécuté avec 0 erreur sur le monorepo.
- [x] **Prisma Engine :** Schéma synchronisé, client généré sans anomalie.

---

## 4. Pré-requis de Déploiement en Production

- [ ] Définir `NODE_ENV=production` sur les serveurs applicatifs.
- [ ] Renseigner les variables de production dans `.env` :
  - `DATABASE_URL` et `DATABASE_URL_RUNTIME` (rôle sans `BYPASSRLS`).
  - `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` (générés avec au moins 256 bits d'entropie).
  - `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `WAVE_WEBHOOK_SECRET`, `CINETPAY_WEBHOOK_SECRET`.
  - Paramètres SMTP pour la livraison des emails d'invitation.
- [ ] Configurer PgBouncer en mode transaction pour absorber les pics de charge concurrents.
- [ ] Configurer les DNS wildcard (`*.viraltechmarket.com`) pour la résolution dynamique des sous-domaines clients.
