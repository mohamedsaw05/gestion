# Fiche Statut des Fournisseurs de Paiement — VTM SaaS

**Date :** 1er Novembre 2026  
**Application :** SaaS VTM — ViralTech Market  
**Audit :** Adaptateurs, En-têtes, Signatures et Réconciliation

---

## 1. Stripe
- **Mode d'intégration :** Checkout Sessions & Webhooks officiels.
- **En-tête de signature :** `stripe-signature`.
- **Validation serveur :** `stripe.webhooks.constructEvent()` avec `STRIPE_WEBHOOK_SECRET`.
- **Statut technique :** **Implémenté et testé (✓ PASS)**.
- **Réconciliation automatique :** Événements `invoice.payment_succeeded`, `payment_intent.succeeded`.

## 2. Paystack
- **Mode d'intégration :** Charge API & Webhooks officiels.
- **En-tête de signature :** `x-paystack-signature`.
- **Validation serveur :** HMAC-SHA512 du corps brut JSON avec `PAYSTACK_SECRET_KEY`.
- **Statut technique :** **Implémenté et testé (✓ PASS)**.
- **Réconciliation automatique :** Événement `charge.success`.

## 3. Wave Money
- **Mode d'intégration :** Wave Business API v1.
- **En-tête de signature :** `Wave-Signature` avec timestamp `t=<ts>,v1=<sig>`.
- **Validation serveur :** HMAC-SHA256 sur `${timestamp}${rawPayload}` avec `WAVE_WEBHOOK_SECRET`. Fenêtre de tolérance anti-rejeu : 300 secondes (5 minutes).
- **Statut technique :** **Implémenté et testé (✓ PASS)**.
- **Réconciliation automatique :** Événement `checkout.session.completed` avec extraction de `invoiceId` depuis `client_reference` ou metadata.
- **Repli sécurisé :** Si `WAVE_WEBHOOK_SECRET` n'est pas renseigné, le point de terminaison renvoie `503 Service Unavailable`, et l'encaissement Wave en magasin est tracé comme `DECLARED_MANUAL` (en attente de vérification bancaire).

## 4. CinetPay
- **Mode d'intégration :** Notification API v2 & Vérification Serveur.
- **En-tête de signature :** `x-token` (ou transmission de signature de notification).
- **Validation serveur :** HMAC-SHA256 du corps brut JSON avec `CINETPAY_WEBHOOK_SECRET`.
- **Statut technique :** **Implémenté et testé (✓ PASS)**.
- **Réconciliation automatique :** Événements avec statut `ACCEPTED` ou `payment.success`, extraction `cpm_trans_id` et `invoiceId` via `cpm_custom`.
- **Absorption anti-collision :** Capture gracieuse des erreurs de contrainte d'unicité `P2002` lors des notifications concurrentes.
