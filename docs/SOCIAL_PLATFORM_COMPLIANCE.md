# Registre de Conformité des Plateformes Sociales & Politiques Officielles

**Date de révision : 18 octobre 2026**  
**Version du document : 1.0.0**  
**Périmètre :** Gestionnaire SaaS Universel de Commerce — Module Social Inbox

---

## 1. Principes Cardinaux d'Intégration Sociale

Le Gestionnaire SaaS Universel de Commerce s'interdit formellement :
- Tout scraping HTML ou automatisation non autorisée (headless browser).
- Toute rétro-ingénierie d'APIs privées ou non documentées.
- Le partage de mots de passe de comptes utilisateurs.
- La rotation de proxys / IPs pour contourner les quotas de requêtes.
- L'achat d'engagement artificiel (likes, abonnements, vues automatisés).
- Le spam automatisé ou les diffusions non sollicitées.

Toutes les intégrations sont implémentées exclusivement via les **APIs officielles des développeurs**, avec flux OAuth 2.0 / PKCE, signature cryptographique des webhooks (`HMAC-SHA256`), chiffrement des jetons au repos (`AES-256-GCM`), et vérification stricte de la conformité avant chaque envoi.

---

## 2. Matrice de Conformité par Plateforme

| Plateforme | Produit API Officiel | Version API | Scopes Autorisés Demandés | Fenêtre Conversationnelle | Statut Branchement Réel |
|---|---|---|---|---|---|
| **Facebook Messenger** | Meta Graph API (Messenger Platform) | v21.0 | `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement` | 24 heures (Initiation client) | `BLOQUÉE PAR ACCÈS EXTERNE` |
| **Instagram** | Instagram Platform / Messaging API | v21.0 | `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments` | 24 heures (Comptes pro/créateurs) | `BLOQUÉE PAR ACCÈS EXTERNE` |
| **TikTok** | TikTok for Business Messaging API | v1.3 | `business.message`, `video.comment` (vidéos possédées) | Selon quota et initiation utilisateur | `BLOQUÉE PAR ACCÈS EXTERNE` |
| **WhatsApp** | WhatsApp Cloud API (Business Platform) | v21.0 | `whatsapp_business_messaging`, `whatsapp_business_management` | 24 heures service client / Modèles approuvés hors fenêtre | `BLOQUÉE PAR ACCÈS EXTERNE` |

---

## 3. Politiques Spécifiques et Règles d'Envoi

### 3.1. WhatsApp Business Platform & Cloud API
- **Documentation officielle vérifiée :**
  - [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/)
  - [WhatsApp Cloud API Overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview)
  - [WhatsApp Opt-In Requirements](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)
  - [WhatsApp Message Templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- **Règles d'Opt-In et Consentement :**
  - Le destinataire doit avoir expressément donné son accord préalable (opt-in) avant toute réception de message professionnel.
  - La preuve du consentement est consignée dans le modèle `SocialConsent` avec date, canal, numéro de téléphone et statut.
  - Tout mot-clé d'arrêt (`STOP`, `ARRET`, `UNSUBSCRIBE`) ou demande via l'interface entraîne un statut immédiat `OPTED_OUT` et le blocage de tout futur envoi.
- **RESTRICTION ABSOLUE SUR LE RECOUVREMENT DE DETTES (Section 11.6 CDC) :**
  - La politique commerciale WhatsApp de Meta restreint formellement les activités de « debt collection » ou rappels menaçants de factures impayées.
  - **Décision d'architecture :** Le moteur `SocialComplianceService` bloque systématiquement toute relance de crédit sur le canal WhatsApp (`platform === 'WHATSAPP' && isDebtReminder`).
  - Aucun contournement de formulation n'est permis. Les relances de dettes sont automatiquement basculées vers les canaux autorisés : notification interne d'équipe, courriel officiel ou relance manuelle.

### 3.2. Meta Facebook Messenger Platform
- **Documentation officielle vérifiée :**
  - [Messenger Platform Policy](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy)
- **Fenêtre standard de 24 heures :**
  - Les réponses manuelles et automatisées ne peuvent être transmises que si le client a interagi avec la Page dans les 24 heures précédentes.
  - Au-delà de 24h, l'envoi direct est bloqué par `SocialComplianceService`.
  - Les étiquettes de message exceptionnelles (`HUMAN_AGENT` accordant jusqu'à 7 jours pour un conseiller humain) nécessitent une approbation explicite de Meta lors de l'App Review.

### 3.3. Instagram Messaging API
- **Documentation officielle vérifiée :**
  - [Instagram Messaging API Overview](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api)
- **Prérequis de compte :**
  - Comptes Instagram Professionnels ou Créateurs liés à une Page Facebook gérée.
  - Les comptes personnels ne sont pas éligibles (rejet explicite dans l'interface sans tenter de contournement).
- **Fenêtre de 24 heures :** Même politique que Messenger Platform.

### 3.4. TikTok for Business Messaging API
- **Documentation officielle vérifiée :**
  - [TikTok Business Messaging API Getting Started v1.3](https://business-api.tiktok.com/portal/docs/business-messaging-api-get-started/v1.3)
  - [TikTok Comments on Owned Videos](https://business-api.tiktok.com/portal/docs/get-comments-on-an-owned-video/v1.3)
- **Périmètre des données accessibles :**
  - Conversations et messages de la boîte de messagerie professionnelle autorisée.
  - Commentaires sur les vidéos appartenant au compte vérifié uniquement.
  - Aucun accès aux vidéos de tiers ni publication automatique de contenu sans revue dédiée.

---

## 4. Dispositif Anti-Abus et Protection des Comptes

1. **Vérification Pré-Envoi (`SocialComplianceService`) :**
   - Validation du compte social connecté et non révoqué (`CONNECTED`).
   - Vérification de la fenêtre temporelle de 24 heures.
   - Contrôle d'absence d'opt-out dans `SocialConsent`.
   - Contrôle d'interdiction de recouvrement de créances.
2. **Gestion des Quotas et Rate Limiting :**
   - Respect des en-têtes officiels (`X-Business-Use-Case-Usage`, `Retry-After`).
   - Backoff exponentiel avec jitter en cas de saturation réseau.
3. **Arrêt d'Urgence (Kill Switch) :**
   - Endpoint `POST /social/kill-switch` permettant à tout administrateur de geler immédiatement toutes les intégrations sociales et d'arrêter les flux asynchrones sans impacter les ventes du commerce.

---

## 5. État Réel des Connexions & Bloqueurs Externes

Conformément à la règle de vérité (Section 0.1 & 17 CDC), les statuts sont enregistrés ainsi :

- **Code, Schéma de base de données, Migrations, Contrôleurs et Adaptateurs :** `VÉRIFIÉE` (code présent, compilé, testé).
- **Service de Conformité et Filtres de Règles 24h/Dettes/Opt-out :** `VÉRIFIÉE` (tests unitaires exécutés avec succès).
- **Connexions réelles aux serveurs Meta / TikTok en production :** `BLOQUÉE PAR ACCÈS EXTERNE`.
  - *Bloqueurs humains restants :* Création des comptes développeurs par le client, déclaration des applications Meta / TikTok, soumission à l'App Review pour l'accès aux permissions avancées de messagerie, et configuration des clés `META_CLIENT_SECRET`, `TIKTOK_APP_SECRET`, `WHATSAPP_SYSTEM_TOKEN`.
