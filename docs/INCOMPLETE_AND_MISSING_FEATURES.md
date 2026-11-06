# ÉTAT DES LIEUX DES FONCTIONNALITÉS INACHEVÉES ET MODULES RESTANTS — VTM

**Document de référence :** `docs/INCOMPLETE_AND_MISSING_FEATURES.md`  
**Date :** 1er Novembre 2026  
**Révision Git :** `86dabc5fb2b1c612a21f4e9b14b9f8770fd63884`  

---

## 1. MATRICE COMPARATIVE : PROMIS VS LIVRÉ

Pour chaque brique fonctionnelle mentionnée dans la documentation d'architecture ou les guides utilisateurs, l'audit vérifie la présence effective à chaque échelon technique :

| Brique Fonctionnelle | Demandée | Schéma DB | Backend | Frontend | Permissions | Tests Automatisés | Utilisable en Production | Reste à Faire pour Finalisation |
|---|---|---|---|---|---|---|---|---|
| **Vente au comptoir (POS)** | Oui | Oui | Oui | Oui | Oui | 55 unitaires + 191 E2E | **OUI** | Sécuriser `operationId` multi-onglets (`S1-01`). |
| **Paniers Suspendus** | Oui | Oui | Oui | Oui | Oui | Validé E2E | **OUI** | Verrou atomique `HeldCart.resume` (`S1-02`). |
| **Gestion des Stocks & Mouvements** | Oui | Oui | Oui | Oui | Oui | Validé E2E | **OUI** | Index trigrammes sur catalogue pour grands volumes. |
| **Quarantaine SAV (Retours)** | Oui | Oui | Oui | Oui | Oui | Test dédié unitaire | **OUI** | Terminé et protégé contre toute vente accidentelle. |
| **Facturation & Avoirs (5 templates)**| Oui | Oui | Oui | Oui | Oui | Validé E2E | **OUI** | Terminé. |
| **Sessions de Caisse & Rendu Monnaie**| Oui | Oui | Oui | Oui | Oui | Test dédié unitaire | **OUI** | Terminé avec traçabilité complète des espèces. |
| **Recouvrement & Crédit Client** | Oui | Oui | Oui | Oui | Oui | Validé E2E | **OUI** | Raccorder la relance WhatsApp automatique. |
| **Internationalisation UI (Anglais)** | Oui | N/A | Non | Non | N/A | Aucun | **NON (0%)** | Intégrer `react-i18next` et extraire 850+ clés de traduction. |
| **Webhooks Mobile Money CinetPay/Wave**| Oui | Oui | Partiel | N/A | Superadmin | Partiel (Stripe/Paystack) | **NON** | Implémenter les validateurs de signatures CinetPay et Wave. |
| **Module Pointage (Staff Attendance)**| Oui | Oui | Non | Non | Non | Aucun | **NON** | Développer les écrans de pointage et les calculs d'heures. |
| **Module Fidélité & Récompenses** | Oui | Oui | Partiel | Non | Non | Aucun | **NON** | Développer le moteur de calcul de points et les bons d'achat. |
| **Module Prise de Rendez-vous** | Oui | Non | Non | Non | Non | Aucun | **NON** | Modéliser l'agenda et la synchronisation calendrier. |
| **Suivi Transporteur (Livraisons)** | Oui | Partiel | Partiel | Partiel | Oui | Partiel | **PARTIEL** | Connecter les APIs des transporteurs locaux. |

---

## 2. SYNTHÈSE DES DETTES TECHNIQUES ET DIFFÉRENCES DOCUMENTAIRES

1. **Modules annoncés dans le guide mais non branchés :**
   - Le guide utilisateur mentionne la gestion de la fidélité et le pointage horaire des vendeurs. Bien que les tables ou enums préparatoires existent dans Prisma, les pages associées dans `apps/client` sont actuellement absentes ou sous forme de squelettes.
2. **Reconnaissance optique / Scanner caméra :**
   - Le scanner de code-barres fonctionne parfaitement avec des douchettes USB / Bluetooth (émulation clavier). En revanche, l'utilisation de la caméra intégrée du smartphone/tablette via WebRTC n'est pas finalisée dans tous les navigateurs mobiles.
