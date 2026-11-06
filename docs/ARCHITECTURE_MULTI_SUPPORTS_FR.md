# Architecture multi-supports

## Source centrale

L’architecture actuelle comprend un client Web React/Vite, une API NestJS et PostgreSQL. L’authentification, les permissions et l’isolation par organisation sont appliquées par l’API. Le tableau de bord rafraîchit ses indicateurs depuis les routes serveur et reprend une synchronisation périodique à l’ouverture, au focus et au retour du réseau.

## Préparation livrée

Le manifeste PWA et le service worker installent le même client Web; ils n’ajoutent pas une base locale commerciale. Les opérations sensibles restent en ligne et sont confirmées par l’API. Les ressources compilées sont mises en cache uniquement si elles sont des fichiers statiques de même origine.

## À intégrer ensuite

Il n’existe pas encore de conteneur desktop Tauri/Electron, d’application Capacitor/native, ni de canal temps réel SSE/WebSocket. Les futures applications devront appeler les mêmes routes API et ne pas écrire directement en base. La resynchronisation devra relire l’état persisté après reconnexion; un événement temps réel ne remplacera jamais l’enregistrement transactionnel.

