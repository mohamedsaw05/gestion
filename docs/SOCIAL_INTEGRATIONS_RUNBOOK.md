# Runbook d'Exploitation : Intégrations Sociales & Webhooks

**Date de rédaction : 18 octobre 2026**  
**Version : 1.0.0**  
**Public :** Administrateurs SaaS, Développeurs, Équipes Support

---

## 1. Vue d'Ensemble de l'Architecture

Le module `social` d'`apps/api` fournit une interface unifiée pour 4 canaux officiels :
1. **Facebook Messenger** (Meta Graph API)
2. **Instagram Direct** (Instagram Platform API)
3. **TikTok Business Messaging** (TikTok for Business API)
4. **WhatsApp Business Platform** (WhatsApp Cloud API)

Les jetons d'accès OAuth sont chiffrés au repos via l'utilitaire cryptographique avec clé maîtresse `SOCIAL_ENCRYPTION_KEY` (AES-256-GCM). Aucun jeton ou secret n'est exposé au client ni consigné dans les logs.

---

## 2. Variables d'Environnement Requises

Pour activer les connexions réelles en production, renseigner dans `.env` :

```env
# Clé de chiffrement des tokens au repos (32 octets hexadécimaux)
SOCIAL_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Meta (Facebook & Instagram)
META_APP_ID=
META_CLIENT_SECRET=
META_WEBHOOK_VERIFY_TOKEN=gestionnaire_meta_webhook_secret_2026

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=gestionnaire_whatsapp_verify_2026

# TikTok for Business
TIKTOK_APP_ID=
TIKTOK_APP_SECRET=
TIKTOK_WEBHOOK_VERIFY_TOKEN=gestionnaire_tiktok_verify_2026
```

---

## 3. Endpoints des Webhooks Officiels

Les webhooks doivent être configurés sur les portails développeurs respectifs :

### 3.1. Meta (Facebook & Instagram)
- **Callback URL :** `https://api.votre-domaine.com/social/webhooks/meta`
- **Validation Challenge :** `GET /social/webhooks/meta?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...`
- **Réception des événements :** `POST /social/webhooks/meta` (Vérification de signature `X-Hub-Signature-256`)

### 3.2. WhatsApp Cloud API
- **Callback URL :** `https://api.votre-domaine.com/social/webhooks/whatsapp`
- **Validation Challenge :** `GET /social/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...`
- **Réception des messages & accusés :** `POST /social/webhooks/whatsapp`

### 3.3. TikTok Business
- **Callback URL :** `https://api.votre-domaine.com/social/webhooks/tiktok`
- **Vérification de signature :** En-tête `X-TikTok-Signature` HMAC-SHA256

---

## 4. Procédures Opérationnelles

### 4.1. Connexion d'un compte commerçant (OAuth)
1. L'administrateur clique sur **« Connecter OAuth »** dans `/social`.
2. L'API génère un URL d'autorisation avec paramètre `state` anti-CSRF aléatoire et PKCE.
3. L'utilisateur valide les autorisations sur le portail de la plateforme.
4. Le callback échange le code contre un jeton à long terme, le chiffre et l'enregistre dans `SocialAccount` avec statut `CONNECTED`.

### 4.2. Révocation / Déconnexion Propre
- Requête : `DELETE /social/accounts/:id`
- L'API révoque le jeton auprès du fournisseur distant, supprime les secrets chiffrés et passe le statut à `DISCONNECTED`.
- Les messages et fils historiques sont conservés dans le CRM pour la mémoire commerciale du tenant.

### 4.3. Procédure d'Arrêt d'Urgence (Kill Switch)
En cas d'anomalie de plateforme, de suspicion d'abus, de violation de politique ou d'alerte de restriction :
1. Déclencher le bouton d'urgence sur `/social` ou exécuter :
   ```bash
   curl -X POST https://api.votre-domaine.com/social/kill-switch \
     -H "Authorization: Bearer <TOKEN_ADMIN>"
   ```
2. **Conséquence immédiate :** Tous les comptes sociaux passent à l'état `DISCONNECTED`, toutes les files d'envoi sortantes sont suspendues, aucune requête réseau supplémentaire n'est émise.
3. Le fonctionnement commercial (ventes en caisse, inventaire, facturation) reste **100% opérationnel et totalement étanche**.

### 4.4. Dépannage en Cas d'Erreur 24h ou Rejet
- **Erreur « Fenêtre de messagerie Meta fermée » :** Signifie que 24 heures se sont écoulées sans nouveau message du client. L'utilisateur doit attendre une réouverture par le client ou utiliser un modèle pré-approuvé (WhatsApp).
- **Erreur « Recouvrement de créances formellement restreint » :** Respect strict de la politique Meta. Aucune dérogation technique. Proposer l'envoi d'un courriel officiel ou une notification interne.
