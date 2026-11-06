# Flux d'Invitations Administrateur et Traçabilité Email — VTM SaaS

**Date :** 1er Novembre 2026  
**Module :** `apps/api/src/invitations/`  
**Couverture :** Sécurité des jetons, création de compte et statut de livraison

---

## 1. Sécurité du Flux d'Invitation

1. **Jeton Opaque Unique :**
   - Lors de la création d'une invitation, un jeton cryptographiquement sécurisé est généré via `crypto.randomBytes(32).toString('base64url')`.
   - Seul son hash SHA-256 (`tokenHash`) est persisté en base de données.
   - Le jeton en clair est renvoyé une seule et unique fois dans la réponse API pour transmission au destinataire.
2. **Aucun Mot de Passe Temporaire en Clair :**
   - Le destinataire choisit lui-même son mot de passe lors de l'acceptation (`AcceptInvitationDto`).
   - Le mot de passe est immédiatement haché avec Argon2id avant persistance dans la table `User`.
3. **Imperméabilité Inter-Tenant :**
   - Le `tenantId` est figé à la création de l'invitation. L'acceptation ne peut jamais rattacher un utilisateur à un autre tenant.

---

## 2. Déclaration Honnête du Statut Email

Le système n'invente aucun succès d'envoi SMTP :
- En l'absence de passerelle SMTP/Sendgrid configurée, le statut retourné est expressément :
  `deliveryStatus: 'CREATED_LINK_GENERATED_NO_SMTP_DISPATCH'`
- L'administrateur peut copier le lien généré et le transmettre directement au collaborateur invité.
- Lorsque le webhook outbox ou le transporteur SMTP est configuré, l'événement `users.invitation.created` est dépilé par le worker pour envoi effectif.

---

## 3. Preuves de Tests
Fichier : `apps/api/src/invitations/invitations.service.spec.ts`
- `✓ crée une invitation avec token opaque et hash sécurisé (aucun mot de passe en clair)` (PASS)
- `✓ refuse une invitation si un utilisateur avec cet email existe déjà dans le tenant` (PASS)
- `✓ refuse d'accepter une invitation expirée` (PASS)
- `✓ révoque correctement une invitation en attente` (PASS)
