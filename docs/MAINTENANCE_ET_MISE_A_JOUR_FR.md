# Guide de Maintenance et Procédures de Mise à Jour — VTM SaaS

Ce guide décrit la méthodologie pour apporter des correctifs et des évolutions futures au **Gestionnaire Commercial SaaS VTM** sans interrompre les activités des commerçants ni corrompre les données en production.

---

## 1. Principes Directeurs d'Évolution Sans Régression

1. **Rétrocompatibilité du Schéma de Base :**
   - Ne supprimez ni ne renommez jamais une colonne existante dans une même version sans avoir au préalable déployé un code tolérant.
   - Ajoutez toujours les nouvelles colonnes avec des valeurs par défaut (`@default(...)`) ou en mode optionnel (`?`).
2. **Migrations Déployées Automatiquement :**
   - Sur Render, les migrations Prisma sont exécutées via la commande `preDeployCommand` :
     ```bash
     npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
     ```
   - Si la migration échoue, Render annule le déploiement et maintient l'ancienne version active (*Zero Downtime Failover*).
3. **Compilation Stricte en Amont :**
   - Aucun déploiement ne doit être effectué sans validation locale préalable par `npm run build` et `npm run test:api`.

---

## 2. Procédure Pas-à-Pas pour Déployer une Mise à Jour

### Étape 1 : Développement & Tests Locaux
1. Créez une branche Git pour votre correction :
   ```bash
   git checkout -b fix/nom-du-correctif
   ```
2. Apportez vos modifications de code.
3. Si le schéma Prisma est modifié :
   ```bash
   npm run db:migrate -- --name nom_de_la_migration
   ```
4. Exécutez la suite de tests pour vérifier l'absence de régression :
   ```bash
   npm run test:api
   npm run build
   ```

### Étape 2 : Création de la Sauvegarde Pré-Déploiement
Avant de pousser votre code en production, déclenchez une sauvegarde complète :
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
```

### Étape 3 : Fusion & Déploiement Render
1. Fusionnez votre branche sur `main` :
   ```bash
   git checkout main
   git merge fix/nom-du-correctif
   git push origin main
   ```
2. Render détecte automatiquement le nouveau commit sur `main` :
   - Exécute le `buildCommand`.
   - Exécute le `preDeployCommand` (migrations Prisma).
   - Démarre la nouvelle version de l'API.
   - Vérifie la sonde `/health`.
   - Bascule le trafic vers la nouvelle version.
   - Met à jour les sites statiques Vite (`vtm-client`, `vtm-admin`, `vtm-site`).

---

## 3. Procédure de Retour Arrière (Rollback)

Si un problème imprévu survient après le déploiement :

1. Rendez-vous dans le tableau de bord Render : **Dashboard > vtm-api > Deploys**.
2. Repérez le déploiement stable précédent.
3. Cliquez sur **Rollback to this deploy**.
4. Render réactive instantanément l'ancienne version.
5. Si une migration de base doit être annulée, restaurez la sauvegarde pré-déploiement selon la procédure décrite dans [`docs/SAUVEGARDE_RESTAURATION_FR.md`](file:///c:/Users/MOHAMED%20SAVADOGO/Downloads/gestionnaire%20de%20project/docs/SAUVEGARDE_RESTAURATION_FR.md).

