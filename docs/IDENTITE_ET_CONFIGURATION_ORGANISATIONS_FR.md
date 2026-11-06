# Identité et configuration des organisations

## Source de vérité

Le profil de l’organisation et ses paramètres persistés sont la source de vérité pour son nom commercial, ses coordonnées et son logo. Les écrans client utilisent un état neutre quand le nom n’est pas renseigné; le nom de l’éditeur n’est pas injecté comme identité de substitution. Le logo doit être enregistré via l’API et référencé par les données du tenant.

## Création et complétion

La création initialise l’organisation sans déclarer le profil complet. Le directeur peut compléter son profil ensuite; `onboardedAt` sert à distinguer un profil configuré d’un profil incomplet. Les coordonnées obligatoires pour un document doivent être demandées à l’usage si elles manquent.

## Documents

Les documents doivent charger le profil correspondant au tenant authentifié et n’utiliser que son identité. Les logos doivent provenir d’un stockage durable référencé par le tenant; un aperçu local seul ne garantit pas la persistance après reconnexion. Les tests d’isolation entre deux organisations et les vérifications PDF restent à maintenir lors des changements de rendu.

