# SYSTÈME DE DESIGN & EXPÉRIENCE UTILISATEUR (UI/UX)
**Gestionnaire SaaS Universel de Commerce**

Ce document formalise les conventions graphiques, la hiérarchie de navigation, les composants partagés et les principes d'utilisabilité déployés dans le frontend du SaaS.

---

## 1. Principes Directeurs

1. **Puissance à l'intérieur, clarté à l'extérieur** : La complexité fonctionnelle (variantes, numéros de série, périmètres géographiques, traçabilité outbox, remises volume) est intégralement préservée mais structurée visuellement pour éviter toute surcharge cognitive.
2. **Hiérarchie stricte** :
   $$\text{DOMAINE} \longrightarrow \text{MODULE} \longrightarrow \text{ESPACE DE TRAVAIL} \longrightarrow \text{PAGE} \longrightarrow \text{ACTION}$$
3. **Respect de l'identité visuelle** : Préservation du thème clair SaaS professionnel, sobre, lisible et prêt pour la commercialisation (pas de dark mode ou glassmorphism non sollicités).
4. **Zéro action orpheline** : Pas de bouton sans effet serveur, pas de fausse donnée, gestion immédiate des états vides et des retours par toasts non bloquants.

---

## 2. Hiérarchie de Navigation & Domaines Fonctionnels

Au premier niveau, l'ensemble des fonctionnalités est condensé en **6 domaines métier cohérents** (+ Tableau de bord) :

| Domaine | Identifiant | Modules Associés | Description & Périmètre |
| :--- | :--- | :--- | :--- |
| **Accueil** | `dashboard` | Tableau de bord | Vue synthétique, priorités opérationnelles, accès rapides |
| **Ventes & Caisse** | `sales` | Nouvelle Vente (`sales/new`), Historique Ventes (`sales`), Commandes (`orders`), Livraisons (`deliveries`), Retours (`returns`) | Point de vente, cycle de devis/commandes, encaissements et retours |
| **Catalogue & Stocks** | `catalog_stock` | Produits (`catalog`), Stocks & Dépôts (`inventory`), Tarifs & Barèmes (`pricing`), Garanties & SAV (`warranties`) | Articles, variantes, traçabilité sérialisée, transferts et barèmes |
| **Approvisionnements** | `procurement` | Fournisseurs & Achats (`suppliers`) | Gestion des grossistes, bons de commande d'achat et dettes |
| **Clients & Comptes** | `crm` | Répertoire Clients (`customers`), Crédit & Encours (`credit`) | Fichier clientèle, plafonds de crédit et encaissement des créances |
| **Indicateurs & Finance** | `analytics` | Rapports d'Activité (`reports`), Documents (`documents`), Sessions Caisse (`cash`), Audit (`audit`) | Agrégations financières serveur, export CSV, pièces comptables |
| **Configuration** | `settings` | Équipe & Rôles (`settings/users`), Paramètres (`settings/config`), Profil (`settings/business-profile`), Abonnement (`settings/subscription`) | Gestion RBAC multi-boutique, paramètres métier et quotas |

### Filtrage des Domaines par Permissions
Le menu latéral interroge `/me/menu` (RbacService côté serveur) : seuls les domaines et modules pour lesquels l'utilisateur connecté dispose d'au moins une permission active sont rendus dans la navigation.

---

## 3. Accès Rapide & Recherche Globale (`Ctrl+K`)

Le gestionnaire intègre une **Palette de Commandes universelle** accessible :
- Au clavier via le raccourci standard **`Ctrl + K`** (ou `Cmd + K` sur macOS).
- À la souris via le déclencheur de recherche situé en haut de la barre latérale.

### Fonctionnalités de la Palette
- **Navigation instantanée** : Recherche fuzzy par mots-clés vers n'importe quelle page ou sous-module.
- **Historique récent** : Mémorisation locale (`localStorage`) des dernières pages visitées pour un rappel en 1 clic.
- **Raccourcis clavier complets** :
  - `↑` / `↓` : Sélection de l'élément dans la liste.
  - `Entrée` : Ouverture immédiate de l'espace de travail.
  - `Échap` : Fermeture sans perturber le contexte actuel.

---

## 4. Composants Partagés & Modèle d'Interface

Toutes les pages du gestionnaire s'appuient sur un jeu de composants unifiés situés dans `apps/client/src/components/` :

### 4.1. `PageHeader` (`PageHeader.tsx`)
En-tête standardisé présent sur chaque écran :
- **Titre H1 lisible** et sous-titre contextualisé.
- **Badges d'état / KPI clés** (ex: nombre d'articles, statut d'abonnement, chiffre du jour).
- **Action principale** mise en valeur (`variant="primary"`).
- **Actions secondaires** regroupées pour limiter l'encombrement.
- **Bouton de retour** contextuel (`showBack`).

### 4.2. `EmptyState` (`EmptyState.tsx`)
Traitement explicite des états d'absence de données pour éviter les tableaux déserts sans explication :
- Distinction entre *« Liste vide à l'origine »* (avec bouton d'action d'ajout) et *« Recherche sans résultat »* (avec bouton d'effacement du filtre).
- Icônes et typographie d'aide à la décision.

### 4.3. `ConfirmModal` (`ConfirmModal.tsx`)
Fenêtre de confirmation accessible pour toutes les actions destructrices ou sensibles (annulation de commande, suspension de tenant, suppression de rôle) :
- Support du focus trap et des raccourcis `Échap` (fermeture) et `Entrée`.
- Variante `danger` avec avertissement visuel explicite.

### 4.4. `ToastContext` (`ToastContext.tsx` & `useToast`)
Système de notifications flottantes non intrusives en haut à droite :
- Types pris en charge : `success`, `error`, `warning`, `info`.
- Disparition automatique après 4 secondes ou fermeture au clic.
- Remplace avantageusement les bannières d'erreur statiques qui déforment la disposition des pages.

### 4.5. `Breadcrumbs` (`Breadcrumbs.tsx`)
Fil d'Ariane dynamique généré automatiquement à partir de la configuration `navigation.config.ts` :
- Exemple : `Accueil > Ventes & Caisse > Historique des Ventes`
- Liens cliquables pour remonter instantanément dans l'arborescence.

---

## 5. Tokens de Style & Conventions CSS

Les styles reposent sur **Vanilla CSS** avec variables `:root` définies dans `apps/client/src/index.css` :

```css
:root {
  --primary: #4338ca;         /* Indigo SaaS professionnel */
  --primary-hover: #3730a3;
  --primary-soft: #eef2ff;
  --bg: #f4f5f9;              /* Fond clair reposant */
  --surface: #ffffff;         /* Cartes et panneaux */
  --surface-muted: #f8fafc;
  --border: #e4e7ee;          /* Séparateurs nets */
  --text: #111827;            /* Contraste élevé WCAG */
  --text-muted: #6b7280;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --radius: 8px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
}
```

---

## 6. Adaptation Mobile & Responsive Design

- **Menu latéral responsive** :
  - Sur écran large (desktop) : menu complet rétractable en rail compact d'icônes avec infobulles.
  - Sur tablette et smartphone : menu escamotable (tiroir coulissant) activé par bouton hamburger dans la barre supérieure, avec fermeture automatique lors du changement de route.
- **Grilles auto-adaptatives** :
  - `kpi-grid` et formulaires en colonnes flexibles `repeat(auto-fit, minmax(..., 1fr))` garantissant une lecture fluide sans débordement horizontal.
- **Tableaux avec défilement fluide** :
  - Enveloppe `overflow-x: auto` pour préserver l'alignement des colonnes monétaires et des boutons d'actions sur petit écran.
