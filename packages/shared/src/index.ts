/**
 * Utilitaires et modèles de données partagés entre apps/client, apps/admin et apps/api.
 */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ClientSession {
  tenantId: string;
  accessToken: string;
  refreshToken: string;
}

export interface PlatformSession {
  accessToken: string;
}

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'VOID' | 'REFUNDED';

export type PlanKey = 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface PlatformStats {
  tenants: { total: number; active: number; suspended: number };
  subscriptions: { active: number; trialing: number; mrr: number; currency: string };
  invoices: { pending: number; paid: number };
}

export interface PlatformAdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

/**
 * Formate un montant monétaire selon la devise et la locale.
 */
export function formatCurrency(amount: number | string | null | undefined, currency = 'XOF'): string {
  if (amount === null || amount === undefined) return `0 ${currency}`;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0 ${currency}`;
  return `${num.toLocaleString('fr-FR')} ${currency}`;
}

/**
 * Formate une date ISO en chaîne lisible (JJ/MM/AAAA HH:mm).
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Nettoie une chaîne de texte pour neutraliser les injections de formules CSV.
 */
export function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+@-|\t\r\n]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

// ─────────────────────────────────────────────────────────────────────────
// EXPENSES (DÉPENSES OPÉRATIONNELLES)
// ─────────────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'RENT'
  | 'SALARIES'
  | 'UTILITIES'
  | 'TRANSPORT'
  | 'SUPPLIES'
  | 'MARKETING'
  | 'MAINTENANCE'
  | 'TAXES'
  | 'OTHER';

export type ExpenseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Expense {
  id: string;
  tenantId: string;
  locationId?: string | null;
  category: ExpenseCategory | string;
  amount: number | string;
  currency: string;
  description: string;
  beneficiary?: string | null;
  paymentMethod: string;
  cashSessionId?: string | null;
  status: ExpenseStatus;
  receiptUrl?: string | null;
  attachmentId?: string | null;
  isRecurring: boolean;
  recurrenceInterval?: string | null;
  createdByUserId: string;
  approvedByUserId?: string | null;
  rejectedReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// FILE STORAGE & ASSETS
// ─────────────────────────────────────────────────────────────────────────

export interface StoredFile {
  id: string;
  tenantId: string;
  uploadedByUserId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  hashSha256: string;
  storagePath: string;
  storageProvider: 'LOCAL' | 'S3';
  category: string;
  scanStatus: 'CLEAN' | 'PENDING' | 'INFECTED' | 'UNCHECKED';
  isPublic: boolean;
  retentionDays?: number | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// AUTOMATION ENGINE
// ─────────────────────────────────────────────────────────────────────────

export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  trigger: string;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  timeWindow?: string | null;
  isActive: boolean;
  lastTriggeredAt?: string | null;
  executionCount: number;
  failureCount: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecutionLog {
  id: string;
  tenantId: string;
  ruleId: string;
  triggerEvent: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  inputPayload?: unknown;
  outputPayload?: unknown;
  errorMessage?: string | null;
  durationMs: number;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS & SYSTEM REPAIR
// ─────────────────────────────────────────────────────────────────────────

export interface DiagnosticScan {
  id: string;
  tenantId?: string | null;
  type: string;
  status: 'SUCCESS' | 'WARNING' | 'CRITICAL';
  scope: 'PLATFORM' | 'TENANT';
  triggeredByUserId: string;
  findings: Record<string, unknown>;
  repairsExecuted?: Record<string, unknown> | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// HELP CENTER & USER GUIDES
// ─────────────────────────────────────────────────────────────────────────

export interface HelpGuide {
  id: string;
  titleFr: string;
  titleEn: string;
  category: string;
  summaryFr: string;
  summaryEn: string;
  stepsFr: string[];
  stepsEn: string[];
  shortcut?: string;
  module: string;
}

// ─────────────────────────────────────────────────────────────────────────
// PRODUCT PROFITABILITY & MARGINS (Partie 23)
// ─────────────────────────────────────────────────────────────────────────

export interface ProductProfitability {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  currency: string;
  currentSellingPrice: number;
  lastPurchaseCost: number;
  weightedAverageCost: number; // PMP
  estimatedMargin: number;
  estimatedMarginRate: number; // Taux de marge = Marge / Coût * 100
  estimatedMarkupRate: number; // Taux de marque = Marge / Prix * 100
  historicalQuantitySold: number;
  historicalRevenue: number;
  historicalCostOfGoodsSold: number;
  historicalGrossMargin: number;
  historicalMarginRate: number;
  historicalMarkupRate: number;
  stockOnHand: number;
  alertUnderCost: boolean;
  alertLowMargin: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// SERVICES & PRESTATIONS (Partie 26)
// ─────────────────────────────────────────────────────────────────────────

export type ServiceOrderStatus =
  | 'DRAFT'
  | 'QUALIFIED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'BILLED'
  | 'CANCELLED';

export type ServicePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ServiceItemType = 'LABOR' | 'PART' | 'OTHER';

export interface ServiceOrderItem {
  id: string;
  tenantId: string;
  serviceOrderId: string;
  productId?: string | null;
  itemType: ServiceItemType;
  name: string;
  quantity: number | string;
  unitCost: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
  stockDeducted: boolean;
  stockMovementId?: string | null;
  createdAt: string;
}

export interface ServiceOrder {
  id: string;
  tenantId: string;
  locationId: string;
  referenceNumber: string;
  customerId?: string | null;
  assignedUserId?: string | null;
  title: string;
  description?: string | null;
  diagnosisNotes?: string | null;
  resolutionNotes?: string | null;
  status: ServiceOrderStatus;
  priority: ServicePriority;
  scheduledDate?: string | null;
  estimatedDurationMinutes?: number | null;
  actualDurationMinutes?: number | null;
  hourlyLaborRate?: number | string | null;
  laborCost: number | string;
  partsCost: number | string;
  otherCost: number | string;
  totalCost: number | string;
  quotedPrice: number | string;
  finalPrice: number | string;
  grossMargin: number | string;
  saleId?: string | null;
  invoiceId?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  items?: ServiceOrderItem[];
  customer?: { id: string; name: string; phone?: string | null } | null;
  location?: { id: string; name: string } | null;
  assignedUser?: { id: string; fullName: string; email: string } | null;
}

// ─────────────────────────────────────────────────────────────────────────
// RÉSERVATIONS / RENDEZ-VOUS (CAPABILITIES.RESERVATIONS)
// ─────────────────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface Appointment {
  id: string;
  tenantId: string;
  locationId: string;
  customerId?: string | null;
  assignedUserId?: string | null;
  title: string;
  description?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

