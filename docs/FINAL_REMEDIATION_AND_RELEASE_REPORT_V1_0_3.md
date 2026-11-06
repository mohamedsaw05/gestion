# Rapport de livraison — VTM 1.0.3

**Objectif de cette version :** corriger le verrouillage partagé du navigateur et améliorer l’écran de connexion, avec une utilisation en ligne sur téléphone.

## Changements

- Retrait du compteur d’échecs partagé en `localStorage`; le serveur seul applique la temporisation.
- Clé serveur basée sur l’organisation et l’adresse e-mail quand le tenant est explicite; aucune mise à jour du statut tenant n’est faite par l’échec de connexion.
- Le verrouillage ne désactive dans l’interface que le formulaire affichant le même e-mail et la durée reçue du serveur. Il disparaît à l’expiration; un autre compte peut se connecter sur le même navigateur.
- Le formulaire client ne réutilise pas automatiquement le dernier `tenantId` du navigateur.
- Refonte visuelle split-screen sur grand écran et mobile condensé tactile; état Internet visible, soumission désactivée hors ligne, bouton afficher/masquer le mot de passe.

## Vérifications

- Suite API complète après la correction: 18 fichiers, 87 tests — PASS.
- Test de non-régression: après le verrouillage du compte du tenant A, le compte du tenant B reste accessible — PASS.
- Build de production API, client, admin et site — PASS (`npm run release:package`).
- Archive ZIP: 1 345 fichiers, scan de secrets sans détection, extraction et contrôle d’intégrité — PASS.
- E2E non relancé pour cette version.
- Aucun test de navigateur multi-résolution ni capture réelle n’a été exécuté. La PWA reste une application Web installable, pas une application native.

## Limites

Le verrouillage serveur est gardé en mémoire par instance API; une montée en multi-instance nécessite un compteur partagé ou persistant, limité au compte. En auto-détection, lorsque la même adresse existe dans plusieurs organisations, le serveur ne reçoit pas un tenant choisi explicitement; ce cas mérite un parcours de sélection d’organisation avant de promettre une isolation plus fine.

