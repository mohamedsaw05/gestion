# Registre des Diagnostics et Codes d'Erreur — VTM SaaS

Ce document constitue le catalogue officiel des codes d'erreur normalisés émis par le **Gestionnaire Commercial SaaS VTM**. Chaque code permet un diagnostic instantané et propose une action corrective directe.

---

## 1. Structure d'un Code d'Erreur VTM

Chaque code suit la convention : `VTM-[DOMAINE]-[NUMÉRO]`
- `VTM-AUTH` : Authentification, sessions, mots de passe et jetons.
- `VTM-RBAC` : Droits d'accès, permissions et restrictions de périmètre d'emplacement.
- `VTM-CATALOG` : Catalogue, produits, unités, prix et codes-barres.
- `VTM-STOCK` : Niveaux de stock, mouvements, transferts et inventaires.
- `VTM-SALE` : Point de vente, calculs, remises, encaissements et monnaie.
- `VTM-CREDIT` : Soldes débiteurs, plafonds autorisés et remboursements clients.
- `VTM-RESET` : Réinitialisations d'organisation et protections de sécurité.
- `VTM-SAAS` : Gestion plateforme, abonnements, quotas et facturation éditeur.

---

## 2. Répertoire des Codes Principaux

| Code d'Erreur | Domaine | Message / Signification | Cause Technique Fréquente | Action Corrective Recommandée |
|---|---|---|---|---|
| `VTM-AUTH-001` | Authentification | Identifiants invalides | Email ou mot de passe erroné | Vérifier l'orthographe de l'adresse email et du mot de passe. |
| `VTM-AUTH-002` | Authentification | Jeton d'accès expiré | Le token JWT de 15 min est échu | L'application cliente déclenche automatiquement `/auth/refresh`. |
| `VTM-AUTH-003` | Authentification | Session expirée ou révoquée | Le refresh token a été invalidé | Rediriger l'utilisateur vers l'écran de connexion. |
| `VTM-RBAC-001` | Autorisations | Permission manquante | L'utilisateur n'a pas le droit requis | Attribuer la permission correspondante au rôle de l'utilisateur. |
| `VTM-RBAC-002` | Périmètre | Hors du périmètre d'emplacement | L'utilisateur tente d'agir sur un dépôt non assigné | Vérifier l'emplacement sélectionné dans la barre supérieure. |
| `VTM-CATALOG-001`| Catalogue | Code-barres déjà attribué | Unicité du code-barres violée | Choisir un code-barres unique au sein de l'entreprise. |
| `VTM-CATALOG-002`| Catalogue | Unité de conversion invalide | Facteur de conversion ≤ 0 | Définir un ratio de conversion strict supérieur à zéro. |
| `VTM-STOCK-001` | Stocks | Stock disponible insuffisant | Vente ou transfert supérieur au stock | Réceptionner du stock ou activer temporairement l'option stock négatif. |
| `VTM-STOCK-002` | Stocks | Emplacement source identique à destination | Transfert inter-dépôts redondant | Sélectionner deux emplacements distincts pour le transfert. |
| `VTM-SALE-001` | Ventes | Panier vide | Tentative d'encaissement sans article | Ajouter au moins un produit avant de cliquer sur Encaisser. |
| `VTM-SALE-002` | Ventes | Montant perçu insuffisant | Le montant reçu est inférieur au total dû | Compléter le paiement ou affecter le solde restant au crédit client. |
| `VTM-CREDIT-001`| Crédits | Plafond de crédit client dépassé | La créance totale excéderait la limite | Augmenter le plafond du client ou demander un règlement partiel. |
| `VTM-CREDIT-002`| Crédits | Client obligatoire pour vente à crédit | Aucun client n'a été rattaché | Sélectionner la fiche du client bénéficiaire du crédit. |
| `VTM-RESET-001` | Sécurité Reset | Réinitialisation globale interdite en production | Appel de `reset-all` avec `NODE_ENV=production` | Cette commande est strictement désactivée en production. |
| `VTM-RESET-002` | Sécurité Reset | Sauvegarde préalable requise | `backupConfirmed` faux ou sauvegarde non exportée | Télécharger d'abord la sauvegarde de l'organisation avant réinitialisation. |
| `VTM-RESET-003` | Sécurité Reset | Phrase de confirmation incorrecte | Saisie non conforme de la phrase requise | Saisir exactement : `CONFIRMER REINITIALISATION NomEntreprise`. |
| `VTM-SAAS-001` | SaaS | Quota d'utilisateurs atteint | Le plan actuel ne permet plus d'ajouts | Passer au plan supérieur dans la console Super Admin. |
| `VTM-SAAS-002` | SaaS | Entreprise suspendue pour impayé | Abonnement expiré sans règlement | Procéder au règlement de l'abonnement pour réactivation instantanée. |

---

## 3. Utilisation de la Sonde `/health`

La sonde `/health` permet de distinguer instantanément un incident d'infrastructure d'un problème fonctionnel :
- Si `database.status == "down"` : vérifier les identifiants ou le réseau PostgreSQL sur Render.
- Si `outboxQueue.status == "lagging"` : la file de traitement asynchrone a du retard.
- Si `status == "healthy"` : l'infrastructure est nominale.

