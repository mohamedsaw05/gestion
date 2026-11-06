# Connexion et verrouillage ciblé

## Règle de verrouillage

Les tentatives infructueuses ne modifient jamais l’état du tenant, son abonnement, ses ventes ou sa disponibilité. Le compteur anti-brute-force est côté serveur et sa clé est limitée à l’organisation et à l’adresse e-mail (`tenantId + email`) lorsque l’organisation est connue; en auto-détection, il reste attaché à l’identifiant de connexion. La connexion correcte d’un autre compte n’est pas bloquée par le verrou d’une organisation.

Le navigateur ne conserve plus de compteur global partagé dans `localStorage`. Il affiche le message reçu du serveur et le délai uniquement dans le formulaire du compte qui vient d’échouer. Changer l’adresse permet de se connecter avec un autre compte sur le même appareil; le serveur reste l’autorité pour la durée du verrou.

## Connexion multi-organisation

Le formulaire ne réutilise plus automatiquement le dernier `tenantId` du navigateur. L’API résout le compte selon l’adresse et les informations d’authentification, évitant d’envoyer le prochain utilisateur vers l’organisation de la session précédente. Un `tenantId` explicitement transmis reste strictement limité à cette organisation.

## En ligne et interface

L’accès au gestionnaire requiert une connexion Internet. L’écran indique l’état réseau, refuse l’envoi du formulaire hors ligne et n’affirme pas que les opérations sont enregistrées sans réponse serveur. Il propose une disposition à deux panneaux sur ordinateur et une présentation compacte adaptée au tactile sur téléphone.

## Vérification

Le test `apps/api/src/auth/auth.service.spec.ts` couvre le verrouillage du compte d’une organisation et la connexion réussie d’un autre compte. La vérification visuelle multi-résolution sur navigateur réel reste à exécuter.

