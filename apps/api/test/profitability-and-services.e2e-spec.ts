/**
 * Tests E2E de validation des fonctionnalités majeures :
 * 1. Rentabilité par produit, coûts réels d'achat, PMP et marges historiques figées (Partie 23)
 * 2. Module Prestations & Services complet avec cycle de vie, pièces consommées en stock, rentabilité et facturation (Partie 26)
 * 3. Boîte de réception sociale conforme aux plateformes avec blocage formel des relances d'impayés sur WhatsApp (Partie 25)
 * 4. Isolation multi-tenant stricte (RLS) sur les nouveaux endpoints.
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
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (!headers['Content-Type'] && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
}

describe('Validation E2E — Rentabilité par Produit & Module Prestations', () => {
  let tokenA: string;
  let tokenB: string;
  let locationA: string;
  let categoryA: string;

  beforeAll(async () => {
    tokenA = await tenantLogin(TENANT_A, 'owner@alpha.demo');
    tokenB = await tenantLogin(TENANT_B, 'owner@beta.demo');

    const locRes = await api('/locations', tokenA);
    const locations = (await locRes.json()) as { id: string }[];
    locationA = locations[0]?.id;

    const catRes = await api('/categories', tokenA);
    const categories = (await catRes.json()) as { id: string }[];
    categoryA = categories[0]?.id;
  });

  describe('Partie 23 — Coûts d\'achat, Prix de vente, Marges et Rentabilité par Produit', () => {
    let testProductId: string;

    it('POST /products crée un produit avec prix de base et coût d\'achat de référence', async () => {
      const res = await api('/products', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          name: `Kit Écran Retina Test E2E ${Date.now()}`,
          sku: `RETINA-${Date.now()}`,
          type: 'PHYSICAL',
          basePrice: '25000',
          costPrice: '15000',
          categoryId: categoryA,
          unit: 'PIECE',
          isStocked: true,
        }),
      });

      expect(res.status).toBe(201);
      const product = (await res.json()) as { id: string; name: string; basePrice: string; costPrice: string };
      expect(product.id).toBeDefined();
      expect(Number(product.costPrice)).toBe(15000);
      expect(Number(product.basePrice)).toBe(25000);
      testProductId = product.id;
    });

    it('GET /products/:id/profitability calcule la marge estimée sans division par zéro', async () => {
      const res = await api(`/products/${testProductId}/profitability`, tokenA);
      expect(res.status).toBe(200);
      const prof = await res.json();

      expect(prof.productId).toBe(testProductId);
      expect(Number(prof.costPrice)).toBe(15000);
      expect(Number(prof.basePrice)).toBe(25000);
      // Marge estimée = 25000 - 15000 = 10000
      expect(Number(prof.estimatedCurrentMargin)).toBe(10000);
      // Taux de marge = 10000 / 15000 * 100 = 66.67%
      expect(Math.round(prof.estimatedCurrentMarginRate)).toBe(67);
      // Taux de marque = 10000 / 25000 * 100 = 40%
      expect(Math.round(prof.estimatedCurrentMarkupRate)).toBe(40);
      expect(prof.isSoldBelowCost).toBe(false);
      expect(prof.isLowMargin).toBe(false);
    });

    it('POST /sales fige le snapshot de coût unitaire lors d\'une vente', async () => {
      // Ajuster d'abord le stock pour permettre la vente
      const adjRes = await api('/inventory/adjust', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          locationId: locationA,
          productId: testProductId,
          quantityDelta: '10',
          movementType: 'adjustment',
          reason: 'Initialisation test E2E',
        }),
      });
      expect(adjRes.status).toBe(201);

      // Effectuer la vente de 2 unités
      const saleRes = await api('/sales', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          locationId: locationA,
          currency: 'XOF',
          operationId: crypto.randomUUID(),
          lines: [
            {
              productId: testProductId,
              quantity: '2',
            },
          ],
        }),
      });

      expect(saleRes.status).toBe(201);
      const sale = await saleRes.json();
      expect(sale.lines).toHaveLength(1);
      expect(Number(sale.lines[0].costPriceSnapshot)).toBe(15000);
    });

    it('GET /products/:id/sales restitue la marge réalisée exacte', async () => {
      const res = await api(`/products/${testProductId}/sales`, tokenA);
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.total).toBeGreaterThanOrEqual(1);
      const saleLine = body.data[0];
      expect(Number(saleLine.unitPriceSnapshot)).toBe(25000);
      expect(Number(saleLine.costPriceSnapshot)).toBe(15000);
      // Marge brute = (25000 - 15000) * 2 = 20000
      expect(Number(saleLine.grossMargin)).toBe(20000);
      expect(Math.round(saleLine.marginRate)).toBe(67);
    });

    it('PATCH /products/:id modifie le coût actuel sans altérer les marges historiques (Immuabilité)', async () => {
      // Le prix d'achat fournisseur augmente à 18000
      const patchRes = await api(`/products/${testProductId}`, tokenA, {
        method: 'PATCH',
        body: JSON.stringify({
          costPrice: '18000',
        }),
      });
      expect(patchRes.status).toBe(200);

      // 1. La rentabilité estimée future doit utiliser le nouveau coût 18000
      const profRes = await api(`/products/${testProductId}/profitability`, tokenA);
      const prof = await profRes.json();
      expect(Number(prof.costPrice)).toBe(18000);
      expect(Number(prof.estimatedCurrentMargin)).toBe(7000); // 25000 - 18000

      // 2. MAIS la vente passée doit impérativement conserver son coût snapshoté à 15000 et sa marge de 20000
      const salesRes = await api(`/products/${testProductId}/sales`, tokenA);
      const salesBody = await salesRes.json();
      const pastSale = salesBody.data[0];
      expect(Number(pastSale.costPriceSnapshot)).toBe(15000);
      expect(Number(pastSale.grossMargin)).toBe(20000);
    });

    it('GET /products/:id/purchases répond avec pagination', async () => {
      const res = await api(`/products/${testProductId}/purchases`, tokenA);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe('number');
    });

    it('RLS: Le Tenant B ne peut pas consulter la rentabilité d\'un produit du Tenant A', async () => {
      const res = await api(`/products/${testProductId}/profitability`, tokenB);
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Partie 26 — Module Prestations & Services d\'Atelier', () => {
    let serviceOrderId: string;
    let partProductId: string;

    beforeAll(async () => {
      // Créer une pièce de rechange avec stock
      const partRes = await api('/products', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          name: `Connecteur de Charge USB-C Test ${Date.now()}`,
          sku: `USBC-PART-${Date.now()}`,
          type: 'PHYSICAL',
          basePrice: '10000',
          costPrice: '4000',
          categoryId: categoryA,
          unit: 'PIECE',
          isStocked: true,
        }),
      });
      const part = await partRes.json();
      partProductId = part.id;

      // Ajouter du stock pour la pièce
      const partAdjRes = await api('/inventory/adjust', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          locationId: locationA,
          productId: partProductId,
          quantityDelta: '5',
          movementType: 'adjustment',
          reason: 'Stock pièces atelier',
        }),
      });
      expect(partAdjRes.status).toBe(201);
    });

    it('POST /services crée un nouveau dossier d\'intervention', async () => {
      const res = await api('/services', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          title: 'Réparation connecteur alimentation MacBook Pro',
          description: 'L\'appareil ne prend plus la charge. Diag initial requis.',
          locationId: locationA,
          priority: 'HIGH',
          estimatedDurationMinutes: 90,
          quotedPrice: '35000',
        }),
      });

      expect(res.status).toBe(201);
      const order = await res.json();
      expect(order.id).toBeDefined();
      expect(order.referenceNumber).toMatch(/^SRV-/);
      expect(order.status).toBe('DRAFT');
      expect(order.priority).toBe('HIGH');
      expect(Number(order.quotedPrice)).toBe(35000);
      serviceOrderId = order.id;
    });

    it('PATCH /services/:id avance le statut (DRAFT -> QUALIFIED -> IN_PROGRESS)', async () => {
      // 1. Passage en QUALIFIED
      let res = await api(`/services/${serviceOrderId}`, tokenA, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'QUALIFIED' }),
      });
      expect(res.status).toBe(200);
      let body = await res.json();
      expect(body.status).toBe('QUALIFIED');

      // 2. Passage en IN_PROGRESS (intervention en cours)
      res = await api(`/services/${serviceOrderId}`, tokenA, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.status).toBe('IN_PROGRESS');
    });

    it('POST /services/:id/items ajoute de la main-d\'œuvre (service pur sans impact stock)', async () => {
      const res = await api(`/services/${serviceOrderId}/items`, tokenA, {
        method: 'POST',
        body: JSON.stringify({
          itemType: 'LABOR',
          name: 'Main-d\'œuvre micro-soudure carte mère',
          quantity: '1',
          unitPrice: '25000',
          unitCost: '0',
        }),
      });

      expect(res.status).toBe(201);
      const order = await res.json();
      expect(order.items).toHaveLength(1);
      const item = order.items[0];
      expect(item.id).toBeDefined();
      expect(item.itemType).toBe('LABOR');
      expect(Number(item.lineTotal)).toBe(25000);
    });

    it('POST /services/:id/items ajoute une pièce consommée avec décrémentation automatique de stock', async () => {
      const res = await api(`/services/${serviceOrderId}/items`, tokenA, {
        method: 'POST',
        body: JSON.stringify({
          itemType: 'PART',
          name: 'Connecteur USB-C haute performance',
          productId: partProductId,
          quantity: '1',
          unitPrice: '10000',
          unitCost: '4000',
        }),
      });

      expect(res.status).toBe(201);
      const order = await res.json();
      expect(order.items).toHaveLength(2);
      const item = order.items.find((i: any) => i.itemType === 'PART');
      expect(item).toBeDefined();
      expect(item.productId).toBe(partProductId);
      expect(Number(item.lineTotal)).toBe(10000);

      // Vérifier le stock restant (5 - 1 = 4)
      const stockRes = await api(`/inventory/stock?locationId=${locationA}`, tokenA);
      const stockBody = (await stockRes.json()) as { productId: string; quantityOnHand: string }[];
      const level = stockBody.find((sl) => sl.productId === partProductId);
      expect(Number(level?.quantityOnHand)).toBe(4);
    });

    it('GET /services/:id calcule la rentabilité consolidée du dossier', async () => {
      const res = await api(`/services/${serviceOrderId}`, tokenA);
      expect(res.status).toBe(200);
      const order = await res.json();

      expect(order.items).toHaveLength(2);
      // Prix total = 25000 (main d'œuvre) + 10000 (pièce) = 35000
      expect(Number(order.finalPrice)).toBe(35000);
      // Coût total = 0 + 4000 = 4000
      expect(Number(order.totalCost)).toBe(4000);
      // Marge brute atelier = 35000 - 4000 = 31000
      expect(Number(order.grossMargin)).toBe(31000);
    });

    it('POST /services/:id/bill clôture et génère la vente et le règlement', async () => {
      // 1. Marquer comme COMPLETED d'abord
      await api(`/services/${serviceOrderId}`, tokenA, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      // 2. Facturation avec paiement comptant
      const billRes = await api(`/services/${serviceOrderId}/bill`, tokenA, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: 'CASH',
          amountPaid: '35000',
        }),
      });

      expect(billRes.status).toBe(201);
      const billedOrder = await billRes.json();
      expect(billedOrder.status).toBe('BILLED');
      expect(billedOrder.completedAt).toBeDefined();
      expect(billedOrder.saleId).toBeDefined();

      // Vérifier la vente générée
      const saleRes = await api(`/sales/${billedOrder.saleId}`, tokenA);
      expect(saleRes.status).toBe(200);
      const sale = await saleRes.json();
      expect(Number(sale.grandTotal)).toBe(35000);
    });

    it('GET /services/stats fournit les indicateurs opérationnels réels', async () => {
      const res = await api('/services/stats', tokenA);
      expect(res.status).toBe(200);
      const stats = await res.json();

      expect(stats.totalOrders).toBeGreaterThanOrEqual(1);
      expect(stats.billedOrders).toBeGreaterThanOrEqual(1);
      expect(Number(stats.totalRevenue)).toBeGreaterThanOrEqual(35000);
    });

    it('RLS: Le Tenant B ne peut pas accéder aux dossiers d\'atelier du Tenant A', async () => {
      const res = await api(`/services/${serviceOrderId}`, tokenB);
      expect(res.status).toBe(404);
    });
  });

  describe('Partie 25 — Boîte de Réception Sociale & Conformité WhatsApp', () => {
    it('Refuse catégoriquement l\'envoi de relance de créance ou impayé via WhatsApp', async () => {
      // 1. Simuler un message entrant sur WhatsApp pour ouvrir une conversation
      const simRes = await api('/social/accounts/WHATSAPP/simulate-inbound', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          type: 'DIRECT_MESSAGE',
          contactName: 'Client Démo WhatsApp',
          contactIdentifier: '+22670001122',
          content: 'Bonjour, pouvez-vous me donner des nouvelles de ma commande ?',
        }),
      });

      expect(simRes.status).toBe(201);
      const simData = await simRes.json();
      const conversationId = simData.conversation.id;

      // 2. Tenter d'envoyer un message sortant de recouvrement de créance / impayé sur cette conversation WhatsApp
      const sendRes = await api(`/social/conversations/${conversationId}/messages`, tokenA, {
        method: 'POST',
        body: JSON.stringify({
          content: 'Rappel urgent: Votre facture est échue. Merci de régler votre impayé sans délai.',
        }),
      });

      // Doit être catégoriquement rejeté en 400 Bad Request
      expect(sendRes.status).toBe(400);
      const errBody = await sendRes.json();
      expect(errBody.message).toContain('recouvrement de créances / dettes est formellement restreint sur WhatsApp');
    });
  });
});
