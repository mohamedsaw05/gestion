/**
 * Tests E2E de validation des complétions fonctionnelles prioritaires (Audit Maître) :
 * 1. Stock Movements & Pagination (GET /inventory/movements)
 * 2. Stock Valuation (GET /inventory/valuation)
 * 3. Physical Inventory Reconciliation (POST /inventory/reconcile)
 * 4. Customers Full CRUD & Detail (GET/PUT/DELETE /customers/:id)
 * 5. Customer Duplicate Merge (POST /customers/merge)
 * 6. Customers CSV Import (POST /customers/import)
 * 7. Products CSV Import (POST /products/import)
 * 8. Operational Automated Alerts (GET /alerts & /alerts/count)
 * 9. Organization Full Data Export (GET /organization/export)
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.TEST_API_URL ?? 'http://localhost:4000';
const TENANT_A = '3e91b057-f0f3-4410-9c4a-8541896328a6';

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

describe('Audit Fonctionnel Intégral — Complétions Métier', () => {
  let token: string;
  let locationId: string;
  let testProductId: string;

  beforeAll(async () => {
    token = await tenantLogin(TENANT_A, 'owner@alpha.demo');

    // Récupérer un emplacement et un produit existant pour les tests
    const locRes = await api('/locations', token);
    const locations = (await locRes.json()) as { id: string }[];
    locationId = locations[0].id;

    const prodRes = await api('/products', token);
    const products = (await prodRes.json()) as { id: string }[];
    testProductId = products[0].id;
  });

  describe('1. Mouvements & Valorisation du Stock', () => {
    it('GET /inventory/movements retourne la liste paginée des mouvements avec métadonnées', async () => {
      const res = await api('/inventory/movements?limit=10', token);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { total: number; limit: number; items: any[] };

      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
      if (body.items.length > 0) {
        const first = body.items[0];
        expect(first).toHaveProperty('movementType');
        expect(first).toHaveProperty('quantity');
        expect(first).toHaveProperty('createdAt');
      }
    });

    it('GET /inventory/valuation calcule la valeur globale du stock au prix de vente', async () => {
      const res = await api(`/inventory/valuation?locationId=${locationId}`, token);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        totalSkus: number;
        totalOnHand: string;
        estimatedRetailValue: string;
        items: any[];
      };

      expect(body).toHaveProperty('totalSkus');
      expect(body).toHaveProperty('totalOnHand');
      expect(body).toHaveProperty('estimatedRetailValue');
      expect(Array.isArray(body.items)).toBe(true);
    });

    it('POST /inventory/reconcile effectue une réconciliation d\'inventaire physique avec écarts et traçabilité', async () => {
      // 1. Lire le stock actuel
      const stockRes = await api(`/inventory/stock?locationId=${locationId}`, token);
      const stock = (await stockRes.json()) as { productId: string; quantityOnHand: string }[];
      const currentItem = stock.find((s) => s.productId === testProductId) ?? stock[0];
      const currentQty = Number(currentItem?.quantityOnHand ?? '10');
      const targetCounted = currentQty + 3; // +3 surplus physique constaté

      // 2. Soumettre la réconciliation
      const reconcileRes = await api('/inventory/reconcile', token, {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          reason: 'Test E2E Inventaire périodique',
          items: [
            {
              productId: currentItem.productId,
              countedQuantity: targetCounted.toString(),
            },
          ],
        }),
      });

      expect(reconcileRes.status).toBe(201);
      const reconcileBody = (await reconcileRes.json()) as {
        reconciliationSessionId: string;
        items: { discrepancyDelta: string; countedQuantity: string }[];
      };

      expect(reconcileBody).toHaveProperty('reconciliationSessionId');
      expect(reconcileBody.items[0].discrepancyDelta).toBe('3');

      // 3. Vérifier que le stock a été mis à jour exactement à targetCounted
      const updatedStockRes = await api(`/inventory/stock?locationId=${locationId}`, token);
      const updatedStock = (await updatedStockRes.json()) as { productId: string; quantityOnHand: string }[];
      const updatedItem = updatedStock.find((s) => s.productId === currentItem.productId);
      expect(Number(updatedItem?.quantityOnHand)).toBe(targetCounted);

      // 4. Vérifier qu'un mouvement inventory_reconciliation a bien été consigné
      const movRes = await api(`/inventory/movements?locationId=${locationId}&limit=5`, token);
      const movBody = (await movRes.json()) as { items: any[] };
      const recMovement = movBody.items.find(
        (m) => m.referenceId === reconcileBody.reconciliationSessionId,
      );
      expect(recMovement).toBeDefined();
      expect(recMovement?.movementType).toBe('inventory_reconciliation');
    });
  });

  describe('2. Gestion Complète des Clients & Fusion de Doublons', () => {
    let createdCustomerId: string;

    it('POST, GET, PUT et DELETE /customers gère le cycle de vie complet du contact', async () => {
      // Création
      const createRes = await api('/customers', token, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Contact Test Cycle',
          phone: '+226 70 11 22 33',
          email: 'contact.test@cycle.bf',
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string; name: string };
      createdCustomerId = created.id;
      expect(created.name).toBe('Contact Test Cycle');

      // Lecture fiche détaillée
      const getRes = await api(`/customers/${createdCustomerId}`, token);
      expect(getRes.status).toBe(200);
      const detail = (await getRes.json()) as { id: string; sales: any[]; creditAccount: any };
      expect(detail.id).toBe(createdCustomerId);
      expect(Array.isArray(detail.sales)).toBe(true);

      // Modification
      const updateRes = await api(`/customers/${createdCustomerId}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Contact Test Cycle Modifié',
          phone: '+226 75 00 00 00',
        }),
      });
      expect(updateRes.status).toBe(200);
      const updated = (await updateRes.json()) as { name: string; phone: string };
      expect(updated.name).toBe('Contact Test Cycle Modifié');
      expect(updated.phone).toBe('+226 75 00 00 00');

      // Archivage (soft delete)
      const deleteRes = await api(`/customers/${createdCustomerId}`, token, {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(200);

      // Vérifier qu'il n'apparaît plus dans la liste active
      const listRes = await api('/customers', token);
      const activeList = (await listRes.json()) as { id: string }[];
      expect(activeList.some((c) => c.id === createdCustomerId)).toBe(false);
    });

    it('POST /customers/merge fusionne atomiquement un doublon sans perte d\'historique', async () => {
      // Créer 2 contacts distincts
      const c1Res = await api('/customers', token, {
        method: 'POST',
        body: JSON.stringify({ name: 'Doublon Source' }),
      });
      const source = (await c1Res.json()) as { id: string };

      const c2Res = await api('/customers', token, {
        method: 'POST',
        body: JSON.stringify({ name: 'Contact Principal Cible' }),
      });
      const target = (await c2Res.json()) as { id: string };

      // Fusionner source dans target
      const mergeRes = await api('/customers/merge', token, {
        method: 'POST',
        body: JSON.stringify({
          sourceCustomerId: source.id,
          targetCustomerId: target.id,
        }),
      });
      expect(mergeRes.status).toBe(201);
      const mergeBody = (await mergeRes.json()) as { success: boolean; targetCustomerId: string };
      expect(mergeBody.success).toBe(true);
      expect(mergeBody.targetCustomerId).toBe(target.id);

      // Vérifier que le contact source a été archivé
      const listRes = await api('/customers', token);
      const activeList = (await listRes.json()) as { id: string }[];
      expect(activeList.some((c) => c.id === source.id)).toBe(false);
      expect(activeList.some((c) => c.id === target.id)).toBe(true);
    });

    it('POST /customers/import valide et importe des contacts depuis CSV', async () => {
      const csv = `nom,telephone,email\nClient CSV 1,+226 70 99 99 91,csv1@test.bf\nClient CSV 2,+226 70 99 99 92,csv2@test.bf`;

      // 1. Dry run
      const dryRes = await api('/customers/import', token, {
        method: 'POST',
        body: JSON.stringify({ csvContent: csv, dryRun: true }),
      });
      expect(dryRes.status).toBe(201);
      const dryBody = (await dryRes.json()) as { dryRun: boolean; validCount: number; errorCount: number };
      expect(dryBody.dryRun).toBe(true);
      expect(dryBody.validCount).toBe(2);
      expect(dryBody.errorCount).toBe(0);

      // 2. Commit réel
      const commitRes = await api('/customers/import', token, {
        method: 'POST',
        body: JSON.stringify({ csvContent: csv, dryRun: false }),
      });
      expect(commitRes.status).toBe(201);
      const commitBody = (await commitRes.json()) as { createdCount: number };
      expect(commitBody.createdCount).toBe(2);
    });
  });

  describe('3. Importation CSV Catalogue Produits', () => {
    it('POST /products/import valide les prix et refuse les doublons de SKU', async () => {
      const uniqueSku = `SKU-TEST-${Date.now()}`;
      const csv = `nom,sku,prix,type,unite\nArticle Test CSV,${uniqueSku},4500,PHYSICAL,U\nArticle Prix Invalide,SKU-INV,invalide_prix,PHYSICAL,U`;

      // Dry run : détecte 1 valide et 1 erreur
      const dryRes = await api('/products/import', token, {
        method: 'POST',
        body: JSON.stringify({ csvContent: csv, dryRun: true }),
      });
      expect(dryRes.status).toBe(201);
      const dryBody = (await dryRes.json()) as { validCount: number; errorCount: number };
      expect(dryBody.validCount).toBe(1);
      expect(dryBody.errorCount).toBe(1);

      // Commit réel de la ligne valide
      const validCsv = `nom,sku,prix,type,unite\nArticle Test CSV,${uniqueSku},4500,PHYSICAL,U`;
      const commitRes = await api('/products/import', token, {
        method: 'POST',
        body: JSON.stringify({ csvContent: validCsv, dryRun: false }),
      });
      expect(commitRes.status).toBe(201);
      const commitBody = (await commitRes.json()) as { createdCount: number };
      expect(commitBody.createdCount).toBe(1);

      // Tentative de réimport du même SKU : doit être refusé pour doublon
      const dupRes = await api('/products/import', token, {
        method: 'POST',
        body: JSON.stringify({ csvContent: validCsv, dryRun: true }),
      });
      const dupBody = (await dupRes.json()) as { errorCount: number; errors: any[] };
      expect(dupBody.errorCount).toBe(1);
      expect(dupBody.errors[0].reason).toContain('SKU déjà existant');
    });
  });

  describe('4. Moteur d\'Alertes Opérationnelles & Portabilité des Données', () => {
    it('GET /alerts et /alerts/count retournent les alertes opérationnelles en temps réel', async () => {
      const countRes = await api('/alerts/count', token);
      expect(countRes.status).toBe(200);
      const countBody = (await countRes.json()) as { count: number };
      expect(typeof countBody.count).toBe('number');

      const alertsRes = await api('/alerts', token);
      expect(alertsRes.status).toBe(200);
      const alertsBody = (await alertsRes.json()) as { total: number; alerts: any[] };
      expect(alertsBody.total).toBe(countBody.count);
      expect(Array.isArray(alertsBody.alerts)).toBe(true);
    });

    it('GET /organization/export génère une archive complète JSON des données du tenant', async () => {
      const res = await api('/organization/export', token);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = (await res.json()) as {
        exportedAt: string;
        tenant: { id: string; name: string };
        catalog: { productCount: number; products: any[] };
        customers: { customerCount: number; customers: any[] };
        inventory: { levelsCount: number };
      };

      expect(data).toHaveProperty('exportedAt');
      expect(data.tenant.id).toBe(TENANT_A);
      expect(data.catalog).toHaveProperty('productCount');
      expect(data.customers).toHaveProperty('customerCount');
      expect(data.inventory).toHaveProperty('levelsCount');
    });
  });

  describe('10. Vente Directe Produit Épuisé & Paramètres de Personnalisation', () => {
    let outOfStockProductId: string;

    it('crée un produit avec stock initial à 0 pour tester les ventes directes', async () => {
      const sku = `OOS-${Date.now()}`;
      const res = await api('/products', token, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Produit Épuisé Test Direct',
          sku,
          basePrice: '2500',
          unit: 'pièce',
        }),
      });
      expect(res.status).toBe(201);
      const prod = (await res.json()) as { id: string };
      outOfStockProductId = prod.id;
    });

    it('refuse la vente directe si le stock est épuisé et que le réassort immédiat n’est pas activé', async () => {
      // S'assurer que le stock négatif est désactivé
      await api('/settings/inventory.allowNegativeStock', token, {
        method: 'PUT',
        body: JSON.stringify({ value: false }),
      });

      const res = await api('/sales', token, {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: outOfStockProductId, quantity: '2' }],
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain('Stock insuffisant');
    });

    it('valide la vente directe avec succès grâce à l’approvisionnement immédiat (immediateRestocks)', async () => {
      const res = await api('/sales', token, {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: outOfStockProductId, quantity: '2' }],
          immediateRestocks: [
            {
              productId: outOfStockProductId,
              quantity: '2',
              source: 'Présent physiquement en boutique',
            },
          ],
        }),
      });
      expect(res.status).toBe(201);
      const sale = (await res.json()) as {
        id: string;
        grandTotal: string;
        lines: any[];
        documents: any[];
      };
      expect(Number(sale.grandTotal)).toBe(5000);
      expect(sale.lines).toHaveLength(1);
      expect(sale.documents.length).toBeGreaterThanOrEqual(1);
    });

    it('autorise la vente directe sans réassort explicite si inventory.allowNegativeStock est activé', async () => {
      // Activer le stock négatif
      const configRes = await api('/settings/inventory.allowNegativeStock', token, {
        method: 'PUT',
        body: JSON.stringify({ value: true }),
      });
      expect(configRes.status).toBe(200);

      // Vente directe sans immediateRestocks
      const res = await api('/sales', token, {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          operationId: crypto.randomUUID(),
          lines: [{ productId: outOfStockProductId, quantity: '1' }],
        }),
      });
      expect(res.status).toBe(201);
      const sale = (await res.json()) as { id: string; grandTotal: string };
      expect(Number(sale.grandTotal)).toBe(2500);

      // Remettre le stock négatif à false
      await api('/settings/inventory.allowNegativeStock', token, {
        method: 'PUT',
        body: JSON.stringify({ value: false }),
      });
    });

    it('sauvegarde et persiste les personnalisations visuelles et documentaires', async () => {
      const fakeLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      // 1. Logo
      const logoRes = await api('/settings/documents.logoDataUri', token, {
        method: 'PUT',
        body: JSON.stringify({ value: fakeLogo }),
      });
      expect(logoRes.status).toBe(200);

      // 2. En-tête de reçu
      const headerRes = await api('/settings/documents.receiptHeaderText', token, {
        method: 'PUT',
        body: JSON.stringify({ value: 'Bienvenue au Grand Marché Alpha !' }),
      });
      expect(headerRes.status).toBe(200);

      // 3. Pied de page de reçu
      const footerRes = await api('/settings/documents.receiptFooterText', token, {
        method: 'PUT',
        body: JSON.stringify({ value: 'Articles garantis 30 jours avec ticket.' }),
      });
      expect(footerRes.status).toBe(200);

      // 4. Modèle de facture
      const templateRes = await api('/settings/documents.invoiceTemplate', token, {
        method: 'PUT',
        body: JSON.stringify({ value: 'ELEGANT' }),
      });
      expect(templateRes.status).toBe(200);

      // Vérifier la persistance dans GET /settings
      const getRes = await api('/settings', token);
      expect(getRes.status).toBe(200);
      const settings = (await getRes.json()) as Record<string, unknown>;
      expect(settings['documents.logoDataUri']).toBe(fakeLogo);
      expect(settings['documents.receiptHeaderText']).toBe('Bienvenue au Grand Marché Alpha !');
      expect(settings['documents.receiptFooterText']).toBe('Articles garantis 30 jours avec ticket.');
      expect(settings['documents.invoiceTemplate']).toBe('ELEGANT');

      // Nettoyage après test pour préserver l'isolation des autres suites
      await api('/settings/documents.receiptFooterText', token, {
        method: 'PUT',
        body: JSON.stringify({ value: '' }),
      });
      await api('/settings/documents.logoDataUri', token, {
        method: 'PUT',
        body: JSON.stringify({ value: '' }),
      });
      await api('/settings/documents.receiptHeaderText', token, {
        method: 'PUT',
        body: JSON.stringify({ value: '' }),
      });
      await api('/settings/documents.invoiceTemplate', token, {
        method: 'PUT',
        body: JSON.stringify({ value: 'STANDARD_PRO' }),
      });
    });
  });
});

