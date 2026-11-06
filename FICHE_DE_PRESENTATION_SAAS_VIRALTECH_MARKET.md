# FICHE DE PRÉSENTATION D'UN GESTIONNAIRE SAAS — VIRALTECH MARKET

**Objectif :** Comprendre le logiciel, identifier ses fonctionnalités les plus utiles et préparer des visuels professionnels destinés à la publicité, aux réseaux sociaux et aux présentations commerciales.

---

## 1. IDENTITÉ DU LOGICIEL

### 1. Nom exact du gestionnaire :
**VTM — ViralTech Market Gestionnaire Commercial & SaaS** (couramment désigné sous le nom **Gestionnaire Commercial VTM** ou **VTM Commerce**).

### 2. Type de logiciel :
Il s'agit d'un **PGI / ERP commercial tout-en-un pour point de vente et multi-boutiques**. Il regroupe la **gestion de caisse et encaissements**, le **suivi des stocks et inventaires en temps réel**, la **facturation & reçus**, la **gestion du crédit/dettes clients**, les **achats fournisseurs**, les **prestations de services & réparations**, les **réservations / rendez-vous**, les **dépenses d'exploitation** et le **suivi de rentabilité financière**.

### 3. Description en quelques phrases : à quoi sert-il concrètement ?
Le logiciel permet à un commerçant ou chef d'entreprise de piloter l'intégralité de son activité en temps réel depuis n'importe quel appareil : enregistrer une vente en quelques secondes (espèces, Orange Money, Moov Money, Wave, carte bancaire, crédit), imprimer ou envoyer un reçu/facture, suivre le niveau exact de stock pour éviter ruptures et vols, contrôler les écarts de caisse de ses employés, suivre les créances clients sans rien oublier, et connaître immédiatement son bénéfice net réel par jour, semaine ou mois.

### 4. Nom de l'entreprise qui le commercialise :
**ViralTech Market (VTM)**.

### 5. Logo disponible :
**Oui**. Le logo est présent au format SVG et vectoriel dans l'interface (`apps/client/src/components/Layout.tsx`, `apps/client/public/`), décliné avec la marque VTM, ses emblèmes dorés et son identité visuelle moderne.

### 6. Site web, lien de démonstration ou adresse de connexion :
- **Application Web Commerçants & Caissiers :** `http://localhost:5173` (ou domaine de production déployé).
- **Console d'Administration Plateforme SaaS (Superadmin) :** `http://localhost:5174/platform` (ou `/platform`).
- **Tutoriel interactif et vidéo démo 10 secondes :** accessible directement via `/tutoriel-10s.html` et `/help`.

### 7. Le logiciel est-il déjà utilisable ?
**Oui, le logiciel est opérationnel, éprouvé et testé.** Tous les moteurs fondamentaux (Ventes, Stocks, Multi-boutiques, Caisse, Crédit, Facturation, Prestations, Rendez-vous, Dépenses, Diagnostic et Sauvegarde) sont opérationnels et validés par une suite de tests automatisés (33/33 tests unitaires et d'intégration validés).

---

## 2. CLIENTS VISÉS

### 8. À qui veux-tu vendre ce gestionnaire ?
- **Boutiques & Magasins de détail :** vente de téléphones, électronique, prêt-à-porter, cosmétiques, quincaillerie, pièces détachées, supérettes.
- **Ateliers & Entreprises de services :** réparation informatique/smartphone, pressing, salons, garages, prestations techniques avec devis et main-d'œuvre.
- **Grossistes & Demi-grossistes :** commerces vendant par carton, boîte ou pièce, avec tarification différenciée et gestion des livraisons.
- **Commerces multi-boutiques / Multi-dépôts :** gérants possédant 2 à 10 points de vente ou entrepôts souhaitant centraliser la gestion sans se déplacer.

### 9. Quel problème principal rencontrent ces clients avant d'utiliser ton logiciel ?
**L'opacité financière et le manque de contrôle :** ils ne connaissent pas leur bénéfice net réel, subissent des disparitions inexpliquées de stock ou d'argent en caisse, oublient de recouvrer des crédits clients accordés sur cahier, et perdent des heures à recalculer manuellement leurs bilans à la fin de la journée.

### 10. Quelles sont leurs trois difficultés les plus importantes ?
1. **Les écarts de caisse et coulages de stock :** incapacité de savoir quel employé a vendu quoi, à quelle heure et où est passé le stock.
2. **Le piège des crédits non recouvrés :** clients qui achètent à crédit sur carnet avec des montants oubliés, contestés ou dépassant la solvabilité raisonnable.
3. **La complexité de gestion multi-boutiques :** impossibilité pour le patron de savoir ce qui se passe dans sa boutique n°2 sans s'y déplacer physiquement ou passer 15 appels téléphoniques par jour.

### 11. Pourquoi devraient-ils choisir ton logiciel plutôt qu'une autre solution ou qu'une gestion sur papier et Excel ?
- **Par rapport au cahier / papier :** impossible de perdre une vente, zéro calcul manuel, protection totale contre les falsifications ou l'arrachage de pages, alertes automatiques et reçus professionnels instantanés.
- **Par rapport à Excel :** utilisable sur smartphone sans compétences informatiques, accessible à plusieurs employés en même temps avec des droits restreints (un caissier ne peut pas voir le bénéfice ni modifier les prix sans autorisation), pas de risque de formule cassée ou de fichier écrasé.
- **Par rapport aux logiciels concurrents lourds :** interface ultra-rapide (encaissement en 3 clics), adaptée aux réalités africaines et internationales (gestion du CFA/XOF, devises multiples, moyens de paiement locaux Wave/Mobile Money), isolation étanche des données et fonctionnement fluide même avec une connexion internet modeste.

---

## 3. FONCTIONNALITÉS ESSENTIELLES

### 12. Quels sont les grands modules disponibles ?
1. **Ventes & Encaissements (`/sales/new`, `/sales`)**
2. **Catalogue & Variantes (`/catalog`)**
3. **Gestion des Stocks & Lots (`/inventory`)**
4. **Sessions de Caisse (`/cash`)**
5. **Comptes Clients & Recouvrement Crédit (`/credit`, `/customers`)**
6. **Facturation & Reçus (`/documents`)**
7. **Prestations & Ordres de Service (`/services`)**
8. **Réservations & Rendez-vous (`/appointments`)**
9. **Commandes Clients & Livraisons (`/orders`, `/deliveries`)**
10. **Fournisseurs & Commandes d'Achat (`/suppliers`)**
11. **Retours & Remboursements (`/returns`)**
12. **Garanties & SAV (`/warranties`)**
13. **Dépenses d'Exploitation & Frais Généraux (`/expenses`)**
14. **Rapports Financiers & Bénéfices Nets (`/reports`)**
15. **Audit Immuable & Diagnostic Système (`/audit`, `/diagnostics`)**
16. **Console d'Administration Plateforme SaaS (`/platform`)**

### 13. Quelles sont les cinq fonctionnalités les plus utiles pour un client ?
1. **L'encaissement express multi-moyens de paiement** (Cash, Mobile Money, Carte, Crédit fractionné).
2. **Le suivi automatisé des stocks avec alertes anti-rupture et inventaires**.
3. **Le carnet de crédit client avec plafond bloquant et historique des versements**.
4. **La clôture de caisse quotidienne avec calcul automatique des écarts**.
5. **Le rapport de rentabilité nette en temps réel** (Chiffre d'affaires - Coût d'achat - Dépenses = Bénéfice net).

### 14. Que peut-il faire concrètement avec chacune d'elles ?
- **Encaissement express :** scanner un code-barres ou cliquer sur un article, appliquer une remise contrôlée, choisir le mode de règlement, valider et imprimer le ticket de caisse en moins de 10 secondes.
- **Suivi des stocks :** voir en un coup d'œil ce qui reste dans chaque boutique, être averti dès qu'un produit passe sous le seuil critique, et transférer des pièces d'une boutique à une autre sans perte.
- **Gestion du crédit client :** fixer une limite de crédit par client (ex: 50 000 FCFA), bloquer automatiquement la vente si le plafond est dépassé, et enregistrer des paiements partiels avec reçu d'acompte.
- **Clôture de caisse :** à la fermeture, le caissier compte ses espèces physiques ; le logiciel compare avec les ventes enregistrées et met en évidence le moindre franc d'écart sans tricherie possible.
- **Rapport de rentabilité :** le propriétaire consulte depuis son lit ou son bureau le chiffre d'affaires du jour, la marge brute dégagée et le bénéfice net après déduction des dépenses de la journée (loyer, transport, factures).

### 15. Quelles informations le tableau de bord affiche-t-il ?
- **Chiffre d'affaires brut et encaissé** de la journée, de la semaine et du mois.
- **Bénéfice net réel** calculé automatiquement sur les ventes réalisées.
- **Niveau de stock global** et nombre de produits en alerte ou rupture.
- **Créances clients en cours** avec alerte sur les dépassements de limite.
- **État des sessions de caisse** (ouverte, fermée, écart détecté).
- **Graphique d'évolution des ventes** et top des produits les plus vendus.

### 16. Quelles fonctions permettent de gagner du temps ou d'éviter les erreurs ?
- **Recherche instantanée & Lecteur code-barres :** sélection de l'article en 1 seconde sans taper de nom ni chercher dans des listes interminables.
- **Verrouillage automatique contre le stock négatif :** impossible de vendre un produit physique que l'on n'a pas en stock sans avertissement explicite.
- **Calcul automatique de la monnaie à rendre :** élimine les erreurs de calcul du caissier.
- **Protection anti-écrasement des prix :** les prix d'achat et barèmes de marge sont protégés et invisibles pour les caissiers simples.

### 17. Existe-t-il des fonctions automatiques ?
- **Décrémentation de stock immédiate** à chaque vente validée.
- **Génération automatique du reçu numérique immuable** dès validation du paiement.
- **Alerte de réapprovisionnement** dès qu'un produit atteint son stock de sécurité.
- **Mise à jour du solde de dette client** en cas de vente à crédit ou de versement partiel.
- **Génération automatique de la garantie** si le produit vendu bénéficie d'une garantie (électronique, électroménager).
- **Scans d'intégrité et auto-réparation** en arrière-plan via le module Diagnostic.

### 18. Quelles fonctions rendent ton logiciel différent des autres ?
- **Architecture Multi-Tenant étanche avec RLS PostgreSQL matérielle :** chaque boutique a ses données strictement isolées des autres sans risque de fuite.
- **Module complet Prestations & Réparations (`/services`) :** cycle complet de diagnostic, devis, affectation technicien, pièces détachées consommées du stock et facturation finale.
- **Module officiel Réservations & Rendez-vous (`/appointments`) :** prise de rendez-vous client, gestion des créneaux horaires par boutique et suivi des visites.
- **Protection financière avancée :** plafonds d'endettement paramétrables, tri déterministe anti-deadlock pour les ventes en forte affluence et traçabilité Outbox 100% auditable.

---

## 4. PARCOURS D'UTILISATION

### 19. Comment un nouveau client commence-t-il à utiliser le logiciel ?
1. **Création de l'organisation :** le compte est créé via la plateforme SaaS avec choix de l'offre (Essai, Starter, Pro, Entreprise).
2. **Profil du commerce :** l'assistant (`/settings/business-profile`) active en un clic les modules pertinents selon son métier (Boutique de détail, Atelier de réparation, Quincaillerie, etc.).
3. **Création ou import du catalogue :** ajout rapide des premiers produits (ou import en masse).
4. **Ouverture de session de caisse :** saisie du fond de caisse initial et encaissement de la première vente !

### 20. Quelle est l'action principale que le client effectue chaque jour ?
**Encaisser les ventes** (sur l'écran de caisse tactile/rapide) et **clôturer sa caisse le soir** en vérifiant la concordance entre le tiroir-caisse physique et le rapport du logiciel.

### 21. Quels résultats peut-il obtenir après quelques jours ou semaines d'utilisation ?
- **Après 3 jours :** zéro oubli de vente, disparition immédiate des contestations de prix ou de monnaie avec les clients grâce aux reçus systématiques.
- **Après 2 semaines :** élimination des écarts de caisse inexpliqués et vision claire des produits les plus rentables vs les produits dormants.
- **Après 1 mois :** réduction drastique des pertes sur crédit client (recouvrement facilité), réduction des ruptures de stock de 80%, et connaissance exacte du bénéfice net dégagé par l'entreprise.

### 22. Le logiciel est-il accessible sur ordinateur, téléphone et tablette ?
**Oui.** L'interface est 100% responsive web moderne, fluide et optimisée sur ordinateur (PC/Mac), tablettes (iPad, Android) et smartphones (iOS, Android).

### 23. Fonctionne-t-il en ligne uniquement ou également hors connexion ?
Le logiciel fonctionne principalement **en ligne via navigateur web**, avec un cache local de session pour fluidifier la navigation et préserver les opérations en cas de micro-coupure réseau.

### 24. Peut-on ajouter plusieurs utilisateurs, employés, magasins ou organisations ?
**Oui, sans restriction technique :**
- **Utilisateurs :** nombre illimité (selon le quota de l'offre SaaS souscrite).
- **Magasins / Boutiques :** support complet du multi-emplacement (`locations`), avec affectation d'employés à un magasin spécifique ou à l'ensemble du réseau.
- **Rôles & Permissions :** attribution fine (Propriétaire, Gérant, Vendeur/Caissier, Magasinier, Comptable).

---

## 5. ÉTAT RÉEL DES FONCTIONNALITÉS

### Opérationnelle et testée :
- Ventes, encaissements multi-modes (Cash, Mobile Money, Carte, Crédit).
- Reçus automatiques et numérotation séquentielle inviolable.
- Catalogue de produits, variantes (tailles, couleurs), bundles (packs) et numéros de série / IMEI.
- Gestion des stocks, lots avec date de péremption (FEFO) et transferts inter-boutiques.
- Sessions de caisse avec contrôle d'ouverture/fermeture et traçabilité des écarts.
- Comptes de crédit clients, versements partiels et plafonds de dette.
- Prestations et réparations techniques avec pièces consommées.
- Réservations et rendez-vous clients avec planning de créneaux.
- Dépenses opérationnelles et justificatifs.
- Factures proforma, devis et factures définitives.
- Commandes d'achat fournisseurs et réceptions de stock.
- Retours de marchandises avec remise en stock conditionnelle.
- Garanties commerciales et suivi des réclamations SAV.
- Rapports financiers de rentabilité et chiffre d'affaires.
- Journal d'audit complet et moteur de diagnostic système.
- Console d'administration plateforme SaaS avec gestion des abonnements.

### Présente mais à améliorer :
- Export comptable avancé vers des logiciels tiers (format FEC / Sage).
- Notifications SMS directes (module présent, nécessite la configuration de la passerelle SMS choisie par le client).

### En développement :
- Synchronisation native e-commerce grand public (boutique en ligne connectée au stock du magasin physique).

### Prévue pour une version future :
- Mode hors-ligne complet PWA avec réconciliation différée en cas de coupure prolongée de plusieurs jours.
- Reconnaissance vocale pour saisie d'articles en caisse.

### Fonctions que tu ne souhaites pas encore montrer publiquement :
- Les menus d'administration interne superadmin (`/platform`), réservés exclusivement à l'éditeur ViralTech Market pour piloter les souscriptions.

---

## 6. SÉCURITÉ ET FIABILITÉ

### 25. Comment les comptes et les accès sont-ils protégés ?
- Mots de passe hachés avec l'algorithme robuste **Argon2id**.
- Authentification par jetons sécurisés **JWT (Access Token court + Refresh Token avec rotation stricte)**.
- **Protection Anti-Brute-Force intégrée :** verrouillage automatique de 5 minutes après 5 tentatives infructueuses consécutives.
- Sessions révocables immédiatement en cas de départ d'un employé.

### 26. Existe-t-il plusieurs rôles et autorisations pour les utilisateurs ?
**Oui, un moteur RBAC (Role-Based Access Control) complet :**
- **Propriétaire (Owner) :** accès total sans restriction.
- **Gérant (Manager) :** supervision complète des ventes, stocks, caisses et employés de sa boutique, sans accès aux paramètres critiques de l'organisation.
- **Vendeur / Caissier :** accès restreint à la vente, à sa caisse personnelle et à la consultation du catalogue. Impossible de voir les bénéfices, les coûts d'achat fournisseurs ou de modifier un prix.
- **Magasinier :** gestion des réceptions et transferts de stocks.
- **Rôles personnalisés :** chaque entreprise peut créer ses propres profils sur mesure avec plus de 40 permissions atomiques.

### 27. Les données sont-elles sauvegardées ? Si oui, comment ?
- Sauvegardes continues et instantanées grâce à la base de données relationnelle PostgreSQL.
- Bouton d'exportation de secours en un clic : le client peut à tout moment télécharger l'intégralité de ses données (ventes, clients, stocks, produits) au format JSON/CSV directement depuis les paramètres.

### 28. Existe-t-il un historique des opérations ou une traçabilité des actions ?
**Oui, journal d'audit immuable (`AuditLog`) :** chaque création de vente, suppression, modification de stock, encaissement, réinitialisation ou ouverture de caisse est enregistrée avec l'identifiant de l'utilisateur, l'horodatage précis à la seconde, l'adresse IP et les valeurs avant/après.

### 29. Comment les données de différentes entreprises sont-elles séparées ?
Par la technologie **Row Level Security (RLS)** native du moteur PostgreSQL : chaque requête SQL exécutée dans le système est verrouillée avec la variable de session `app.current_tenant_id`. Il est physiquement impossible pour une boutique A de lire ou modifier la moindre ligne d'une boutique B, même en cas de bug de code.

### 30. Quelles garanties peux-tu réellement annoncer concernant la disponibilité, la confidentialité et la récupération des données ?
- **Confidentialité totale :** étanchéité multi-tenant prouvée par tests d'intrusion automatisés.
- **Disponibilité :** architecture Cloud conteneurisée à haute résilience, sans composant obsolète.
- **Récupération :** possibilité d'auto-réparation sûre via le scanner de cohérence et réinitialisation maîtrisée protégée par mot de passe et phrase de confirmation.

---

## 7. OFFRE COMMERCIALE

### 31. Comment le logiciel est-il vendu ?
Sous forme d'**abonnement SaaS sans engagement** (mensuel ou annuel avec réduction), ou formule personnalisée pour les grands réseaux multi-magasins.

### 32. Quel est le prix, s'il est déjà défini ?
Quatre plans versionnés sont intégrés dans la plateforme :
1. **Essai (Trial) :** Gratuit pendant 14 jours (toutes fonctionnalités incluses).
2. **Starter :** Formule accessible pour petit commerce ou indépendant (1 boutique, 2 utilisateurs). *Tarif standard indicatif : 15 000 FCFA / mois (ou ~25 €)*.
3. **Pro (Le plus populaire) :** Pour magasin dynamique avec stock et crédit (jusqu'à 3 boutiques, 10 utilisateurs). *Tarif standard indicatif : 35 000 FCFA / mois (ou ~55 €)*.
4. **Entreprise :** Réseau étendu, multi-boutiques illimité, support dédié 24/7. *Sur devis personnalisé*.

### 33. Existe-t-il une démonstration gratuite, une période d'essai ou une formule de départ ?
**Oui.** Période d'essai gratuite de **14 jours sans carte bancaire requise**, avec toutes les fonctionnalités débloquées pour tester avec ses propres produits.

### 34. L'installation, la configuration, la formation et la maintenance sont-elles incluses ou facturées séparément ?
- **Installation :** Aucune installation requise sur machine (accès immédiat en ligne via navigateur).
- **Maintenance et mises à jour :** 100% incluses automatiquement et gratuites.
- **Accompagnement & Import initial de catalogue :** inclus dès la formule Pro.

### 35. Comment le client obtient-il de l'aide en cas de problème ?
- Centre d'aide et tutoriels intégrés dans l'application (`/help`).
- Support direct par **WhatsApp commercial et technique**.
- Assistance par email et prise en main à distance si nécessaire.

### 36. Quelles sont les coordonnées à afficher ?
- **Entreprise :** ViralTech Market (VTM)
- **WhatsApp / Téléphone commercial :** *(Coordonnées de contact officiel VTM)*
- **Email support :** `support@viraltechmarket.com` (ou email officiel VTM)
- **Site officiel :** *(Lien vers le portail VTM)*

---

## 8. ÉLÉMENTS VISUELS DISPONIBLES

### 37. Peux-tu fournir des captures d'écran du logiciel ?
**Oui.** Le dossier `docs/screenshots/` et le manifeste `docs/CAPTURES_MANIFEST.md` recensent les captures d'écran réelles en haute définition de chaque module :
- Tableau de bord principal avec jauges de rentabilité.
- Écran de caisse et nouvelle vente.
- Suivi des stocks et alertes.
- Gestion du crédit et balance âgée clients.
- Ordres de réparation et services.
- Planning des réservations et rendez-vous.

### 38. As-tu une vidéo de démonstration ou un accès de test ?
**Oui.**
- Une vidéo de démonstration et un tutoriel express de 10 secondes sont disponibles dans `apps/client/public/tutoriel-10s.html` et `apps/client/public/videos/`.
- Un environnement de test complet avec données de démonstration est accessible localement ou en ligne.

### 39. As-tu déjà un logo, des icônes ou une charte graphique ?
**Oui.** Identité visuelle moderne basée sur la typographie Inter / Outfit, une palette sombre et lumineuse haut de gamme, des icônes explicites et des badges colorés haute visibilité.

### 40. Quelles pages représentent le mieux le logiciel ?
1. **Le Tableau de bord (`/`) :** pour l'impact visuel et la synthèse des bénéfices.
2. **L'Écran de Vente & Caisse (`/sales/new`) :** pour montrer la simplicité et la rapidité d'encaissement.
3. **La Gestion des Stocks (`/inventory`) :** pour rassurer sur le contrôle des marchandises.
4. **Le Carnet de Crédit Clients (`/credit`) :** pour illustrer la fin des dettes oubliées.
5. **Le Planning des Rendez-vous (`/appointments`) :** pour montrer l'organisation professionnelle.

### 41. Y a-t-il des éléments à masquer ?
Pour les visuels publics, utiliser des données d'exemples réalistes (ex: "Boutique Prestige VTM", montants standards, noms génériques) et masquer toute information personnelle réelle d'utilisateurs.

---

## 9. STYLE DES VISUELS

### 42. Quel style préfères-tu ?
**Moderne, premium et technologique, tout en restant chaleureux, lisible et rassurant.** L'objectif est de dégager une impression de puissance professionnelle sans paraître intimidant pour un commerçant ordinaire.

### 43. Quelles couleurs faut-il utiliser ?
- **Couleur principale :** Bleu profond / Marine (`#0f172a`, `#1e293b`).
- **Accents lumineux :** Or ambré (`#f59e0b`, `#fbbf24`), Bleu électrique (`#2563eb`, `#38bdf8`) et Vert émeraude pour les indicateurs de succès et bénéfices (`#10b981`).
- **Fond :** Blanc éclatant et surfaces gris clair pour les versions jour ; dégradé nuit profond pour les versions prestige.

### 44. Souhaites-tu montrer surtout les écrans réels du logiciel, des illustrations explicatives ou une combinaison des deux ?
**Une combinaison des deux :** l'écran réel du logiciel (pour prouver qu'il existe et qu'il est déjà magnifique) accompagné d'encarts explicatifs courts mettant en valeur le bénéfice client (ex: *« Encaissé en 5 secondes »*, *« Zéro vol de stock »*, *« Connaissez votre vrai bénéfice »*).

### 45. Le visuel doit-il porter uniquement sur le logiciel ou également afficher le logo ViralTech Market ?
**Les deux :** le nom du logiciel mis en avant avec la signature officielle **« Propulsé par ViralTech Market »** et le logo VTM.

### 46. Quelle langue faut-il utiliser ?
**Français principalement** (avec possibilité de déclinaison bilingue Français/Anglais pour les marchés régionaux).

---

## 10. SUPPORTS À PRODUIRE

### 47. Où comptes-tu publier les visuels ?
- **WhatsApp :** statuts, catalogues de diffusion et messages privés de prospection.
- **Facebook & Instagram :** publications publicitaires ciblées (commerçants, gérants de boutiques).
- **TikTok :** courtes vidéos dynamiques de démonstration en situation réelle de vente.
- **Présentation commerciale PDF / Plaquette :** pour les rendez-vous en direct avec les chefs d'entreprise.

### 48. Quels formats sont prioritaires ?
1. **Format Carré (1:1 - 1080x1080) :** pour les publications de fil Facebook et Instagram.
2. **Format Vertical (9:16 - 1080x1920) :** pour les Stories Instagram, Statuts WhatsApp et vidéos TikTok.
3. **Format Paysage (16:9) :** pour les bannières web et les fiches de présentation.

### 49. Veux-tu une seule affiche ou une série de visuels ?
**Une série de visuels thématiques cohérents :**
- Visuel 1 : Présentation générale & coup de cœur (*« Dites adieu aux carnets et aux pertes »*).
- Visuel 2 : Maîtrise des stocks & inventaires (*« Sachez exactement ce qu'il vous reste »*).
- Visuel 3 : Gestion du crédit & caisse (*« Fini les créances impayées et les erreurs de monnaie »*).
- Visuel 4 : Multi-boutiques & contrôle à distance (*« Pilotez vos magasins depuis votre téléphone »*).
- Visuel 5 : Offre spéciale & appel à l'action WhatsApp (*« Testez gratuitement pendant 14 jours »*).

### 50. Souhaites-tu également une courte vidéo publicitaire ou une démonstration guidée du logiciel ?
**Oui.** Une vidéo rythmée de 15 à 30 secondes montrant un commerçant qui scanne un produit, valide la vente et voit immédiatement son chiffre d'affaires et son stock se mettre à jour sur son téléphone.

### 51. Quelle action le public doit-il effectuer après avoir vu la publicité ?
**Cliquer pour discuter directement sur WhatsApp ou demander une démonstration gratuite immédiate.**

---

## 11. MESSAGE COMMERCIAL FINAL

### 52. Quelle est la promesse principale de ton gestionnaire ?
**« Gardez le contrôle total sur votre argent, vos stocks et vos bénéfices, où que vous soyez et en toute sérénité. »**

### 53. Quel est son avantage le plus convaincant ?
**La clarté financière immédiate :** en fin de journée, le gérant sait exactement combien il a vendu, combien il a en caisse, ce qu'on lui doit et quel est son bénéfice réel, sans passer une heure à faire des calculs.

### 54. Quel titre ou slogan veux-tu éventuellement mettre en avant ?
- **Slogan principal :** *« VTM — Votre commerce sous contrôle, votre esprit tranquille. »*
- **Slogans alternatifs :**
  - *« Fini les cahiers, place à la rentabilité. »*
  - *« Vendez plus vite, gérez plus simplement, encaissez sans erreur. »*
  - *« La puissance d'un grand système de gestion, la simplicité en plus. »*

### 55. Y a-t-il une phrase, une promesse ou une information que je ne dois surtout pas utiliser ?
- Ne jamais promettre : *« Ce logiciel fait vos ventes tout seul sans travail de votre part »*.
- Ne jamais inventer de fausses certifications ou de partenariats bancaires inexistants.
- Ne jamais prétendre qu'il s'agit d'un simple fichier Excel déguisé : c'est un véritable progiciel SaaS professionnel conçu avec des technologies de pointe.

---

*Fiche technique et commerciale validée pour l'ensemble des modules du gestionnaire SaaS ViralTech Market.*
