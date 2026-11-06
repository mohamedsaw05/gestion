# 🌐 Site Vitrine Public VTM SaaS — Spécifications, Tarification & SEO

## 1. Objectifs & Positionnement Stratégique

Le site vitrine public (`apps/site`) est le point d'entrée commercial et marketing de la solution **VTM SaaS (Gestionnaire Universel & Commerce POS)**.
Il répond directement aux directives opérationnelles :
1. **Tarif de référence centralisé :** le prix mensuel courant est servi par `GET /commercial/settings`; les formules vendables sont exclusivement 3, 6, 12 et 24 mois après les 14 jours d’essai.
2. **Prise en Main & Formation Offerte :** **Formation complète incluse pour 1 personne référente** par entreprise (en présentiel à Ouagadougou Tampouy ou en visio).
3. **Ancrage Local & Contact Direct :**
   - **Localisation physique :** Ouagadougou, Arrondissement 3 (Secteur 15 Tampouy), près du collège privé Ave Maria.
   - **Téléphone & WhatsApp direct :** `+226 72 74 45 95` (avec lien d'action instantané `https://wa.me/22672744595`).
4. **Accès Immédiat à l'Application :** Bouton "Espace Client" et "Se Connecter" redirigeant vers l'interface de gestion (`/login`).

---

## 2. Architecture Technique (`apps/site`)

- **Technologie :** React 19 + TypeScript + Vite.
- **Styles :** Design System moderne et immersif en Vanilla CSS (Dark mode premium, verre dépoli glassmorphism, dégradés vibrants, micro-interactions).
- **Indépendance :** Package autonome dans le monorepo npm (`apps/site`), scriptable via `npm run dev:site` (port 5173 ou configuré) et `npm run build:site`.
- **Packaging :** Intégré automatiquement dans l'archive zip de production via `npm run release:package`.

---

## 3. Référencement Naturel (SEO) & Données Structurées

Le site intègre les meilleures pratiques de référencement pour l'Afrique de l'Ouest et l'international :

### 3.1. Balises Méta & Open Graph
- **Title :** `VTM SaaS | Logiciel de caisse, stock et facturation`
- **Meta Description :** `Gestion commerciale et point de vente au Burkina Faso. Essai gratuit de 14 jours, puis formules trimestrielle, semestrielle, annuelle ou biennale. Tarifs chargés depuis la configuration centrale.`
- **Keywords :** `logiciel caisse ouagadougou, gestion stock burkina faso, facturation normalisee dgi, logiciel commerce ouaga, caisse enregistreuse tampouy, pos ouagadougou`
- **OpenGraph & Twitter Cards :** Prévisualisation enrichie pour les partages WhatsApp, Facebook, LinkedIn et X.

### 3.2. Balisage Schema.org (JSON-LD)
Deux schémas sémantiques sont déclarés dans `index.html` :
1. **`SoftwareApplication` :**
   - ApplicationCategory : `BusinessApplication`
   - N’afficher un prix structuré que si la page a chargé la configuration commerciale courante. Ne pas publier un montant codé en dur dans les métadonnées.
   - TrialPeriod : `14 days`
2. **`LocalBusiness` :**
   - Name : `VTM SaaS - Gestionnaire Universel Burkina`
   - Address : `Secteur 15, Quartier Tampouy (près collège Ave Maria), Ouagadougou, Burkina Faso`
   - Telephone : `+226 72 74 45 95`
   - GeoCoordinates : `Latitude 12.3950, Longitude -1.5420`

---

## 4. Grille des 16 Modules Mis en Valeur

Le site vitrine présente les 16 piliers technologiques de VTM SaaS :
1. **Caisse Tactile & Point de Vente (POS) :** Vente en 3 clics, mode déconnecté, tickets thermiques ESC/POS 58/80mm.
2. **Stocks Multi-Dépôts :** Alertes péremption, numéros de lot, transferts inter-boutiques, inventaires physiques.
3. **Facturation & Devis Professionnels :** 5 modèles élégants, devises multiples (XOF, EUR, USD), acomptes et soldes.
4. **Gestion des Crédits & Encours Clients :** Plafonds personnalisés, fiches de compte, échéanciers et relances WhatsApp.
5. **Comptabilité Simplifiée & Clôtures :** Journal des ventes, clôtures X & Z, suivi des dépenses et marges nettes.
6. **Présence & Pointage du Personnel :** Heures d'arrivée/départ, plannings hebdo, détection intelligente des jours de fermeture.
7. **Boutique en Ligne & Catalogue WhatsApp :** Partage direct de lien de commande, synchronisation du stock en temps réel.
8. **Gestion des Rendez-vous & Services :** Agenda, affectation d'employés, rappels automatiques.
9. **Multi-Boutiques & Multi-Magasins :** Console centralisée pour chaînes de magasins et franchises.
10. **Messagerie & Automatisation :** Envoi d'alertes SMS/WhatsApp et suivi des commandes.
11. **Rapports & Tableaux de Bord Décisionnels :** Courbes de chiffre d'affaires, produits vedettes, panier moyen.
12. **Gestion des Fournisseurs & Achats :** Bons de commande, réceptions, historique des prix d'achat.
13. **Fidélité & Cartes Cadeaux :** Système de points, remises automatiques pour les clients réguliers.
14. **Sauvegarde & Sécurité des Données :** Chiffrement AES, backups automatiques, traçabilité des actions d'audit.
15. **Mode Hors-Ligne Résilient :** Continue de fonctionner même en cas de coupure Internet ou d'électricité.
16. **Accompagnement & Formation Dédiée :** 1 session de formation offerte pour votre référent magasin.

---

## 5. Parcours de Conversion & Appels à l'Action (CTA)

- **Bouton Principal :** "Démarrer mes 14 jours d'essai gratuit" ➔ Redirection vers la création de compte ou contact WhatsApp.
- **Bouton WhatsApp Flottant & Header :** "Discuter sur WhatsApp" (+226 72 74 45 95) avec message pré-rempli :
  `"Bonjour VTM SaaS, je souhaite démarrer un essai gratuit de 14 jours pour ma boutique à Ouagadougou."`
- **Bouton Espace Client :** Connexion directe sur le portail de gestion de caisse.
