# Couverture Frontend Commerçant et Console d'Administration — VTM SaaS

**Date :** 1er Novembre 2026  
**Applications :** `apps/client` (Commerçant) et `apps/admin` (Console Plateforme)

---

## 1. Parcours Commerçant (`apps/client`)

Tous les parcours critiques ont été validés avec compilation TypeScript stricte (`tsc -b`) et build Vite réussi sans erreur :

1. **Connexion & Authentification Multi-Cœurs :**
   - Cœur 1 (Vérification et anti-brute force).
   - Cœur 2 (Chiffrement et transport sécurisé de jeton).
   - Cœur 3 (Routage dynamique).
   - Cœur 4 (Bouclier anti-crash).
   - Cœur 5 (Isolation RLS et audit).
2. **Caisse & Vente au Comptoir (`/sales/new`) :**
   - Sélection du point de vente et du client.
   - Ajout d'articles au panier avec recherche en temps réel et scan code-barres.
   - Mise en attente (`HoldCart`) et reprise sécurisée.
   - Encaissement multi-moyens (Espèces avec rendu de monnaie, Mobile Money, Carte, Crédit).
   - Idempotence par onglet via `sessionStorage` évitant toute collision multi-fenêtres.
3. **Retours & Remboursements (`/sales`) :**
   - Sélection de la vente originale.
   - Rejet côté client et serveur de tout remboursement d'espèces sur crédit impayé.
   - Traitement des articles défectueux vers l'emplacement de quarantaine SAV.
4. **Catalogue & Stock (`/products`, `/inventory`) :**
   - Pagination sécurisée plafonnée à 100 éléments par page.
   - Recherche globale sur SKU, nom, marque et alias de recherche.
5. **Paramètres de l'Organisation (`/settings/config`) :**
   - Gestion de l'identité (Nom commercial, NIF/IFU, RCCM, logo officiel).
   - Personnalisation des 10 modèles de factures et reçus.
   - Activation/Désactivation de modules avec synchronisation serveur.

---

## 2. Console d'Administration Plateforme (`apps/admin`)

1. **Console Plateforme (`/tenants`, `/tenants/:id`) :**
   - Liste des organisations clientes, statut d'abonnement, période d'essai 14 jours.
   - Suspension, réactivation et diagnostics.
2. **Protection du Reset Global :**
   - Le bouton de réinitialisation globale est verrouillé et ne peut pas être déclenché en environnement de production côté serveur.
3. **Audit Système & Événements Outbox :**
   - Journalisation de l'ensemble des opérations administratives sensibles.
