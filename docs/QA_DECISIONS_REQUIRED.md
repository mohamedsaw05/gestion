# NOUVELLES DÉCISIONS MÉTIER ET ARBITRAGES STRATÉGIQUES — VTM SAAS

**Document de référence :** `docs/QA_DECISIONS_REQUIRED.md`  
**Date :** 1er Novembre 2026  
**Destinataire :** Propriétaire et Décideur Métier VTM  
**Périmètre :** Arbitrages stratégiques issus de l'audit contradictoire intégral (Phases 0 à 17)  

---

### DÉCISION 1 : Sécurisation Absolue contre l'Effacement Global de Données (S0-01)
1. **Le problème concret :**
   Il existe actuellement dans le code une commande d'administration plateforme (`POST /platform/reset-all`) capable d'effacer d'un seul clic l'intégralité des ventes, factures et clients de **toutes les entreprises de la plateforme en même temps**. Aucune sécurité ne vérifie si le logiciel tourne en conditions réelles de production.
2. **Options possibles :**
   - **Option A (Recommandée - Sécurité Maximale) :** Supprimer purement et simplement cette route en environnement de production. N'autoriser la réinitialisation que sur les comptes explicitement marqués comme "Comptes de Démonstration" (`isDemo: true`), sans jamais toucher aux vrais clients.
   - **Option B :** Conserver la commande globale pour les urgences mais exiger une confirmation avec code à usage unique (OTP) envoyé par SMS au propriétaire de la plateforme.
3. **Recommandation :** **Option A**. En production SaaS commerciale, une commande capable d'effacer tous les clients en une seule fois représente un risque inacceptable.
4. **Valeur par défaut proposée :** Option A (désactivation totale du reset global en production).
5. **Question claire pour vous :**
   > *Validez-vous la suppression définitive de la commande d'effacement global en production pour garantir qu'aucune entreprise cliente ne puisse voir ses données effacées par accident ?*

---

### DÉCISION 2 : Stratégie de Déploiement de la Version Anglaise (i18n - S2-01)
1. **Le problème concret :**
   L'application est aujourd'hui rédigée à 100% en français dans ses écrans, ses boutons et ses tickets imprimés. L'anglais n'existe que dans le manuel d'utilisation externe.
2. **Options possibles :**
   - **Option A (Recommandée - Déploiement progressif) :** Traduire en priorité la caisse (POS), les tickets de caisse et les factures pour permettre aux caissiers et clients anglophones d'acheter et de recevoir leurs reçus en anglais, puis traduire le reste de l'administration dans un second temps.
   - **Option B (Chantier global immédiat) :** Bloquer le lancement commercial pour traduire l'intégralité des 850 libellés de l'application (paramètres, graphiques, configuration comptable).
   - **Option C (Marché francophone exclusif) :** Assumer un lancement initial 100% en français pour les pays d'Afrique francophone (Côte d'Ivoire, Sénégal, Cameroun, etc.) et reporter l'anglais à l'année prochaine.
3. **Recommandation :** **Option A**. Elle permet d'accueillir des commerces bilingues sans retarder le lancement commercial.
4. **Valeur par défaut proposée :** Option A.
5. **Question claire pour vous :**
   > *Souhaitez-vous que nous rendions en priorité l'écran de caisse et les tickets de vente bilingues (FR/EN) avant le lancement commercial ?*

---

### DÉCISION 3 : Prévention des Conflits de Vente Multi-Onglets (S1-01)
1. **Le problème concret :**
   Si un caissier ouvre deux onglets sur le même magasin dans son navigateur internet pour servir deux clients en parallèle, le système risque d'attribuer le ticket du premier client au second en raison d'une clé d'idempotence partagée dans le navigateur.
2. **Options possibles :**
   - **Option A (Recommandée - Souplesse caissier) :** Isoler hermétiquement chaque onglet de vente. Le caissier peut ouvrir autant d'onglets qu'il le souhaite, chaque panier reste totalement indépendant avec son propre ticket.
   - **Option B (Verrouillage de sécurité strict) :** Interdire l'ouverture de plusieurs onglets sur la même caisse. Si un second onglet est ouvert, le premier affiche un avertissement et se met en pause.
3. **Recommandation :** **Option A**. Les commerçants apprécient de pouvoir préparer une seconde vente pendant qu'un client cherche sa monnaie dans son sac.
4. **Valeur par défaut proposée :** Option A (isolation complète par onglet).
5. **Question claire pour vous :**
   > *Validez-vous l'isolation indépendante de chaque onglet de vente pour permettre aux caissiers de gérer plusieurs paniers en parallèle sans risque de mélange ?*

---

### DÉCISION 4 : Sort des Données à l'Expiration de la Période d'Essai Gratuite
1. **Le problème concret :**
   Lorsqu'un nouveau commerçant teste VTM pendant sa période d'essai (ex: 14 ou 30 jours) et ne souscrit pas immédiatement d'abonnement payant à l'échéance, quelle doit être la règle d'accès à ses données ?
2. **Options possibles :**
   - **Option A (Recommandée - Règle de courtoisie et conformité) :** Basculer le compte en « Consultation seule » pendant 60 jours. Le commerçant peut continuer à se connecter pour voir ses anciens chiffres et exporter ses données (clients, factures en PDF, stocks), mais le bouton d'encaissement est désactivé jusqu'au paiement. Aucune donnée n'est supprimée sans préavis.
   - **Option B (Blocage immédiat) :** Dès le jour J de fin d'essai, bloquer l'accès à l'application avec un écran d'invitation à payer.
3. **Recommandation :** **Option A**. Elle inspire confiance aux commerçants et respecte le droit de récupération des données tout en incitant à la souscription.
4. **Valeur par défaut proposée :** Option A (60 jours de consultation et export garantis).
5. **Question claire pour vous :**
   > *Approuvez-vous le maintien d'un accès en consultation et export pendant 60 jours pour les commerçants dont la période d'essai prend fin ?*

---

### DÉCISION 5 : Intégration des Opérateurs Mobile Money (Wave et CinetPay)
1. **Le problème concret :**
   Le système propose actuellement le paiement en ligne par carte (Stripe) et Mobile Money (Paystack), mais les connecteurs pour Wave et CinetPay (très populaires au Sénégal, en Côte d'Ivoire, au Mali, etc.) ne sont pas encore finalisés pour la validation automatique par notification bancaire.
2. **Options possibles :**
   - **Option A (Recommandée) :** Finaliser en priorité les connecteurs officiels Wave et CinetPay pour que les ventes se valident automatiquement dès que le client valide le paiement sur son smartphone.
   - **Option B :** Conserver pour l'instant le mode « Mobile Money manuel », où le caissier demande au client son numéro de transaction reçu par SMS et le consigne sur le ticket sans connexion bancaire directe.
3. **Recommandation :** **Option A**. C'est un avantage concurrentiel majeur pour accélérer le passage en caisse.
4. **Valeur par défaut proposée :** Option A.
5. **Question claire pour vous :**
   > *Souhaitez-vous que nous finalisions les validateurs automatiques pour Wave et CinetPay afin de fluidifier les encaissements Mobile Money ?*
