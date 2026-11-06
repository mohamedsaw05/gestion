# Réinitialisation d’une organisation

## Opération ciblée

Le Super Admin sélectionne un tenant par identifiant. L’aperçu affiche le tenant, le directeur propriétaire reconnu par son rôle principal, les utilisateurs, invitations, appareils et rôles personnalisés. L’opération exige une confirmation explicite et un export préalable. Un reset ciblé ne doit pas être confondu avec l’effacement global.

## Données conservées

Le tenant, son identité commerciale et ses paramètres d’organisation, ses emplacements, son abonnement et ses factures SaaS, les traces d’audit plateforme, ainsi que le compte du directeur principal sont conservés. Le hash du mot de passe, l’association au tenant et le rôle propriétaire du directeur sont conservés; ses jetons de rafraîchissement sont révoqués.

## Données supprimées ou remises à zéro

Les comptes secondaires, invitations, appareils, rôles et permissions personnalisés, capacités/modules activés au niveau tenant et l’état d’onboarding sont réinitialisés. Les tables métier tenant-scoped sont inventoriées dynamiquement et supprimées dans la transaction de reset, selon leurs clés tenant.

## Protection et limites

Un export JSON des lignes tenant-scoped est calculé et son empreinte SHA-256 est recalculée avant la suppression; une divergence interrompt l’opération. Le résultat d’audit contient des volumes avant/après. L’export est actuellement renvoyé au navigateur et n’est pas conservé dans un dépôt d’archives durable; la procédure de restauration automatisée et le test de non-régression sur un second tenant restent à compléter. Avant un reset de production, conserver l’export dans un stockage sécurisé externe et valider l’identité du tenant et du directeur.

Le reset global demeure une route séparée et est bloqué en production. Le reset individuel est conçu pour un tenant explicitement sélectionné; sa politique de réauthentification Super Admin doit être complétée avant de considérer le contrôle de sécurité production comme entièrement conforme.

