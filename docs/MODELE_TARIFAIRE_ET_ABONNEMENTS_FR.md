# Modèle tarifaire et abonnements VTM

## Référence commerciale

Le tarif mensuel de référence initial est **2 500 FCFA (XOF)**. L’essai gratuit de 14 jours est distinct d’un achat. Les seules durées commerciales achetables sont 3, 6, 12 et 24 mois. Au tarif initial, les totaux sont respectivement 7 500, 15 000, 30 000 et 60 000 FCFA. Un et deux mois sont refusés côté API, même si un client construit sa requête manuellement.

## Source et administration

Le prix courant est conservé dans `PlatformConfig` sous `commercial.subscription-tariff`. L’API publique `GET /commercial/settings` fournit le prix, les quatre totaux et les horaires d’assistance. Le panneau Super Admin → Configuration commerciale → Tarification des abonnements permet d’enregistrer un entier positif, un motif facultatif et l’auteur. Chaque changement est ajouté à `PlatformTariffHistory` avec l’ancien et le nouveau prix, l’administrateur et la date d’effet. Les clients n’écrivent jamais le montant à facturer.

Une facture commerciale est recalculée côté serveur à partir du tarif courant et du nombre de mois autorisé. `CreateSaasInvoiceDto` accepte seulement 3, 6, 12 ou 24 mois; le montant n’est pas accepté comme entrée. Les factures stockent leur montant, leur devise, leur début et leur fin: ces valeurs constituent le snapshot historique et ne sont pas recalculées après un changement de tarif.

## Calendrier

Les périodes utilisent des mois calendaires UTC, et non des blocs fixes de 30 jours. Si le jour d’origine n’existe pas dans le mois cible, la date est ramenée au dernier jour de ce mois (par exemple 31 janvier + 3 mois = 30 avril). L’échéance de facture sert de période d’abonnement lors du paiement.

## Essai et opérations admin

Les organisations créées via l’offre d’essai conservent 14 jours gratuits et un état d’abonnement distinct. Un changement de plan administrateur ne modifie pas le montant déjà facturé. L’émission d’une facture commerciale au changement de plan utilise une durée autorisée et le tarif central.

## Tests et limites connues

Les tests unitaires couvrent le tarif initial, les totaux 3/6/12/24, le refus de 1/2 mois, le changement de prix et un calcul de fin de mois. Cette version ne met pas en place un parcours autonome de paiement client ni un processeur de paiement; les factures sont émises par les fonctions administratives existantes. La liste publique des tarifs est chargée depuis l’API et n’affiche aucun ancien montant si le service est indisponible.
