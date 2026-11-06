# Gestion des événements festifs

## Configuration actuellement disponible

La configuration du mécanisme festif est persistée dans `PlatformConfig` (PostgreSQL). Elle comprend un indicateur `enabled`, une période, un fuseau et les paramètres du mécanisme. La configuration est désactivée par défaut; des dates seules ne l’activent pas. Le backend refuse une utilisation si le mécanisme est désactivé ou hors période.

## Limites importantes

Il s’agit d’une configuration unique de roue festive, pas de plusieurs événements indépendants (Noël, fin d’année, etc.). Les distributions ne disposent pas encore d’un registre transactionnel d’attributions par tenant avec clé d’idempotence et quota auditable. La persistance des réglages ne suffit pas à garantir qu’un cadeau ne sera jamais attribué en double lors de requêtes concurrentes.

Avant toute campagne réelle, ne pas activer la distribution de cadeaux comme mécanisme de production. Il faut ajouter des entités d’événement et d’attribution, des contraintes uniques/idempotence, les quotas, un historique consultable et des tests de concurrence, d’activation séparée et de désactivation.

