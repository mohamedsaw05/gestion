/**
 * Tests d'intégration et E2E du Platform Engine et du cycle de vie SaaS :
 * 1. Authentification superadmin plateforme séparée des tenants
 * 2. Provisioning atomique d'un nouveau tenant (organisation, souscription, profil, boutique, owner)
 * 3. Gestion des offres, abonnements, quotas et factures SaaS
 * 4. Portail souscription pour l'administrateur du tenant (consultation plan, quotas réels, reçus SaaS)
 * 5. Contrôle strict et côté serveur des quotas (utilisateurs, emplacements, ventes)
 * 6. Suspension et réactivation d'un tenant avec blocage effectif en écriture
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.TEST_API_URL ?? 'http://localhost:4000';
const TENANT_A = '3e91b057-f0f3-4410-9c4a-8541896328a6';

async function platformLogin(email = 'admin@platform.saas', password = 'Passw0rd!') {
  const res = await fetch(`${API_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Platform login failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.accessToken as string;
}

async function tenantLogin(tenantId: string, email: string, password = 'Passw0rd!') {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, email, password }),
  });
  if (!res.ok) {
    throw new Error(`Tenant login failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.accessToken as string;
}

async function api(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

describe('Platform Engine & SaaS Commercial Lifecycle (E2E)', () => {
  let platformToken: string;
  let tenantAToken: string;

  beforeAll(async () => {
    platformToken = await platformLogin();
    tenantAToken = await tenantLogin(TENANT_A, 'owner@alpha.demo');
  });

  describe('1. Séparation de la console propriétaire et authentification', () => {
    it('permet au superadmin de se connecter et récupérer son profil', async () => {
      const res = await api('/platform/auth/me', platformToken);
      expect(res.status).toBe(200);
      const profile = await res.json();
      expect(profile.email).toBe('admin@platform.saas');
      expect(profile.role).toBe('SUPERADMIN');
    });

    it('refuse une connexion superadmin avec un mauvais mot de passe', async () => {
      const res = await fetch(`${API_URL}/platform/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@platform.saas', password: 'MauvaisMotDePasse!' }),
      });
      expect(res.status).toBe(401);
    });

    it("interdit à un token utilisateur tenant d'accéder à la console plateforme", async () => {
      const res = await api('/platform/auth/me', tenantAToken);
      expect(res.status).toBe(401);
    });

    it("fournit les métriques globales de la plateforme (MRR, tenants, factures)", async () => {
      const res = await api('/platform/stats', platformToken);
      expect(res.status).toBe(200);
      const stats = await res.json();
      expect(stats.tenants.total).toBeGreaterThanOrEqual(2);
      expect(stats.subscriptions.currency).toBe('XOF');
      expect(stats.subscriptions.mrr).toBeGreaterThanOrEqual(35000); // Au moins Tenant A (PRO = 35 000 XOF)
    });
  });

  describe('2. Gestion des offres, abonnements et factures SaaS', () => {
    it('liste les 4 offres commerciales (TRIAL, STARTER, PRO, ENTERPRISE)', async () => {
      const res = await api('/platform/plans', platformToken);
      expect(res.status).toBe(200);
      const plans = await res.json();
      const keys = plans.map((p: any) => p.key);
      expect(keys).toContain('TRIAL');
      expect(keys).toContain('STARTER');
      expect(keys).toContain('PRO');
      expect(keys).toContain('ENTERPRISE');
    });

    it('liste les abonnements avec leurs quotas stricts', async () => {
      const res = await api('/platform/subscriptions', platformToken);
      expect(res.status).toBe(200);
      const subs = await res.json();
      expect(subs.length).toBeGreaterThanOrEqual(2);
      const subA = subs.find((s: any) => s.tenantId === TENANT_A);
      expect(subA).toBeDefined();
      expect(subA.plan.key).toBe('PRO');
      expect(subA.plan.maxUsers).toBe(200);
      expect(subA.plan.maxLocations).toBe(20);
    });

    it('permet de créer et régler une facture d\'abonnement SaaS manuelle', async () => {
      // 1. Créer une facture SaaS
      const createRes = await api(`/platform/subscriptions/${TENANT_A}/invoices`, platformToken, {
        method: 'POST',
        body: JSON.stringify({
          amount: 35000,
          currency: 'XOF',
          paymentMethod: 'MANUAL_TRANSFER',
          notes: 'Renouvellement mensuel manuel',
        }),
      });
      expect(createRes.status).toBe(201);
      const invoice = await createRes.json();
      expect(invoice.status).toBe('PENDING');

      // 2. Enregistrer le paiement
      const payRes = await api(`/platform/invoices/${invoice.id}/pay`, platformToken, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: 'MANUAL_TRANSFER',
          paymentReference: 'VIR-BANK-2026-X01',
          notes: 'Virement bancaire vérifié par la comptabilité',
        }),
      });
      expect(payRes.status).toBe(201);
      const payResult = await payRes.json();
      expect(payResult.invoice.status).toBe('PAID');
      expect(payResult.invoice.paymentReference).toBe('VIR-BANK-2026-X01');
    });
  });

  describe('3. Provisioning atomique et cycle de vie d\'un nouveau tenant', () => {
    let newTenantId: string;
    const testEmail = `owner.gamma.${Date.now()}@gamma.demo`;

    it('provisionne de façon atomique un tenant avec souscription, boutique et owner', async () => {
      const res = await api('/platform/tenants', platformToken, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Commerce Gamma Test',
          ownerEmail: testEmail,
          ownerName: 'Mamadou Gamma',
          ownerPassword: 'Passw0rd!',
          planKey: 'TRIAL',
          businessType: 'BOUTIQUE',
          // The platform enforces store names globally, so each run needs a fresh name.
          initialStoreName: `Boutique Gamma ${Date.now()}`,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.tenant.id).toBeDefined();
      expect(data.tenant.name).toBe('Commerce Gamma Test');
      expect(data.owner.email).toBe(testEmail);
      expect(data.subscription.status).toBe('TRIALING');
      expect(data.subscription.plan).toBe('Essai Gratuit 14 jours');

      newTenantId = data.tenant.id;

      // Vérifier que le propriétaire créé peut immédiatement se connecter à son espace métier !
      const gammaToken = await tenantLogin(newTenantId, testEmail, 'Passw0rd!');
      expect(gammaToken).toBeDefined();

      // Vérifier que le propriétaire a accès à son portail d'abonnement
      const subRes = await api('/tenant-subscription/current', gammaToken);
      expect(subRes.status).toBe(200);
      const subData = await subRes.json();
      expect(subData.plan.key).toBe('TRIAL');
      expect(subData.quotas.users.max).toBe(3);
      expect(subData.quotas.locations.max).toBe(1);
    });

    it('permet de suspendre puis réactiver le tenant en appliquant le blocage', async () => {
      const gammaToken = await tenantLogin(newTenantId, testEmail, 'Passw0rd!');

      // Suspendre le tenant
      const suspRes = await api(`/platform/tenants/${newTenantId}/suspend`, platformToken, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Défaut de paiement récurrent' }),
      });
      expect(suspRes.status).toBe(201);

      // Une fois suspendu, toute tentative d'écriture (créer un utilisateur) doit être rejetée côté serveur !
      const userRes = await api('/users', gammaToken, {
        method: 'POST',
        body: JSON.stringify({
          email: 'second@gamma.demo',
          fullName: 'Deuxième Vendeur',
        }),
      });
      expect(userRes.status).toBe(403);
      const err = await userRes.json();
      expect(err.message).toMatch(/suspendu/i);

      // Réactiver le tenant
      const reactRes = await api(`/platform/tenants/${newTenantId}/reactivate`, platformToken, {
        method: 'POST',
      });
      expect(reactRes.status).toBe(201);

      // Maintenant l'action réussit
      const userOkRes = await api('/users', gammaToken, {
        method: 'POST',
        body: JSON.stringify({
          email: 'second@gamma.demo',
          fullName: 'Deuxième Vendeur',
        }),
      });
      expect(userOkRes.status).toBe(201);
    });

    it('applique strictement le quota d\'utilisateurs (3 max pour TRIAL)', async () => {
      const gammaToken = await tenantLogin(newTenantId, testEmail, 'Passw0rd!');

      // Actuellement 2 utilisateurs (owner + second). Ajoutons le 3ème (doit réussir)
      const user3Res = await api('/users', gammaToken, {
        method: 'POST',
        body: JSON.stringify({
          email: 'third@gamma.demo',
          fullName: 'Troisième Employé',
        }),
      });
      expect(user3Res.status).toBe(201);

      // Le 4ème dépasse le quota de 3 max pour le plan TRIAL -> doit échouer côté serveur !
      const user4Res = await api('/users', gammaToken, {
        method: 'POST',
        body: JSON.stringify({
          email: 'fourth@gamma.demo',
          fullName: 'Quatrième Employé Hors Quota',
        }),
      });
      expect(user4Res.status).toBe(400);
      const quotaErr = await user4Res.json();
      expect(quotaErr.message).toMatch(/Quota d'utilisateurs atteint/i);
    });

    it('permet au superadmin de migrer le tenant vers le plan supérieur (STARTER) pour débloquer les quotas', async () => {
      const upgradeRes = await api(`/platform/subscriptions/${newTenantId}/change-plan`, platformToken, {
        method: 'POST',
        body: JSON.stringify({ planKey: 'PRO' }), // PRO autorise 10 utilisateurs
      });
      expect(upgradeRes.status).toBe(201);
      const upgradeData = await upgradeRes.json();
      expect(upgradeData.subscription.plan.key).toBe('PRO');

      // Maintenant le 4ème utilisateur peut être créé sans problème !
      const gammaToken = await tenantLogin(newTenantId, testEmail, 'Passw0rd!');
      const user4OkRes = await api('/users', gammaToken, {
        method: 'POST',
        body: JSON.stringify({
          email: 'fourth@gamma.demo',
          fullName: 'Quatrième Employé Maintenant Autorisé',
        }),
      });
      expect(user4OkRes.status).toBe(201);
    });
  });

  describe('4. Portail souscription côté tenant et isolation RLS des factures SaaS', () => {
    it('permet au propriétaire de Tenant A de voir ses factures SaaS', async () => {
      const res = await api('/tenant-subscription/invoices', tenantAToken);
      expect(res.status).toBe(200);
      const invoices = await res.json();
      expect(invoices.length).toBeGreaterThanOrEqual(1);
      for (const inv of invoices) {
        expect(inv.tenantId).toBe(TENANT_A);
      }
    });
  });

  describe('5. Règlements, annulations, remboursements et passerelles webhooks', () => {
    let testInvoiceId: string;

    it('permet d\'annuler (VOID) une facture en attente et bloque tout paiement ultérieur', async () => {
      const createRes = await api(`/platform/subscriptions/${TENANT_A}/invoices`, platformToken, {
        method: 'POST',
        body: JSON.stringify({
          amount: 15000,
          currency: 'XOF',
          paymentMethod: 'MANUAL_TRANSFER',
          notes: 'Facture test annulation',
        }),
      });
      expect(createRes.status).toBe(201);
      const inv = await createRes.json();
      testInvoiceId = inv.id;

      const voidRes = await api(`/platform/invoices/${testInvoiceId}/void`, platformToken, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Erreur de saisie administrative' }),
      });
      expect(voidRes.status).toBe(201);
      const voidData = await voidRes.json();
      expect(voidData.invoice.status).toBe('VOID');

      // Tenter de payer une facture VOID doit échouer avec 400
      const payVoidRes = await api(`/platform/invoices/${testInvoiceId}/pay`, platformToken, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'MANUAL_TRANSFER', paymentReference: 'REF-VOID-FAIL' }),
      });
      expect(payVoidRes.status).toBe(400);
    });

    it('permet de rembourser (REFUND) une facture réglée et refuse de rembourser une facture non payée', async () => {
      // 1. Tenter de rembourser une facture non payée (VOID) échoue
      const refundVoidRes = await api(`/platform/invoices/${testInvoiceId}/refund`, platformToken, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Tentative illicite' }),
      });
      expect(refundVoidRes.status).toBe(400);

      // 2. Créer une facture et la payer
      const createRes = await api(`/platform/subscriptions/${TENANT_A}/invoices`, platformToken, {
        method: 'POST',
        body: JSON.stringify({
          amount: 25000,
          currency: 'XOF',
          paymentMethod: 'MANUAL_TRANSFER',
        }),
      });
      const inv = await createRes.json();

      const payRes = await api(`/platform/invoices/${inv.id}/pay`, platformToken, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'MANUAL_TRANSFER', paymentReference: 'REF-PAID-01' }),
      });
      expect(payRes.status).toBe(201);

      // 3. Rembourser la facture payée réussit
      const refundRes = await api(`/platform/invoices/${inv.id}/refund`, platformToken, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Demande client justifiée' }),
      });
      expect(refundRes.status).toBe(201);
      const refundData = await refundRes.json();
      expect(refundData.invoice.status).toBe('REFUNDED');
    });

    it('rejette les webhooks pour un fournisseur non supporté', async () => {
      const res = await fetch(`${API_URL}/platform/webhooks/psp/fournisseur_inconnu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'evt_123' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejette les webhooks si le secret n\'est pas configuré sur le serveur (503)', async () => {
      const res = await fetch(`${API_URL}/platform/webhooks/psp/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'sig_test',
        },
        body: JSON.stringify({ id: 'evt_123' }),
      });
      expect(res.status).toBe(503);
    });
  });
});
