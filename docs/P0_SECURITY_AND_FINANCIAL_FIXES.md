# Preuves Détaillées des Corrections P0 — Risques Critiques S0

**Date :** 1er Novembre 2026  
**Cible :** Risques S0-01 (Reset Global Plateforme) et S0-02 (Remboursement Cash Crédit Impayé)  
**Résultat :** Risques neutralisés au niveau applicatif et transactionnel. Preuves de tests exécutés avec succès.

---

## 1. S0-01 : Neutralisation du Reset Global de Plateforme

### A. Cause Racine
La route `POST /platform/reset-all` permettait d'exécuter un effacement global `deleteMany` sur les tables sans garantie d'interdiction en production, reposant uniquement sur un contrôle client et un mot de passe administrateur.

### B. Solution Implémentée Côté Serveur
Dans `apps/api/src/platform/platform-tenants.service.ts` :
1. Blocage strict si `process.env.NODE_ENV === 'production'`.
2. Blocage strict si `process.env.ALLOW_PLATFORM_RESET !== 'true'`.
3. Blocage strict si l'environnement n'est pas expressément `'test' | 'development' | 'qa'`.
4. Exigence de la phrase de confirmation cryptographique exacte : `JE-CONFIRME-LA-REINITIALISATION-COMPLETE-DES-DONNEES-DEMO`.
5. Vérification du hash sécurisé Argon2 du mot de passe administrateur.
6. Journalisation d'un événement d'audit système indélébile (`platform.reset_all.attempt`).

```ts
if (
  process.env.NODE_ENV === 'production' ||
  process.env.ALLOW_PLATFORM_RESET !== 'true' ||
  !['test', 'development', 'qa'].includes(process.env.NODE_ENV ?? '')
) {
  throw new ForbiddenException(
    'VTM-PLATFORM-RESET-FORBIDDEN: La réinitialisation globale de la plateforme est strictement interdite en production ou sans configuration QA dédiée.',
  );
}
```

### C. Preuves de Tests
Fichier : `apps/api/src/platform/platform-tenants.service.spec.ts`
- `✓ S0-01 : doit refuser catégoriquement la réinitialisation si NODE_ENV === 'production'` (PASS)
- `✓ S0-01 : doit refuser si ALLOW_PLATFORM_RESET !== 'true'` (PASS)
- `✓ S0-01 : doit refuser si phrase de confirmation incorrecte` (PASS)
- `✓ S0-01 : doit refuser si mot de passe administrateur incorrect` (PASS)

---

## 2. S0-02 : Interdiction du Remboursement CASH sur Vente à Crédit

### A. Règle Métier Fondamentale
Un commerçant ne peut jamais sortir d'argent physique de sa caisse pour rembourser une vente dont il n'a jamais perçu les fonds.

### B. Solution Implémentée Côté Serveur
Dans `apps/api/src/returns/returns.service.ts` :
1. Calcul côté serveur du montant d'espèces net réellement perçu sur la vente :
   ```ts
   const previousCashRefunds = await tx.refund.findMany({ where: { saleId: sale.id, method: 'CASH' } });
   const remainingCashAvailable = Math.max(0, totalCashPaidOnSale - alreadyRefundedCash);
   ```
2. Si la vente est intégralement à crédit et impayée :
   - Tout choix de remboursement financier (`CASH`, `MOBILE_MONEY`, etc.) est strictement rejeté avec code `VTM-RETURNS-CASH-REFUND-FORBIDDEN`.
   - La créance du client est automatiquement réduite du montant des articles retournés.
   - Un avoir (`CreditNote`) traçable est généré pour le client.
   - Le tiroir-caisse (`CashSession`) n'enregistre AUCUNE sortie d'argent.
3. Si la vente est partiellement payée en espèces :
   - Le remboursement en espèces est plafonné à `remainingCashAvailable`.
   - Toute demande excédant le montant perçu est rejetée avec code `VTM-RETURNS-REFUND-EXCEEDS-PAID`.
   - La créance restante est réduite pour la part non payée.

### C. Preuves de Tests
Fichier : `apps/api/src/returns/returns.service.spec.ts`
- `✓ S0-02 : refuse le remboursement CASH si la vente était intégralement à crédit impayée` (PASS)
- `✓ S0-02 : annule la créance client sans sortie de caisse lors du retour d'une vente à crédit` (PASS)
- `✓ S0-02 : autorise le remboursement CASH à concurrence du montant réellement encaissé sur vente mixte` (PASS)
- `✓ S0-02 : refuse une demande de remboursement CASH supérieure au montant d'espèces perçu` (PASS)
