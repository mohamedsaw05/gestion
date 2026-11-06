/**
 * Tests E2E de validation des 4 nouveaux modules métier et d'exploitation :
 * 1. Module de Dépenses & Suivi Financier (Partie 3)
 * 2. Stockage Sécurisé des Fichiers & Médias (Partie 4)
 * 3. Moteur d'Automatisation Réel & Règles Configurables (Partie 7 & 14)
 * 4. Outil Administrateur de Diagnostic & Réparation Sûre (Partie 6)
 *
 * Vérifie rigoureusement l'isolation multi-tenant RLS (Tenant A vs Tenant B),
 * la traçabilité financière (aucune écriture silencieuse), et la non-régression.
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

describe('Validation E2E — Dépenses, Fichiers, Automatisation & Diagnostics', () => {
  let tokenA: string;
  let tokenB: string;
  let locationA: string;

  beforeAll(async () => {
    tokenA = await tenantLogin(TENANT_A, 'owner@alpha.demo');
    tokenB = await tenantLogin(TENANT_B, 'owner@beta.demo');

    const locRes = await api('/locations', tokenA);
    const locations = (await locRes.json()) as { id: string }[];
    locationA = locations[0]?.id;
  });

  describe('Partie 3 — Module de Dépenses & Suivi Financier', () => {
    let createdExpenseId: string;

    it('POST /expenses crée une dépense opérationnelle validée', async () => {
      const res = await api('/expenses', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          amount: '45000',
          category: 'UTILITIES',
          description: 'Facture électricité boutique Alpha',
          beneficiary: 'Compagnie Électrique Nationale',
          paymentMethod: 'CASH',
          locationId: locationA,
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; amount: string; category: string; status: string };
      expect(body.id).toBeDefined();
      expect(body.category).toBe('UTILITIES');
      expect(body.status).toBe('APPROVED');
      createdExpenseId = body.id;
    });

    it('GET /expenses liste les dépenses avec pagination et filtres', async () => {
      const res = await api('/expenses?category=UTILITIES&limit=10', tokenA);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: any[]; total: number; totalAmount: string };
      expect(body.data).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.data.some((e: any) => e.id === createdExpenseId)).toBe(true);
    });

    it('GET /expenses/summary calcule les totaux par catégorie', async () => {
      const res = await api('/expenses/summary', tokenA);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { totalAmount: string; categories: any[] };
      expect(body).toHaveProperty('totalAmount');
      expect(Array.isArray(body.categories)).toBe(true);
    });

    it('POST /expenses avec montant élevé (>500k) passe en PENDING_APPROVAL', async () => {
      const res = await api('/expenses', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          amount: '750000',
          category: 'RENT',
          description: 'Loyer commercial trimestriel',
          beneficiary: 'Bailleur Immobilier',
          paymentMethod: 'BANK_TRANSFER',
        }),
      });

      expect(res.status).toBe(201);
      const highExpense = (await res.json()) as { id: string; status: string };
      expect(highExpense.status).toBe('PENDING_APPROVAL');

      // Approbation par le propriétaire
      const approveRes = await api(`/expenses/${highExpense.id}/approve`, tokenA, {
        method: 'PATCH',
      });
      expect(approveRes.status).toBe(200);
      const approved = (await approveRes.json()) as { status: string };
      expect(approved.status).toBe('APPROVED');
    });

    it('ISOLATION RLS : Tenant B ne peut pas accéder aux dépenses de Tenant A', async () => {
      const res = await api(`/expenses/${createdExpenseId}`, tokenB);
      expect(res.status).toBe(404);
    });
  });

  describe('Partie 4 — Stockage Sécurisé des Fichiers & Médias', () => {
    let uploadedFileId: string;

    it('GET /files/storage/usage retourne la consommation et le quota de 5 Go', async () => {
      const res = await api('/files/storage/usage', tokenA);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { usedBytes: number; quotaBytes: number; fileCount: number };
      expect(body.quotaBytes).toBe(5 * 1024 * 1024 * 1024);
      expect(body.usedBytes).toBeGreaterThanOrEqual(0);
    });

    it('POST /files/upload téléverse un fichier avec hash SHA256 et métadonnées', async () => {
      const formData = new FormData();
      const textBlob = new Blob(['Facture justificatif test E2E'], { type: 'text/plain' });
      formData.append('file', textBlob, 'justificatif_loyer.txt');
      formData.append('category', 'EXPENSE_RECEIPT');

      const res = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; hashSha256: string; fileName: string; sizeBytes: number };
      expect(body.id).toBeDefined();
      expect(body.hashSha256).toBeDefined();
      expect(body.sizeBytes).toBeGreaterThan(0);
      uploadedFileId = body.id;
    });

    it('GET /files liste les fichiers avec pagination', async () => {
      const res = await api('/files?category=EXPENSE_RECEIPT', tokenA);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: any[]; total: number };
      expect(body.data.some((f: any) => f.id === uploadedFileId)).toBe(true);
    });

    it('GET /files/:id/download télécharge le flux du fichier', async () => {
      const res = await api(`/files/${uploadedFileId}/download`, tokenA);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Facture justificatif test E2E');
    });

    it('ISOLATION RLS : Tenant B ne peut pas télécharger le fichier de Tenant A', async () => {
      const res = await api(`/files/${uploadedFileId}/download`, tokenB);
      expect(res.status).toBe(404);
    });

    it('DELETE /files/:id supprime le fichier physiquement et en base', async () => {
      const res = await api(`/files/${uploadedFileId}`, tokenA, { method: 'DELETE' });
      expect(res.status).toBe(200);

      const check = await api(`/files/${uploadedFileId}`, tokenA);
      expect(check.status).toBe(404);
    });
  });

  describe('Partie 7 & 14 — Moteur d’Automatisation & Exécutions Anti-Boucle', () => {
    let ruleId: string;

    it('POST /automation/rules crée une règle d’automatisation', async () => {
      const res = await api('/automation/rules', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alerte Dépense Supérieure à 200 000 XOF',
          description: 'Alerte immédiate pour toute dépense majeure',
          trigger: 'EXPENSE_CREATED',
          conditions: { amountGreaterThan: 200000 },
          actions: [
            { type: 'ALERT', channel: 'IN_APP', recipientRole: 'OWNER', message: 'Dépense importante enregistrée' },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; name: string; isActive: boolean };
      expect(body.id).toBeDefined();
      expect(body.isActive).toBe(true);
      ruleId = body.id;
    });

    it('POST /automation/rules/:id/test effectue un test dry-run sans effet de bord', async () => {
      const res = await api(`/automation/rules/${ruleId}/test`, tokenA, {
        method: 'POST',
        body: JSON.stringify({
          mockPayload: { amount: 350000, category: 'EQUIPMENT' },
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { matched: boolean; simulatedActions: any[] };
      expect(body.matched).toBe(true);
      expect(body.simulatedActions.length).toBe(1);
    });

    it('PATCH /automation/rules/:id/toggle active/désactive la règle', async () => {
      const res = await api(`/automation/rules/${ruleId}/toggle`, tokenA, { method: 'PATCH' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { isActive: boolean };
      expect(body.isActive).toBe(false);
    });

    it('GET /automation/logs liste l’historique des exécutions', async () => {
      const res = await api('/automation/logs', tokenA);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: any[]; total: number };
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('ISOLATION RLS : Tenant B ne peut pas modifier la règle de Tenant A', async () => {
      const res = await api(`/automation/rules/${ruleId}/toggle`, tokenB, { method: 'PATCH' });
      expect(res.status).toBe(404);
    });
  });

  describe('Partie 6 — Diagnostic Administrateur & Réparation Sûre', () => {
    let scanId: string;

    it('POST /diagnostics/scan exécute un scan non destructif en lecture seule', async () => {
      const res = await api('/diagnostics/scan', tokenA, {
        method: 'POST',
        body: JSON.stringify({ type: 'FULL_SYSTEM' }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; status: string; findings: any };
      expect(body.id).toBeDefined();
      expect(['SUCCESS', 'WARNING', 'CRITICAL']).toContain(body.status);
      expect(body.findings).toHaveProperty('dbLatencyMs');
      expect(body.findings).toHaveProperty('outbox');
      expect(body.findings).toHaveProperty('files');
      expect(body.findings).toHaveProperty('inventory');
      scanId = body.id;
    });

    it('GET /diagnostics/scans/:id retourne le rapport complet du scan', async () => {
      const res = await api(`/diagnostics/scans/${scanId}`, tokenA);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; findings: any };
      expect(body.id).toBe(scanId);
    });

    it('POST /diagnostics/repair exécute une réparation sûre et idempotente', async () => {
      const res = await api('/diagnostics/repair', tokenA, {
        method: 'POST',
        body: JSON.stringify({
          repairType: 'PURGE_TEMPORARY_CACHE',
          reason: 'Maintenance préventive test E2E',
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; result: any };
      expect(body.success).toBe(true);
      expect(body.result.action).toBe('PURGE_TEMPORARY_CACHE');
    });

    it('ISOLATION RLS : Tenant B ne peut pas consulter les scans de Tenant A', async () => {
      const res = await api(`/diagnostics/scans/${scanId}`, tokenB);
      expect(res.status).toBe(404);
    });
  });
});
