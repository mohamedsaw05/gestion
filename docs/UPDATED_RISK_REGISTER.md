# Registre des Risques Actualisé (Risk Register) — VTM SaaS

**Date d'évaluation :** 1er Novembre 2026  
**Révision :** Version Post-Fiabilisation Candidate Release

---

| Réf. Risque | Niveau Initial | Description du Risque | Statut Post-Correction | Preuve de Clôture / Mitigation |
|---|---|---|---|---|
| **S0-01** | CRITIQUE | Réinitialisation globale de la plateforme en production | **RÉSOLU / NEUTRALISÉ** | Interdiction stricte côté serveur (`NODE_ENV === 'production'` rejeté, flag explicite requis, 4 tests unitaires). |
| **S0-02** | CRITIQUE | Remboursement CASH sur vente à crédit non payée | **RÉSOLU / NEUTRALISÉ** | Règle financière stricte : interdiction remboursement espèces, réduction de créance et avoir client (4 tests unitaires). |
| **S1-01** | ÉLEVÉ | Clé d'idempotence de caisse partagée entre onglets | **RÉSOLU / NEUTRALISÉ** | Migration vers `sessionStorage` + empreinte logique de requête côté serveur (2 tests unitaires). |
| **S1-02** | ÉLEVÉ | Reprise concurrente d'un panier suspendu | **RÉSOLU / NEUTRALISÉ** | Prise de possession atomique via `updateMany` conditionnel sur statut `HELD` (3 tests unitaires). |
| **S1-03** | MOYEN | Webhooks Wave et CinetPay non sécurisés | **RÉSOLU / SÉCURISÉ** | Validation de signature HMAC (Wave timestamp + CinetPay x-token) et absorption P2002 anti-rejeu (5 tests unitaires). |
| **S1-04** | MOYEN | Autorisation optimiste frontend basée sur `localStorage` | **RÉSOLU / SÉCURISÉ** | Source de vérité serveur via `/me` et `getResolvedModules` persistant en base PostgreSQL. |
| **S2-01** | FAIBLE | Bilinguisme FR/EN incomplet | **RÉSOLU / FONCTIONNEL** | Architecture i18n dédiée (`i18n.ts`), sélecteur persistant et formatage monétaire conforme. |
| **S2-02** | FAIBLE | Traçabilité ambiguë de l'envoi d'email d'invitation | **RÉSOLU / HONNÊTE** | Déclaration explicite du statut `CREATED_LINK_GENERATED_NO_SMTP_DISPATCH` tant que le SMTP n'est pas branché. |
