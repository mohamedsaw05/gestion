# Factures, reçus, bons et décharges

## Identité et exactitude

Une organisation configure son identité dans **Paramètres → Profil du commerce**. Les documents commerciaux doivent afficher le nom et logo du commerce, l’adresse, les coordonnées et la boutique concernée, selon les valeurs réellement enregistrées. ViralTech Market est l’éditeur du logiciel; son identité ne remplace pas celle du commerçant. Vérifiez l’identité du client, les lignes, quantités, prix, remises, taxes applicables, total, payé, solde et statut.

## Références et historique

Le moteur de documents maintient une séquence par organisation, emplacement et série de document. La mise à jour de séquence est réalisée côté serveur dans une transaction afin que des créations concurrentes n’obtiennent pas le même numéro. Une référence émise ne doit pas être recyclée après annulation ou incident d’impression. Le reçu et la facture sont des snapshots reliés à l’opération commerciale; corrigez par annulation/avoir/réémission prévue plutôt que par modification rétroactive du contenu déjà remis.

Une décharge ou un document de remise doit nommer les parties, l’objet remis, le motif, la date, la quantité ou valeur pertinente et le responsable. Si une donnée obligatoire manque, complétez l’opération source avant l’émission. La signature manuscrite ou zone prévue ne prouve pas à elle seule que la transaction source est valide.

## Impression

Les PDF A4 sont destinés aux factures et pièces administratives; les formats compacts conviennent aux tickets si le pilote et le papier sont configurés correctement. Utilisez l’aperçu, vérifiez marges et lisibilité, puis imprimez. L’impression depuis navigateur délègue au système; le format et le rendu dépendent aussi du pilote. La taille de papier réellement prise en charge doit être vérifiée sur le modèle installé.

## Contrôle et limites

Les suites de tests logicielles contrôlent les snapshots, références et montants selon les fonctions existantes. Aucun test physique A4, thermique, scanner ou imprimante multifonction n’est revendiqué par cette version. L’impression ESC/POS brute, le scan par une imprimante multifonction et les signatures électroniques ne sont pas certifiés. Après une impression échouée, réimprimez le document existant au lieu d’en émettre un nouveau.
