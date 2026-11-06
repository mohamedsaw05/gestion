# Règles métier du Super Admin

## Portée

Le Super Admin administre la plateforme et les abonnements. Il est distinct du directeur principal et des comptes employés, qui appartiennent à un tenant. Les comptes Super Admin utilisent les routes et le portail `/platform`; ils ne doivent pas servir de comptes clients.

## Organisations et accès

- Une organisation est créée avec un directeur principal et un mot de passe initial fourni lors de la création. Aucun mot de passe de secours ne doit être fabriqué ou affiché.
- Une boutique initiale est obligatoire pour un commerce qui en a besoin. Les noms de boutiques sont normalisés en ignorant casse, accents et espaces superflus; l’unicité est globale pour les boutiques actives.
- Les profils incomplets gardent leur état jusqu’à la validation du parcours de configuration. L’identité commerciale d’un tenant provient de ses paramètres persistés.
- Les droits de capacité et les droits de module sont distincts. Une activation de module ne peut pas accorder une capacité interdite par le plan.

## Administration et audit

Les créations, changements de plan, suspensions, réactivations et réinitialisations passent par l’API et sont persistés. Les changements de plan et factures sont conservés dans PostgreSQL. Le reset individuel est ciblé par identifiant de tenant; le reset global reste soumis aux protections d’environnement.

## Limites fonctionnelles constatées

Au 4 novembre 2026, la console ne fournit pas encore l’ensemble des champs de profil dans une fiche éditable complète, les attributions de durée par lot avec annulation/idempotence, ni une fiche de validation hebdomadaire des droits. Ces fonctions ne doivent pas être considérées disponibles. Les indicateurs de console doivent être rapprochés des données persistées avant décision opérationnelle.

## Identifiants et URL

Les comptes de test sont réservés aux environnements isolés. Les écrans de connexion client ne préremplissent plus les identifiants. L’URL client est celle du déploiement configuré; aucun sous-domaine fictif n’est attribué par le backend.

