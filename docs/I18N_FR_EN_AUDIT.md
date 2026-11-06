# AUDIT APPROFONDI DE L'INTERNATIONALISATION (i18n) FR / EN — VTM

**Document de référence :** `docs/I18N_FR_EN_AUDIT.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  
**Niveau de preuve :** `CODE INSPECTÉ` (Analyse statique sur 100% des fichiers UI)

---

## 1. CONSTAT MAJEUR : ÉTAT RÉEL DU SUPPORT MULTILINGUE

L'audit contradictoire du code source démontre de manière irréfutable que **le support de l'anglais dans l'interface utilisateur de VTM est actuellement INEXISTANT (0%)** :

1. **Absence de moteur i18n :** Ni `react-i18next`, ni `next-intl`, ni `lingui` ne sont présents dans les dépendances de `apps/client/package.json` ou `apps/admin/package.json`.
2. **Textes 100% en dur en français :** L'intégralité des 67 composants et pages React contient des chaînes de caractères codées en dur en français.
3. **Absence de sélecteur de langue :** Il n'existe aucun composant de sélection de langue (FR/EN) dans la barre de navigation, le profil utilisateur ou les paramètres de l'application.
4. **Documentation asymétrique :** L'anglais n'existe aujourd'hui que sous la forme d'un fichier de documentation externe (`docs/USER_GUIDE_EN.md`), alors que l'application elle-même ne sait pas afficher un seul mot en anglais.

---

## 2. MATRICE DE COUVERTURE FR / EN PAR ZONE APPLICATIVE

| Zone applicative | Présence FR | Présence EN | Chaînes en dur | Mécanisme de traduction | Taux de couverture EN réel |
|---|---|---|---|---|---|
| **Barre de navigation & Menus** | 100% | 0% | Oui (ex: "Vendre", "Stock", "Clients") | Aucun (codé en dur) | **0%** |
| **Écran de Caisse (POS)** | 100% | 0% | Oui (ex: "Encaisser", "Panier suspendu") | Aucun | **0%** |
| **Formulaires & Modales** | 100% | 0% | Oui (ex: "Ajouter un produit", "Prix d'achat") | Aucun | **0%** |
| **Messages d'erreurs UI** | 100% | 0% | Oui (ex: "Le stock disponible est insuffisant") | Aucun | **0%** |
| **Codes d'erreurs Backend** | 100% (Codes normés) | 100% (Codes normés) | Non (Codes type `VTM-STK-INSUFFICIENT`) | Clés techniques stables | **100% (Codes seuls)** |
| **Factures & Devis PDF** | 100% | 0% | Oui (ex: "Facture N°", "Total TTC", "Conditions") | Générateur PDF statique FR | **0%** |
| **Tickets de caisse thermiques** | 100% | 0% | Oui (ex: "Ticket de vente", "Rendu monnaie") | Modèle HTML/CSS FR | **0%** |
| **Console SuperAdmin** | 100% | 0% | Oui (ex: "Locataires", "Abonnements", "Réinitialiser") | Aucun | **0%** |
| **Notifications Toasts** | 100% | 0% | Oui (ex: "Vente validée avec succès") | Aucun | **0%** |
| **Emails transactionnels** | 100% | 0% | Oui (Templates HTML FR) | Aucun | **0%** |
| **Rapports & Exports CSV** | 100% | 0% | En-têtes CSV en français en dur | Aucun | **0%** |

---

## 3. AUDIT DES FORMATS RÉGIONAUX (L10N)

Outre la traduction linguistique, la localisation financière et temporelle présente les constats suivants :

1. **Devises :** Le formatage monétaire est majoritairement optimisé pour l'Afrique de l'Ouest et Centrale (`XOF` / `XAF` sans décimales ou avec espace insécable : `15 000 FCFA`). Le basculement vers une devise comme l'Euro (`EUR`) ou le Dollar (`USD`) avec séparateur virgule/point n'est pas dynamiquement géré par `Intl.NumberFormat`.
2. **Dates & Heures :** Les dates sont généralement formatées via `toLocaleDateString('fr-FR')` ou via des helpers fixes. Un utilisateur anglophone verra toujours les dates au format `JJ/MM/AAAA` au lieu de `MM/DD/YYYY`.
3. **Pluriels :** Gestion manuelle basique (ex: `item.quantity > 1 ? 'articles' : 'article'`), non conforme aux règles complexes de pluralisation i18n.

---

## 4. FEUILLE DE ROUTE RECOMMANDÉE POUR L'INTERNATIONALISATION COMPLÈTE

Pour atteindre le bilinguisme parfait promis aux clients sans casser les performances :

1. **Étape 1 (Outillage) :** Installer `i18next` et `react-i18next` dans `apps/client` et `apps/admin`.
2. **Étape 2 (Extraction) :** Extraire les 850+ libellés de l'interface vers deux fichiers de dictionnaires structurés par domaine (`locales/fr/*.json` et `locales/en/*.json`).
3. **Étape 3 (Persistance) :** Ajouter la préférence linguistique dans la table `User` (`language: 'FR' | 'EN'`) et dans les cookies/localStorage.
4. **Étape 4 (Documents légaux) :** Paramétrer la langue d'impression des factures et reçus au niveau de la fiche client ou de l'organisation.
