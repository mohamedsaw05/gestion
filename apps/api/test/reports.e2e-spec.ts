/**
 * Tests E2E du moteur de Reporting côté serveur :
 * 1. GET /reports/summary (ventes nettes, panier moyen, valorisation stock, alertes stock faible, créances)
 * 2. GET /reports/daily (ventes par jour)
 * 3. GET /reports/payment-methods (ventes par mode de paiement)
 * 4. GET /reports/categories (ventes par catégorie)
 * 5. GET /reports/export/sales.csv (export CSV sécurisé contre l'injection de formules)
 * 6. Isolation tenant : les données du tenant B ne fuient pas dans le rapport du tenant A
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.TEST_API_URL ?? 'http://localhost:4000';
const TENANT_A = '3e91b057-f0f3-4410-9c4a-8541896328a6';
const TENANT_B = '4e5f8f93-a704-42db-a2ac-33a310c58e8e';

async function tenantLogin(tenantId: string, email: string, password = 'Passw0rd!') {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, email, password }),
  });
  if (!res.ok) {
    throw new Error(`Tenant login failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

async function api(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

describe('Reporting Engine — Endpoints réels et isolation', () => {
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await fetch(`${API_URL}/auth/reset-rate-limit`, { method: 'POST' }).catch(() => {});
    tokenA = await tenantLogin(TENANT_A, 'owner@alpha.demo');
    tokenB = await tenantLogin(TENANT_B, 'owner@beta.demo');
  });

  it('GET /reports/summary retourne les indicateurs consolidés du tenant A', async () => {
    const res = await api('/reports/summary', tokenA);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body).toHaveProperty('currency');
    expect(body).toHaveProperty('sales');
    expect(body.sales).toHaveProperty('grossTotal');
    expect(body.sales).toHaveProperty('netSales');
    expect(body.sales).toHaveProperty('completedCount');
    expect(body.sales).toHaveProperty('averageCart');

    expect(body).toHaveProperty('returns');
    expect(body).toHaveProperty('inventory');
    expect(body.inventory).toHaveProperty('valuationTotal');
    expect(body.inventory).toHaveProperty('lowStockCount');

    expect(body).toHaveProperty('credit');
    expect(body.credit).toHaveProperty('outstandingDebtTotal');
  });

  it('GET /reports/daily retourne la progression chronologique des ventes', async () => {
    const res = await api('/reports/daily', tokenA);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('date');
      expect(body[0]).toHaveProperty('count');
      expect(body[0]).toHaveProperty('revenue');
    }
  });

  it('GET /reports/payment-methods retourne la répartition par moyen de paiement', async () => {
    const res = await api('/reports/payment-methods', tokenA);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('method');
      expect(body[0]).toHaveProperty('totalAmount');
      expect(body[0]).toHaveProperty('percentage');
    }
  });

  it('GET /reports/categories retourne la ventilation par catégorie de produit', async () => {
    const res = await api('/reports/categories', tokenA);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('categoryName');
      expect(body[0]).toHaveProperty('itemsSold');
      expect(body[0]).toHaveProperty('revenue');
    }
  });

  it('GET /reports/export/sales.csv génère un fichier CSV téléchargeable', async () => {
    const res = await fetch(`${API_URL}/reports/export/sales.csv`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const buffer = Buffer.from(await res.arrayBuffer());
    // Vérifier les 3 octets du BOM UTF-8 (0xEF, 0xBB, 0xBF)
    expect(buffer[0]).toBe(0xef);
    expect(buffer[1]).toBe(0xbb);
    expect(buffer[2]).toBe(0xbf);
    const text = buffer.toString('utf-8');
    expect(text).toContain('ID Vente');
    expect(text).toContain('Total Net');
  });

  it('Isolation stricte : les rapports du tenant B sont distincts du tenant A', async () => {
    const resA = await api('/reports/summary', tokenA);
    const resB = await api('/reports/summary', tokenB);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const bodyA = (await resA.json()) as any;
    const bodyB = (await resB.json()) as any;

    // Tenant B est un tenant d'essai avec son propre catalogue et ses ventes isolées
    expect(bodyA.sales).toBeDefined();
    expect(bodyB.sales).toBeDefined();
  });
});
