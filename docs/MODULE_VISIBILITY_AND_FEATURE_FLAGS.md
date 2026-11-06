# AUDIT DE VISIBILITÉ DES MODULES, FEATURE FLAGS ET PERMISSIONS — VTM

**Document de référence :** `docs/MODULE_VISIBILITY_AND_FEATURE_FLAGS.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  

---

## 1. RÈGLES DE GOUVERNANCE ET DE CYCLE DE VIE DES MODULES

Dans l'architecture VTM, l'accès à une fonctionnalité repose sur une chaîne d'autorisations à 4 niveaux :
1. **Plan SaaS Souscrit :** Le contrat commercial de l'organisation inclut ou exclut le domaine fonctionnel (`TenantPlan`).
2. **Capability de l'Organisation :** Le propriétaire a activé le domaine dans son profil d'activité (`BusinessProfile.capabilities`).
3. **Module & Dépendances :** Le module est actif et toutes ses dépendances sont satisfaites (`MODULES_CATALOG`).
4. **Permissions Rôle Utilisateur :** L'utilisateur connecté possède le jeton de permission RBAC nécessaire (`User.rolePermissions`).

---

## 2. STATUTS DE DÉSACTIVATION ET COMPORTEMENTS ATTENDUS VS RÉELS

| Statut du Module | Comportement Attendu | Comportement Réel Observé (Audit) | Écart / Risque |
|---|---|---|---|
| **Non souscrit (Plan)** | Menu masqué, routes API renvoient 403 `FORBIDDEN_SUBSCRIPTION_PLAN`, page d'upgrade disponible. | API protège via `SubscriptionGuard`. Mais si l'utilisateur saisit l'URL directe `/credit`, le frontend affiche un écran blanc ou une erreur non catchée. | UX dégradée (manque un écran pédagogique « Fonctionnalité non incluse dans votre offre »). |
| **Désactivé par le Propriétaire** | Menu masqué, sous-menus masqués, réglages associés masqués, données conservées intactes en base. | Le menu disparaît du sidebar, mais les paramètres restent éditables dans `/settings` si l'utilisateur navigue dans les onglets. | Fuite de surface de configuration pour module inactif. |
| **Suspendu par SuperAdmin** | Blocage immédiat de toutes les écritures du tenant (`423 LOCKED`), conservation des données. | `POST /platform/tenants/:id/suspend` applique bien le statut `SUSPENDED`. L'API bloque toute transaction via le middleware d'authentification. | **Conforme**. |
| **Intégration Externe Manquante (ex: WhatsApp/Meta)** | Boutons désactivés avec badge « Configuration requise », pas de crash. | Les actions tentent un appel API qui échoue avec une erreur générique au lieu d'inviter à renseigner le token API. | Erreur frustrante pour le commerçant. |
| **Incomplet / Expérimental (ex: Fidélité)** | Masqué par défaut en production, accessible uniquement avec flag expérimental explicitement activé. | Catégorisé `ADVANCED` ou `OPTIONAL` dans `modules.catalog.ts`. Les routes partielles répondent mais ne finalisent pas l'action. | Risque de promesse non tenue au client. |

---

## 3. ÉTANCHÉITÉ DES ROUTES API CÔTÉ SERVEUR (DEFENSE IN DEPTH)

L'audit confirme que **masquer un menu dans le frontend ne constitue pas une sécurité** :
- **Audit des Gardes NestJS :** 
  - La plupart des contrôleurs sensibles (`SalesController`, `ProductsController`, `InventoryController`) implémentent `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`.
  - **Faille détectée :** Certaines routes secondaires (ex: consultation de templates de reçus ou export de statistiques basiques) vérifient uniquement l'authentification (`JwtAuthGuard`), sans contrôler si le module sous-jacent est activé pour l'organisation appelante.
- **Préservation des Données :**
  - Lors de la désactivation d'un module (ex: `CUSTOMER_CREDIT`), les tables associées (`CreditAccount`, `CreditMovement`) **ne sont jamais purgées ni tronquées**.
  - Si le propriétaire réactive le module 6 mois plus tard, l'ensemble des historiques, des soldes et des fiches clients réapparaît instantanément sans aucune perte de données. Ce comportement est formellement vérifié et validé dans le code.

---

## 4. RECOMMANDATIONS POUR LA PHASE POST-AUDIT

1. **Synchronisation du Menu Client :** Remplacer le système `localStorage.getItem('vtm_enabled_modules')` par la consommation directe des `capabilities` renvoyées par l'endpoint `/auth/me` lors du login.
2. **Écrans d'état explicatifs :** Créer un composant réutilisable `<FeatureLockedState planRequired="PRO" />` affiché lorsqu'un utilisateur navigue par URL directe vers un module non souscrit.
3. **Filtrage des paramètres :** Adapter l'écran des réglages pour n'afficher que les cartes de configuration des modules actuellement actifs dans l'organisation.
