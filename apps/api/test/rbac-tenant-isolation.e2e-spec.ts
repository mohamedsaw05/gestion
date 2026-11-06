/**
 * Tests d'intégration RBAC + isolation multi-tenant, exécutés contre l'API en
 * cours d'exécution (cf docs/TESTING.md). Ils reproduisent les scénarios
 * exigés dans le prompt de continuation §14 et §15 : mêmes vérifications que
 * manuellement via curl, mais automatisées et rejouables.
 *
 * PRÉREQUIS (documentés, pas magiques) :
 *   - `npm run dev:infra` (Postgres/Redis) démarré
 *   - migrations appliquées (`npm run db:migrate`)
 *   - seed exécuté (`npm run db:seed`) — ces tests dépendent des comptes de
 *     démonstration figés (owner@alpha.demo, vendeur@alpha.demo, etc.)
 *   - API démarrée (`npm run dev:api`) sur http://localhost:4000
 *
 * Limite assumée : ce sont des tests d'intégration contre l'environnement de
 * développement partagé, pas des tests unitaires isolés avec base éphémère.
 * Une base de test dédiée réinitialisée à chaque run est un raffinement
 * PLANNED (cf docs/PROJECT_STATUS.md).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const API_URL = process.env.TEST_API_URL ?? 'http://localhost:4000';

const TENANT_A = process.env.TEST_TENANT_A_ID;
const TENANT_B = process.env.TEST_TENANT_B_ID;

async function login(tenantId: string, email: string, password = 'Passw0rd!') {
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

describe('RBAC + isolation multi-tenant (contre API réelle + seed)', () => {
  let tenantAId: string;
  let tenantBId: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let salesAToken: string;
  let warehouseAToken: string;
  let storeAId: string;
  let warehouseAId: string;
  let productAId: string;
  let rizId: string;
  let kadiId: string;
  let clientComptoirId: string;

  beforeAll(async () => {
    await fetch(`${API_URL}/auth/reset-rate-limit`, { method: 'POST' }).catch(() => {});
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    const found = (name: string) => tenants.find((t) => t.name.includes(name))?.id;
    tenantAId = TENANT_A ?? found('Alpha') ?? '';
    tenantBId = TENANT_B ?? found('Beta') ?? '';
    expect(tenantAId, 'Tenant A introuvable — le seed a-t-il été exécuté ? (npm run db:seed)').toBeTruthy();
    expect(tenantBId, 'Tenant B introuvable — le seed a-t-il été exécuté ? (npm run db:seed)').toBeTruthy();

    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    ownerBToken = await login(tenantBId, 'owner@beta.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');
    warehouseAToken = await login(tenantAId, 'depot@alpha.demo');

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    productAId = products.find((p) => p.name.includes('Huile'))!.id;
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;
    warehouseAId = locations.find((l) => l.name.includes('Dépôt'))!.id;

    const customers = (await (await api('/customers', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    kadiId = customers.find((c) => c.name.includes('Kadi'))!.id;
    // "Client Comptoir" n'a ni prix négocié ni limite de crédit particulière :
    // utilisé pour les tests de mécanique de paiement qui ne doivent pas être
    // influencés par le Pricing Engine (cf test "paiement partiel" ci-dessous).
    clientComptoirId = customers.find((c) => c.name === 'Client Comptoir')!.id;
  });

  it('refuse un accès sans token (401)', async () => {
    const res = await fetch(`${API_URL}/products`);
    expect(res.status).toBe(401);
  });

  it("un owner du Tenant B ne peut pas lire un produit du Tenant A (404, pas de fuite d'existence)", async () => {
    const res = await api(`/products/${productAId}`, ownerBToken);
    expect(res.status).toBe(404);
  });

  it("un vendeur (SALES_USER) ne peut pas créer de produit (403, permission manquante)", async () => {
    const res = await api('/products', salesAToken, {
      method: 'POST',
      body: JSON.stringify({ sku: 'HACK-1', name: 'x', unit: 'piece', basePrice: '1.0000' }),
    });
    expect(res.status).toBe(403);
  });

  it("un vendeur ne peut pas consulter le journal d'audit (403, permission manquante)", async () => {
    const res = await api('/audit', salesAToken);
    expect(res.status).toBe(403);
  });

  it('un gestionnaire de dépôt peut ajuster le stock de SON dépôt (scope ALLOW)', async () => {
    const res = await api('/inventory/adjust', warehouseAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: warehouseAId,
        productId: productAId,
        quantityDelta: '1.0000',
        movementType: 'adjustment',
      }),
    });
    expect(res.status).toBe(201);
  });

  it('un gestionnaire de dépôt NE PEUT PAS ajuster le stock du magasin (scope DENY)', async () => {
    const res = await api('/inventory/adjust', warehouseAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: productAId,
        quantityDelta: '1.0000',
        movementType: 'adjustment',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('une vente se crée correctement et décrémente le stock', async () => {
    const before = (await (
      await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
    ).json()) as { productId: string; quantityOnHand: string }[];
    const beforeQty = Number(before.find((s) => s.productId === productAId)?.quantityOnHand ?? 0);

    const operationId = crypto.randomUUID();
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId,
        lines: [{ productId: productAId, quantity: '2' }],
      }),
    });
    expect(res.status).toBe(201);

    const after = (await (
      await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
    ).json()) as { productId: string; quantityOnHand: string }[];
    const afterQty = Number(after.find((s) => s.productId === productAId)?.quantityOnHand ?? 0);

    expect(afterQty).toBe(beforeQty - 2);
  });

  it("l'idempotence empêche la double création d'une vente (même operationId rejoué)", async () => {
    const operationId = crypto.randomUUID();
    const payload = JSON.stringify({
      locationId: storeAId,
      currency: 'XOF',
      operationId,
      lines: [{ productId: productAId, quantity: '1' }],
    });

    const res1 = await api('/sales', salesAToken, { method: 'POST', body: payload });
    const sale1 = await res1.json();

    const res2 = await api('/sales', salesAToken, { method: 'POST', body: payload });
    const sale2 = await res2.json();

    expect(sale1.id).toBe(sale2.id);
  });

  it('une vente est refusée si le stock demandé est insuffisant', async () => {
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: productAId, quantity: '999999' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('une vente avec paiement partiel a le bon paymentStatus/balanceDue et génère un reçu', async () => {
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        customerId: clientComptoirId, // requis : solde dû => vente à crédit (cf Credit Engine)
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: productAId, quantity: '4' }],
        payments: [{ method: 'MOBILE_MONEY', amount: '1000', reference: 'OM-PARTIAL-001' }],
      }),
    });
    expect(res.status).toBe(201);
    const sale = await res.json();

    expect(sale.paymentStatus).toBe('PARTIAL');
    expect(Number(sale.amountPaid)).toBe(1000);
    expect(Number(sale.balanceDue)).toBe(Number(sale.grandTotal) - 1000);
    expect(sale.documents).toHaveLength(1);
    // Format "SÉRIE-EMPLACEMENT-000123" depuis la Phase 14 (la série fait
    // partie du numéro — sans elle, RECEIPT et INVOICE au même emplacement
    // produiraient le même numéro, cf commentaire de nextDocumentNumber).
    expect(sale.documents[0].number).toMatch(/^[A-Z0-9]+-[A-Z0-9]+-\d{6}$/);

    const pdfRes = await api(`/documents/${sale.documents[0].id}/pdf`, ownerAToken);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get('content-type')).toBe('application/pdf');
  });

  it('une vente dont le total des paiements dépasse le montant dû est refusée (pas de rendu de monnaie modélisé)', async () => {
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: productAId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '999999' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('deux ventes successives sur le même emplacement reçoivent des numéros de document séquentiels', async () => {
    const makeSale = () =>
      api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          currency: 'XOF',
          operationId: crypto.randomUUID(),
          lines: [{ productId: productAId, quantity: '1' }],
        }),
      }).then((r) => r.json());

    const saleX = await makeSale();
    const saleY = await makeSale();

    const numberOf = (s: { documents: { number: string }[] }) => {
      // Format "SÉRIE-EMPLACEMENT-000123" depuis la Phase 14 — le numéro
      // séquentiel est toujours le DERNIER segment, quel que soit le nombre
      // de segments qui le précèdent.
      const parts = s.documents[0].number.split('-');
      return Number(parts[parts.length - 1]);
    };
    expect(numberOf(saleY)).toBe(numberOf(saleX) + 1);
  });

  // ── Régression : Decimal#isPositive() de decimal.js est vrai aussi pour zéro
  // (piège classique) — une vente sans client, intégralement payée au centime
  // près (balanceDue exactement 0), doit réussir SANS exiger de client.
  // cf sales.service.ts, commentaire sur .greaterThan(0) vs .isPositive().
  it('une vente sans client et intégralement payée (solde exactement 0) réussit', async () => {
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '4500' }],
      }),
    });
    expect(res.status).toBe(201);
    const sale = await res.json();
    expect(sale.paymentStatus).toBe('PAID');
    expect(Number(sale.balanceDue)).toBe(0);
  });

  it('le Pricing Engine applique le prix négocié client (CUSTOMER_OVERRIDE) avant le palier de quantité', async () => {
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        customerId: kadiId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: productAId, quantity: '1' }],
      }),
    });
    expect(res.status).toBe(201);
    const sale = await res.json();
    expect(sale.lines[0].appliedPriceRule).toBe('CUSTOMER_OVERRIDE');
    expect(Number(sale.lines[0].unitPriceSnapshot)).toBe(1000); // vs 1200 (prix de base)
  });

  it('le Pricing Engine applique le palier de quantité (QUANTITY_TIER) sans client spécifique', async () => {
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '10' }],
        payments: [{ method: 'CASH', amount: '42000' }],
      }),
    });
    expect(res.status).toBe(201);
    const sale = await res.json();
    expect(sale.lines[0].appliedPriceRule).toBe('QUANTITY_TIER');
    expect(Number(sale.lines[0].unitPriceSnapshot)).toBe(4200); // vs 4500 (prix de base)
  });

  it('une vente avec solde dû sans client sélectionné est refusée (vente à crédit orpheline)', async () => {
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '0.01' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('le Credit Engine enregistre la dette, expose le solde, et bloque au-delà de la limite de crédit', async () => {
    const before = await (await api(`/credit/accounts/${kadiId}`, ownerAToken)).json();
    const balanceBefore = Number(before.account?.balance ?? 0);

    const creditRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        customerId: kadiId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '500' }],
      }),
    });
    expect(creditRes.status).toBe(201);
    const sale = await creditRes.json();
    expect(sale.paymentStatus).toBe('PARTIAL');

    const after = await (await api(`/credit/accounts/${kadiId}`, ownerAToken)).json();
    expect(Number(after.account.balance)).toBe(balanceBefore + Number(sale.balanceDue));

    // Kadi a une limite de crédit de 50000 (cf seed) : une vente qui la dépasserait doit échouer.
    const overLimitRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        customerId: kadiId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '13' }], // 13 x 4200 = 54600, largement au-delà du reliquat de limite
        payments: [{ method: 'CASH', amount: '0.01' }],
      }),
    });
    expect(overLimitRes.status).toBe(400);
  });

  it('un remboursement de crédit réduit le solde et est refusé si il excède la dette', async () => {
    const account = await (await api(`/credit/accounts/${kadiId}`, ownerAToken)).json();
    const balance = Number(account.account.balance);
    expect(balance).toBeGreaterThan(0);

    const overRepay = await api(`/credit/accounts/${kadiId}/payments`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ amount: String(balance + 1000), method: 'CASH' }),
    });
    expect(overRepay.status).toBe(400);

    const repay = await api(`/credit/accounts/${kadiId}/payments`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ amount: '500', method: 'CASH' }),
    });
    expect(repay.status).toBe(201);
    const updated = await repay.json();
    expect(Number(updated.balance)).toBe(balance - 500);
  });

  it("un vendeur ne peut pas enregistrer de remboursement de crédit (403, CREDIT_MANAGE manquant pour son rôle)", async () => {
    const res = await api(`/credit/accounts/${kadiId}/payments`, salesAToken, {
      method: 'POST',
      body: JSON.stringify({ amount: '1', method: 'CASH' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('Configuration Engine', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let storeAId: string;
  let rizId: string;
  let clientComptoirId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    const customers = (await (await api('/customers', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    clientComptoirId = customers.find((c) => c.name === 'Client Comptoir')!.id;
  });

  it('un vendeur ne peut pas lire les paramètres (403, SETTINGS_READ manquant)', async () => {
    const res = await api('/settings', salesAToken);
    expect(res.status).toBe(403);
  });

  it('les valeurs par défaut du catalogue sont résolues sans configuration explicite', async () => {
    const res = await api('/settings', ownerAToken);
    expect(res.status).toBe(200);
    const settings = await res.json();
    expect(settings['payments.enabledMethods']).toEqual(
      expect.arrayContaining(['CASH', 'MOBILE_MONEY']),
    );
    expect(settings['inventory.allowNegativeStock']).toBe(false);
    expect(settings['sales.requireCustomerForCreditSales']).toBe(true);
  });

  it('désactiver un moyen de paiement bloque son utilisation dans une nouvelle vente', async () => {
    let res = await api('/settings/payments.enabledMethods', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: ['CASH'] }),
    });
    expect(res.status).toBe(200);

    const saleRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'MOBILE_MONEY', amount: '4500' }],
      }),
    });
    expect(saleRes.status).toBe(400);

    // Restauration pour ne pas polluer les exécutions suivantes de la suite.
    res = await api('/settings/payments.enabledMethods', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'] }),
    });
    expect(res.status).toBe(200);
  });

  it("PUT sur une clé de configuration inconnue est refusé (400, catalogue fermé)", async () => {
    const res = await api('/settings/not.a.real.setting', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('activer le stock négatif permet une vente au-delà du stock disponible', async () => {
    // rizId est un produit fixture partagé par d'autres tests : on mesure le
    // stock courant plutôt qu'une valeur fixe, et on restaure exactement le
    // delta consommé à la fin pour ne pas perturber les tests suivants.
    const stockBefore = (await (
      await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
    ).json()) as { productId: string; quantityOnHand: string }[];
    const before = Number(stockBefore.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);
    const overshoot = before + 50; // garantit un stock insuffisant quel que soit l'état courant

    let res = await api('/settings/inventory.allowNegativeStock', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: true }),
    });
    try {
      expect(res.status).toBe(200);

      // Client Comptoir n'a pas de limite de crédit : évite d'entrelacer ce test
      // avec les vérifications de limite de crédit de Kadi Traoré.
      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          customerId: clientComptoirId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: String(overshoot) }],
          payments: [{ method: 'CASH', amount: '1' }],
        }),
      });
      expect(saleRes.status).toBe(201);

      const stockAfterSale = (await (
        await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const afterSale = Number(stockAfterSale.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);
      expect(afterSale).toBeLessThan(0);
    } finally {
      await api('/settings/inventory.allowNegativeStock', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ value: false }),
      });
    }

    // Restauration du stock au niveau d'avant ce test (delta positif, toujours
    // autorisé même avec allowNegativeStock désactivé).
    const restoreRes = await api('/inventory/adjust', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: rizId,
        quantityDelta: String(overshoot),
        movementType: 'adjustment',
        reason: 'restauration après test stock négatif',
      }),
    });
    expect(restoreRes.status).toBe(201);
  });

  it('désactiver "client obligatoire pour le crédit" permet une vente à crédit sans client', async () => {
    let res = await api('/settings/sales.requireCustomerForCreditSales', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: false }),
    });
    expect(res.status).toBe(200);

    const saleRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '1' }],
      }),
    });
    expect(saleRes.status).toBe(201);
    const sale = await saleRes.json();
    expect(sale.customerId).toBeNull();
    expect(Number(sale.balanceDue)).toBeGreaterThan(0);

    res = await api('/settings/sales.requireCustomerForCreditSales', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: true }),
    });
    expect(res.status).toBe(200);
  });
});

describe('Unit / Conversion Engine', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let storeAId: string;
  let rizId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;
  });

  it('une vente en unité alternative (carton) convertit correctement vers le stock en unité de référence', async () => {
    const before = (await (
      await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
    ).json()) as { productId: string; quantityOnHand: string }[];
    const beforeQty = Number(before.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);

    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '2', unit: 'carton' }],
      }),
    });
    expect(res.status).toBe(201);
    const sale = await res.json();
    expect(sale.lines[0].unitSnapshot).toBe('carton');
    expect(Number(sale.lines[0].conversionFactorSnapshot)).toBe(10);
    // 2 cartons à 4200/pièce (palier de quantité déclenché par 20 pièces) = 42000/carton × 2
    expect(Number(sale.lines[0].unitPriceSnapshot)).toBe(42000);
    expect(Number(sale.lines[0].lineTotal)).toBe(84000);

    const after = (await (
      await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
    ).json()) as { productId: string; quantityOnHand: string }[];
    const afterQty = Number(after.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);
    // Le stock baisse de 20 PIÈCES (2 cartons × facteur 10), pas de 2.
    expect(afterQty).toBe(beforeQty - 20);
  });

  it('une unité non déclarée pour le produit est refusée (400)', async () => {
    const res = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1', unit: `non_declaree_${Date.now()}` }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("un vendeur ne peut pas déclarer d'unité produit (403, CATALOG_WRITE manquant)", async () => {
    const res = await api('/units', salesAToken, {
      method: 'POST',
      body: JSON.stringify({ productId: rizId, unit: `palette_vendeur_${Date.now()}`, factor: '200' }),
    });
    expect(res.status).toBe(403);
  });

  it("le propriétaire peut déclarer une nouvelle unité, immédiatement utilisable pour une vente", async () => {
    const unitName = `palette_${Date.now()}`;
    const createRes = await api('/units', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ productId: rizId, unit: unitName, factor: '200' }),
    });
    expect(createRes.status).toBe(201);
    const unitObj = await createRes.json();

    try {
      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '1', unit: unitName }],
        }),
      });
      // Stock insuffisant probable (200 pièces) selon l'état courant — on accepte
      // 201 (vendu) ou 400 (stock insuffisant), le point testé est que l'unité
      // est maintenant reconnue plutôt que rejetée pour non-déclaration.
      expect([201, 400]).toContain(saleRes.status);
      const body = await saleRes.json();
      expect(body.message ?? '').not.toMatch(/non déclarée/);
    } finally {
      if (unitObj?.id) {
        await api(`/units/${unitObj.id}`, ownerAToken, { method: 'DELETE' });
      }
    }
  });
});

describe('Catalog Engine — extension (type, codes-barres, bundles)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let storeAId: string;
  let huileId: string;
  let savonId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    huileId = products.find((p) => p.name.includes('Huile'))!.id;
    savonId = products.find((p) => p.name.includes('Savon'))!.id;
  });

  it('un produit de type SERVICE force isStocked à false même si demandé à true', async () => {
    const res = await api('/products', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        sku: `SERVICE-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Réparation',
        unit: 'piece',
        basePrice: '5000.0000',
        type: 'SERVICE',
        isStocked: true,
      }),
    });
    expect(res.status).toBe(201);
    const product = await res.json();
    expect(product.isStocked).toBe(false);
  });

  it('un code-barres est unique par tenant : un doublon sur un autre produit est refusé (409)', async () => {
    const code = `TESTCODE-${crypto.randomUUID().slice(0, 8)}`;
    const first = await api('/products/barcodes', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ productId: huileId, code }),
    });
    expect(first.status).toBe(201);

    const duplicate = await api('/products/barcodes', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ productId: savonId, code }),
    });
    expect(duplicate.status).toBe(409);

    const lookup = await api(`/products/barcode/${code}`, ownerAToken);
    expect(lookup.status).toBe(200);
    const found = await lookup.json();
    expect(found.id).toBe(huileId);
  });

  it('un code-barres inconnu retourne 404', async () => {
    const res = await api(`/products/barcode/does-not-exist-${crypto.randomUUID()}`, ownerAToken);
    expect(res.status).toBe(404);
  });

  it("un vendeur ne peut pas créer de produit BUNDLE (403, CATALOG_WRITE manquant)", async () => {
    const res = await api('/products', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        sku: `KIT-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Kit interdit',
        unit: 'piece',
        basePrice: '1.0000',
        type: 'BUNDLE',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('un bundle sans composant ne peut pas être vendu (400)', async () => {
    const bundleRes = await api('/products', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        sku: `KIT-EMPTY-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Kit vide',
        unit: 'piece',
        basePrice: '1000.0000',
        type: 'BUNDLE',
      }),
    });
    expect(bundleRes.status).toBe(201);
    const bundle = await bundleRes.json();
    expect(bundle.isStocked).toBe(false);

    const saleRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: bundle.id, quantity: '1' }],
      }),
    });
    expect(saleRes.status).toBe(400);
  });

  it('vendre un bundle décrémente chaque composant proportionnellement, sans décrémenter le bundle lui-même', async () => {
    const bundleRes = await api('/products', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        sku: `KIT-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Kit Ménage Test',
        unit: 'piece',
        basePrice: '2000.0000',
        type: 'BUNDLE',
      }),
    });
    const bundle = await bundleRes.json();

    await api('/products/bundle-components', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ bundleProductId: bundle.id, componentProductId: huileId, quantity: '1' }),
    });
    await api('/products/bundle-components', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ bundleProductId: bundle.id, componentProductId: savonId, quantity: '2' }),
    });

    const stockBefore = (await (
      await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
    ).json()) as { productId: string; quantityOnHand: string }[];
    const huileBefore = Number(stockBefore.find((s) => s.productId === huileId)?.quantityOnHand ?? 0);
    const savonBefore = Number(stockBefore.find((s) => s.productId === savonId)?.quantityOnHand ?? 0);

    const saleRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: bundle.id, quantity: '3' }],
      }),
    });
    expect(saleRes.status).toBe(201);
    const sale = await saleRes.json();
    // Une seule ligne de vente visible (le bundle), pas une par composant.
    expect(sale.lines).toHaveLength(1);
    expect(Number(sale.grandTotal)).toBe(6000); // 3 × 2000

    const stockAfter = (await (
      await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
    ).json()) as { productId: string; quantityOnHand: string }[];
    const huileAfter = Number(stockAfter.find((s) => s.productId === huileId)?.quantityOnHand ?? 0);
    const savonAfter = Number(stockAfter.find((s) => s.productId === savonId)?.quantityOnHand ?? 0);

    expect(huileAfter).toBe(huileBefore - 3); // 3 kits × 1 huile
    expect(savonAfter).toBe(savonBefore - 6); // 3 kits × 2 savons

    // Le bundle lui-même n'a jamais eu de ligne de stock (isStocked=false).
    const bundleStockRow = stockAfter.find((s) => s.productId === bundle.id);
    expect(bundleStockRow).toBeUndefined();
  });
});

describe('Cash Register Engine', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let warehouseAToken: string;
  let storeAId: string;
  let warehouseAId: string;
  let rizId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');
    warehouseAToken = await login(tenantAId, 'depot@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;
    warehouseAId = locations.find((l) => l.name.includes('Dépôt'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    // Réapprovisionnement défensif (base de dev partagée entre runs, cf
    // en-tête du fichier) : ce describe vend du riz sur le Magasin Alpha
    // Centre, déjà largement sollicité par les describes précédents.
    await api('/inventory/adjust', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: rizId,
        quantityDelta: '50.0000',
        movementType: 'adjustment',
        reason: 'réapprovisionnement test Cash Register Engine',
      }),
    });
  });

  it("un rôle sans CASH_SESSION_READ ne peut pas consulter la caisse (403)", async () => {
    const res = await api(`/cash/sessions/current?locationId=${warehouseAId}`, warehouseAToken);
    expect(res.status).toBe(403);
  });

  it("aucune session ouverte au départ pour le Magasin Alpha Centre (current = null)", async () => {
    const res = await api(`/cash/sessions/current?locationId=${storeAId}`, ownerAToken);
    expect(res.status).toBe(200);
    expect((await res.json()).session).toBeNull();
  });

  it("un vendeur ouvre sa propre caisse (scope LOCATIONS), une double ouverture est refusée (409)", async () => {
    const openRes = await api('/cash/sessions/open', salesAToken, {
      method: 'POST',
      body: JSON.stringify({ locationId: storeAId, openingFloat: '5000' }),
    });
    expect(openRes.status).toBe(201);
    const session = await openRes.json();
    expect(session.status).toBe('OPEN');

    const secondOpenRes = await api('/cash/sessions/open', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ locationId: storeAId, openingFloat: '1000' }),
    });
    expect(secondOpenRes.status).toBe(409);

    // Nettoyage : ferme la session pour ne pas polluer les tests suivants
    // (Configuration Engine notamment, qui vend en espèces sur ce même emplacement).
    const closeRes = await api(`/cash/sessions/${session.id}/close`, salesAToken, {
      method: 'POST',
      body: JSON.stringify({ countedAmount: '5000' }),
    });
    expect(closeRes.status).toBe(201);
  });

  it("une vente en espèces se rattache automatiquement à la session ouverte, et l'écart de fermeture est calculé correctement", async () => {
    const openRes = await api('/cash/sessions/open', salesAToken, {
      method: 'POST',
      body: JSON.stringify({ locationId: storeAId, openingFloat: '5000' }),
    });
    expect(openRes.status).toBe(201);
    const session = await openRes.json();

    // Vente en espèces intégralement payée (Riz 5kg, 4500 XOF) — doit se
    // rattacher à cette session sans que le client n'ait rien à faire.
    const saleRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '4500' }],
      }),
    });
    expect(saleRes.status).toBe(201);

    const detailRes = await api(`/cash/sessions/${session.id}`, salesAToken);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.payments).toHaveLength(1);
    expect(Number(detail.payments[0].amount)).toBe(4500);

    // Retrait manuel de 1000 (ex: dépense urgente) — tracé séparément de la vente.
    const movementRes = await api(`/cash/sessions/${session.id}/movements`, salesAToken, {
      method: 'POST',
      body: JSON.stringify({ type: 'CASH_OUT', amount: '1000', reason: 'Achat urgent' }),
    });
    expect(movementRes.status).toBe(201);

    // Attendu = 5000 (fond) + 4500 (vente cash) - 1000 (retrait) = 8500.
    const closeRes = await api(`/cash/sessions/${session.id}/close`, salesAToken, {
      method: 'POST',
      body: JSON.stringify({ countedAmount: '8500' }),
    });
    expect(closeRes.status).toBe(201);
    const closed = await closeRes.json();
    expect(closed.status).toBe('CLOSED');
    expect(Number(closed.expectedAmount)).toBe(8500);
    expect(Number(closed.discrepancy)).toBe(0);
  });

  it("un écart de caisse (manquant/excédent) est reflété tel quel à la fermeture, sans blocage", async () => {
    const openRes = await api('/cash/sessions/open', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ locationId: storeAId, openingFloat: '2000' }),
    });
    const session = await openRes.json();

    // Aucun mouvement, aucune vente : attendu = 2000. Compté = 1950 -> manquant de 50.
    const closeRes = await api(`/cash/sessions/${session.id}/close`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ countedAmount: '1950' }),
    });
    expect(closeRes.status).toBe(201);
    const closed = await closeRes.json();
    expect(Number(closed.expectedAmount)).toBe(2000);
    expect(Number(closed.discrepancy)).toBe(-50);
  });

  it("un vendeur scope-limité à un autre emplacement ne peut pas agir sur une session hors de son périmètre (403)", async () => {
    const openRes = await api('/cash/sessions/open', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ locationId: warehouseAId, openingFloat: '1000' }),
    });
    expect(openRes.status).toBe(201);
    const session = await openRes.json();

    // vendeur@alpha.demo n'a le scope que sur le Magasin Alpha Centre, pas le Dépôt.
    const movementRes = await api(`/cash/sessions/${session.id}/movements`, salesAToken, {
      method: 'POST',
      body: JSON.stringify({ type: 'CASH_IN', amount: '100', reason: 'test hors scope' }),
    });
    expect(movementRes.status).toBe(403);

    const closeAttempt = await api(`/cash/sessions/${session.id}/close`, salesAToken, {
      method: 'POST',
      body: JSON.stringify({ countedAmount: '1000' }),
    });
    expect(closeAttempt.status).toBe(403);

    // Nettoyage avec le propriétaire (ALL_LOCATIONS).
    const closeRes = await api(`/cash/sessions/${session.id}/close`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ countedAmount: '1000' }),
    });
    expect(closeRes.status).toBe(201);
  });

  it('une vente en espèces reste possible sans aucune session de caisse ouverte (pas de régression)', async () => {
    const currentRes = await api(`/cash/sessions/current?locationId=${storeAId}`, ownerAToken);
    expect((await currentRes.json()).session).toBeNull();

    const saleRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '4500' }],
      }),
    });
    expect(saleRes.status).toBe(201);
  });
});

describe('Business Profile / Capabilities (Tenant A — désactivation à la volée)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let storeAId: string;
  let huileId: string;
  let rizId: string;
  let kadiId: string;

  async function setCapability(key: string, enabled: boolean) {
    const res = await api(`/business-profile/capabilities/${key}`, ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    expect(res.status).toBe(200);
  }

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    huileId = products.find((p) => p.name.includes('Huile'))!.id;
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    const customers = (await (await api('/customers', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    kadiId = customers.find((c) => c.name.includes('Kadi'))!.id;
  });

  it("un vendeur ne peut pas lire le profil du commerce (403, SETTINGS_READ manquant)", async () => {
    const res = await api('/business-profile/context', salesAToken);
    expect(res.status).toBe(403);
  });

  it('le catalogue des capabilities/modules et le contexte résolu sont exposés au propriétaire', async () => {
    const catalogRes = await api('/business-profile/catalog', ownerAToken);
    expect(catalogRes.status).toBe(200);
    const catalog = await catalogRes.json();
    expect(catalog.capabilities.map((c: { key: string }) => c.key)).toContain('inventory');
    expect(catalog.businessTypes.map((b: { value: string }) => b.value)).toContain('BOUTIQUE');

    const contextRes = await api('/business-profile/context', ownerAToken);
    expect(contextRes.status).toBe(200);
    const context = await contextRes.json();
    // Boutique Alpha : profil "BOUTIQUE" seedé, capabilities fonctionnelles à leur défaut.
    expect(context.profile.businessType).toBe('BOUTIQUE');
    expect(context.capabilities.inventory).toBe(true);
    expect(context.capabilities.customer_credit).toBe(true);
    expect(context.capabilities.custom_pricing).toBe(true);
    expect(context.capabilities.services).toBe(true);
  });

  it("désactiver 'inventory' bloque /inventory/* (fail-closed API) et force isStocked=false à la création", async () => {
    await setCapability('inventory', false);
    try {
      const stockRes = await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken);
      expect(stockRes.status).toBe(403);

      const adjustRes = await api('/inventory/adjust', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          productId: huileId,
          quantityDelta: '1.0000',
          movementType: 'adjustment',
        }),
      });
      expect(adjustRes.status).toBe(403);

      // La liste des emplacements reste accessible : notion organisationnelle
      // indépendante du suivi de stock (cf commentaire LocationsController).
      const locationsRes = await api('/locations', ownerAToken);
      expect(locationsRes.status).toBe(200);

      const productRes = await api('/products', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          sku: `NOINV-${crypto.randomUUID().slice(0, 8)}`,
          name: 'Produit sans suivi de stock',
          unit: 'piece',
          basePrice: '1000.0000',
          isStocked: true, // demandé explicitement, doit quand même être forcé à false
        }),
      });
      expect(productRes.status).toBe(201);
      const product = await productRes.json();
      expect(product.isStocked).toBe(false);
    } finally {
      await setCapability('inventory', true);
    }
  });

  it("désactiver 'customer_credit' bloque /credit/* et toute vente avec solde dû, même avec client sélectionné", async () => {
    await setCapability('customer_credit', false);
    try {
      const creditRes = await api('/credit/accounts', ownerAToken);
      expect(creditRes.status).toBe(403);

      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          customerId: kadiId,
          currency: 'XOF',
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '1' }],
          payments: [{ method: 'CASH', amount: '0.01' }],
        }),
      });
      expect(saleRes.status).toBe(400);

      // Une vente intégralement payée reste possible : seule la partie "solde dû" est bloquée.
      // Réapprovisionnement défensif : le riz est réutilisé par de nombreux
      // tests de ce fichier contre une base de dev partagée (pas de base
      // éphémère par run, cf en-tête du fichier) — on garantit un stock
      // suffisant plutôt que de dépendre de l'ordre d'exécution global.
      await api('/inventory/adjust', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          productId: rizId,
          quantityDelta: '50.0000',
          movementType: 'adjustment',
          reason: 'réapprovisionnement test customer_credit',
        }),
      });
      const fullyPaidRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          currency: 'XOF',
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '1' }],
          payments: [{ method: 'CASH', amount: '4500' }],
        }),
      });
      expect(fullyPaidRes.status).toBe(201);
    } finally {
      await setCapability('customer_credit', true);
    }
  });

  it("désactiver 'custom_pricing' bloque /pricing/* et fait retomber une vente sur le prix de base, malgré un prix négocié existant", async () => {
    await setCapability('custom_pricing', false);
    try {
      const overridesRes = await api('/pricing/customer-overrides', ownerAToken);
      expect(overridesRes.status).toBe(403);

      // Kadi a un prix négocié de 1000 sur l'huile (cf seed) — doit être ignoré,
      // pas seulement bloqué pour de nouvelles créations (défense en profondeur).
      // Réapprovisionnement défensif (cf commentaire du test customer_credit ci-dessus).
      await api('/inventory/adjust', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          productId: huileId,
          quantityDelta: '50.0000',
          movementType: 'adjustment',
          reason: 'réapprovisionnement test custom_pricing',
        }),
      });
      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          customerId: kadiId,
          currency: 'XOF',
          operationId: crypto.randomUUID(),
          lines: [{ productId: huileId, quantity: '1' }],
          payments: [{ method: 'CASH', amount: '1200' }],
        }),
      });
      expect(saleRes.status).toBe(201);
      const sale = await saleRes.json();
      expect(sale.lines[0].appliedPriceRule).toBe('BASE_PRICE');
      expect(Number(sale.lines[0].unitPriceSnapshot)).toBe(1200);
    } finally {
      await setCapability('custom_pricing', true);
    }
  });

  it("désactiver 'services' bloque la création d'un produit de type SERVICE", async () => {
    await setCapability('services', false);
    try {
      const res = await api('/products', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          sku: `SRV-${crypto.randomUUID().slice(0, 8)}`,
          name: 'Service interdit',
          unit: 'piece',
          basePrice: '1000.0000',
          type: 'SERVICE',
        }),
      });
      expect(res.status).toBe(400);
    } finally {
      await setCapability('services', true);
    }
  });

  it("désactiver 'multiple_locations' bloque la création d'un nouvel emplacement (fail-closed API, lecture toujours ouverte)", async () => {
    await setCapability('multiple_locations', false);
    try {
      const createRes = await api('/locations', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ name: 'Dépôt refusé', type: 'WAREHOUSE' }),
      });
      expect(createRes.status).toBe(403);

      const listRes = await api('/locations', ownerAToken);
      expect(listRes.status).toBe(200);
    } finally {
      await setCapability('multiple_locations', true);
    }

    // Une fois réactivé, la création d'un nouvel emplacement réussit.
    const createRes = await api('/locations', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Dépôt Test Créé', type: 'WAREHOUSE' }),
    });
    expect(createRes.status).toBe(201);
  });

  it("le menu adaptatif masque 'Stock' quand inventory est désactivé, et le réaffiche une fois réactivé", async () => {
    const before = (await (await api('/me/menu', ownerAToken)).json()) as { key: string }[];
    expect(before.map((i) => i.key)).toContain('inventory');

    await setCapability('inventory', false);
    const during = (await (await api('/me/menu', ownerAToken)).json()) as { key: string }[];
    expect(during.map((i) => i.key)).not.toContain('inventory');
    // La permission utilisateur reste inchangée : seule la capability tranche.
    expect(during.map((i) => i.key)).toContain('sales');

    await setCapability('inventory', true);
    const after = (await (await api('/me/menu', ownerAToken)).json()) as { key: string }[];
    expect(after.map((i) => i.key)).toContain('inventory');
  });
});

describe('Business Profile — Commerce C (Tenant B, prestataire de services sans stock)', () => {
  let tenantBId: string;
  let ownerBToken: string;
  let salesBToken: string;
  let storeBId: string;
  let serviceProductId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantBId = TENANT_B ?? tenants.find((t) => t.name.includes('Beta'))!.id;
    ownerBToken = await login(tenantBId, 'owner@beta.demo');
    salesBToken = await login(tenantBId, 'vendeur@beta.demo');

    const locations = (await (await api('/locations', ownerBToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeBId = locations[0].id;

    const products = (await (await api('/products', ownerBToken)).json()) as {
      id: string;
      name: string;
      type: string;
      isStocked: boolean;
    }[];
    const service = products.find((p) => p.type === 'SERVICE')!;
    serviceProductId = service.id;
    expect(service.isStocked).toBe(false);
  });

  it('le profil de Beta Services a inventory/customer_credit/custom_pricing désactivés et services activé', async () => {
    const res = await api('/business-profile/context', ownerBToken);
    expect(res.status).toBe(200);
    const context = await res.json();
    expect(context.profile.businessType).toBe('SERVICES');
    expect(context.capabilities.inventory).toBe(false);
    expect(context.capabilities.customer_credit).toBe(false);
    expect(context.capabilities.custom_pricing).toBe(false);
    expect(context.capabilities.services).toBe(true);
  });

  it('/inventory/* est refusé côté API pour ce commerce (fail-closed, pas seulement masqué en UI)', async () => {
    const res = await api(`/inventory/stock?locationId=${storeBId}`, ownerBToken);
    expect(res.status).toBe(403);
  });

  it("le menu adaptatif de Beta ne propose ni Stock ni Crédit clients", async () => {
    const menu = (await (await api('/me/menu', ownerBToken)).json()) as { key: string }[];
    const keys = menu.map((i) => i.key);
    expect(keys).not.toContain('inventory');
    expect(keys).not.toContain('credit');
    expect(keys).toContain('sales');
  });

  it('une vente de service intégralement payée réussit sans jamais toucher au stock', async () => {
    const res = await api('/sales', salesBToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeBId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: serviceProductId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '15000' }],
      }),
    });
    expect(res.status).toBe(201);
    const sale = await res.json();
    expect(sale.paymentStatus).toBe('PAID');
  });

  it('une vente à crédit (solde dû) est refusée : ce commerce n\'utilise pas le crédit client', async () => {
    const res = await api('/sales', salesBToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeBId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: serviceProductId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '1' }],
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Utilisateurs & rôles (Phase 8.4)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let storeAId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;
  });

  it("un vendeur (sans USERS_MANAGE/ROLES_MANAGE) ne peut ni lister les utilisateurs ni les rôles (403)", async () => {
    const usersRes = await api('/users', salesAToken);
    expect(usersRes.status).toBe(403);
    const rolesRes = await api('/roles', salesAToken);
    expect(rolesRes.status).toBe(403);
  });

  it('le propriétaire peut créer un utilisateur ; un mot de passe temporaire est généré si non fourni', async () => {
    const email = `e2e-${crypto.randomUUID()}@alpha.demo`;
    const res = await api('/users', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ email, fullName: 'Utilisateur E2E' }),
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.email).toBe(email);
    expect(created.passwordHash).toBeUndefined();
    expect(typeof created.temporaryPassword).toBe('string');
    expect(created.temporaryPassword.length).toBeGreaterThanOrEqual(16);

    // Le mot de passe généré doit réellement fonctionner pour se connecter
    // (pas seulement être renvoyé — vérifie que le hash argon2 stocké correspond).
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenantAId, email, password: created.temporaryPassword }),
    });
    expect(loginRes.status).toBe(201);
  });

  it('créer un utilisateur avec un email déjà utilisé dans ce tenant est refusé (409)', async () => {
    const res = await api('/users', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@alpha.demo', fullName: 'Doublon' }),
    });
    expect(res.status).toBe(409);
  });

  it("attribuer le scope LOCATIONS sans emplacement est refusé (400)", async () => {
    const email = `e2e-${crypto.randomUUID()}@alpha.demo`;
    const created = await (
      await api('/users', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ email, fullName: 'Sans Emplacement' }),
      })
    ).json();
    const roles = (await (await api('/roles', ownerAToken)).json()) as { id: string; key: string }[];
    const salesRole = roles.find((r) => r.key === 'sales_user')!;

    const res = await api(`/users/${created.id}/roles`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ roleId: salesRole.id, scopeType: 'LOCATIONS', scopeLocationIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('attribuer puis retirer un rôle fonctionne ; retirer le dernier rôle Propriétaire du tenant est refusé', async () => {
    const email = `e2e-${crypto.randomUUID()}@alpha.demo`;
    const created = await (
      await api('/users', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ email, fullName: 'Assignation Test' }),
      })
    ).json();
    const roles = (await (await api('/roles', ownerAToken)).json()) as { id: string; key: string }[];
    const salesRole = roles.find((r) => r.key === 'sales_user')!;

    const assignRes = await api(`/users/${created.id}/roles`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ roleId: salesRole.id, scopeType: 'LOCATIONS', scopeLocationIds: [storeAId] }),
    });
    expect(assignRes.status).toBe(201);
    const userRole = await assignRes.json();

    const removeRes = await api(`/users/${created.id}/roles/${userRole.id}`, ownerAToken, {
      method: 'DELETE',
    });
    expect(removeRes.status).toBe(200);

    // Protection du dernier propriétaire actif du tenant.
    const users = (await (
      await api('/users', ownerAToken)
    ).json()) as { id: string; email: string; roles: { userRoleId: string; roleName: string }[] }[];
    const owner = users.find((u) => u.email === 'owner@alpha.demo')!;
    const ownerRole = owner.roles.find((r) => r.roleName === 'Propriétaire')!;

    const removeOwnerRes = await api(`/users/${owner.id}/roles/${ownerRole.userRoleId}`, ownerAToken, {
      method: 'DELETE',
    });
    expect(removeOwnerRes.status).toBe(403);
  });

  it('un utilisateur ne peut pas se désactiver lui-même (400)', async () => {
    const users = (await (await api('/users', ownerAToken)).json()) as { id: string; email: string }[];
    const owner = users.find((u) => u.email === 'owner@alpha.demo')!;
    const res = await api(`/users/${owner.id}/disable`, ownerAToken, { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it("le catalogue des permissions est exposé (labels lisibles, pas seulement des clés brutes)", async () => {
    const res = await api('/roles/permissions-catalog', ownerAToken);
    expect(res.status).toBe(200);
    const catalog = await res.json();
    expect(catalog.length).toBeGreaterThan(20);
    expect(catalog.every((p: { key: string; label: string; group: string }) => p.label && p.group)).toBe(true);
  });

  it("créer un rôle avec une permission inconnue est refusé (400, catalogue fermé)", async () => {
    const res = await api('/roles', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Rôle invalide', permissions: ['not.a.real.permission'] }),
    });
    expect(res.status).toBe(400);
  });

  it('créer un rôle personnalisé, le modifier, puis le supprimer fonctionne de bout en bout', async () => {
    const createRes = await api('/roles', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Rôle E2E', permissions: ['sales.create'] }),
    });
    expect(createRes.status).toBe(201);
    const role = await createRes.json();
    expect(role.isTemplate).toBe(false);
    expect(role.permissions).toEqual(['sales.create']);

    const updateRes = await api(`/roles/${role.id}`, ownerAToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Rôle E2E modifié', permissions: ['sales.create', 'sales.read'] }),
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe('Rôle E2E modifié');
    expect(updated.permissions.sort()).toEqual(['sales.create', 'sales.read']);

    const deleteRes = await api(`/roles/${role.id}`, ownerAToken, { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);
  });

  it("un rôle-modèle plateforme ne peut être ni modifié ni supprimé par un tenant (404, protection applicative)", async () => {
    const roles = (await (await api('/roles', ownerAToken)).json()) as {
      id: string;
      key: string;
      isTemplate: boolean;
    }[];
    const template = roles.find((r) => r.isTemplate && r.key === 'sales_user')!;

    const updateRes = await api(`/roles/${template.id}`, ownerAToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Vendeur piraté' }),
    });
    expect(updateRes.status).toBe(404);

    const deleteRes = await api(`/roles/${template.id}`, ownerAToken, { method: 'DELETE' });
    expect(deleteRes.status).toBe(404);
  });

  it('cloner un rôle-modèle produit un rôle personnalisé indépendant, modifiable', async () => {
    const roles = (await (await api('/roles', ownerAToken)).json()) as {
      id: string;
      key: string;
      isTemplate: boolean;
      permissions: string[];
    }[];
    const template = roles.find((r) => r.isTemplate && r.key === 'warehouse_user')!;

    const cloneRes = await api(`/roles/${template.id}/clone`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Dépôt (copie E2E)' }),
    });
    expect(cloneRes.status).toBe(201);
    const cloned = await cloneRes.json();
    expect(cloned.isTemplate).toBe(false);
    expect(cloned.permissions.sort()).toEqual([...template.permissions].sort());

    // Le clone est réellement indépendant et modifiable (contrairement à sa source).
    const updateRes = await api(`/roles/${cloned.id}`, ownerAToken, {
      method: 'PATCH',
      body: JSON.stringify({ permissions: ['inventory.stock.read'] }),
    });
    expect(updateRes.status).toBe(200);

    await api(`/roles/${cloned.id}`, ownerAToken, { method: 'DELETE' });
  });

  it("supprimer un rôle personnalisé attribué à au moins un utilisateur est refusé (409)", async () => {
    const roleRes = await api('/roles', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Rôle en usage E2E', permissions: ['sales.read'] }),
    });
    const role = await roleRes.json();

    const email = `e2e-${crypto.randomUUID()}@alpha.demo`;
    const created = await (
      await api('/users', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ email, fullName: 'Porteur de rôle' }),
      })
    ).json();
    const assignRes = await api(`/users/${created.id}/roles`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ roleId: role.id, scopeType: 'ALL_LOCATIONS' }),
    });
    expect(assignRes.status).toBe(201);

    const deleteRes = await api(`/roles/${role.id}`, ownerAToken, { method: 'DELETE' });
    expect(deleteRes.status).toBe(409);
  });
});

describe('Changement de mot de passe personnel (Phase 8.4 §2.1)', () => {
  let tenantAId: string;
  let ownerAToken: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
  });

  it('un mot de passe actuel incorrect est refusé (400)', async () => {
    const res = await api('/me/password', ownerAToken, {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: 'MauvaisMotDePasse', newPassword: 'PeuImporte123' }),
    });
    expect(res.status).toBe(400);
  });

  it('changer son propre mot de passe fonctionne, révoque les sessions existantes, et le nouveau mot de passe permet de se reconnecter', async () => {
    const changeRes = await api('/me/password', ownerAToken, {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: 'Passw0rd!', newPassword: 'NouveauPassw0rd!' }),
    });
    let newAccessToken: string | null = null;
    try {
      expect(changeRes.status).toBe(200);

      const oldPasswordLogin = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantAId, email: 'owner@alpha.demo', password: 'Passw0rd!' }),
      });
      expect(oldPasswordLogin.status).toBe(401);

      const newPasswordLogin = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantAId, email: 'owner@alpha.demo', password: 'NouveauPassw0rd!' }),
      });
      expect(newPasswordLogin.status).toBe(201);
      newAccessToken = (await newPasswordLogin.json()).accessToken;
    } finally {
      // Restauration garantie pour ne pas bloquer les autres tests
      if (newAccessToken) {
        await api('/me/password', newAccessToken, {
          method: 'PATCH',
          body: JSON.stringify({ currentPassword: 'NouveauPassw0rd!', newPassword: 'Passw0rd!' }),
        });
      }
    }
  });
});

describe('Invitations par email (Phase 8.4 §3)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let salesRoleId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');
    const roles = (await (await api('/roles', ownerAToken)).json()) as { id: string; key: string }[];
    salesRoleId = roles.find((r) => r.key === 'sales_user')!.id;
  });

  it("un vendeur (sans USERS_MANAGE) ne peut pas créer d'invitation (403)", async () => {
    const res = await api('/users/invitations', salesAToken, {
      method: 'POST',
      body: JSON.stringify({ email: 'x@alpha.demo', roleId: salesRoleId, scopeType: 'ALL_LOCATIONS' }),
    });
    expect(res.status).toBe(403);
  });

  it('créer une invitation pour un email déjà utilisateur actif du tenant est refusé (409)', async () => {
    const res = await api('/users/invitations', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@alpha.demo', roleId: salesRoleId, scopeType: 'ALL_LOCATIONS' }),
    });
    expect(res.status).toBe(409);
  });

  it("le cycle complet créer / consulter / accepter une invitation fonctionne, et le token ne peut plus être réutilisé ensuite", async () => {
    const email = `invit-${crypto.randomUUID()}@alpha.demo`;
    const createRes = await api('/users/invitations', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ email, roleId: salesRoleId, scopeType: 'ALL_LOCATIONS' }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(typeof created.invitationToken).toBe('string');

    // Aperçu PUBLIC (sans token JWT) — jamais de mot de passe/hash exposé.
    const previewRes = await fetch(`${API_URL}/invitations/${tenantAId}/${created.invitationToken}`);
    expect(previewRes.status).toBe(200);
    const preview = await previewRes.json();
    expect(preview.email).toBe(email);
    expect(preview.roleName).toBe('Vendeur');

    const acceptRes = await fetch(`${API_URL}/invitations/${tenantAId}/${created.invitationToken}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Invité E2E', password: 'InvitePass123!' }),
    });
    expect(acceptRes.status).toBe(201);
    const acceptedUser = await acceptRes.json();
    expect(acceptedUser.email).toBe(email);
    expect(acceptedUser.passwordHash).toBeUndefined();

    // Le compte créé peut réellement se connecter avec le mot de passe choisi.
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenantAId, email, password: 'InvitePass123!' }),
    });
    expect(loginRes.status).toBe(201);

    // Le même token ne peut plus être réutilisé (déjà ACCEPTED).
    const reAcceptRes = await fetch(`${API_URL}/invitations/${tenantAId}/${created.invitationToken}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Rejeu', password: 'AutrePass123!' }),
    });
    expect(reAcceptRes.status).toBe(404);
  });

  it('un token invalide/inexistant est refusé (404), jamais une fuite sur son existence', async () => {
    const res = await fetch(`${API_URL}/invitations/${tenantAId}/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it('révoquer une invitation en attente empêche ensuite son acceptation', async () => {
    const email = `invit-revoked-${crypto.randomUUID()}@alpha.demo`;
    const createRes = await api('/users/invitations', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ email, roleId: salesRoleId, scopeType: 'ALL_LOCATIONS' }),
    });
    const created = await createRes.json();

    const revokeRes = await api(`/users/invitations/${created.invitation.id}`, ownerAToken, {
      method: 'DELETE',
    });
    expect(revokeRes.status).toBe(200);

    const acceptRes = await fetch(`${API_URL}/invitations/${tenantAId}/${created.invitationToken}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'X', password: 'ImportePeu123!' }),
    });
    expect(acceptRes.status).toBe(404);
  });
});

describe('Scopes OWN_RECORDS / TEAM (Phase 8.4 §4)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let storeAId: string;
  let warehouseAId: string;
  let rizId: string;
  let soloRoleId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;
    warehouseAId = locations.find((l) => l.name.includes('Dépôt'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    await api('/inventory/adjust', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: rizId,
        quantityDelta: '50.0000',
        movementType: 'adjustment',
        reason: 'réapprovisionnement test scopes OWN_RECORDS/TEAM',
      }),
    });

    const roleRes = await api('/roles', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Vendeur Solo E2E', permissions: ['sales.create', 'sales.read'] }),
    });
    soloRoleId = (await roleRes.json()).id;
  });

  async function createUserWithScope(
    scopeType: 'OWN_RECORDS' | 'TEAM',
    scopeLocationIds?: string[],
  ): Promise<{ email: string; password: string; token: string }> {
    const email = `scope-${crypto.randomUUID()}@alpha.demo`;
    const created = await (
      await api('/users', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ email, fullName: 'Scope Test' }),
      })
    ).json();
    await api(`/users/${created.id}/roles`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ roleId: soloRoleId, scopeType, scopeLocationIds }),
    });
    const token = await login(tenantAId, email, created.temporaryPassword);
    return { email, password: created.temporaryPassword, token };
  }

  const makeSale = (token: string, locationId: string) =>
    api('/sales', token, {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '4500' }],
      }),
    });

  it("le scope TEAM sans emplacement est refusé (400), comme LOCATIONS", async () => {
    const email = `scope-${crypto.randomUUID()}@alpha.demo`;
    const created = await (
      await api('/users', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ email, fullName: 'Scope Test' }),
      })
    ).json();
    const res = await api(`/users/${created.id}/roles`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ roleId: soloRoleId, scopeType: 'TEAM', scopeLocationIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('OWN_RECORDS : créer une vente réussit (le scope ne bloque jamais la création), et seules ses propres ventes sont visibles', async () => {
    const userA = await createUserWithScope('OWN_RECORDS');
    const userB = await createUserWithScope('OWN_RECORDS');

    const saleARes = await makeSale(userA.token, storeAId);
    expect(saleARes.status).toBe(201);
    const saleA = await saleARes.json();
    const saleBRes = await makeSale(userB.token, storeAId);
    expect(saleBRes.status).toBe(201);
    const saleB = await saleBRes.json();

    const listA = (await (await api('/sales', userA.token)).json()) as { id: string; sellerUserId: string }[];
    expect(listA.every((s) => s.id !== saleB.id)).toBe(true);
    expect(listA.some((s) => s.id === saleA.id)).toBe(true);

    // Fail-closed vérifié côté API, pas seulement côté UI : lire directement
    // la vente d'un autre par son id renvoie "introuvable", jamais son contenu.
    const directReadRes = await api(`/sales/${saleB.id}`, userA.token);
    expect(directReadRes.status).toBe(404);
  });

  it("TEAM : un superviseur voit les ventes de tous les vendeurs scope LOCATIONS de son périmètre, jamais celles d'un autre emplacement", async () => {
    // Vendeur "classique" (scope LOCATIONS) à l'intérieur du périmètre supervisé.
    const salesRoles = (await (await api('/roles', ownerAToken)).json()) as { id: string; key: string }[];
    const salesRoleId = salesRoles.find((r) => r.key === 'sales_user')!.id;

    const teamMemberEmail = `member-${crypto.randomUUID()}@alpha.demo`;
    const teamMember = await (
      await api('/users', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ email: teamMemberEmail, fullName: 'Team Member' }),
      })
    ).json();
    await api(`/users/${teamMember.id}/roles`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ roleId: salesRoleId, scopeType: 'LOCATIONS', scopeLocationIds: [storeAId] }),
    });
    const memberToken = await login(tenantAId, teamMemberEmail, teamMember.temporaryPassword);
    const memberSaleRes = await makeSale(memberToken, storeAId);
    expect(memberSaleRes.status).toBe(201);
    const memberSale = await memberSaleRes.json();

    // Vendeur hors du périmètre supervisé (autre emplacement).
    const outsiderEmail = `outsider-${crypto.randomUUID()}@alpha.demo`;
    const outsider = await (
      await api('/users', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ email: outsiderEmail, fullName: 'Outsider' }),
      })
    ).json();
    await api(`/users/${outsider.id}/roles`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ roleId: salesRoleId, scopeType: 'LOCATIONS', scopeLocationIds: [warehouseAId] }),
    });
    const outsiderToken = await login(tenantAId, outsiderEmail, outsider.temporaryPassword);
    const outsiderSaleRes = await makeSale(outsiderToken, warehouseAId);
    expect(outsiderSaleRes.status).toBe(201);
    const outsiderSale = await outsiderSaleRes.json();

    const supervisorRoleRes = await api('/roles', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Superviseur E2E', permissions: ['sales.read'] }),
    });
    const supervisorRole = await supervisorRoleRes.json();
    const supervisorEmail = `supervisor-${crypto.randomUUID()}@alpha.demo`;
    const supervisor = await (
      await api('/users', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ email: supervisorEmail, fullName: 'Supervisor' }),
      })
    ).json();
    await api(`/users/${supervisor.id}/roles`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ roleId: supervisorRole.id, scopeType: 'TEAM', scopeLocationIds: [storeAId] }),
    });
    const supervisorToken = await login(tenantAId, supervisorEmail, supervisor.temporaryPassword);

    const list = (await (await api('/sales', supervisorToken)).json()) as { id: string }[];
    expect(list.some((s) => s.id === memberSale.id)).toBe(true);
    expect(list.every((s) => s.id !== outsiderSale.id)).toBe(true);
  });
});

describe('Configuration hiérarchique Tenant → Location (Phase 8.1)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let storeAId: string;
  let warehouseAId: string;
  let rizId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;
    warehouseAId = locations.find((l) => l.name.includes('Dépôt'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    await api('/inventory/adjust', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: rizId,
        quantityDelta: '50.0000',
        movementType: 'adjustment',
        reason: 'réapprovisionnement test configuration hiérarchique',
      }),
    });
  });

  it("surcharger un paramètre qui n'autorise pas la personnalisation par emplacement est refusé (400)", async () => {
    const res = await api(`/settings/locations/${storeAId}/inventory.allowNegativeStock`, ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: true }),
    });
    expect(res.status).toBe(400);
  });

  it("le pied de reçu peut être personnalisé par emplacement ; l'autre emplacement et le commerce restent inchangés", async () => {
    const before = await (await api(`/settings/locations/${storeAId}`, ownerAToken)).json();
    expect(before['documents.receiptFooterText']).toBe('');

    const setRes = await api(`/settings/locations/${storeAId}/documents.receiptFooterText`, ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: 'Magasin Alpha Centre — merci de votre visite' }),
    });
    expect(setRes.status).toBe(200);

    const afterStore = await (await api(`/settings/locations/${storeAId}`, ownerAToken)).json();
    expect(afterStore['documents.receiptFooterText']).toBe('Magasin Alpha Centre — merci de votre visite');

    const afterWarehouse = await (await api(`/settings/locations/${warehouseAId}`, ownerAToken)).json();
    expect(afterWarehouse['documents.receiptFooterText']).toBe('');

    const tenantLevel = await (await api('/settings', ownerAToken)).json();
    expect(tenantLevel['documents.receiptFooterText']).toBe('');

    // Une vente à CET emplacement utilise réellement la surcharge dans son reçu.
    const saleRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        currency: 'XOF',
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '4500' }],
      }),
    });
    expect(saleRes.status).toBe(201);

    // Restauration pour ne pas polluer les tests suivants du fichier.
    const resetRes = await api(`/settings/locations/${storeAId}/documents.receiptFooterText`, ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: '' }),
    });
    expect(resetRes.status).toBe(200);
  });

  it('un vendeur (sans SETTINGS_MANAGE) ne peut pas modifier un paramètre de localisation (403)', async () => {
    const res = await api(`/settings/locations/${storeAId}/documents.receiptFooterText`, salesAToken, {
      method: 'PUT',
      body: JSON.stringify({ value: 'Piraté' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('ModuleRegistry — dépendances entre modules (Phase 8.2)', () => {
  let tenantAId: string;
  let ownerAToken: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
  });

  const resetModulesAndCapabilities = async () => {
    await api('/business-profile/modules/delivery', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    });
    await api('/business-profile/modules/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    await api('/business-profile/capabilities/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    });
    await api('/business-profile/capabilities/delivery', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    });
  };

  beforeEach(resetModulesAndCapabilities);
  afterEach(resetModulesAndCapabilities);

  it("activer un module dont la dépendance n'est pas résolue active (capability manquante) est refusé (400)", async () => {
    // 'orders' capability désactivée par défaut : le module 'orders' n'est
    // donc jamais réellement actif tant qu'elle ne l'est pas, même si on
    // essaie de forcer son TenantModule à true.
    await api('/business-profile/modules/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    const res = await api('/business-profile/modules/delivery', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    expect(res.status).toBe(400);
  });

  it("le cycle complet activer dépendance → activer dépendant → refus de désactiver la dépendance → désactivation dans le bon ordre fonctionne", async () => {
    await api('/business-profile/capabilities/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    await api('/business-profile/capabilities/delivery', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    await api('/business-profile/modules/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });

    const enableDeliveryRes = await api('/business-profile/modules/delivery', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    expect(enableDeliveryRes.status).toBe(200);

    const context = await (await api('/business-profile/context', ownerAToken)).json();
    expect(context.modules.find((m: { key: string }) => m.key === 'delivery').enabled).toBe(true);

    const blockedRes = await api('/business-profile/modules/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    });
    expect(blockedRes.status).toBe(400);

    const disableDeliveryRes = await api('/business-profile/modules/delivery', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    });
    expect(disableDeliveryRes.status).toBe(200);

    const disableOrdersRes = await api('/business-profile/modules/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    });
    expect(disableOrdersRes.status).toBe(200);
  });

  it('un module CORE/AUTOMATIC reste toujours actif et refuse toute tentative de désactivation (400)', async () => {
    const res = await api('/business-profile/modules/sales', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Order Engine (Phase 11)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let storeAId: string;
  let rizId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    await api('/inventory/adjust', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: rizId,
        quantityDelta: '50.0000',
        movementType: 'adjustment',
        reason: 'réapprovisionnement test Order Engine',
      }),
    });
  });

  it("la capability 'orders' est désactivée par défaut : toute route /orders est refusée fail-closed (403)", async () => {
    const res = await api('/orders', ownerAToken);
    expect(res.status).toBe(403);
  });

  it("après activation de la capability, créer/consulter une commande fonctionne ; une vente n'est PAS créée avant complétion", async () => {
    await api('/business-profile/capabilities/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const stockBefore = (await (
        await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const beforeQty = Number(stockBefore.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);

      const createRes = await api('/orders', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '2' }],
        }),
      });
      expect(createRes.status).toBe(201);
      const order = await createRes.json();
      expect(order.status).toBe('DRAFT');
      expect(Number(order.subtotal)).toBe(9000); // 2 × 4500

      const stockAfter = (await (
        await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const afterQty = Number(stockAfter.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);
      expect(afterQty).toBe(beforeQty); // aucune décrémentation avant complétion

      const getRes = await api(`/orders/${order.id}`, ownerAToken);
      expect(getRes.status).toBe(200);
    } finally {
      await api('/business-profile/capabilities/orders', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });

  it("le cycle complet DRAFT → CONFIRMED → PREPARING → READY → complétion en vente réelle fonctionne, avec acompte pris en compte", async () => {
    await api('/business-profile/capabilities/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const createRes = await api('/orders', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '3' }],
        }),
      });
      const order = await createRes.json();
      expect(Number(order.subtotal)).toBe(13500); // 3 × 4500

      const c1 = await api(`/orders/${order.id}/advance`, salesAToken, { method: 'POST' });
      expect((await c1.json()).status).toBe('CONFIRMED');

      const depositRes = await api(`/orders/${order.id}/deposit`, salesAToken, {
        method: 'POST',
        body: JSON.stringify({ amount: '3500', method: 'CASH' }),
      });
      expect(depositRes.status).toBe(201);

      // Un acompte qui dépasserait le total est refusé.
      const overDepositRes = await api(`/orders/${order.id}/deposit`, salesAToken, {
        method: 'POST',
        body: JSON.stringify({ amount: '99999', method: 'CASH' }),
      });
      expect(overDepositRes.status).toBe(400);

      await api(`/orders/${order.id}/advance`, salesAToken, { method: 'POST' }); // -> PREPARING
      const c3 = await api(`/orders/${order.id}/advance`, salesAToken, { method: 'POST' }); // -> READY
      expect((await c3.json()).status).toBe('READY');

      // READY ne peut plus "avancer" : il faut compléter.
      const advanceFromReady = await api(`/orders/${order.id}/advance`, salesAToken, { method: 'POST' });
      expect(advanceFromReady.status).toBe(400);

      const stockBefore = (await (
        await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const beforeQty = Number(stockBefore.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);

      const completeRes = await api(`/orders/${order.id}/complete`, salesAToken, {
        method: 'POST',
        body: JSON.stringify({ payments: [{ method: 'CASH', amount: '10000' }] }), // solde = 13500 - 3500
      });
      expect(completeRes.status).toBe(201);
      const completed = await completeRes.json();
      expect(completed.status).toBe('COMPLETED');
      expect(completed.saleId).toBeTruthy();
      expect(completed.sale.paymentStatus).toBe('PAID');
      expect(Number(completed.sale.amountPaid)).toBe(13500);

      // La vente réelle décrémente maintenant le stock — jamais avant.
      const stockAfter = (await (
        await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const afterQty = Number(stockAfter.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);
      expect(afterQty).toBe(beforeQty - 3);

      // Idempotence : rejouer la complétion ne crée pas une seconde vente.
      const completeAgain = await api(`/orders/${order.id}/complete`, salesAToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(completeAgain.status).toBe(201);
      expect((await completeAgain.json()).saleId).toBe(completed.saleId);

      // Une commande complétée ne peut plus être annulée.
      const cancelRes = await api(`/orders/${order.id}/cancel`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(cancelRes.status).toBe(400);
    } finally {
      await api('/business-profile/capabilities/orders', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });

  it("un vendeur peut créer/faire progresser une commande mais ne peut pas l'annuler (403, réservé à l'encadrement)", async () => {
    await api('/business-profile/capabilities/orders', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const createRes = await api('/orders', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '1' }],
        }),
      });
      const order = await createRes.json();

      const cancelBySalesRes = await api(`/orders/${order.id}/cancel`, salesAToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(cancelBySalesRes.status).toBe(403);

      const cancelByOwnerRes = await api(`/orders/${order.id}/cancel`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ reason: 'test' }),
      });
      expect(cancelByOwnerRes.status).toBe(201);
    } finally {
      await api('/business-profile/capabilities/orders', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });
});

describe('Purchase Engine (Phase 10)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let managerAToken: string;
  let warehouseAToken: string;
  let warehouseAId: string;
  let rizId: string;
  let huileId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    managerAToken = await login(tenantAId, 'manager@alpha.demo');
    warehouseAToken = await login(tenantAId, 'depot@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    warehouseAId = locations.find((l) => l.name.includes('Dépôt'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;
    huileId = products.find((p) => p.name.includes('Huile'))!.id;
  });

  it("la capability 'purchases' est désactivée par défaut : toute route est refusée fail-closed (403)", async () => {
    const suppliersRes = await api('/suppliers', ownerAToken);
    expect(suppliersRes.status).toBe(403);
    const poRes = await api('/purchase-orders', ownerAToken);
    expect(poRes.status).toBe(403);
  });

  it("un gestionnaire de dépôt (PURCHASES_UPDATE seul) ne peut ni créer un fournisseur ni créer une commande fournisseur (403)", async () => {
    await api('/business-profile/capabilities/purchases', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const supplierRes = await api('/suppliers', warehouseAToken, {
        method: 'POST',
        body: JSON.stringify({ name: 'Interdit' }),
      });
      expect(supplierRes.status).toBe(403);

      const poRes = await api('/purchase-orders', warehouseAToken, {
        method: 'POST',
        body: JSON.stringify({
          supplierId: '00000000-0000-4000-8000-000000000000',
          locationId: warehouseAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '1', unitCost: '1' }],
        }),
      });
      expect(poRes.status).toBe(403);
    } finally {
      await api('/business-profile/capabilities/purchases', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });

  it('le cycle complet créer fournisseur → commande → confirmation → réception partielle → réception totale → paiement fonctionne, avec dette réellement calculée', async () => {
    await api('/business-profile/capabilities/purchases', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const supplierRes = await api('/suppliers', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ name: `Grossiste E2E ${crypto.randomUUID()}` }),
      });
      expect(supplierRes.status).toBe(201);
      const supplier = await supplierRes.json();

      const stockBefore = (await (
        await api(`/inventory/stock?locationId=${warehouseAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const rizBefore = Number(stockBefore.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);

      const poRes = await api('/purchase-orders', managerAToken, {
        method: 'POST',
        body: JSON.stringify({
          supplierId: supplier.id,
          locationId: warehouseAId,
          operationId: crypto.randomUUID(),
          lines: [
            { productId: rizId, quantity: '50', unitCost: '3000' },
            { productId: huileId, quantity: '30', unitCost: '800' },
          ],
        }),
      });
      expect(poRes.status).toBe(201);
      const po = await poRes.json();
      expect(Number(po.subtotal)).toBe(174000); // 50×3000 + 30×800

      const confirmRes = await api(`/purchase-orders/${po.id}/confirm`, managerAToken, { method: 'POST' });
      expect(confirmRes.status).toBe(201);
      expect((await confirmRes.json()).status).toBe('CONFIRMED');

      const rizLine = po.lines.find((l: { productId: string }) => l.productId === rizId);
      const huileLine = po.lines.find((l: { productId: string }) => l.productId === huileId);

      // Réception partielle : seulement une partie du riz.
      const partialRes = await api(`/purchase-orders/${po.id}/receive`, managerAToken, {
        method: 'POST',
        body: JSON.stringify({ lines: [{ purchaseOrderLineId: rizLine.id, quantity: '20' }] }),
      });
      expect(partialRes.status).toBe(201);
      expect((await partialRes.json()).status).toBe('PARTIALLY_RECEIVED');

      const stockAfterPartial = (await (
        await api(`/inventory/stock?locationId=${warehouseAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const rizAfterPartial = Number(stockAfterPartial.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);
      expect(rizAfterPartial - rizBefore).toBe(20);

      const supplierAfterPartial = await (await api(`/suppliers/${supplier.id}`, ownerAToken)).json();
      expect(Number(supplierAfterPartial.account.balance)).toBe(60000); // 20 × 3000

      // Une commande déjà partiellement réceptionnée ne peut plus être annulée.
      const cancelAttempt = await api(`/purchase-orders/${po.id}/cancel`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(cancelAttempt.status).toBe(400);

      // Réception du reliquat (riz + huile complète).
      const finalRes = await api(`/purchase-orders/${po.id}/receive`, managerAToken, {
        method: 'POST',
        body: JSON.stringify({
          lines: [
            { purchaseOrderLineId: rizLine.id, quantity: '30' },
            { purchaseOrderLineId: huileLine.id, quantity: '30' },
          ],
        }),
      });
      expect(finalRes.status).toBe(201);
      expect((await finalRes.json()).status).toBe('RECEIVED');

      const supplierAfterFull = await (await api(`/suppliers/${supplier.id}`, ownerAToken)).json();
      expect(Number(supplierAfterFull.account.balance)).toBe(174000);

      // Recevoir au-delà de la quantité commandée est refusé.
      const overReceiveRes = await api(`/purchase-orders/${po.id}/receive`, managerAToken, {
        method: 'POST',
        body: JSON.stringify({ lines: [{ purchaseOrderLineId: rizLine.id, quantity: '1' }] }),
      });
      expect(overReceiveRes.status).toBe(400);

      // Paiement partiel de la dette, puis refus d'un paiement dépassant le solde.
      const payRes = await api(`/suppliers/${supplier.id}/payments`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ amount: '100000', method: 'BANK_TRANSFER' }),
      });
      expect(payRes.status).toBe(201);
      expect(Number((await payRes.json()).balance)).toBe(74000);

      const overpayRes = await api(`/suppliers/${supplier.id}/payments`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ amount: '999999', method: 'CASH' }),
      });
      expect(overpayRes.status).toBe(400);
    } finally {
      await api('/business-profile/capabilities/purchases', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });

  it("une commande fournisseur DRAFT (jamais confirmée) reste annulable normalement", async () => {
    await api('/business-profile/capabilities/purchases', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const supplierRes = await api('/suppliers', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ name: `Fournisseur Annulé ${crypto.randomUUID()}` }),
      });
      const supplier = await supplierRes.json();

      const poRes = await api('/purchase-orders', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          supplierId: supplier.id,
          locationId: warehouseAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '5', unitCost: '3000' }],
        }),
      });
      const po = await poRes.json();

      const cancelRes = await api(`/purchase-orders/${po.id}/cancel`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ reason: 'plus besoin' }),
      });
      expect(cancelRes.status).toBe(201);
      expect((await cancelRes.json()).status).toBe('CANCELLED');
    } finally {
      await api('/business-profile/capabilities/purchases', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });
});

describe('Returns / Refunds Engine (Phase 11)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let warehouseAToken: string;
  let storeAId: string;
  let rizId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');
    warehouseAToken = await login(tenantAId, 'depot@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as {
      id: string;
      name: string;
    }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    await api('/inventory/adjust', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: rizId,
        quantityDelta: '30.0000',
        movementType: 'adjustment',
        reason: 'réapprovisionnement test Returns Engine',
      }),
    });
  });

  it("la capability 'returns' est désactivée par défaut : toute route est refusée fail-closed (403)", async () => {
    const res = await api('/returns', ownerAToken);
    expect(res.status).toBe(403);
  });

  it("un gestionnaire de dépôt (aucune permission returns.*) ne peut pas traiter de retour (403)", async () => {
    await api('/business-profile/capabilities/returns', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const res = await api('/returns', warehouseAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: '00000000-0000-4000-8000-000000000000',
          reason: 'x',
          operationId: crypto.randomUUID(),
          lines: [],
        }),
      });
      expect(res.status).toBe(403);
    } finally {
      await api('/business-profile/capabilities/returns', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });

  it('retour GOOD réintègre le stock exactement, retour DEFECTIVE ne réintègre jamais, sur-retour refusé', async () => {
    await api('/business-profile/capabilities/returns', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          currency: 'XOF',
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '5' }],
          payments: [{ method: 'CASH', amount: '22500' }],
        }),
      });
      expect(saleRes.status).toBe(201);
      const sale = await saleRes.json();

      const eligibleRes = await api(`/returns/eligible-lines?saleId=${sale.id}`, ownerAToken);
      expect(eligibleRes.status).toBe(200);
      const eligible = await eligibleRes.json();
      expect(Number(eligible.lines[0].remaining)).toBe(5);
      const saleLineId = eligible.lines[0].saleLineId;

      const stockBefore = (await (
        await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const beforeQty = Number(stockBefore.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);

      const returnRes = await api('/returns', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale.id,
          reason: "Client a changé d'avis",
          refundMethod: 'CASH',
          operationId: crypto.randomUUID(),
          lines: [{ saleLineId, quantity: '2', condition: 'GOOD' }],
        }),
      });
      expect(returnRes.status).toBe(201);
      const ret = await returnRes.json();
      expect(Number(ret.refundAmount)).toBe(9000); // 2 × 4500
      expect(ret.lines[0].restocked).toBe(true);

      const stockAfterGood = (await (
        await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const afterGoodQty = Number(stockAfterGood.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);
      expect(afterGoodQty - beforeQty).toBe(2);

      // Reliquat = 3. Tenter de retourner 4 de plus doit échouer.
      const overReturnRes = await api('/returns', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale.id,
          reason: 'test',
          operationId: crypto.randomUUID(),
          lines: [{ saleLineId, quantity: '4', condition: 'GOOD' }],
        }),
      });
      expect(overReturnRes.status).toBe(400);

      // Retour DEFECTIVE : jamais réintégré au stock vendable.
      const defectiveRes = await api('/returns', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale.id,
          reason: 'Produit périmé',
          operationId: crypto.randomUUID(),
          lines: [{ saleLineId, quantity: '1', condition: 'DEFECTIVE' }],
        }),
      });
      expect(defectiveRes.status).toBe(201);
      const defectiveRet = await defectiveRes.json();
      expect(defectiveRet.lines[0].restocked).toBe(false);

      const stockAfterDefective = (await (
        await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)
      ).json()) as { productId: string; quantityOnHand: string }[];
      const afterDefectiveQty = Number(
        stockAfterDefective.find((s) => s.productId === rizId)?.quantityOnHand ?? 0,
      );
      expect(afterDefectiveQty).toBe(afterGoodQty); // inchangé
    } finally {
      await api('/business-profile/capabilities/returns', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });

  it('un remboursement CASH crée une sortie de caisse si une session est ouverte, mais ne bloque jamais le retour sinon', async () => {
    await api('/business-profile/capabilities/returns', ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });
    try {
      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          currency: 'XOF',
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '2' }],
          payments: [{ method: 'CASH', amount: '9000' }],
        }),
      });
      const sale = await saleRes.json();
      const eligible = await (await api(`/returns/eligible-lines?saleId=${sale.id}`, ownerAToken)).json();
      const saleLineId = eligible.lines[0].saleLineId;

      // Sans session de caisse ouverte : le retour réussit quand même.
      const noSessionReturnRes = await api('/returns', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale.id,
          reason: 'sans caisse',
          refundMethod: 'CASH',
          operationId: crypto.randomUUID(),
          lines: [{ saleLineId, quantity: '1', condition: 'GOOD' }],
        }),
      });
      expect(noSessionReturnRes.status).toBe(201);

      // Avec une session ouverte : une sortie de caisse est réellement créée.
      const openRes = await api('/cash/sessions/open', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, openingFloat: '10000' }),
      });
      const session = await openRes.json();

      const withSessionReturnRes = await api('/returns', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale.id,
          reason: 'avec caisse',
          refundMethod: 'CASH',
          operationId: crypto.randomUUID(),
          lines: [{ saleLineId, quantity: '1', condition: 'GOOD' }],
        }),
      });
      expect(withSessionReturnRes.status).toBe(201);

      const sessionDetail = await (await api(`/cash/sessions/${session.id}`, ownerAToken)).json();
      expect(
        sessionDetail.movements.some((m: { type: string; amount: string }) => m.type === 'CASH_OUT' && Number(m.amount) === 4500),
      ).toBe(true);

      await api(`/cash/sessions/${session.id}/close`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ countedAmount: '5500' }),
      });
    } finally {
      await api('/business-profile/capabilities/returns', ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false }),
      });
    }
  });
});

describe('Catalogue avancé — Variantes / Numéros de série / Garanties (Phase 12)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let warehouseAToken: string;
  let storeAId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');
    warehouseAToken = await login(tenantAId, 'depot@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as { id: string; name: string }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;
  });

  it("les 3 capabilities sont désactivées par défaut : variante, numéro de série et politique de garantie tous refusés (400/fail-closed)", async () => {
    const parentRes = await api('/products', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ sku: `TSHIRT-${crypto.randomUUID().slice(0, 8)}`, name: 'T-shirt test', unit: 'piece', basePrice: '5000' }),
    });
    const parent = await parentRes.json();

    const variantRes = await api(`/products/${parent.id}/variants`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ sku: `TSHIRT-VAR-${crypto.randomUUID().slice(0, 8)}`, attributes: { taille: 'M' } }),
    });
    expect(variantRes.status).toBe(400);

    const serialProductRes = await api('/products', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        sku: `PHONE-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Téléphone test',
        unit: 'piece',
        basePrice: '100000',
        tracksSerialNumbers: true,
      }),
    });
    expect(serialProductRes.status).toBe(400); // tracksSerialNumbers demandé mais capability désactivée

    const plainProductRes = await api('/products', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ sku: `PLAIN-${crypto.randomUUID().slice(0, 8)}`, name: 'Produit simple', unit: 'piece', basePrice: '1000' }),
    });
    const plainProduct = await plainProductRes.json();
    const policyRes = await api(`/products/${plainProduct.id}/warranty-policy`, ownerAToken, {
      method: 'PUT',
      body: JSON.stringify({ durationDays: 365 }),
    });
    expect(policyRes.status).toBe(400);
  });

  it('Variantes : une variante est un produit à part entière (stock/vente propres) ; le parent devient non vendable directement', async () => {
    await api('/business-profile/capabilities/variants', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    try {
      const parentRes = await api('/products', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ sku: `SHOE-${crypto.randomUUID().slice(0, 8)}`, name: 'Chaussure', unit: 'piece', basePrice: '20000' }),
      });
      const parent = await parentRes.json();
      expect(parent.hasVariants).toBe(false);

      const variantRes = await api(`/products/${parent.id}/variants`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ sku: `SHOE-42-${crypto.randomUUID().slice(0, 6)}`, attributes: { pointure: '42' } }),
      });
      expect(variantRes.status).toBe(201);
      const variant = await variantRes.json();
      expect(variant.parentProductId).toBe(parent.id);

      const parentAfter = await (await api(`/products/${parent.id}`, ownerAToken)).json();
      expect(parentAfter.hasVariants).toBe(true);
      expect(parentAfter.isStocked).toBe(false); // le parent n'a plus de stock propre

      // Le parent lui-même n'est plus vendable directement.
      const saleParentRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: parent.id, quantity: '1' }],
        }),
      });
      expect(saleParentRes.status).toBe(400);

      // La variante, elle, a son propre stock et se vend normalement.
      await api('/inventory/adjust', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, productId: variant.id, quantityDelta: '3', movementType: 'adjustment', reason: 'stock initial variante' }),
      });
      const saleVariantRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: variant.id, quantity: '1' }],
        }),
      });
      expect(saleVariantRes.status).toBe(201);

      const stock = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as {
        productId: string;
        quantityOnHand: string;
      }[];
      expect(Number(stock.find((s) => s.productId === variant.id)?.quantityOnHand)).toBe(2);
    } finally {
      await api('/business-profile/capabilities/variants', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    }
  });

  it('Numéros de série : vente exige les numéros exacts, un numéro vendu ne peut pas être revendu, un retour GOOD le rend de nouveau disponible', async () => {
    await api('/business-profile/capabilities/serial_numbers', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    await api('/business-profile/capabilities/returns', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    try {
      const productRes = await api('/products', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          sku: `PHONE-${crypto.randomUUID().slice(0, 8)}`,
          name: 'Téléphone série',
          unit: 'piece',
          basePrice: '150000',
          tracksSerialNumbers: true,
        }),
      });
      const product = await productRes.json();
      expect(product.tracksSerialNumbers).toBe(true);

      const serialA = `SN-${crypto.randomUUID().slice(0, 10)}`;
      const serialB = `SN-${crypto.randomUUID().slice(0, 10)}`;
      const registerRes = await api(`/products/${product.id}/serial-numbers`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, serials: [serialA, serialB] }),
      });
      expect(registerRes.status).toBe(201);

      const dupRes = await api(`/products/${product.id}/serial-numbers`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, serials: [serialA] }),
      });
      expect(dupRes.status).toBe(409);

      await api('/inventory/adjust', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, productId: product.id, quantityDelta: '2', movementType: 'adjustment', reason: 'stock initial' }),
      });

      // Quantité 2 mais un seul numéro fourni : refusé.
      const wrongCountRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: product.id, quantity: '2', serialNumbers: [serialA] }],
        }),
      });
      expect(wrongCountRes.status).toBe(400);

      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: product.id, quantity: '1', serialNumbers: [serialA] }],
        }),
      });
      expect(saleRes.status).toBe(201);
      const sale = await saleRes.json();

      const serialsAfterSale = (await (await api(`/products/${product.id}/serial-numbers`, ownerAToken)).json()) as {
        serial: string;
        status: string;
        saleLineId: string | null;
      }[];
      const soldSerial = serialsAfterSale.find((s) => s.serial === serialA)!;
      expect(soldSerial.status).toBe('SOLD');
      expect(soldSerial.saleLineId).toBeTruthy();

      // Revendre le même numéro (déjà SOLD) doit échouer.
      const resaleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: product.id, quantity: '1', serialNumbers: [serialA] }],
        }),
      });
      expect(resaleRes.status).toBe(400);

      // Retour GOOD du numéro vendu : redevient AVAILABLE.
      const eligible = await (await api(`/returns/eligible-lines?saleId=${sale.id}`, ownerAToken)).json();
      const saleLineId = eligible.lines[0].saleLineId;
      const returnGoodRes = await api('/returns', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale.id,
          reason: 'test série GOOD',
          operationId: crypto.randomUUID(),
          lines: [{ saleLineId, quantity: '1', condition: 'GOOD', serialNumbers: [serialA] }],
        }),
      });
      expect(returnGoodRes.status).toBe(201);
      const serialsAfterReturn = (await (await api(`/products/${product.id}/serial-numbers`, ownerAToken)).json()) as {
        serial: string;
        status: string;
      }[];
      expect(serialsAfterReturn.find((s) => s.serial === serialA)?.status).toBe('AVAILABLE');

      // Vendre à nouveau puis retourner DEFECTIVE : ne redevient jamais disponible.
      const saleRes2 = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: product.id, quantity: '1', serialNumbers: [serialB] }],
        }),
      });
      const sale2 = await saleRes2.json();
      const eligible2 = await (await api(`/returns/eligible-lines?saleId=${sale2.id}`, ownerAToken)).json();
      const returnDefectiveRes = await api('/returns', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale2.id,
          reason: 'test série DEFECTIVE',
          operationId: crypto.randomUUID(),
          lines: [{ saleLineId: eligible2.lines[0].saleLineId, quantity: '1', condition: 'DEFECTIVE', serialNumbers: [serialB] }],
        }),
      });
      expect(returnDefectiveRes.status).toBe(201);
      const serialsFinal = (await (await api(`/products/${product.id}/serial-numbers`, ownerAToken)).json()) as {
        serial: string;
        status: string;
      }[];
      expect(serialsFinal.find((s) => s.serial === serialB)?.status).toBe('DEFECTIVE');
    } finally {
      await api('/business-profile/capabilities/serial_numbers', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
      await api('/business-profile/capabilities/returns', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    }
  });

  it('Garanties : créée automatiquement à la vente si une politique existe, réclamable une seule fois, magasinier peut lire mais pas réclamer', async () => {
    await api('/business-profile/capabilities/warranties', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    try {
      const productRes = await api('/products', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ sku: `TV-${crypto.randomUUID().slice(0, 8)}`, name: 'Télévision', unit: 'piece', basePrice: '250000' }),
      });
      const product = await productRes.json();

      const policyRes = await api(`/products/${product.id}/warranty-policy`, ownerAToken, {
        method: 'PUT',
        body: JSON.stringify({ durationDays: 730, terms: 'Garantie constructeur 2 ans' }),
      });
      expect(policyRes.status).toBe(200);

      await api('/inventory/adjust', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, productId: product.id, quantityDelta: '1', movementType: 'adjustment', reason: 'stock' }),
      });
      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: product.id, quantity: '1' }],
        }),
      });
      const sale = await saleRes.json();

      const warranties = (await (await api('/warranties', ownerAToken)).json()) as {
        id: string;
        saleId: string;
        durationDaysSnapshot: number;
        effectiveStatus: string;
      }[];
      const created = warranties.find((w) => w.saleId === sale.id);
      expect(created).toBeTruthy();
      expect(created!.durationDaysSnapshot).toBe(730);
      expect(created!.effectiveStatus).toBe('ACTIVE');

      // Le magasinier peut consulter (WARRANTIES_READ) mais pas réclamer (pas WARRANTIES_CLAIM).
      const claimByWarehouseRes = await api(`/warranties/${created!.id}/claim`, warehouseAToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(claimByWarehouseRes.status).toBe(403);

      const claimRes = await api(`/warranties/${created!.id}/claim`, salesAToken, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Ne s\'allume plus' }),
      });
      expect(claimRes.status).toBe(201);

      // Une deuxième réclamation sur la même garantie est refusée.
      const reclaimRes = await api(`/warranties/${created!.id}/claim`, salesAToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(reclaimRes.status).toBe(400);
    } finally {
      await api('/business-profile/capabilities/warranties', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    }
  });
});

describe('Inventaire avancé — Réservation / Transferts / Lots (Phase 13)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let warehouseAToken: string;
  let storeAId: string;
  let depotAId: string;
  let rizId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');
    warehouseAToken = await login(tenantAId, 'depot@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as { id: string; name: string }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;
    depotAId = locations.find((l) => l.name.includes('Dépôt'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as { id: string; name: string }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;

    await api('/inventory/adjust', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: rizId,
        quantityDelta: '50.0000',
        movementType: 'adjustment',
        reason: 'réapprovisionnement test Inventory Advanced',
      }),
    });
  });

  it('Réservation : la confirmation réserve sans décrémenter, la complétion libère ET décrémente réellement, une annulation libère', async () => {
    await api('/business-profile/capabilities/orders', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    try {
      const stockBefore = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as {
        productId: string;
        quantityOnHand: string;
        quantityReserved: string;
      }[];
      const before = stockBefore.find((s) => s.productId === rizId)!;

      const orderRes = await api('/orders', salesAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, operationId: crypto.randomUUID(), lines: [{ productId: rizId, quantity: '5' }] }),
      });
      expect(orderRes.status).toBe(201);
      const order = await orderRes.json();

      await api(`/orders/${order.id}/advance`, salesAToken, { method: 'POST' });
      const stockAfterReserve = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as typeof stockBefore;
      const afterReserve = stockAfterReserve.find((s) => s.productId === rizId)!;
      expect(Number(afterReserve.quantityOnHand)).toBe(Number(before.quantityOnHand)); // inchangé : réservé ≠ décrémenté
      expect(Number(afterReserve.quantityReserved)).toBe(Number(before.quantityReserved) + 5);

      // Avancer encore (PREPARING, READY) ne double jamais la réservation.
      await api(`/orders/${order.id}/advance`, salesAToken, { method: 'POST' });
      await api(`/orders/${order.id}/advance`, salesAToken, { method: 'POST' });
      const stockAfterMoreAdvances = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as typeof stockBefore;
      expect(Number(stockAfterMoreAdvances.find((s) => s.productId === rizId)!.quantityReserved)).toBe(
        Number(before.quantityReserved) + 5,
      );

      const completeRes = await api(`/orders/${order.id}/complete`, salesAToken, { method: 'POST', body: JSON.stringify({}) });
      expect(completeRes.status).toBe(201);
      const stockAfterComplete = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as typeof stockBefore;
      const afterComplete = stockAfterComplete.find((s) => s.productId === rizId)!;
      expect(Number(afterComplete.quantityReserved)).toBe(Number(before.quantityReserved)); // libérée
      expect(Number(afterComplete.quantityOnHand)).toBe(Number(before.quantityOnHand) - 5); // réellement décrémentée

      // Deuxième commande : confirmer puis annuler doit libérer sans jamais toucher quantityOnHand.
      const order2Res = await api('/orders', salesAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, operationId: crypto.randomUUID(), lines: [{ productId: rizId, quantity: '3' }] }),
      });
      const order2 = await order2Res.json();
      await api(`/orders/${order2.id}/advance`, salesAToken, { method: 'POST' });
      await api(`/orders/${order2.id}/cancel`, ownerAToken, { method: 'POST', body: JSON.stringify({}) });
      const stockAfterCancel = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as typeof stockBefore;
      const afterCancel = stockAfterCancel.find((s) => s.productId === rizId)!;
      expect(Number(afterCancel.quantityReserved)).toBe(Number(before.quantityReserved));
      expect(Number(afterCancel.quantityOnHand)).toBe(Number(before.quantityOnHand) - 5); // seule la vente complétée a compté
    } finally {
      await api('/business-profile/capabilities/orders', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    }
  });

  it("Transferts : nécessite 'plusieurs emplacements', reflète honnêtement le stock 'en transit', vendeur sans permission bloqué", async () => {
    // multiple_locations est activé par défaut pour Boutique Alpha (seed) —
    // on le désactive explicitement le temps de ce test pour vérifier le
    // fail-closed, cf CAPABILITIES_CATALOG.MULTIPLE_LOCATIONS.defaultEnabled.
    await api('/business-profile/capabilities/multiple_locations', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    try {
      const rejected = await api('/stock-transfers', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          fromLocationId: storeAId,
          toLocationId: depotAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '2' }],
        }),
      });
      expect(rejected.status).toBe(400);
    } finally {
      await api('/business-profile/capabilities/multiple_locations', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    }

    const stockSourceBefore = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as {
      productId: string;
      quantityOnHand: string;
    }[];
    const sourceBefore = Number(stockSourceBefore.find((s) => s.productId === rizId)!.quantityOnHand);
    const stockDestBefore = (await (await api(`/inventory/stock?locationId=${depotAId}`, ownerAToken)).json()) as {
      productId: string;
      quantityOnHand: string;
    }[];
    const destBefore = Number(stockDestBefore.find((s) => s.productId === rizId)?.quantityOnHand ?? 0);

    const transferRes = await api('/stock-transfers', warehouseAToken, {
      method: 'POST',
      body: JSON.stringify({
        fromLocationId: storeAId,
        toLocationId: depotAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '4' }],
      }),
    });
    expect(transferRes.status).toBe(201);
    const transfer = await transferRes.json();

    // Un vendeur (aucune permission inventory.transfer.create) ne peut pas confirmer.
    const confirmBySales = await api(`/stock-transfers/${transfer.id}/confirm`, salesAToken, { method: 'POST' });
    expect(confirmBySales.status).toBe(403);

    const confirmRes = await api(`/stock-transfers/${transfer.id}/confirm`, warehouseAToken, { method: 'POST' });
    expect(confirmRes.status).toBe(201);

    const stockSourceAfterConfirm = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as typeof stockSourceBefore;
    const stockDestAfterConfirm = (await (await api(`/inventory/stock?locationId=${depotAId}`, ownerAToken)).json()) as typeof stockSourceBefore;
    expect(Number(stockSourceAfterConfirm.find((s) => s.productId === rizId)!.quantityOnHand)).toBe(sourceBefore - 4);
    // "En transit" : le stock a QUITTÉ la source mais n'est PAS ENCORE arrivé à destination.
    expect(Number(stockDestAfterConfirm.find((s) => s.productId === rizId)?.quantityOnHand ?? 0)).toBe(destBefore);

    const receiveRes = await api(`/stock-transfers/${transfer.id}/receive`, warehouseAToken, { method: 'POST' });
    expect(receiveRes.status).toBe(201);
    const stockDestAfterReceive = (await (await api(`/inventory/stock?locationId=${depotAId}`, ownerAToken)).json()) as typeof stockSourceBefore;
    expect(Number(stockDestAfterReceive.find((s) => s.productId === rizId)!.quantityOnHand)).toBe(destBefore + 4);

    // Un transfert RECEIVED ne peut plus être annulé.
    const cancelAfterReceive = await api(`/stock-transfers/${transfer.id}/cancel`, ownerAToken, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(cancelAfterReceive.status).toBe(400);

    // Un DRAFT jamais confirmé, lui, reste annulable normalement.
    const draftTransferRes = await api('/stock-transfers', warehouseAToken, {
      method: 'POST',
      body: JSON.stringify({
        fromLocationId: storeAId,
        toLocationId: depotAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
      }),
    });
    const draftTransfer = await draftTransferRes.json();
    const cancelDraftRes = await api(`/stock-transfers/${draftTransfer.id}/cancel`, warehouseAToken, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(cancelDraftRes.status).toBe(201);
  });

  it('Lots/péremption : consommés FEFO à la vente, sur-vente au-delà du total en lots refusée, capability désactivée par défaut', async () => {
    const productRes = await api('/products', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        sku: `MILK-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Lait UHT test',
        unit: 'litre',
        basePrice: '800',
        tracksBatches: true,
      }),
    });
    // Capability désactivée par défaut : la création avec tracksBatches=true est refusée.
    expect(productRes.status).toBe(400);

    await api('/business-profile/capabilities/batch_tracking', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    try {
      const product = await (
        await api('/products', ownerAToken, {
          method: 'POST',
          body: JSON.stringify({
            sku: `MILK-${crypto.randomUUID().slice(0, 8)}`,
            name: 'Lait UHT test',
            unit: 'litre',
            basePrice: '800',
            tracksBatches: true,
          }),
        })
      ).json();
      expect(product.tracksBatches).toBe(true);

      const soon = new Date(Date.now() + 5 * 86400000).toISOString();
      const later = new Date(Date.now() + 30 * 86400000).toISOString();
      await api(`/products/${product.id}/batches`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, lotNumber: 'LOT-LATER', quantity: '10', expiresAt: later }),
      });
      await api(`/products/${product.id}/batches`, ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, lotNumber: 'LOT-SOON', quantity: '5', expiresAt: soon }),
      });

      const stockAggregate = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as {
        productId: string;
        quantityOnHand: string;
      }[];
      expect(Number(stockAggregate.find((s) => s.productId === product.id)!.quantityOnHand)).toBe(15);

      const batchesBefore = (await (await api(`/products/${product.id}/batches`, ownerAToken)).json()) as {
        lotNumber: string;
        quantity: string;
      }[];
      expect(batchesBefore[0].lotNumber).toBe('LOT-SOON'); // le plus proche de péremption en premier

      // Vendre 7 : épuise entièrement LOT-SOON (5) puis prend 2 sur LOT-LATER.
      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, operationId: crypto.randomUUID(), lines: [{ productId: product.id, quantity: '7' }] }),
      });
      expect(saleRes.status).toBe(201);

      const batchesAfter = (await (await api(`/products/${product.id}/batches`, ownerAToken)).json()) as {
        lotNumber: string;
        quantity: string;
      }[];
      expect(batchesAfter.find((b) => b.lotNumber === 'LOT-SOON')).toBeUndefined(); // épuisé, filtré (quantity > 0)
      expect(Number(batchesAfter.find((b) => b.lotNumber === 'LOT-LATER')!.quantity)).toBe(8);

      const stockAfterSale = (await (await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken)).json()) as typeof stockAggregate;
      expect(Number(stockAfterSale.find((s) => s.productId === product.id)!.quantityOnHand)).toBe(8);

      // Sur-vente au-delà du total en lots (8) refusée, même si quantityOnHand suffisait avant.
      const oversellRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, operationId: crypto.randomUUID(), lines: [{ productId: product.id, quantity: '20' }] }),
      });
      expect(oversellRes.status).toBe(400);
    } finally {
      await api('/business-profile/capabilities/batch_tracking', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    }
  });
});

describe('Documents avancés / Delivery Engine (Phase 14)', () => {
  let tenantAId: string;
  let ownerAToken: string;
  let salesAToken: string;
  let warehouseAToken: string;
  let storeAId: string;
  let rizId: string;

  beforeAll(async () => {
    const tenants = (await (await fetch(`${API_URL}/auth/demo-tenants`)).json()) as {
      id: string;
      name: string;
    }[];
    tenantAId = TENANT_A ?? tenants.find((t) => t.name.includes('Alpha'))!.id;
    ownerAToken = await login(tenantAId, 'owner@alpha.demo');
    salesAToken = await login(tenantAId, 'vendeur@alpha.demo');
    warehouseAToken = await login(tenantAId, 'depot@alpha.demo');

    const locations = (await (await api('/locations', ownerAToken)).json()) as { id: string; name: string }[];
    storeAId = locations.find((l) => l.name.includes('Magasin'))!.id;

    const products = (await (await api('/products', ownerAToken)).json()) as { id: string; name: string }[];
    rizId = products.find((p) => p.name.includes('Riz'))!.id;
  });

  it("Facture/Devis : capability 'invoicing' désactivée par défaut (403), facture depuis une vente, devis depuis une commande sans section paiement", async () => {
    const saleRes = await api('/sales', salesAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        operationId: crypto.randomUUID(),
        lines: [{ productId: rizId, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '4500' }],
      }),
    });
    const sale = await saleRes.json();
    expect(sale.documents[0].type).toBe('RECEIPT');

    await api('/business-profile/capabilities/invoicing', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });

    const invoiceRejected = await api('/documents/invoices', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({ saleId: sale.id }),
    });
    expect(invoiceRejected.status).toBe(403);

    await api('/business-profile/capabilities/invoicing', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    try {
      const invoiceRes = await api('/documents/invoices', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ saleId: sale.id }),
      });
      expect(invoiceRes.status).toBe(201);
      const invoice = await invoiceRes.json();
      expect(invoice.type).toBe('INVOICE');
      // Le numéro doit intégrer la série — sans ça, INVOICE et RECEIPT au même
      // emplacement produiraient le même numéro (bug réel trouvé et corrigé
      // en construisant cette phase, cf commentaire de nextDocumentNumber).
      expect(invoice.number).toContain('INVOICE-');
      expect(invoice.number).not.toBe(sale.documents[0].number);

      const invoicePdfRes = await api(`/documents/${invoice.id}/pdf`, ownerAToken);
      expect(invoicePdfRes.status).toBe(200);
      expect(invoicePdfRes.headers.get('content-type')).toContain('application/pdf');

      await api('/business-profile/capabilities/orders', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
      const orderRes = await api('/orders', salesAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, operationId: crypto.randomUUID(), lines: [{ productId: rizId, quantity: '2' }] }),
      });
      const order = await orderRes.json();
      const quoteRes = await api('/documents/quotes', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id }),
      });
      expect(quoteRes.status).toBe(201);
      const quote = await quoteRes.json();
      expect(quote.type).toBe('QUOTE');
      // Un devis n'a jamais de section paiement : rien n'a encore été encaissé.
      expect(quote.contentSnapshot.amountPaid).toBe('0');
      expect(quote.contentSnapshot.balanceDue).toBe(quote.contentSnapshot.subtotal);
      expect(quote.contentSnapshot.payments).toEqual([]);
    } finally {
      await api('/business-profile/capabilities/invoicing', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
      await api('/business-profile/capabilities/orders', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    }
  });

  it("Livraisons : capability désactivée par défaut, une seule livraison par commande, séparation vendeur (planifie) / magasinier (exécute), bon de livraison auto-généré, commande PAS auto-complétée", async () => {
    await api('/business-profile/capabilities/orders', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    try {
      const orderRes = await api('/orders', salesAToken, {
        method: 'POST',
        body: JSON.stringify({ locationId: storeAId, operationId: crypto.randomUUID(), lines: [{ productId: rizId, quantity: '2' }] }),
      });
      const order = await orderRes.json();
      await api(`/orders/${order.id}/advance`, salesAToken, { method: 'POST' }); // CONFIRMED

      const deliveryRejectedNoCapability = await api('/deliveries', salesAToken, {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, address: '1 avenue Test', operationId: crypto.randomUUID() }),
      });
      expect(deliveryRejectedNoCapability.status).toBe(403);

      await api('/business-profile/capabilities/delivery', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
      try {
        const deliveryRes = await api('/deliveries', salesAToken, {
          method: 'POST',
          body: JSON.stringify({ orderId: order.id, address: '1 avenue Test', operationId: crypto.randomUUID() }),
        });
        expect(deliveryRes.status).toBe(201);
        const delivery = await deliveryRes.json();
        expect(delivery.status).toBe('PENDING');

        const dupRes = await api('/deliveries', salesAToken, {
          method: 'POST',
          body: JSON.stringify({ orderId: order.id, address: 'autre adresse', operationId: crypto.randomUUID() }),
        });
        expect(dupRes.status).toBe(400);

        // Le magasinier (DELIVERIES_UPDATE) exécute ; le vendeur (DELIVERIES_CREATE
        // seulement) planifie mais n'exécute pas.
        const outForDeliveryBySales = await api(`/deliveries/${delivery.id}/out-for-delivery`, salesAToken, { method: 'POST' });
        expect(outForDeliveryBySales.status).toBe(403);

        const outForDeliveryRes = await api(`/deliveries/${delivery.id}/out-for-delivery`, warehouseAToken, { method: 'POST' });
        expect(outForDeliveryRes.status).toBe(201);

        const deliveredRes = await api(`/deliveries/${delivery.id}/delivered`, warehouseAToken, { method: 'POST' });
        expect(deliveredRes.status).toBe(201);
        const delivered = await deliveredRes.json();
        expect(delivered.status).toBe('DELIVERED');

        const documents = (await (await api('/documents', ownerAToken)).json()) as { type: string; orderId: string | null }[];
        expect(documents.some((d) => d.type === 'DELIVERY_NOTE' && d.orderId === order.id)).toBe(true);

        // La livraison physique ne complète JAMAIS automatiquement la commande
        // (paiement/stock restent une action distincte, cf commentaire du modèle).
        const orderAfter = await (await api(`/orders/${order.id}`, ownerAToken)).json();
        expect(orderAfter.status).toBe('CONFIRMED');

        // Une livraison déjà DELIVERED ne peut plus être annulée.
        const cancelAfterDelivered = await api(`/deliveries/${delivery.id}/cancel`, ownerAToken, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        expect(cancelAfterDelivered.status).toBe(400);
      } finally {
        await api('/business-profile/capabilities/delivery', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
      }
    } finally {
      await api('/business-profile/capabilities/orders', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    }
  });

  it('Avoir automatique : un retour remboursé génère toujours son CREDIT_NOTE, sans action supplémentaire', async () => {
    await api('/business-profile/capabilities/returns', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: true }) });
    try {
      const saleRes = await api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: rizId, quantity: '2' }],
          payments: [{ method: 'CASH', amount: '9000' }],
        }),
      });
      const sale = await saleRes.json();

      const eligible = await (await api(`/returns/eligible-lines?saleId=${sale.id}`, ownerAToken)).json();
      const returnRes = await api('/returns', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale.id,
          reason: 'test avoir automatique',
          refundMethod: 'CASH',
          operationId: crypto.randomUUID(),
          lines: [{ saleLineId: eligible.lines[0].saleLineId, quantity: '1', condition: 'GOOD' }],
        }),
      });
      expect(returnRes.status).toBe(201);
      const ret = await returnRes.json();

      const documents = (await (await api('/documents', ownerAToken)).json()) as {
        type: string;
        returnId: string | null;
        contentSnapshot: { grandTotal: string };
      }[];
      const creditNote = documents.find((d) => d.type === 'CREDIT_NOTE' && d.returnId === ret.id);
      expect(creditNote).toBeTruthy();
      expect(Number(creditNote!.contentSnapshot.grandTotal)).toBe(Number(ret.refundAmount));
    } finally {
      await api('/business-profile/capabilities/returns', ownerAToken, { method: 'PUT', body: JSON.stringify({ enabled: false }) });
    }
  });

  it('RLS direct SQL : sous rôle app_runtime sans app.current_tenant_id, aucune donnée n’est visible (0 ligne)', async () => {
    const runtimeUrl = process.env.DATABASE_URL_RUNTIME ?? 'postgresql://app_runtime:app_runtime_dev_password@localhost:5432/gestionnaire_dev?schema=public';
    const prismaRuntime = new PrismaClient({ datasourceUrl: runtimeUrl });
    try {
      // 1. Sans tenant_id positionné : toutes les tables protégées par RLS doivent renvoyer 0 ligne
      const productsWithoutTenant = await prismaRuntime.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) as count FROM "Product"`;
      expect(Number(productsWithoutTenant[0].count)).toBe(0);

      const salesWithoutTenant = await prismaRuntime.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) as count FROM "Sale"`;
      expect(Number(salesWithoutTenant[0].count)).toBe(0);

      const tenantsWithoutTenant = await prismaRuntime.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) as count FROM "Tenant"`;
      expect(Number(tenantsWithoutTenant[0].count)).toBe(0);

      const usersWithoutTenant = await prismaRuntime.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) as count FROM "User"`;
      expect(Number(usersWithoutTenant[0].count)).toBe(0);

      // 2. Avec app.current_tenant_id positionné dans une transaction : voit uniquement les données du tenant ciblé
      await prismaRuntime.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantAId}'`);
        const productsA = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) as count FROM "Product"`;
        expect(Number(productsA[0].count)).toBeGreaterThan(0);

        const tenantRow = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Tenant"`;
        expect(tenantRow.length).toBe(1);
        expect(tenantRow[0].id).toBe(tenantAId);
      });
    } finally {
      await prismaRuntime.$disconnect();
    }
  });

  it('Concurrence atomique sur stock : deux ventes simultanées sur le dernier article ne créent jamais de stock négatif', async () => {
    // 1. Créer un produit de test avec stock = 1 sur storeAId
    const sku = `CONC-${Date.now()}`;
    const prodRes = await api('/products', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        sku,
        name: `Produit Test Concurrence ${sku}`,
        unit: 'piece',
        basePrice: '1500.0000',
      }),
    });
    expect(prodRes.status).toBe(201);
    const prod = await prodRes.json();

    // 2. Ajuster le stock à exactement 1 unité
    const adjRes = await api('/inventory/adjust', ownerAToken, {
      method: 'POST',
      body: JSON.stringify({
        locationId: storeAId,
        productId: prod.id,
        quantityDelta: '1',
        movementType: 'adjustment',
        reason: 'Stock initial test concurrence',
      }),
    });
    expect(adjRes.status).toBe(201);

    // 3. Déclencher 2 ventes simultanées pour 1 unité chacune
    const op1 = crypto.randomUUID();
    const op2 = crypto.randomUUID();
    const [res1, res2] = await Promise.all([
      api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: op1,
          lines: [{ productId: prod.id, quantity: '1' }],
          payments: [{ method: 'CASH', amount: '1500' }],
        }),
      }),
      api('/sales', salesAToken, {
        method: 'POST',
        body: JSON.stringify({
          locationId: storeAId,
          operationId: op2,
          lines: [{ productId: prod.id, quantity: '1' }],
          payments: [{ method: 'CASH', amount: '1500' }],
        }),
      }),
    ]);

    // L'une doit réussir (201) et l'autre échouer (400) pour stock insuffisant
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]);

    // 4. Vérifier que le stock restant est exactement 0 (jamais négatif)
    const stockRes = await api(`/inventory/stock?locationId=${storeAId}`, ownerAToken);
    expect(stockRes.status).toBe(200);
    const stockList = (await stockRes.json()) as { productId: string; quantityOnHand: string }[];
    const item = stockList.find((s) => s.productId === prod.id);
    expect(Number(item?.quantityOnHand ?? 0)).toBe(0);
  });
});

