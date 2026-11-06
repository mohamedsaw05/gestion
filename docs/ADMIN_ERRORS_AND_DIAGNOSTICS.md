# 🛠️ Catalogue des Codes d'Erreur Normalisés VTM & Diagnostics Système

## 1. Vue d'Ensemble

Pour standardiser la gestion des erreurs, faciliter le support technique de niveau 1 & 2, et offrir une télémétrie claire aux administrateurs de la plateforme VTM SaaS, un **catalogue normé de codes d'erreur (`VTM-***-***`)** et un **module de diagnostics système temps réel** ont été intégrés dans le backend (`apps/api`) et dans la console d'administration (`apps/admin`).

---

## 2. Structure Normée des Codes d'Erreur

Tous les codes d'erreur VTM respectent le pattern :
```text
VTM-{DOMAINE}-{NUMÉRO}
```

Où `{DOMAINE}` correspond à l'une des 8 catégories métier :
1. `AUTH` : Authentification, sessions, permissions et jetons JWT.
2. `SEC` : Sécurité, phrases de confirmation, protection anti-effacement.
3. `STOCK` : Gestion des stocks, mouvements, inventaires, réapprovisionnements.
4. `SALE` : Ventes, caisses, sessions POS, clôtures X/Z.
5. `CASH` : Clôtures de caisse, écarts monétaires, mouvements d'espèces.
6. `CREDIT` : Comptes clients, limites d'encours, recouvrement, échéances.
7. `PRINT` : Impression thermique ESC/POS, pilotes d'imprimante, génération PDF.
8. `PLATFORM` : Multi-tenant, provisioning, quotas et diagnostic système.

---

## 3. Référentiel Officiel des Codes d'Erreur

| Code | Domaine | Gravité | Titre | Description Métier | Action / Remédiation Recommandée |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `VTM-AUTH-001` | AUTH | `ERROR` | Session expirée ou invalide | Le jeton d'authentification JWT est manquant ou a expiré | Se reconnecter avec ses identifiants gérant ou caissier |
| `VTM-AUTH-002` | AUTH | `CRITICAL` | Échec ré-authentification administrateur | Le mot de passe Super Admin fourni pour une action critique est incorrect | Vérifier les identifiants Super Admin dans le gestionnaire de mots de passe |
| `VTM-AUTH-003` | AUTH | `ERROR` | Accès non autorisé à l'organisation | L'utilisateur tente d'accéder aux données d'un tenant auquel il n'est pas rattaché | Vérifier l'attribution du compte utilisateur dans la console admin |
| `VTM-SEC-004` | SEC | `CRITICAL` | Phrase de confirmation de réinitialisation invalide | La phrase de confirmation saisie ne correspond pas strictement au modèle requis | Saisir exactement : `CONFIRMER REINITIALISATION <Nom_Organisation>` |
| `VTM-SEC-005` | SEC | `CRITICAL` | Réinitialisation globale interdite | Tentative d'exécution d'un reset global en environnement de production | Action bloquée par politique de sécurité. Utiliser le reset individuel par tenant |
| `VTM-STOCK-001` | STOCK | `ERROR` | Stock insuffisant pour la vente | Le stock physique disponible est inférieur à la quantité demandée | Effectuer une entrée de stock ou un transfert depuis le dépôt principal |
| `VTM-STOCK-002` | STOCK | `WARNING` | Seuil d'alerte de réapprovisionnement atteint | La quantité en stock est inférieure ou égale au seuil minimal défini | Créer un bon de commande fournisseur pour ce produit |
| `VTM-STOCK-003` | STOCK | `ERROR` | Lot de produit périmé ou indisponible | Le lot sélectionné a dépassé sa date de péremption ou est verrouillé | Mettre le lot au rebut ou sélectionner un autre lot valide |
| `VTM-SALE-001` | SALE | `ERROR` | Caisse fermée pour enregistrer une vente | Aucune session de caisse n'est active pour ce terminal ou cet utilisateur | Ouvrir une session de caisse avec le fond initial requis |
| `VTM-SALE-002` | SALE | `WARNING` | Remise appliquée supérieure au plafond autorisé | Le pourcentage ou montant de remise dépasse la limite configurée pour ce rôle | Demander la validation d'un gérant ou d'un administrateur |
| `VTM-CASH-001` | CASH | `WARNING` | Écart de caisse constaté à la clôture | Le comptage physique des espèces diffère du montant théorique calculé | Enregistrer une note explicative d'écart avant de valider la clôture Z |
| `VTM-CASH-002` | CASH | `ERROR` | Session de caisse déjà clôturée | Impossible de modifier ou rajouter un mouvement sur une session fermée | Ouvrir une nouvelle session de caisse pour poursuivre l'activité |
| `VTM-CREDIT-001`| CREDIT| `ERROR` | Plafond de crédit client dépassé | L'encours client actuel plus le montant de la vente excède la limite accordée | Réduire le montant du crédit ou demander un acompte au client |
| `VTM-CREDIT-002`| CREDIT| `WARNING` | Facture à crédit échue non réglée | La date limite de règlement de la facture est dépassée | Contacter le client ou émettre une relance de paiement |
| `VTM-PRINT-001` | PRINT | `WARNING` | Imprimante de caisse injoignable | L'imprimante thermique USB/Réseau ne répond pas lors de la commande ESC/POS | Vérifier le câble USB, le papier thermique et le pilote d'impression |
| `VTM-PLATFORM-001`| PLATFORM| `CRITICAL`| Organisation introuvable | Le tenant demandé n'existe pas ou a été archivé | Vérifier l'identifiant du tenant dans la console de gestion |
| `VTM-PLATFORM-002`| PLATFORM| `WARNING` | Quota d'utilisateurs ou stockage atteint | Le tenant a atteint la limite de son offre souscrite | Mettre à niveau l'abonnement du client dans la console admin |

---

## 4. Endpoints API de Télémétrie & Diagnostics

### 4.1. `GET /platform/error-catalog`
Retourne le catalogue complet au format JSON structuré avec :
- `code` : Identifiant normé
- `domain` : Catégorie métier
- `severity` : `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- `title` : Titre bilingue (FR/EN)
- `description` : Explication du comportement
- `remediation` : Guide de résolution pas-à-pas
- `technicalDiagnostic` : Détail système pour les développeurs et ingénieurs de support

### 4.2. `GET /platform/diagnostics`
Fournit un bilan instantané de la santé globale de l'infrastructure :
```json
{
  "timestamp": "2026-11-01T12:00:00.000Z",
  "status": "HEALTHY",
  "environment": "production",
  "database": {
    "status": "CONNECTED",
    "latencyMs": 4,
    "metrics": {
      "tenants": 12,
      "users": 48,
      "products": 3450,
      "sales": 18200
    }
  },
  "system": {
    "nodeVersion": "v22.14.0",
    "platform": "win32",
    "uptimeSeconds": 86420,
    "memory": {
      "rssMb": 112,
      "heapUsedMb": 68,
      "heapTotalMb": 92
    }
  },
  "regionalScope": {
    "currency": "XOF",
    "timezone": "Africa/Ouagadougou",
    "country": "BF"
  }
}
```

---

## 5. Console Super Admin (`apps/admin`)

Un nouvel onglet **"Diagnostic Système & Codes d'Erreur"** a été intégré :
- **Bloc Santé Système :**
  - Statut Base de données (Vert/Rouge) avec latence SQL en millisecondes.
  - Consommation mémoire (RSS et Heap en Mo).
  - Temps de fonctionnement du serveur API (Uptime).
  - Configuration régionale active (`XOF` - Ouagadougou).
- **Moteur de Recherche & Filtrage Avancé :**
  - Filtrage instantané par domaine (`AUTH`, `SEC`, `STOCK`, `SALE`, `CASH`, `CREDIT`, `PRINT`, `PLATFORM`).
  - Filtrage par niveau de sévérité (`CRITICAL`, `ERROR`, `WARNING`, `INFO`).
  - Champ de recherche plein texte sur les codes, titres et descriptions.
- **Tableau Interactif :**
  - Badges colorés de gravité.
  - Rendu contextuel de la remédiation et des diagnostics techniques.
