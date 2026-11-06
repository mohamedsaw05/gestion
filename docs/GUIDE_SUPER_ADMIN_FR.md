# Guide Super Admin — Console Plateforme SaaS VTM

Ce document est réservé aux administrateurs de la société **ViralTech Market (VTM)** opérant la plateforme SaaS.

---

## 1. Accès & Authentification Super Admin

- **URL de la console :** `https://admin.vtm-market.com` (ou `http://localhost:5174` en développement).
- **Rôle requis :** `PLATFORM_ADMIN` (table `PlatformAdminUser`).
- **Création d'un accès administrateur :**
  ```bash
  PLATFORM_ADMIN_EMAIL="direction@viraltechmarket.com" PLATFORM_ADMIN_PASSWORD="MotDePasseFort!" npm run platform:create-admin
  ```
- **Sécurité :** Authentification isolée de la base commerçante, hachage Argon2id, jetons JWT spécifiques avec garde d'accès serveur `PlatformAdminGuard`.

---

## 2. Gestion des Entreprises Clientes (Tenants)

Dans l'onglet **Organisations** :

- **Création d'une nouvelle entreprise :**
  - Nom commercial et raison sociale légale.
  - Email de contact et numéro de téléphone.
  - Essai initial de 14 jours et tarifs commerciaux de 3, 6, 12 ou 24 mois, calculés depuis le prix mensuel central.
  - Création automatique du compte Propriétaire (`OWNER`), de la première boutique (`Boutique Principale`) et des rôles d'accès initiaux.
- **Modification des informations :**
  - Mise à jour du nom, coordonnées, email ou statut (Actif / Suspendu).
- **Statut & Quotas :**
  - Suivi du nombre d'utilisateurs actifs, d'emplacements configurés et du volume de transactions.

---

## 3. Gestion des Abonnements, Plans & Facturation SaaS

Dans l'onglet **Abonnements & Plans** :

- **Configuration des Plans :**
  - Définition des tarifs périodiques (mensuel, annuel).
  - Plafonds de quotas (nombre max d'utilisateurs, de boutiques, de produits).
  - Modules inclus ou optionnels.
- **Cycle de Vie d'Abonnement :**
  - **Période d'essai (Trial) :** Active par défaut 14 jours à la création.
  - **Actif :** Abonnement réglé et en cours de validité.
  - **Suspendu (Past Due / Expired) :** L'accès de l'entreprise est restreint sans aucune suppression de données. L'entreprise peut réactiver son accès en régularisant sa situation.
- **Facturation & Règlements :**
  - Génération des factures d'abonnement SaaS.
  - Enregistrement des règlements manuels (Virement bancaire, Orange Money, Moov Money, Wave, CinetPay).
  - Réconciliation avec référence de transaction obligatoire.

---

## 4. Diagnostics & Catalogue des Erreurs

Dans l'onglet **Diagnostics & Erreurs** :

- **Sonde système en direct :**
  - Statut de connectivité PostgreSQL et latence en millisecondes.
  - État de la file d'attente asynchrone Outbox (`pendingEvents`, âge du plus ancien événement).
  - Consommation mémoire (Heap used, RSS).
- **Catalogue Officiel des Codes d'Erreur :**
  - Référence des codes normalisés (ex: `VTM-AUTH-001`, `VTM-STOCK-002`, `VTM-RESET-003`).
  - Diagnostic immédiat avec cause technique et action corrective préconisée.

---

## 5. Procédures de Sauvegarde & Réinitialisation Sécurisée

### 5.1 Sauvegarde Exportable d'une Organisation
1. Sélectionnez l'entreprise cible dans la console.
2. Cliquez sur le bouton bleu **« Télécharger la Sauvegarde (.json) »**.
3. Le backend extrait l'ensemble des données (produits, ventes, clients, stocks, factures, paramètres) et consigne une entrée inaltérable `TENANT_BACKUP_EXPORTED` dans le journal d'audit.

### 5.2 Réinitialisation Individuelle d'une Entreprise
Cette opération remet à zéro les données d'activité d'une boutique (ventes, stocks, dépenses, clients) suite à des erreurs de saisie lors d'une phase de test :
- **Prérequis stricts côté serveur :**
  1. Mot de passe Super Admin valide.
  2. Saisie exacte de la phrase de confirmation : `CONFIRMER REINITIALISATION NomDeLEntreprise`.
  3. Vérification que la case de certification de sauvegarde est cochée (`backupConfirmed = true`).
  4. Le serveur vérifie qu'une sauvegarde a été exportée ; si aucune n'est trouvée, il génère automatiquement une sauvegarde d'urgence avant toute suppression.
- **Données préservées :** Compte de l'organisation, comptes utilisateurs, rôles, abonnements, boutiques, logos officiels.
- **Isolation :** Exécuté dans une transaction stricte ne touchant JAMAIS les autres entreprises clientes.

### 5.3 Réinitialisation Globale (Environnements de Test / Démo Uniquement)
- **Règle absolue :** **FORMELLEMENT INTERDITE ET BLOQUÉE EN ENVIRONNEMENT DE PRODUCTION** (`NODE_ENV=production`).
- Requiert `ALLOW_PLATFORM_RESET=true` en environnement QA / test isolé.
- Exige obligatoirement l'identifiant d'un tenant de démonstration certifié (`targetDemoTenantId`).
- Tout effacement non borné de données réelles est rejeté avec code 403 Forbidden.

