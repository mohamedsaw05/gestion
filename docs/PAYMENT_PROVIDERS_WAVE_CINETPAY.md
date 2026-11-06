# Intégration des Fournisseurs de Paiement Wave, CinetPay, Stripe & Paystack

**Date :** 1er Novembre 2026  
**Auditeur :** Ingénieur Sécurité Applicative VTM SaaS

---

## 1. Documentation Officielle et Principes de Sécurité

Conformément aux directives de sécurité :
- Aucune API ni signature n'a été inventée.
- Les documentations officielles actuelles des fournisseurs ont été prises pour référence.
- Aucun paiement n'est validé sur simple saisie de référence ou redirection navigateur client.

### A. Wave
- **Spécification Webhook :** Wave Business API v1.
- **En-tête de signature :** `Wave-Signature` au format `t=<timestamp>,v1=<signature_hex>`.
- **Calcul de signature :** HMAC-SHA256 de la chaîne concaténée `${timestamp}${rawPayload}` avec le secret webhook (`WAVE_WEBHOOK_SECRET`).
- **Tolérance d'horodatage :** 5 minutes maximum pour contrer les attaques par rejeu temporel.
- **Événements supportés :** `checkout.session.completed`.

### B. CinetPay
- **Spécification Webhook :** CinetPay Notification API v2.
- **En-tête de signature :** `x-token` (ou transmission de signature HMAC dans les en-têtes HTTP de notification).
- **Calcul de signature :** HMAC-SHA256 du corps brut JSON avec `CINETPAY_WEBHOOK_SECRET`.
- **Champs de réconciliation :** `cpm_trans_id`, `cpm_trans_status` (`ACCEPTED`), et identifiant facture dans `cpm_custom`.

### C. Stripe & Paystack
- **Stripe :** `stripe-signature` validé via SDK officiel avec `STRIPE_WEBHOOK_SECRET`.
- **Paystack :** `x-paystack-signature` validé via HMAC-SHA512 avec `PAYSTACK_SECRET_KEY`.

---

## 2. Robustesse et Anti-Collision Sous Concurrence

Dans `apps/api/src/platform/platform-webhooks.service.ts` :
1. **Enregistrement Préalable dans `PspWebhookEvent` :**
   - Contrainte d'unicité sur `(provider, eventId)`.
   - Si deux requêtes de webhook concurrentes arrivent pour le même événement, la seconde déclenche une violation d'unicité PostgreSQL `P2002`.
   - Le service intercepte proprement `err?.code === 'P2002'` et retourne `{ status: 'ignored', reason: 'duplicate_notification' }`, évitant ainsi tout double crédit ou erreur HTTP 500 retournée au fournisseur.
2. **Absence de Secrets Configurés :**
   - Si les variables d'environnement (`WAVE_WEBHOOK_SECRET`, `CINETPAY_WEBHOOK_SECRET`) sont absentes, le service retourne `ServiceUnavailableException` (`503`), documentant que le point de terminaison n'est pas configuré.

---

## 3. Preuves de Tests
Fichier : `apps/api/src/platform/platform-webhooks.service.spec.ts`
- `✓ rejette un webhook avec signature invalide (401)` (PASS)
- `✓ traite avec succès un webhook Stripe authentique et appelle recordInvoicePayment` (PASS)
- `✓ traite avec succès un webhook Wave authentique avec signature t=...,v1=...` (PASS)
- `✓ traite avec succès un webhook CinetPay authentique avec signature x-token` (PASS)
- `✓ ignore de façon idempotente une notification déjà reçue (replay attack protection)` (PASS)
