# Guide Officiel des Codes d'Erreur & Diagnostics VTM (ViralTech Market)
**Document de référence technique & opérationnel pour gestionnaires et équipes support**  
*Tous les codes du système sont obligatoirement préfixés par `VTM-`.*

---

## Sommaire
1. [Nomenclature et Philosophie du Système](#1-nomenclature-et-philosophie)
2. [Authentification, Accès & Sécurité (VTM-AUTH & VTM-SEC)](#2-authentification-et-sécurité)
3. [Réseau, Synchronisation & Serveur (VTM-NET & VTM-SRV)](#3-réseau-et-serveur)
4. [Catalogue Produits & Import/Export (VTM-PROD & VTM-IMP)](#4-catalogue-produits-et-importexport)
5. [Ventes, Facturation & Caisse (VTM-SALE & VTM-CASH)](#5-ventes-et-caisse)
6. [Impression Thermique & Documents (VTM-PRINT & VTM-DOC)](#6-impression-et-documents)
7. [Gestion Multi-Boutiques & Tiers (VTM-STORE & VTM-SUPP)](#7-multi-boutiques-et-fournisseurs)
8. [Procédure d'Assistance & Contact](#8-procédure-dassistance)

---

## 1. Nomenclature et Philosophie

Dans **ViralTech Market (VTM)**, aucun message cryptique ou technique n'est affiché aux utilisateurs sans explication humaine.  
Chaque situation anormale est identifiée par un code unique au format :

$$\mathbf{VTM-[DOMAINE]-[NUMÉRO]}$$

- **VTM** : Préfixe obligatoire identifiant la plateforme.
- **DOMAINE** : Trigamme du module concerné (`AUTH`, `SEC`, `NET`, `PROD`, `SALE`, `PRINT`, etc.).
- **NUMÉRO** : Identifiant d'erreur spécifique ou code HTTP associé.

---

## 2. Authentification et Sécurité

| Code d'Erreur | Signification en Langage Simple | Cause Fréquente | Solution Immédiate / Démarche |
| :--- | :--- | :--- | :--- |
| **`VTM-AUTH-001`** | Identifiant manquant | L'adresse email n'a pas été saisie. | Saisissez votre adresse email professionnelle de connexion. |
| **`VTM-AUTH-002`** | Identifiants incorrects | Erreur de frappe dans l'email ou le mot de passe. | Vérifiez la touche Majuscule et ressaisissez calmement votre mot de passe. |
| **`VTM-AUTH-003`** | Format d'email invalide | Caractère interdit ou espace dans l'adresse. | Vérifiez la syntaxe (ex: `nom@entreprise.com`). |
| **`VTM-AUTH-004`** | Mot de passe trop court | Moins de 4 caractères saisis. | Saisissez le mot de passe complet fourni par votre administrateur. |
| **`VTM-AUTH-403`** | Droits insuffisants | Vous tentez d'accéder à un module réservé. | Contactez votre gérant ou administrateur pour élargir vos privilèges. |
| **`VTM-SEC-LCK1`** | **Suspension Temporaire (Palier 1 : 5 minutes)** | 5 tentatives infructueuses consécutives. | Patienter 5 minutes. Le compte se débloque automatiquement sans intervention. |
| **`VTM-SEC-LCK2`** | **Suspension Prolongée (Palier 2 : 1 heure)** | Nouvelles tentatives erronées après la 1ère pause. | Patienter 1 heure, ou demander à votre gérant de réinitialiser votre mot de passe. |
| **`VTM-SEC-LCK3`** | **Verrouillage Définitif (Palier 3 : Assistance Requise)** | Plus de 15 échecs répétés (suspicion d'intrusion). | **Contacter le support VTM** avec le code `VTM-SEC-LCK3` pour déblocage manuel sécurisé. |

---

## 3. Réseau et Serveur

| Code d'Erreur | Signification en Langage Simple | Cause Fréquente | Solution Immédiate / Démarche |
| :--- | :--- | :--- | :--- |
| **`VTM-NET-001`** | Connexion Internet ou liaison serveur interrompue | Câble Ethernet débranché, Wi-Fi déconnecté ou 4G coupée. | 1. Vérifier si d'autres sites web s'ouvrent sur l'ordinateur.<br>2. Redémarrer le routeur Wi-Fi.<br>3. Patienter 30 secondes et recharger la page. |
| **`VTM-NET-002`** | Délai de réponse dépassé (Timeout) | Connexion Internet instable ou réseau surchargé. | Vérifier la stabilité du réseau et cliquer sur rafraîchir. |
| **`VTM-SRV-500`** | Service temporairement indisponible | Maintenance en cours ou micro-coupure cloud. | Patienter 1 à 2 minutes. Les données locales restent sécurisées. |
| **`VTM-SRV-503`** | Serveur en maintenance programmée | Mise à jour de sécurité ou amélioration système. | Réessayer après l'heure de maintenance annoncée. |

---

## 4. Catalogue Produits et Import/Export

| Code d'Erreur | Signification en Langage Simple | Cause Fréquente | Solution Immédiate / Démarche |
| :--- | :--- | :--- | :--- |
| **`VTM-PROD-001`** | Référence ou Code-barres déjà utilisé | Le code-barres scanné est déjà attribué à un autre produit. | Vérifier si l'article n'est pas déjà enregistré dans la liste. |
| **`VTM-PROD-002`** | Prix ou quantité invalide | Saisie d'une valeur négative ou texte dans un champ de montant. | Renseigner un chiffre supérieur ou égal à zéro. |
| **`VTM-IMP-001`** | Format de fichier non supporté | Fichier qui n'est ni un `.csv` ni un `.txt`. | Enregistrer votre tableau au format `.csv` (séparateur virgule ou point-virgule) ou `.txt`. |
| **`VTM-IMP-002`** | Entêtes de colonnes manquantes | Le fichier ne contient pas les colonnes minimales (Nom, Prix). | Télécharger le modèle type depuis la page Produits puis réessayer. |
| **`VTM-IMP-003`** | Données corrompues sur certaines lignes | Lignes incomplètes avec séparateurs manquants. | Le système saute les lignes invalides et importe les lignes saines avec un rapport clair. |
| **`VTM-EXP-001`** | Aucun produit sélectionné pour l'export | Le catalogue est vide ou les filtres ne donnent aucun résultat. | Supprimer les filtres de recherche pour afficher les articles avant d'exporter. |

---

## 5. Ventes, Facturation et Caisse

| Code d'Erreur | Signification en Langage Simple | Cause Fréquente | Solution Immédiate / Démarche |
| :--- | :--- | :--- | :--- |
| **`VTM-SALE-001`** | Stock insuffisant pour la vente | La quantité demandée dépasse le stock physique en boutique. | Ajuster la quantité ou effectuer un réapprovisionnement de stock. |
| **`VTM-SALE-002`** | **Clics multiples détectés (Anti-Doublon)** | L'utilisateur a cliqué 2 ou 3 fois rapidement sur "Valider". | **Le système protège la caisse** : seule la première vente est validée, les clics suivants sont automatiquement neutralisés sans débit en double. |
| **`VTM-SALE-003`** | Panier vide | Tentative de validation sans article ajouté. | Scanner ou ajouter au moins un produit avant d'encaisser. |
| **`VTM-CASH-001`** | Montant remis inférieur au total dû | Le montant versé par le client est insuffisant. | Compléter le paiement ou enregistrer la vente en crédit/acompte si autorisé. |
| **`VTM-CASH-002`** | Caisse non ouverte | Aucune session de caisse n'a été ouverte pour la journée. | Effectuer l'ouverture de caisse avec le fond initial dans l'espace Caisse. |

---

## 6. Impression Thermique et Documents

| Code d'Erreur | Signification en Langage Simple | Cause Fréquente | Solution Immédiate / Démarche |
| :--- | :--- | :--- | :--- |
| **`VTM-PRINT-001`** | Imprimante ticket non accessible | Imprimante thermique éteinte, débranchée ou sans papier. | 1. Vérifier le voyant d'alimentation et le rouleau papier.<br>2. Vérifier le câble USB ou Bluetooth.<br>3. Relancer l'impression depuis l'historique des ventes. |
| **`VTM-PRINT-002`** | Modèle de facture non sélectionné | Aucun gabarit choisi dans les paramètres de l'entreprise. | Aller dans Paramètres > Documents et sélectionner un des 10 thèmes proposés. |
| **`VTM-DOC-001`** | Décharge non signée | Tentative de validation d'une décharge sans signature ou acceptation. | Faire signer le client sur l'écran ou cocher la dispense avant validation. |

---

## 7. Multi-Boutiques et Fournisseurs

| Code d'Erreur | Signification en Langage Simple | Cause Fréquente | Solution Immédiate / Démarche |
| :--- | :--- | :--- | :--- |
| **`VTM-STORE-001`** | Boutique inactive ou suspendue | La boutique sélectionnée a été archivée. | Activer la boutique dans la page Multi-Store ou basculer sur votre boutique principale. |
| **`VTM-SUPP-001`** | Fournisseur sans produit associé | Tentative de passer commande sans articles référencés. | Ouvrir la fiche du fournisseur et cocher les produits qu'il approvisionne parmi le catalogue. |

---

## 8. Procédure d'Assistance & Contact

Lorsque vous rencontrez une anomalie persistante :

1. **Notez le code exact** affiché à l'écran (ex: `VTM-SEC-LCK3`, `VTM-NET-001`).
2. **Ne tentez pas d'actions informatiques hasardeuses** (ne videz pas les caches sans instruction pour préserver les ventes hors-ligne).
3. **Contactez notre équipe support :**
   - **Email :** `support@vtm.cloud`
   - **WhatsApp Assistance :** Contact direct disponible depuis le menu d'aide.
   - Mentionnez toujours : Votre nom d'organisation, votre adresse email, et le code d'erreur `VTM-XXXX-YYY`.
