# Synchronisation et temps réel

## Synchronisation actuelle

PostgreSQL reste la source de vérité. Le tableau de bord relit des agrégats depuis l’API au chargement, au focus, au retour du réseau et périodiquement. Une erreur de réseau n’est pas transformée en succès métier. La PWA ne conserve pas les réponses commerciales dans son cache.

## Temps réel non livré

Aucun transport SSE/WebSocket ni bus d’événements métier n’est actuellement configuré pour diffuser une vente nouvellement validée aux autres appareils. L’actualisation périodique n’est pas du temps réel. Pour ajouter le push d’événement, l’émettre uniquement après commit, authentifier les clients, scoper les canaux par tenant et permissions, puis relire l’état API après reconnexion pour récupérer les événements perdus.

