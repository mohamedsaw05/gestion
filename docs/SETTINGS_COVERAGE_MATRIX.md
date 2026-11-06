# MATRICE D'AUDIT EXHAUSTIVE DES 34 PARAMÈTRES — VTM

**Document de référence :** `docs/SETTINGS_COVERAGE_MATRIX.md`  
**Date :** 1er Novembre 2026  
**Source de vérité :** `packages/db/src/settings.catalog.ts`  
**Mécanisme de persistance :** Table PostgreSQL `TenantSetting` (`@@unique([tenantId, key])`) avec surcharge facultative par `LocationSetting`.

---

## 1. TABLEAU COMPARATIF D'AUDIT DES PARAMÈTRES (1 À 34)

| # | Nom affiché | Clé technique | Portée | Module | Valeur par défaut | Effet Frontend | Effet Backend | Persistance | État réel |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Devise par défaut | `commerce.defaultCurrency` | Tenant | Commerce | `XOF` | Affichage du symbole sur les prix | Utilisée lors de la création de vente sans devise | `TenantSetting` | **Opérationnel** |
| 2 | Moyens de paiement activés | `payments.enabledMethods` | Tenant | Paiement | `["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "CHECK"]` | Filtre les boutons de paiement affichés au POS | Rejette tout paiement d'un type non autorisé | `TenantSetting` | **Opérationnel** |
| 3 | Client obligatoire pour crédit | `sales.requireCustomerForCreditSales` | Tenant | Crédit | `true` | Désactive le bouton valider crédit sans client | Rejette la vente avec `VTM-CREDIT-CUSTOMER-REQUIRED` | `TenantSetting` | **Opérationnel** |
| 4 | Client obligatoire toujours | `sales.requireCustomerAlways` | Tenant | Ventes | `false` | Affiche champ client en requis | Rejette toute vente anonyme au comptoir | `TenantSetting` | **Opérationnel** |
| 5 | Vente en stock négatif | `inventory.allowNegativeStock` | Tenant | Stock | `false` | Avertissement si stock = 0 | Rejette la sortie si stock insuffisant (`VTM-STK-INSUFFICIENT`) | `TenantSetting` | **Opérationnel** |
| 6 | Pied de reçu | `documents.receiptFooterText` | Location | Documents | `""` | Affiché en bas de l'aperçu reçu | Imprimé dans le PDF du reçu (surchargeable par boutique) | `TenantSetting` / `Location` | **Opérationnel** |
| 7 | Logo de l'entreprise | `documents.logoDataUri` | Tenant | Documents | `""` | Prévisualisation du logo dans les paramètres | Imprimé sur tous les reçus, devis et factures PDF | `TenantSetting` | **Opérationnel** |
| 8 | Raison sociale / Nom commercial | `organization.legalName` | Tenant | Organisation | `""` | En-tête des pages et documents | Imprimé en en-tête légal des PDF | `Organization.name` / Setting | **Opérationnel** |
| 9 | Téléphone commercial | `organization.phone` | Tenant | Organisation | `""` | Affiché dans le bandeau | Imprimé sur le ticket | `TenantSetting` | **Opérationnel** |
| 10 | Email commercial | `organization.email` | Tenant | Organisation | `""` | Affiché dans les réglages | Imprimé sur les factures | `TenantSetting` | **Opérationnel** |
| 11 | Adresse physique | `organization.address` | Tenant | Organisation | `""` | Affiché sur la facture | Imprimé sur les factures et reçus | `TenantSetting` | **Opérationnel** |
| 12 | Identifiant fiscal (NIF/RCCM) | `organization.taxId` | Tenant | Organisation | `""` | Affiché sur les factures | Mention fiscale obligatoire sur documents légaux | `TenantSetting` | **Opérationnel** |
| 13 | Message d'en-tête de reçu | `documents.receiptHeaderText` | Tenant | Documents | `""` | Sous le logo sur l'aperçu | Imprimé en sous-titre de reçu | `TenantSetting` | **Opérationnel** |
| 14 | Modèle de facture par défaut | `documents.invoiceTemplate` | Tenant | Facturation | `STANDARD_PRO` | Sélecteur de template actif | Détermine le layout PDF (`InvoicePdfService`) | `TenantSetting` | **Opérationnel** |
| 15 | Afficher client sur reçus | `documents.showCustomerOnReceipts` | Tenant | Documents | `true` | Affiche/masque coordonnées client | Conditionne l'impression du bloc client sur reçu | `TenantSetting` | **Opérationnel** |
| 16 | Relances WhatsApp créances | `reminders.whatsappCreditRemindersEnabled` | Tenant | Crédit | `false` | Affiche bouton WhatsApp dans liste créances | Autorise ou bloque l'envoi de message WhatsApp | `TenantSetting` | **Opérationnel (Restreint)** |
| 17 | Unités discrètes (entiers) | `inventory.discreteUnits` | Tenant | Stock | `["piece", "carton", "pack", ...]` | Empêche saisie décimale au POS | Rejette quantité décimale (`VTM-STK-DISCRETE-UNIT`) | `TenantSetting` | **Opérationnel** |
| 18 | Guide démarrage masqué | `onboarding.dismissed` | Tenant | Interface | `false` | Masque le bandeau de bienvenue | Aucun effet serveur critique | `TenantSetting` | **Opérationnel** |
| 19 | Seuil alerte stock faible | `inventory.lowStockThreshold` | Tenant | Stock | `"5"` | Badge rouge si stock <= seuil | Déclenche notification de réapprovisionnement | `TenantSetting` | **Opérationnel** |
| 20 | Format d'impression tickets | `documents.receiptFormat` | Tenant | Documents | `THERMAL_80MM` | Format d'impression thermique ou A4 | Ajuste le dimensionnement CSS/PDF du ticket | `TenantSetting` | **Opérationnel** |
| 21 | Délai validité des devis | `documents.quoteValidityDays` | Tenant | Devis | `"15"` | Date d'échéance calculée sur devis | Bloque conversion d'un devis expiré | `TenantSetting` | **Opérationnel** |
| 22 | Fond de caisse ouverture | `cash.defaultOpeningFloat` | Tenant | Caisse | `"0"` | Pré-rempli à l'ouverture de session | Montant d'ouverture par défaut | `TenantSetting` | **Opérationnel** |
| 23 | Autoriser remises manuelles | `sales.allowManualDiscounts` | Tenant | Ventes | `true` | Active le champ remise au POS | Rejette la vente si remise présente et désactivée | `TenantSetting` | **Opérationnel** |
| 24 | Plafond remise manuelle (%) | `sales.maxManualDiscountPercent` | Tenant | Ventes | `"20"` | Bloque la saisie au-delà du seuil | Rejette la vente avec `VTM-SALE-DISCOUNT-TOO-HIGH` | `TenantSetting` | **Opérationnel** |
| 25 | Remise max Vendeur (%) | `sales.discountMaxSellerPercent` | Tenant | Ventes | `"5"` | Limite visuelle selon le rôle | Vérifié dans `DiscountsService` selon rôle | `TenantSetting` | **Opérationnel** |
| 26 | Remise max Responsable (%) | `sales.discountMaxManagerPercent` | Tenant | Ventes | `"15"` | Limite visuelle pour manager | Vérifié dans `DiscountsService` selon rôle | `TenantSetting` | **Opérationnel** |
| 27 | Vente sous le coût de revient | `sales.allowSaleBelowCost` | Tenant | Ventes | `false` | Avertissement anti-marge négative | Rejette la vente si prix < CUMP sans dérogation | `TenantSetting` | **Opérationnel** |
| 28 | Délai échéance crédit (jours) | `credit.defaultCreditTermDays` | Tenant | Crédit | `"30"` | Date de relance calculée | Utilisé pour le calcul de l'ancienneté de dette | `TenantSetting` | **Opérationnel** |
| 29 | Méthode valorisation stock | `inventory.valuationMethod` | Tenant | Comptabilité | `CUMP` | Indicateur dans rapport de valorisation | Applique CUMP ou FIFO sur les sorties de stock | `TenantSetting` | **Opérationnel** |
| 30 | Délai réapprovisionnement | `inventory.reorderLeadDays` | Tenant | Stock | `"7"` | Utilisé dans suggestion d'achats | Calcule le stock de sécurité optimal | `TenantSetting` | **Opérationnel** |
| 31 | Amortissement crédit | `credit.amortizationMethod` | Tenant | Crédit | `FREE_SCHEDULE` | Affiche échéancier libre ou constant | Génère l'échéancier prévisionnel | `TenantSetting` | **Opérationnel** |
| 32 | Taux endettement maximal (%) | `credit.maxDebtRatioPercent` | Tenant | Crédit | `"0"` | Alerte si encours dépasse ratio | Bloque nouvelle vente à crédit si > seuil | `TenantSetting` | **Opérationnel** |
| 33 | Pénalité retard journalière | `credit.latePenaltyDailyRate` | Tenant | Crédit | `"0.1"` | Mentionné dans conditions crédit | Calcul des intérêts moratoires sur créances échues | `TenantSetting` | **Opérationnel** |
| 34 | Thème festif | `festive.mode` | Tenant | Interface | `AUTO` | Affiche animations saisonnières (neige, etc.) | Stocké en base sans impact métier financier | `TenantSetting` | **Opérationnel** |

---

## 2. ANOMALIES DE CONFIGURATION DÉTECTÉES LORS DE L'AUDIT

1. **Paramètres visibles pour des modules inactifs :**
   - Si la capability `CUSTOMER_CREDIT` est désactivée, les paramètres `sales.requireCustomerForCreditSales`, `credit.defaultCreditTermDays`, `credit.amortizationMethod` restent visibles dans l'écran de configuration si l'utilisateur y accède directement.
   - **Correction préconisée :** Filtrer dynamiquement les onglets de configuration en fonction des capabilities actives de l'organisation.

2. **Désynchronisation entre LocalStorage et TenantSetting :**
   - Certains toggles d'interface (ex: masquage de colonnes, filtres de listes) sont sauvegardés uniquement dans le navigateur (`localStorage`) et ne suivent pas l'utilisateur s'il change de poste de travail ou de tablette de vente.
