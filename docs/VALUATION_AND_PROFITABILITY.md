# Valorisation du Stock, Prix Promotionnels et Marges Commerciales

Ce document détaille les règles métier, formules comptables et spécifications techniques du moteur de valorisation du stock et d'analyse de rentabilité implémenté dans le SaaS VTM.

---

## 1. Clarification Fondamentale : Coût d'Acquisition vs Prix Public

Les audits antérieurs ont mis en lumière une confusion entre le **prix de vente public** et le **coût d'acquisition réel**. Dans le moteur finalisé :
- **Ne jamais confondre le prix de vente et la valeur patrimoniale du stock.**
- **Le stock actif est valorisé au coût d'achat unitaire réel (CUMP / Coût Moyen Pondéré).**
- Le prix de vente catalogué (`basePrice`) sert à calculer le **chiffre d'affaires potentiel**, et non la valeur d'actif du bilan.

---

## 2. Formules Mathématiques Exactes

### A. Valeur d'Acquisition du Stock (Coût d'Achat Réel)

Pour chaque article $i$ dont le coût d'achat $C_i$ est renseigné :

$$\text{Valeur d'Acquisition}_i = Q_{\text{vendable}, i} \times C_i$$

$$\text{Valeur d'Acquisition Totale} = \sum_{i \in \text{Connus}} (Q_{\text{vendable}, i} \times C_i)$$

> **Règle absolue pour les coûts manquants :**  
> Si un article en stock ne dispose pas d'un coût d'achat renseigné ($C_i = \text{null}$), **le système ne remplace JAMAIS le coût manquant par le prix de vente**.  
> Le système comptabilise ces articles séparément (`unknownCostProductsCount`, `unknownCostQuantity`), affiche l'indicateur `isValuationComplete: false`, et invite explicitement le gestionnaire à compléter les prix d'achat.

---

### B. Valeur Potentielle au Prix Public Normal

Représente le chiffre d'affaires maximal brut réalisable sans remise ni promotion :

$$\text{Valeur Prix Normal}_i = Q_{\text{vendable}, i} \times P_{\text{normal}, i}$$

$$\text{Valeur Vente Normale Totale} = \sum_{i} (Q_{\text{vendable}, i} \times P_{\text{normal}, i})$$

---

### C. Valeur Potentielle au Prix Promotionnel

Représente le chiffre d'affaires potentiel avec application de la promotion active (ou d'un taux simulé de remise commerciale) :

$$P_{\text{promo}, i} = P_{\text{normal}, i} \times \left(1 - \frac{\tau_{\text{remise}}}{100}\right)$$

$$\text{Valeur Vente Promo Totale} = \sum_{i} (Q_{\text{vendable}, i} \times P_{\text{promo}, i})$$

S'il n'existe aucune promotion active, le système indique clairement `hasActivePromotion: false` et la valeur promotionnelle coïncide avec la valeur normale.

---

### D. Marges Commerciales : Distinction entre Taux de Marge et Taux de Marque

Le système distingue rigoureusement les deux indicateurs financiers afin d'éviter toute ambiguïté de gestion :

#### 1. Marge brute en valeur monétaire :
$$\text{Marge Normale} = \text{Valeur Vente Normale} - \text{Valeur d'Acquisition}$$
$$\text{Marge Promo} = \text{Valeur Vente Promo} - \text{Valeur d'Acquisition}$$

#### 2. Taux de Marge (%) — Rentabilité des fonds investis dans le stock :
Rapporte le gain financier au coût d'achat :
$$\text{Taux de Marge (\%)} = \left(\frac{\text{Marge}}{\text{Valeur d'Acquisition}}\right) \times 100$$

#### 3. Taux de Marque (%) — Part de marge contenue dans le chiffre d'affaires :
Rapporte le gain financier au prix de vente :
$$\text{Taux de Marque (\%)} = \left(\frac{\text{Marge}}{\text{Valeur de Vente}}\right) \times 100$$

---

## 3. Détection des Produits Vendus à Perte (Anti-Vente à Perte)

Le moteur compare pour chaque article son prix promotionnel $P_{\text{promo}, i}$ avec son coût d'acquisition $C_i$ :

$$\text{Condition de vente à perte} \iff P_{\text{promo}, i} < C_i \iff \text{Marge Promo}_i < 0$$

Lorsqu'une telle anomalie est détectée :
1. Une alerte visuelle rouge s'affiche sur le tableau de bord de simulation.
2. Le système calcule la **perte unitaire** ($C_i - P_{\text{promo}, i}$) et la **perte potentielle totale** ($Q_{\text{vendable}, i} \times \text{Perte unitaire}$).
3. L'article est listé dans l'onglet dédié pour ajustement immédiat de la grille tarifaire.

---

## 4. Statuts des Quantités et Emplacements

Pour éviter tout gonflement artificiel du stock commercial disponible, le moteur segmente les quantités physiques :

| Notion | Définition technique | Statut dans la valorisation vendable |
| :--- | :--- | :--- |
| **Stock Physique en main** | $\sum \text{StockLevel.quantityOnHand}$ | Total des unités physiquement présentes |
| **Stock Réservé** | $\sum \text{StockLevel.quantityReserved}$ | Unités bloquées pour des commandes en attente |
| **Stock Vendable Disponible** | $\max(0, \text{Physique} - \text{Réservé})$ | **Seule base retenue pour la valorisation commerciale** |
| **Quarantaine SAV / Défectueux** | Emplacements avec `Location.type = 'QUARANTINE'` | **Exclu du stock vendable**. Valorisé séparément sous `quarantineCostTotal` |
| **Marchandise en Transit** | Lignes de `StockTransfer` avec statut `CONFIRMED` | **Exclu des dépôts d'arrivée**. Suivi sous `totalInTransit` |

---

## 5. Spécification des Endpoints API

### `GET /reports/stock-valuation`
- **Permission requise :** `reports.sales.read` (ou `reports.financial.read`)
- **Paramètres optionnels :**
  - `locationId` (UUID) : Restreindre le calcul à une boutique ou un dépôt précis.
  - `categoryId` (UUID) : Filtrer par catégorie de produits.
  - `brand` (string) : Filtrer par marque.
  - `promoDiscountPercent` (nombre 0 à 100) : Simuler un taux de remise promotionnelle.
  - `currency` (string) : Devise ciblée (défaut : devise de l'organisation).
- **Format de réponse :** JSON avec `quantities`, `valuation`, `profitabilityAnalysis`, `breakdownByCategory`, `breakdownByLocation`, et `products`.

### `GET /reports/export/stock-valuation.csv`
- **Type MIME :** `text/csv; charset=utf-8` avec préfixe BOM UTF-8 (compatibilité immédiate Microsoft Excel).
- **Neutralisation de sécurité :** Protection stricte contre les injections de formules CSV (`=`, `+`, `-`, `@` préfixés d'une apostrophe).
