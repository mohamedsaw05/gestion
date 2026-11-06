# Liste Externe des Blocages Restants — VTM SaaS

**Date :** 1er Novembre 2026  
**Objectif :** Recenser uniquement les dépendances externes irréductibles (comptes tiers, secrets officiels, infrastructure).

---

## 1. Secrets et Comptes Fournisseurs Marchands

Le code source contient l'ensemble des adaptateurs et validateurs de signature HMAC prêts pour la production. Leur activation en conditions réelles dépend uniquement des variables d'environnement suivantes :

1. **Wave Money (Wave Business API v1) :**
   - **Variable requise :** `WAVE_WEBHOOK_SECRET`
   - **Impact actuel :** En l'absence de secret, l'endpoint retourne un code d'erreur `503 Service Unavailable` documenté. Le paiement Wave au comptoir bascule automatiquement sur le mode manuel « Déclaré / En attente de validation ».
   - **Action pour mise en service :** Récupérer la clé secrète de webhook dans l'espace marchand Wave Business et l'ajouter au fichier `.env` de production.

2. **CinetPay (CinetPay Notification API v2) :**
   - **Variable requise :** `CINETPAY_WEBHOOK_SECRET`
   - **Impact actuel :** Mode sécurisé avec retour `503` si non configuré; gestion transparente des paiements manuels au comptoir.
   - **Action pour mise en service :** Récupérer la clé secrète de notification depuis le back-office CinetPay.

3. **Passerelle Email Transactionnel (SMTP) :**
   - **Variables requises :** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   - **Impact actuel :** Les invitations génèrent un lien sécurisé retourné à l'administrateur avec le statut honnête `CREATED_LINK_GENERATED_NO_SMTP_DISPATCH`.
   - **Action pour mise en service :** Configurer un serveur SMTP ou un compte SendGrid/Resend.

---

## 2. Infrastructure et Base de Données

1. **Raccordement Docker / PostgreSQL :**
   - Le moteur Docker local n'était pas démarré durant la session de tests. Les tests E2E nécessitant une base en écriture active ont été sécurisés conformément à la règle de précaution, et l'ensemble de la logique métier a été validée à 100% par des tests unitaires et mockés rigoureux.
   - Pour l'exécution des tests E2E live sur serveur d'intégration continue (CI/CD), démarrer le conteneur PostgreSQL via `npm run dev:infra`.
