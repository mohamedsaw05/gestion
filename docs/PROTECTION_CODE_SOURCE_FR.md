# Protection du code et des données de production

## Mesures présentes

- Les clients parlent à l’API; aucun accès PostgreSQL navigateur n’est requis.
- La build Vite déclare `sourcemap: false`.
- Les fichiers `.env` ne font pas partie des artefacts statiques client; les secrets serveur doivent rester dans les variables privées du déploiement.
- Le service worker ne met pas en cache les routes API, les requêtes avec `Authorization` ni les routes d’authentification.
- Les contrôles métier sensibles restent dans NestJS et PostgreSQL.

## Limite technique

Les fichiers JavaScript compilés nécessaires à l’application restent téléchargeables et inspectables par un navigateur. La minification n’est pas une protection de secret. Ne jamais placer de clé privée, secret de fournisseur ou règle métier sensible dans le bundle. L’absence de source map doit aussi être contrôlée dans l’artefact Render après déploiement.

