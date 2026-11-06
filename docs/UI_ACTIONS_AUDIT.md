# AUDIT DES ACTIONS UI, BOUTONS, ACTIONS DE MASSE ET RÉSISTANCE AUX CLICS RAPIDES — VTM

**Document de référence :** `docs/UI_ACTIONS_AUDIT.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Niveau de preuve :** `CODE INSPECTÉ` & `TEST REJOUÉ` (Tests unitaires et E2E d'idempotence)

---

## 1. INVENTAIRE DES ACTIONS SENSIBLES ET COMPORTEMENT FACE AUX CLICS RAPIDES

Dans une application de gestion commerciale, les clics répétés (nerveux ou suite à un ralentissement réseau) sur les boutons d'action représentent le premier facteur de doublons financiers, d'écarts de caisse et de corruptions de stock.

### Matrice d'Audit des Actions Clés

| Action UI / Bouton | Écran | Protection Visuelle Frontend | Protection Backend | Comportement sous 10 clics rapides | Risque / Verdict |
|---|---|---|---|---|---|
| **"Valider la vente / Encaisser"** | POS (`NewSalePage.tsx`) | `isSubmitting` désactive le bouton | `operationId` (idempotence) via header | **1 seule vente créée**. Les 9 autres clics retournent la vente initiale en cache 200 OK. | **Sécurisé en mono-onglet**. Vulnérable si 2 onglets ouverts sur le même magasin (`S1-01`). |
| **"Suspendre le panier"** | POS (`NewSalePage.tsx`) | Désactivation temporaire | Création de ligne `HeldCart` | Si double-clic avant désactivation, 2 paniers identiques sont créés en base. | **Risque modéré de doublon de brouillon**. |
| **"Reprendre le panier"** | Modal Panier Suspendu | Fermeture de la modale | Transaction `READ COMMITTED` | Si deux caissiers cliquent au même instant, les deux reprennent le panier (`S1-02`). | **RISQUE CRITIQUE S1-02** (Concurrence sur `findFirst`). |
| **"Enregistrer un remboursement crédit"** | Crédit (`CreditAccountsPage.tsx`) | Spinner de chargement | Transaction atomique Prisma | 1 seul paiement enregistré si le frontend attend la réponse. Double clic rapide sans attendre peut créer 2 paiements. | **Risque financier si latence réseau**. |
| **"Annuler la vente"** | Historique ventes | Modal de confirmation avec saisie du motif | Vérification du statut `CANCELLED` dans une transaction | Si clics multiples, le premier annule la vente, les suivants échouent avec `400 VTM-SALE-ALREADY-CANCELLED`. | **Sécurisé et idempotent**. |
| **"Clôturer la session de caisse"** | Caisse (`CashSessionsPage.tsx`) | Bouton désactivé | Statut `CLOSED` contrôlé | Le premier clic clôture, les clics suivants retournent une erreur `Session déjà clôturée`. | **Sécurisé**. |
| **"Transférer du stock"** | Stock (`StockTransferModal.tsx`) | Bouton désactivé | Transaction atomique débit/crédit | Clics rapides bloqués côté client ; le backend vérifie le stock disponible. | **Sécurisé contre le stock négatif**. |
| **"Supprimer un produit"** | Catalogue | Modal de confirmation | Soft delete (`deletedAt` ou vérification d'utilisation) | Si le produit est lié à une vente existante, la suppression physique est rejetée. | **Sécurisé (Intégrité référentielle préservée)**. |

---

## 2. AUDIT DES ACTIONS DE SÉLECTION MULTIPLE ET OPÉRATIONS EN MASSE

L'audit a passé au crible les tableaux de données (Produits, Ventes, Clients, Factures) :

1. **Portée des sélections :**
   - La case à cocher "Tout sélectionner" en en-tête de tableau sélectionne **uniquement les éléments affichés sur la page courante** (20 ou 50 éléments), et NON l'intégralité des données filtrées de l'organisation.
   - **Risque UX :** L'utilisateur peut penser avoir supprimé 500 produits alors qu'il n'a supprimé que les 20 visibles.
   - **Recommandation :** Afficher un bandeau explicatif : *"20 éléments sélectionnés sur cette page. [Sélectionner les 342 éléments correspondants]"*.

2. **Absence de double confirmation pour les actions destructives groupées :**
   - Les suppressions en masse d'articles déclenchent une modale simple `Êtes-vous sûr ?`. Pour des volumes importants (> 50 articles), une double confirmation (saisie du mot "SUPPRIMER") doit être instaurée pour éviter les fausses manipulations sur écran tactile.

---

## 3. COMPORTEMENT EN CAS DE COUPURE RÉSEAU OU RAFRAÎCHISSEMENT PENDANT TRAITEMENT

- **Coupure réseau après validation d'une vente :**
  - Si le client envoie la requête et perd la connexion avant de recevoir la réponse 201 Created :
  - La transaction a été validée en base côté serveur.
  - Au retour du réseau, le caissier voit un message d'erreur réseau et reclique sur "Valider".
  - **Résultat réel :** Le mécanisme d'idempotence `operationId` intercepte la seconde requête, détecte la transaction déjà commitée, et renvoie le ticket déjà généré sans débiter à nouveau le stock ni dupliquer le paiement. **C'est une excellente conception architecturale validée par test unitaire.**
