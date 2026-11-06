# Source de Vérité des Modules, Droits et Paramètres — VTM SaaS

**Date :** 1er Novembre 2026  
**Objectif :** Éliminer les autorisations optimistes basées sur `localStorage` et garantir l'autorité finale du serveur.

---

## 1. Source de Vérité Serveur

### A. Constat Initial
Le client stockait les modules activés dans `vtm_enabled_modules` dans `localStorage`. Un utilisateur pouvait modifier cette clé dans la console de son navigateur pour tenter d'afficher des modules désactivés.

### B. Architecture Serveur Implémentée
1. **Résolution Côté Serveur (`BusinessProfileService.getResolvedModules(tenantId)`) :**
   - Combine le profil de l'entreprise, le catalogue officiel, les capabilities obligatoires et le choix effectif stocké en base de données PostgreSQL.
2. **Exposition via `/me` (`apps/api/src/me/me.controller.ts`) :**
   - Le point de terminaison de profil retourne à chaque session et rafraîchissement :
     - `enabledCapabilities: string[]`
     - `enabledModules: string[]`
3. **Synchronisation Frontend (`apps/client/src/context/AuthContext.tsx`) :**
   - Lors de `loadProfile()` et de `refreshMenu()`, la liste retournée par le serveur met immédiatement à jour l'état applicatif.
4. **Persistance en Base Lors des Modifications :**
   - L'activation ou désactivation d'un module depuis la page Paramètres appelle l'endpoint dédié `PUT /business-profile/modules/:key` protégé par la permission `SETTINGS_MANAGE`.

---

## 2. Règle de Conservation des Données

Lorsqu'un module est désactivé pour un tenant :
- **Invisibilité :** Le module disparaît de la barre latérale, des raccourcis et des onglets de configuration.
- **Préservation Intégrale :** Aucune table, colonne ou donnée historique n'est supprimée ou modifiée.
- **Réactivation :** Lors d'une réactivation ultérieure, tous les enregistrements, historiques et paramètres antérieurs sont instantanément retrouvés sans corruption.

---

## 3. Cartographie des 34 Paramètres d'Organisation

Tous les paramètres enregistrés dans `OrganizationSetting` sont typés, validés par des DTO stricts et rattachés à des permissions appropriées (`SETTINGS_READ`, `SETTINGS_MANAGE`).
Les onglets spécialisés (`credit`, `inventory`, `social`) ne sont instanciés que si le module parent est actif pour le tenant authentifié.
