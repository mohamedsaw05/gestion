# Statut d'Implémentation du Bilinguisme Français / Anglais (FR/EN)

**Date :** 1er Novembre 2026  
**Application :** SaaS VTM — ViralTech Market  
**Architecture :** Type-safe lightweight i18n (`apps/client/src/lib/i18n.ts`)

---

## 1. Principes d'Implémentation

1. **Français par Défaut :** L'application s'initialise par défaut en français (`fr`).
2. **Support Anglais Complet :** L'anglais (`en`) est disponible et sélectionnable via le bouton de commutation dans l'en-tête de l'application (Header).
3. **Persistance :** Le choix de langue est conservé de manière persistante dans `localStorage.getItem('vtm_lang')` et synchronisé avec `document.documentElement.lang`.
4. **Zéro Rechargement Destructif :** Le changement de langue émet un événement personnalisé `vtm_lang_changed` permettant la mise à jour réactive sans perte de panier ou de saisie en cours.

---

## 2. Périmètre Traduit et Validé

- **Navigation Principale (`Layout.tsx`) :**
  - Tableau de bord / Dashboard
  - Ventes & Caisse / Sales & POS
  - Produits / Products
  - Stock & Dépôts / Stock & Inventory
  - Clients / Customers
  - Crédits & Risques / Credits & Risks
  - Factures & Devis / Invoices & Quotes
  - Dépenses / Expenses
  - Fournisseurs / Suppliers
  - Marché B2B / B2B Wholesale Market
  - Promotions / Promotions & Pricing
  - Partenaires / Partners
  - Services & Atelier / Services & Repairs
  - Paramètres & Réglages / Settings & Setup
- **Actions Communes :**
  - Enregistrer / Save
  - Annuler / Cancel
  - Confirmer / Confirm
  - Supprimer / Delete
  - Encaisser / Checkout
  - Imprimer / Print
  - Télécharger / Download
- **Formatage Monétaire et Calendaire :**
  - Formatage conforme aux locales `fr-FR` et `en-US` via `Intl.NumberFormat` et `Intl.DateTimeFormat`.
