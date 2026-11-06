# CATALOGUE DES MESSAGES D'ERREUR ACCESSIBLES, CODES TECHNIQUES ET TEXTES PÉDAGOGIQUES — VTM

**Document de référence :** `docs/ERROR_MESSAGES_AND_CODES.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  

---

## 1. PHILOSOPHIE DU DOUBLE NIVEAU D'INFORMATION

Dans VTM, aucun utilisateur commerçant ou caissier ne doit être confronté à un message cryptique (ex: `PrismaClientKnownRequestError: P2002`, `NullPointerException`, `TypeError`).

Le système implémente un double niveau d'information :
1. **Niveau Utilisateur :** Un texte rédigé en langage simple, bienveillant, expliquant clairement ce qui s'est passé et l'action immédiate à réaliser pour continuer.
2. **Niveau Support / Technique :** Un code normé stable (`VTM-[DOMAINE]-[NUMÉRO]`) associé à un identifiant unique de requête (`correlationId` / `traceId`) présent dans les en-têtes HTTP et les logs serveurs.

Exemple d'affichage dans la modale d'alerte :
> **Stock insuffisant pour cette vente**  
> La quantité demandée (5) dépasse le stock actuellement disponible (2) dans ce magasin. Vérifiez votre réserve ou approvisionnez cet article.  
> *Code technique : `VTM-STK-INSUFFICIENT` — Réf. diagnostic : `req_98bfa2e1-4c`*

---

## 2. MATRICE COMPLÈTE DES CODES D'ERREURS NORMATIFS

| Domaine | Code Technique | Message Utilisateur Simple | Cause Racine | Action Recommandée Utilisateur |
|---|---|---|---|---|
| **Stock** | `VTM-STK-INSUFFICIENT` | Quantité demandée supérieure au stock disponible. | Stock disponible insuffisant et paramètre vente négative à `false`. | Ajuster la quantité ou réapprovisionner la boutique. |
| **Stock** | `VTM-STK-QUARANTINE` | Cet article est en quarantaine SAV et ne peut pas être vendu. | L'article provient d'un emplacement isolé pour défaut ou réparation. | Sélectionner un lot sain en rayon ou lever la quarantaine en atelier. |
| **Stock** | `VTM-STK-DISCRETE-UNIT` | Ce produit ne peut être vendu qu'en quantité entière (pièce, carton). | Saisie d'une décimale pour une unité discrète configurée. | Corriger la quantité pour saisir un nombre entier. |
| **Vente** | `VTM-SALE-IDEMPOTENT-HIT` | Vente déjà enregistrée (protection anti-doublon active). | Second clic rapide ou renvoi d'une requête déjà traitée. | Aucune action : le ticket initial s'affiche sans duplication. |
| **Vente** | `VTM-SALE-DISCOUNT-MAX` | Le taux de remise saisi dépasse votre plafond autorisé. | Dépassement du plafond configuré pour le rôle vendeur (ex: 5%). | Demander la validation du gérant ou réduire la remise. |
| **Vente** | `VTM-SALE-BELOW-COST` | Vente à perte interdite sans dérogation gérant. | Prix de vente remisé inférieur au coût de revient CUMP. | Ajuster le prix ou solliciter un code d'autorisation superviseur. |
| **Caisse** | `VTM-CASH-NOT-OPEN` | Veuillez ouvrir la caisse avant d'enregistrer un encaissement. | Aucune session active n'existe pour cet emplacement aujourd'hui. | Cliquer sur "Ouvrir la caisse" et renseigner le fond de caisse. |
| **Caisse** | `VTM-CASH-FLOAT-MISMATCH` | Écart constaté entre le montant théorique et le comptage physique. | Erreur de rendu de monnaie ou billet manquant à la clôture. | Recompter le tiroir-caisse et consigner le motif de l'écart. |
| **Crédit** | `VTM-CREDIT-CUSTOMER-REQ` | Un client nominatif doit obligatoirement être sélectionné pour une vente à crédit. | Vente avec solde dû sans client rattaché. | Sélectionner un client existant ou créer une nouvelle fiche. |
| **Crédit** | `VTM-CREDIT-LIMIT-REACHED` | Le plafond de crédit de ce client est atteint. | L'encours actuel + la nouvelle vente dépasse le plafond accordé. | Encaisser un acompte ou demander un accord d'extension de crédit. |
| **Paiement** | `VTM-PAY-METHOD-DISABLED` | Ce moyen de paiement n'est pas autorisé pour votre commerce. | Méthode désactivée dans les paramètres de paiement de l'entreprise. | Utiliser un autre mode de règlement ou activer l'option en réglages. |
| **Paiement** | `VTM-PAY-PSP-UNSUPPORTED` | Passerelle de paiement en ligne non configurée pour ce pays. | Opérateur mobile money non connecté dans l'organisation. | Utiliser le mode Mobile Money manuel avec référence de transaction. |
| **Panier** | `VTM-CART-ALREADY-RESUMED`| Ce panier a déjà été repris par un autre caissier. | Deux caissiers ont tenté de reprendre le même panier au même instant. | Rafraîchir la liste des paniers pour voir les paniers restants. |
| **Sécurité** | `VTM-AUTH-SESSION-EXPIRED`| Votre session a expiré pour des raisons de sécurité. | Jetons d'accès et de rafraîchissement échus ou révoqués. | Saisissez à nouveau votre mot de passe pour reprendre votre travail. |
| **Sécurité** | `VTM-SEC-IP-RATE-LIMIT` | Trop de tentatives de connexion infructueuses. | 5 échecs consécutifs sur l'adresse email. | Patienter 5 minutes avant un nouvel essai. |

---

## 3. SYSTÈME DE CONSEILS ÉDITORIAUX ET TEXTES PÉDAGOGIQUES VARIABLES (PHASE 2.3)

Pour dynamiser l'accueil et guider les commerçants sans encombrer les écrans, un pool de **7 conseils pratiques par domaine**, stable pour la journée entière (déterminé par `hash(tenantId + userId + date)`), est modélisé :

### Module Vente / Caisse
1. *« Pensez à proposer un article complémentaire lors du passage en caisse pour augmenter votre panier moyen. »*
2. *« Utilisez le raccourci F2 pour basculer instantanément en recherche produit par code-barres. »*
3. *« En cas de client hésitant, suspendez son panier avec le bouton 'Suspendre' pour servir le client suivant sans perdre sa saisie. »*
4. *« Vérifiez toujours l'authenticité des billets de banque de forte valeur avant de rendre la monnaie. »*
5. *« Pour les règlements Mobile Money, exigez de voir le SMS de confirmation officiel sur le téléphone du client. »*
6. *« Un ticket imprimé avec votre logo et vos coordonnées renforce la fidélité et le professionnalisme de votre boutique. »*
7. *« Réalisez un comptage intermédiaire de vos espèces si votre tiroir contient plus de liquidités que le plafond de sécurité. »*

### Module Stock / Inventaire
1. *« Effectuez un inventaire tournant sur une famille de produits chaque semaine pour éviter les surprises en fin d'année. »*
2. *« Tout article retourné défectueux doit être placé en Quarantaine SAV pour ne pas être revendu par mégarde. »*
3. *« Les alertes de stock faible vous permettent de commander vos réapprovisionnements avant la rupture. »*
4. *« Renseignez les dates de péremption dès la réception pour que le système applique automatiquement la règle FIFO. »*
5. *« Lors d'un transfert entre deux boutiques, imprimez le bon de transfert pour que le livreur le fasse émarger à l'arrivée. »*
6. *« Isolez les emballages abîmés dès la réception fournisseur et déclarez-les immédiatement au livreur. »*
7. *« Le coût moyen pondéré (CUMP) se recalcule automatiquement à chaque nouvelle réception au prix d'achat réel. »*
