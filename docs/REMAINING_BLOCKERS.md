# Blocages Externes et Décisions Commerciales Restantes — VTM SaaS

**Date :** 1er Novembre 2026  
**Objectif :** Recenser avec précision les seuls éléments ne pouvant pas être déduits du code et nécessitant des clés externes ou des choix commerciaux finaux.

---

## 1. Identifiants et Comptes Fournisseurs Externes

Le code applicatif et les adaptateurs sont 100% prêts et testés avec leurs signatures cryptographiques. La mise en service réelle dépend uniquement de la fourniture des clés marchandes en production :

1. **Wave Merchant :**
   - Variable requise : `WAVE_WEBHOOK_SECRET`
   - Recommandation : Obtenir le webhook secret depuis le portail Wave Business et le renseigner dans les variables d'environnement du serveur de production.
2. **CinetPay Merchant :**
   - Variable requise : `CINETPAY_WEBHOOK_SECRET`
   - Recommandation : Obtenir la clé secrète de notification depuis le back-office CinetPay.
3. **Fournisseur Email Transactionnel (SMTP / Sendgrid / Resend) :**
   - Variables requises : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` ou clé API dédiée.
   - Recommandation : Tant que ces clés ne sont pas renseignées, le système fonctionne de manière sûre et transparente en affichant le lien d'invitation généré pour copie directe.

---

## 2. Décisions Métier et Commerciales

1. **Politique Commerciale Post-Essai Gratuit :**
   - Période d'essai : 14 jours (implémenté).
   - Accès post-expiration : Les données client ne sont jamais supprimées. L'accès bascule en consultation restreinte et invite à souscrire un plan actif.
2. **Nom de Domaine de Production et Résolution Multi-Tenant :**
   - Le système supporte la résolution de tenant par en-tête / session. Le mapping par sous-domaine (`*.viraltechmarket.com`) nécessite la configuration des entrées DNS wildcard.
