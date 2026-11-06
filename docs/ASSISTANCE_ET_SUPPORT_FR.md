# Assistance et demandes de support

## Horaires

Le service est disponible tous les jours, du lundi au dimanche, de **09h00 à 21h00**, fuseau `Africa/Ouagadougou`. Ces valeurs sont les valeurs par défaut persistées/résolues par la configuration de la plateforme. Le Super Admin peut changer ouverture, fermeture et fuseau depuis **Configuration commerciale → Disponibilité de l’assistance**. Le calcul de disponibilité utilise l’heure locale dans le fuseau configuré.

## Déposer et suivre une demande

Depuis le Centre d’aide, donnez un sujet et décrivez le résultat attendu, les étapes, le terminal et l’heure. Ne placez pas de mot de passe, token ou donnée bancaire dans le message. La demande reçoit un état `OPEN`, apparaît dans l’historique du compte créateur et est conservée après déconnexion. L’équipe Super Admin la voit dans l’onglet Assistance et peut enregistrer une réponse; le créateur voit la réponse à la prochaine consultation du centre d’aide.

En dehors des horaires, la demande reste déposable et son message précise qu’aucun conseiller n’est annoncé comme disponible immédiatement. Pendant les horaires, l’état ouvert signifie que le service est dans sa plage de disponibilité; il ne garantit pas un temps de réponse instantané.

## Sécurité et limites

Les tickets sont isolés par organisation avec RLS et listés pour le compte demandeur. Les réponses de support sont persistées avec l’adresse de l’administrateur qui répond. Cette livraison ne contient pas encore de notification push/email, de fil de réponses multiples, d’affectation d’agent ni de minuterie SLA; rafraîchir le Centre d’aide pour vérifier une réponse. Les changements d’horaires sont centralisés, mais l’historique de modification des horaires n’est pas conservé comme l’historique tarifaire.
