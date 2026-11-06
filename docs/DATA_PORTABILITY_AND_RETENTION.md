# Politique de Portabilité, Rétention & Départ Client (Partie 11 & 12)

## 1. Principes de Portabilité Universelle

Le client demeure le propriétaire exclusif de ses données métier. La plateforme fournit des mécanismes d'export complets sans verrouillage technologique :

### Formats d'Export Disponibles
1. **JSON Structuré (`format=json`) :**
   - Format hiérarchique universel regroupant catalogue, emplacements, clients, fournisseurs, stocks, dépenses, règles d'automatisation et paramètres.
   - Idéal pour migration vers d'autres progiciels ou archivage lisible.
2. **SQL PostgreSQL Isolé (`format=sql`) :**
   - Script SQL complet contenant les instructions `INSERT INTO` pré-ordonnées par dépendances de clés étrangères.
   - Strictement isolé au tenant (aucune référence ni fuite vers d'autres organisations).
   - Prêt pour importation directe dans un serveur PostgreSQL indépendant.
3. **CSV Délimité UTF-8 :**
   - Exports tabulaires dédiés par domaine (articles, clients, mouvements de stock, ventes, dépenses).

---

## 2. Règle d'Indépendance : Activité des Employés vs Inactivité du Directeur

> **Règle Absolue :** L'absence de connexion personnelle du propriétaire ou directeur pendant 1, 2 ou 3 mois ne constitue en aucun cas une inactivité de l'entreprise.
- L'activité de l'organisation est qualifiée par l'activité globale : connexions des vendeurs, encaissements de caisse, réceptions de stock, créations de commandes.
- Tant que l'abonnement est valide ou que des collaborateurs utilisent la plateforme, aucune mesure d'archivage ou de suspension n'est appliquée.

---

## 3. Calendrier de Rétention & Délais Configurables

| Échéance | Déclencheur | Action Système | Avertissement & Recours |
| :--- | :--- | :--- | :--- |
| **J + 30** | Inactivité avérée de l'ensemble du tenant | Optimisation du stockage : compression des pièces jointes et documents archivés. | Notification automatique aux contacts autorisés. Données actives toujours accessibles. |
| **J + 90** | Tenant sans abonnement actif ET stockage fichiers > 5 Go | Éligibilité à la purge des fichiers médias non critiques (images secondaires, exports expirés). | 3 notifications préalables (J-30, J-15, J-3). Possibilité de télécharger l'archive complète. |
| **J + 180** | Fin d'abonnement sans renouvellement | Archivage froid de l'organisation et passage en mode lecture seule strict. | Export complet disponible à la demande via la console d'administration. |
| **Fin de rétention** | Clôture définitive contractuelle | Purge définitive des données non soumises à obligation légale. | Vérification préalable obligatoire des gels légaux (Legal Holds) et litiges. |

---

## 4. Runbook de Départ & Résiliation Client

1. **Demande d'export :** Le propriétaire autorisé déclenche `GET /organization/export?format=sql` et `format=json`.
2. **Période de grâce de 30 jours :** Accès maintenu en lecture seule pour permettre les audits et vérifications contradictoires.
3. **Contrôle des obligations légales :** Vérification de l'absence de contentieux, d'enquête en cours ou d'obligation fiscale locale (ex: conservation comptable légale de 10 ans pour les factures).
4. **Purge contrôlée :** Exécution réversible par lots avec tombstones pour éviter toute réintroduction accidentelle lors de restaurations ultérieures.
