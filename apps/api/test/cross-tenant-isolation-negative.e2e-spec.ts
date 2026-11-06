/**
 * Suite E2E de vérification contradictoire : Tests négatifs d'isolation inter-entreprises,
 * frontières d'accès strictes et résistance aux attaques IDOR / Cross-Tenant.
 *
 * Vérifie formellement côté serveur que :
 * 1. Un jeton d'un Tenant B ne peut accéder à AUCUNE ressource d'un Tenant A (404 systématique sans fuite d'existence)
 * 2. Un jeton Tenant ne peut pas accéder à l'API Platform Superadmin (401)
 * 3. Un jeton Platform Superadmin ne peut pas se substituer directement à un Tenant (401)
 * 4. La double réconciliation de facture SaaS est rejetée avec idempotence stricte (400)
 * 5. Le rapport consolidé du Tenant B ne contient aucune donnée financière du Tenant A
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.TEST_API_URL ?? 'http://localhost:4000';
const TENANT_A_ID = '3e91b057-f0f3-4410-9c4a-8541896328a6';
const TENANT_B_ID = '4e5f8f93-a704-42db-a2ac-33a310c58e8e';

async function loginTenant(tenantId: string, email: string, password = 'Passw0rd!') {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.accessToken as string;
}

async function loginPlatform(email = 'admin@platform.saas', password = 'Passw0rd!') {
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

describe('Contrôle Contradictoire — Isolation Négative Cross-Tenant & Frontières de Sécurité', () => {
  let tokenA: string;
  let tokenB: string;
  let platformToken: string;

  let tenantAProduct: { id: string; name: string };
  let tenantACustomer: { id: string; name: string };
  let tenantALocation: { id: string; name: string };
  let tenantASale: { id: string };
  let tenantADocument: { id: string };

  beforeAll(async () => {
    tokenA = await loginTenant(TENANT_A_ID, 'owner@alpha.demo');
    tokenB = await loginTenant(TENANT_B_ID, 'owner@beta.demo');
    platformToken = await loginPlatform();

    // 1. Récupérer un produit stocké du Tenant A
    const productsA = (await (await api('/products', tokenA)).json()) as any[];
    expect(productsA.length).toBeGreaterThan(0);
    tenantAProduct = productsA.find((p) => p.name.includes('Huile')) ?? productsA[0];

    // 2. Récupérer un client du Tenant A
    const customersA = (await (await api('/customers', tokenA)).json()) as any[];
    expect(customersA.length).toBeGreaterThan(0);
    tenantACustomer = customersA[0];

    // 3. Récupérer une boutique du Tenant A
    const locationsA = (await (await api('/locations', tokenA)).json()) as any[];
    expect(locationsA.length).toBeGreaterThan(0);
    tenantALocation = locationsA.find((l) => l.name.includes('Magasin')) ?? locationsA[0];

    // 4. Récupérer une vente et un document existants, ou en créer un
    const salesRes = await api('/sales', tokenA);
    const existingSales = (await salesRes.json()) as any[];
    if (existingSales && existingSales.length > 0) {
      tenantASale = existingSales[0];
    } else {
      const opId = crypto.randomUUID();
      const saleRes = await api('/sales', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          locationId: tenantALocation.id,
          customerId: tenantACustomer.id,
          currency: 'XOF',
          operationId: opId,
          lines: [{ productId: tenantAProduct.id, quantity: '1' }],
        }),
      });
      tenantASale = await saleRes.json();
    }

    // 5. Récupérer les documents du Tenant A
    const docsRes = await api('/documents', tokenA);
    expect(docsRes.status).toBe(200);
    const docs = (await docsRes.json()) as any[];
    if (docs.length > 0) {
      tenantADocument = docs[0];
    } else {
      tenantADocument = { id: crypto.randomUUID() };
    }
  });

  describe('1. Tests Négatifs IDOR : Accès direct d\'un client B aux ressources du client A', () => {
    it('Tenant B ne peut pas lire un produit du Tenant A (404)', async () => {
      const res = await api(`/products/${tenantAProduct.id}`, tokenB);
      expect(res.status).toBe(404);
    });

    it('Tenant B ne peut pas lire un client du Tenant A (404)', async () => {
      const res = await api(`/customers/${tenantACustomer.id}`, tokenB);
      expect(res.status).toBe(404);
    });

    it('Tenant B ne peut pas lire un emplacement/magasin du Tenant A (404)', async () => {
      const res = await api(`/locations/${tenantALocation.id}`, tokenB);
      expect(res.status).toBe(404);
    });

    it('Tenant B ne peut pas lire une vente du Tenant A (404)', async () => {
      const res = await api(`/sales/${tenantASale.id}`, tokenB);
      expect(res.status).toBe(404);
    });

    it('Tenant B ne peut pas consulter un document comptable du Tenant A (404)', async () => {
      const res = await api(`/documents/${tenantADocument.id}`, tokenB);
      expect(res.status).toBe(404);
    });

    it('Tenant B ne peut pas télécharger le PDF d\'un reçu ou d\'une facture du Tenant A (404)', async () => {
      const res = await api(`/documents/${tenantADocument.id}/pdf`, tokenB);
      expect(res.status).toBe(404);
    });

    it('Tenant B ne peut pas lire le stock du Tenant A (rejet strict 403/404)', async () => {
      const res = await api(`/inventory/stock?locationId=${tenantALocation.id}`, tokenB);
      expect([403, 404]).toContain(res.status);
    });

    it('Tenant B ne peut pas créer une vente en usurpant l\'emplacement du Tenant A (404)', async () => {
      const fakeOpId = crypto.randomUUID();
      const res = await api('/sales', tokenB, {
        method: 'POST',
        body: JSON.stringify({
          locationId: tenantALocation.id, // Emplacement du Tenant A !
          currency: 'XOF',
          operationId: fakeOpId,
          lines: [{ productId: tenantAProduct.id, quantity: '1' }],
        }),
      });
      // Le contrôleur et le service refusent car la location n'appartient pas au tenant
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect([400, 403, 404]).toContain(res.status);
    });
  });

  describe('2. Isolation des Rapports et Analytics Financiers', () => {
    it('le rapport financier /reports/summary du Tenant B ne contient aucune fuite des ventes du Tenant A', async () => {
      const resB = await api('/reports/summary', tokenB);
      expect(resB.status).toBe(200);
      const summaryB = await resB.json();

      const resA = await api('/reports/summary', tokenA);
      expect(resA.status).toBe(200);
      const summaryA = await resA.json();

      // Tenant B (Beta Services) a strictement 0 valorisation de stock car il ne vend que des services
      expect(Number(summaryB.inventory.valuationTotal)).toBe(0);
      // Tenant A (Boutique physique) a du stock physique valorisé
      expect(Number(summaryA.inventory.valuationTotal)).toBeGreaterThan(0);
      // Les agrégations sont hermétiques et distinctes
      expect(Number(summaryB.sales.netSales)).not.toBe(Number(summaryA.sales.netSales));
    });
  });

  describe('3. Étanchéité entre Console Propriétaire (Platform) et Espaces Commerçants', () => {
    it('un utilisateur tenant est immédiatement rejeté de toutes les routes /platform/* (401)', async () => {
      const endpoints = [
        '/platform/stats',
        '/platform/tenants',
        '/platform/plans',
        '/platform/subscriptions',
        '/platform/invoices',
      ];
      for (const endpoint of endpoints) {
        const res = await api(endpoint, tokenA);
        expect(res.status).toBe(401);
      }
    });

    it('un jeton superadmin plateforme ne peut pas requêter directement les routes tenant sans contexte organisation (401)', async () => {
      const res = await api('/sales', platformToken);
      expect(res.status).toBe(401);
    });
  });

  describe('4. Idempotence et validation stricte de la facturation SaaS', () => {
    it('rejette la réconciliation d\'un règlement manuel si la référence de virement est manquante (400)', async () => {
      // 1. Créer une facture pour Tenant B
      const createRes = await api(`/platform/subscriptions/${TENANT_B_ID}/invoices`, platformToken, {
        method: 'POST',
        body: JSON.stringify({
          amount: 15000,
          currency: 'XOF',
          paymentMethod: 'MANUAL_TRANSFER',
          notes: 'Facture test validation',
        }),
      });
      expect(createRes.status).toBe(201);
      const inv = await createRes.json();

      // 2. Tenter de payer sans référence
      const payFailRes = await api(`/platform/invoices/${inv.id}/pay`, platformToken, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: 'MANUAL_TRANSFER',
          paymentReference: '   ', // Chaîne vide ou espaces
        }),
      });
      expect(payFailRes.status).toBe(400);
      const err = await payFailRes.json();
      expect(err.message).toMatch(/référence de virement/i);

      // 3. Payer avec référence valide
      const payOkRes = await api(`/platform/invoices/${inv.id}/pay`, platformToken, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: 'MANUAL_TRANSFER',
          paymentReference: 'VIR-VALID-999',
        }),
      });
      expect(payOkRes.status).toBe(201);

      // 4. Idempotence : Tenter un second règlement sur la même facture déjà PAID doit échouer (400)
      const payDoubleRes = await api(`/platform/invoices/${inv.id}/pay`, platformToken, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: 'MANUAL_TRANSFER',
          paymentReference: 'VIR-VALID-999',
        }),
      });
      expect(payDoubleRes.status).toBe(400);
      const doubleErr = await payDoubleRes.json();
      expect(doubleErr.message).toMatch(/déjà réglée/i);
    });
  });
});
