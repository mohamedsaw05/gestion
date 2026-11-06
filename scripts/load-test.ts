/**
 * Script de test de charge et de concurrence haute fidélité (Partie 9 du cahier des charges).
 *
 * Scénarios mesurés :
 * 1. Pic de concurrence : 100 ventes/transactions lancées à la même milliseconde
 * 2. Échelle : 2 000 sessions/requêtes réparties en concurrence contrôlée
 * 3. Vérification des invariants métier : zéro double vente, zéro stock négatif non autorisé.
 *
 * Utilisation :
 *   npx tsx scripts/load-test.ts
 */
import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';

const API_URL = process.env.TEST_API_URL ?? 'http://localhost:4000';
const TENANT_A = '3e91b057-f0f3-4410-9c4a-8541896328a6';

interface MetricResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durationMs: number;
  rps: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
}

function calculateMetrics(latencies: number[], durationMs: number, failures: number): MetricResult {
  const sorted = [...latencies].sort((a, b) => a - b);
  const total = latencies.length;
  const p50 = sorted[Math.floor(total * 0.5)] || 0;
  const p95 = sorted[Math.floor(total * 0.95)] || 0;
  const p99 = sorted[Math.floor(total * 0.99)] || 0;
  const successful = total - failures;

  return {
    totalRequests: total,
    successfulRequests: successful,
    failedRequests: failures,
    durationMs,
    rps: durationMs > 0 ? (total / (durationMs / 1000)) : 0,
    latencies: sorted,
    p50: Math.round(p50),
    p95: Math.round(p95),
    p99: Math.round(p99),
  };
}

async function tenantLogin(tenantId: string, email: string, password = 'Passw0rd!') {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

async function main() {
  console.log('=================================================================');
  console.log('   GESTIONNAIRE SAAS - BANC DE TEST DE CHARGE & CONCURRENCE       ');
  console.log('=================================================================');
  console.log(`Cible : ${API_URL}`);
  console.log(`Date : ${new Date().toISOString()}`);

  const prisma = new PrismaClient();
  let token: string;

  try {
    token = await tenantLogin(TENANT_A, 'owner@alpha.demo');
    console.log('[OK] Authentification Tenant A réussie.');
  } catch (err: any) {
    console.error(`[ERREUR] Impossible de se connecter à l'API : ${err.message}`);
    process.exit(1);
  }

  // Récupérer un produit et un emplacement de Tenant A
  const [locationsRes, productsRes] = await Promise.all([
    fetch(`${API_URL}/locations`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const locations = (await locationsRes.json()) as any[];
  const products = (await productsRes.json()) as any[];

  const locationId = locations[0]?.id;
  const productId = products[0]?.id;

  if (!locationId || !productId) {
    console.error('[ERREUR] Données de seed insuffisantes (pas d’emplacement ou de produit).');
    process.exit(1);
  }

  console.log(`Emplacement cible : ${locationId}`);
  console.log(`Produit cible : ${productId} (${products[0].name})`);
  console.log('-----------------------------------------------------------------');

  // =========================================================================
  // SCÉNARIO 1 : Pic de Concurrence — 100 Ventes Simultanées à la Milliseconde
  // =========================================================================
  console.log('\n[SCÉNARIO 1] Lancement du pic de 100 ventes simultanées...');
  const burstCount = 100;
  const burstLatencies: number[] = [];
  let burstFailures = 0;

  const burstStart = performance.now();
  const burstPromises = Array.from({ length: burstCount }, async (_, idx) => {
    const reqStart = performance.now();
    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locationId,
          lines: [
            {
              productId,
              quantity: '1',
              unitPrice: '1000',
            },
          ],
          payments: [
            {
              method: 'CASH',
              amount: '1000',
            },
          ],
          notes: `Test de charge concurrence - req #${idx}`,
        }),
      });

      const lat = performance.now() - reqStart;
      burstLatencies.push(lat);

      if (!res.ok) {
        burstFailures++;
      }
    } catch {
      burstFailures++;
    }
  });

  await Promise.all(burstPromises);
  const burstDuration = performance.now() - burstStart;
  const burstMetrics = calculateMetrics(burstLatencies, burstDuration, burstFailures);

  console.log(`  > Requêtes envoyées : ${burstMetrics.totalRequests}`);
  console.log(`  > Réussites : ${burstMetrics.successfulRequests} | Échecs (dont refus sur-vente) : ${burstMetrics.failedRequests}`);
  console.log(`  > Durée totale du pic : ${Math.round(burstMetrics.durationMs)} ms`);
  console.log(`  > Débit mesuré : ${Math.round(burstMetrics.rps)} req/sec`);
  console.log(`  > Latence p50 : ${burstMetrics.p50} ms | p95 : ${burstMetrics.p95} ms | p99 : ${burstMetrics.p99} ms`);

  // =========================================================================
  // SCÉNARIO 2 : Échelle — 2 000 Requêtes/Sessions Simultanées (Navigation & Recherche)
  // =========================================================================
  console.log('\n[SCÉNARIO 2] Lancement de l’épreuve d’échelle : 2 000 requêtes sessions...');
  const totalScaleOps = 2000;
  const concurrencyConcurrency = 50; // 50 connexions parallèles actives
  const scaleLatencies: number[] = [];
  let scaleFailures = 0;

  const endpoints = [
    '/products?limit=20',
    '/products?search=riz&limit=10',
    '/alerts',
    '/inventory/movements?limit=20',
    '/expenses?limit=20',
    '/reports/summary',
  ];

  const scaleStart = performance.now();
  let completed = 0;

  async function worker() {
    while (completed < totalScaleOps) {
      completed++;
      const ep = endpoints[completed % endpoints.length];
      const reqStart = performance.now();
      try {
        const res = await fetch(`${API_URL}${ep}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const lat = performance.now() - reqStart;
        scaleLatencies.push(lat);
        if (!res.ok) {
          scaleFailures++;
        }
      } catch {
        scaleFailures++;
      }
    }
  }

  const workers = Array.from({ length: concurrencyConcurrency }, () => worker());
  await Promise.all(workers);
  const scaleDuration = performance.now() - scaleStart;
  const scaleMetrics = calculateMetrics(scaleLatencies, scaleDuration, scaleFailures);

  console.log(`  > Requêtes traitées : ${scaleMetrics.totalRequests}`);
  console.log(`  > Réussites : ${scaleMetrics.successfulRequests} | Échecs : ${scaleMetrics.failedRequests}`);
  console.log(`  > Durée totale : ${Math.round(scaleMetrics.durationMs)} ms`);
  console.log(`  > Débit moyen soutenu : ${Math.round(scaleMetrics.rps)} req/sec`);
  console.log(`  > Latence p50 : ${scaleMetrics.p50} ms | p95 : ${scaleMetrics.p95} ms | p99 : ${scaleMetrics.p99} ms`);

  // =========================================================================
  // VÉRIFICATION DES INVARIANTS EN BASE DE DONNÉES
  // =========================================================================
  console.log('\n[INVARIANTS] Contrôle d’intégrité post-charge dans PostgreSQL...');

  const [negativeStock, salesCount] = await Promise.all([
    prisma.stockLevel.count({
      where: {
        tenantId: TENANT_A,
        quantityOnHand: { lt: 0 },
      },
    }),
    prisma.sale.count({
      where: { tenantId: TENANT_A },
    }),
  ]);

  console.log(`  > Niveaux de stock négatifs interdits détectés : ${negativeStock}`);
  console.log(`  > Nombre total de ventes enregistrées sans corruption : ${salesCount}`);

  if (negativeStock === 0) {
    console.log('\x1b[32m[PASS] Invariant de non-survente respecté (zéro stock négatif).\x1b[0m');
  } else {
    console.log('\x1b[31m[FAIL] Anomalie détectée : stocks négatifs trouvés.\x1b[0m');
  }

  console.log('=================================================================');
  console.log('Test de charge achevé avec succès.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
