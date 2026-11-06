# 07 — Sécurité (Partie F)

## 1. Authentification

- Mots de passe hashés avec un algorithme à coût mémoire élevé (Argon2id), jamais SHA/MD5 même salé.
- MFA optionnel (TOTP) activable par tenant, obligatoire configurable pour les rôles à fort privilège (admin, gestion financière).
- Verrouillage progressif après tentatives échouées (backoff exponentiel + captcha après seuil), pour limiter le brute force sans bloquer définitivement un utilisateur légitime.
- Access token JWT courte durée (5-15 min) + refresh token opaque avec rotation à chaque usage et détection de rejeu (cf `04-architecture-web.md` §2.2).

## 2. Autorisation

- Vérification systématique côté serveur via `RBAC.can()` à chaque endpoint — jamais de confiance dans un état d'UI côté client.
- Le catalogue de permissions atomiques est versionné dans le code (source de vérité), pas librement configurable en base, pour garantir que ce qui est vérifiable correspond exactement à ce qui est déclaré (cf `02-moteurs.md` §4).
- Scopes de localisation (`ALL_LOCATIONS`, une liste de `location_id`, `OWN_RECORDS`, `TEAM`) appliqués uniformément par les API transactionnelles **et** par le Reporting Engine — jamais un filtrage réservé à un seul des deux (cf risque §7.2 de `01-analyse-risques.md`).

## 3. Isolation tenant

- Row-Level Security Postgres activée sur toutes les tables métier ; rôle applicatif sans `BYPASSRLS` (cf `03-modele-donnees.md` §5).
- `SET LOCAL app.current_tenant_id` positionné par transaction, jamais par connexion partagée dans un pool.
- Tests d'intégration systématiques : pour chaque endpoint, vérifier qu'un utilisateur du tenant A ne peut ni lire ni écrire une ressource du tenant B en devinant son identifiant.

## 4. Chiffrement

- **En transit** : TLS 1.3 partout (Web, Desktop↔Cloud, webhooks entrants des PSP).
- **Au repos, cloud** : chiffrement au niveau du disque/volume de la base (chiffrement transparent du fournisseur cloud) + chiffrement applicatif supplémentaire des colonnes les plus sensibles si exigé par un tenant Enterprise (ex: numéro de pièce d'identité client).
- **Au repos, desktop** : base locale SQLite chiffrée (SQLCipher ou équivalent). La clé de chiffrement n'est **jamais stockée en clair à côté du fichier** : elle est dérivée (KDF) d'un secret d'appareil scellé (obtenu à l'enrôlement, stocké dans le magasin de secrets natif de l'OS — Windows Credential Manager / DPAPI) **combiné** à un élément lié à la session utilisateur active, de sorte qu'un vol du seul fichier `.db` sans l'appareil déverrouillé soit inexploitable.

## 5. Gestion des secrets

- Aucun secret serveur (clé API plateforme, credentials base de données, clés de signature JWT) n'est jamais présent dans le code client (SPA) ni dans l'exécutable desktop distribué.
- Chaque appareil desktop possède son **propre** secret d'enrôlement, individuellement révocable (cf `05-architecture-desktop.md` §5) — jamais un secret partagé compilé dans tous les EXE.
- Rotation périodique des clés de signature JWT (avec période de recouvrement acceptant l'ancienne et la nouvelle clé le temps de la bascule).
- Secrets applicatifs (base de données, PSP, SMS...) gérés via un coffre-fort de secrets (vault) séparé du dépôt de code, jamais en variable d'environnement versionnée.

## 6. Gestion des appareils

- Enrôlement explicite (device pairing) avec identité propre par appareil (`device_id`, secret, empreinte).
- Révocation immédiate possible depuis l'administration tenant, effective à la prochaine tentative de synchronisation ou de connexion, sans attendre une expiration naturelle.
- Statut de sécurité de l'appareil suivi (dernière sync, version applicative, plateforme) pour détecter un appareil qui n'a jamais synchronisé depuis longtemps (compromission potentielle ou perte).

## 7. Sessions

- Une session correspond à un couple (utilisateur, appareil). Un même utilisateur peut avoir plusieurs sessions actives (plusieurs postes) ; chacune est révocable indépendamment.
- Révocation en cascade : suspendre un tenant (Platform Engine) révoque immédiatement toutes ses sessions actives.

## 8. Sécurité API

- Rate limiting à deux niveaux : réseau (par IP, anti-DDoS basique) et applicatif (par tenant/utilisateur, anti-abus fonctionnel).
- Validation stricte de schéma en entrée de chaque endpoint (rejet explicite, pas de coercition silencieuse de types).
- Protection injection : requêtes paramétrées exclusivement (aucune concaténation de SQL dynamique), échappement systématique des sorties pour prévenir le XSS côté SPA.
- CSRF : non pertinent si l'API n'accepte que des tokens Bearer explicites (pas de cookie de session ambiant) — à confirmer selon le mécanisme d'auth finalement choisi pour la SPA ; si des cookies sont utilisés, `SameSite=Strict` + jeton CSRF explicite.

## 9. Protection du desktop distribué

- Compilation avec suppression des symboles de debug, signature de l'exécutable (Authenticode ou équivalent) vérifiée par l'OS et par le mécanisme d'auto-update.
- Obfuscation du binaire si des éléments non déplaçables côté serveur le justifient (rarement nécessaire si la discipline « logique sensible côté serveur » est respectée).
- **Aucune prétention d'invulnérabilité** : l'hypothèse de travail est qu'un exécutable distribué peut toujours être analysé par un attaquant motivé. La sécurité réelle repose sur le fait que la compromission d'un exécutable ne donne accès qu'aux données du périmètre de cet appareil (réplication partielle, cf `05-architecture-desktop.md` §4), jamais à l'ensemble du tenant ni à la plateforme.

## 10. Audit et journalisation sécurisée

- Journal d'audit immuable, append-only, incluant les événements de sécurité (échecs d'authentification, révocations, changements de permission) en plus des événements métier (cf `02-moteurs.md` §27).
- Aucune donnée sensible en clair dans les logs applicatifs (mots de passe, jetons, numéros de carte, contenu de paiement) — masquage systématique à la source (cf `02-moteurs.md` §26).

## 11. Sauvegardes et restauration

- Sauvegardes chiffrées, testées par restauration périodique automatisée (une sauvegarde non vérifiée n'est pas fiable, cf `02-moteurs.md` §25).
- Procédure de restauration documentée et testée en environnement isolé avant tout incident réel.

## 12. Politique de rétention et droit à l'oubli

- La suppression logique généralisée (cf `03-modele-donnees.md` §3.4) doit être complétée par une politique de purge définitive documentée par tenant/juridiction, elle-même auditée avant exécution — sans quoi une demande RGPD de suppression réelle ne peut pas être honorée correctement.
