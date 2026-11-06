# Périphériques, impression et scanners

## Profils par poste

Ouvrez **Paramètres → Périphériques & impression**. Chaque profil est persisté avec son type, marque/modèle déclarés, mode de connexion, terminal, format papier et association boutique/session de caisse. La liste est filtrée par terminal afin que la configuration d’un poste ne remplace pas celle d’un autre. Les associations boutique et session sont validées dans l’organisation.

Types disponibles: imprimante bureautique, imprimante thermique ou lecteur de codes. Formats: A4/A5, 58/80 mm, personnalisé ou sans papier. Connexions répertoriées: service d’impression système, USB, réseau, Wi-Fi, Bluetooth, agent local ou caméra. Enregistrer une valeur décrit une intention de configuration; cela ne démontre pas une connexion physique.

## Ce que permet le navigateur

Un scanner USB/Bluetooth qui se comporte comme un clavier saisit généralement une chaîne dans le champ focalisé. Il faut tester le suffixe de validation, la disposition clavier et le code retourné sur le terminal concerné. L’impression depuis le navigateur ouvre le dialogue d’impression système; les pilotes et le papier sont gérés par le système. Certaines API matérielles demandent HTTPS, une action utilisateur et un support spécifique. Il n’existe pas de garantie générale de prise en charge USB, Bluetooth, caméra ou ESC/POS.

Un pont local ou un agent d’impression peut être évalué pour un besoin ESC/POS ou accès direct, avec authentification locale, liste blanche des destinations et consentement explicite. Ne demandez jamais les identifiants de la plateforme pour connecter un appareil.

## Tests

Le bouton de test ouvre un exemple imprimable via le navigateur: il valide uniquement l’appel d’impression logiciel. Le diagnostic de contexte indique HTTPS, pas la présence d’un scanner ou d’une imprimante. Avant mise en production, tester à nouveau après reconnexion: lecture, bon format, association au poste, sortie papier et lisibilité. Documenter le navigateur, OS, modèle, connexion et résultat.

## Limites de cette livraison

Les profils sont persistés, mais ce module ne possède pas encore de service natif/agent local, de test USB ou Bluetooth direct, de lecture caméra, d’interpréteur ESC/POS, d’import CSV de périphériques ni de test physique certifié. Les profils ne doivent donc pas être présentés comme une certification de compatibilité matérielle. Une impression PDF par le navigateur demeure la voie générique disponible.
