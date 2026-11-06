# Utilisation mobile du gestionnaire

## Ouvrir et installer

Le client Web expose un manifeste PWA, des icônes 180/192/512 px, une couleur de thème et un service worker en production. Sur les navigateurs compatibles, le bouton « Installer l’application » apparaît quand le navigateur signale que l’installation est disponible. Sur iPhone/iPad, utiliser le menu de partage de Safari puis « Sur l’écran d’accueil ».

La première ouverture doit se faire avec une connexion réseau. Le shell et les ressources statiques peuvent être conservés par le navigateur; les données métier restent chargées depuis l’API après authentification. Le service worker ne met pas en cache les routes API, les réponses portant une autorisation ou les pages d’authentification. Une vente hors ligne n’est pas considérée enregistrée.

## Limites

La PWA est le client Web installé, pas une application native Android/iOS. Les notifications push natives et le tableau de bord mobile indépendant du directeur ne sont pas livrés. Le comportement d’installation doit être vérifié sur les versions de navigateurs réellement prises en charge.

