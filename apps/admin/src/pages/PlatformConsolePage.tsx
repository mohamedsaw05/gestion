import React, { useEffect, useState, useMemo } from 'react';
import {
  clearPlatformToken,
  loadPlatformToken,
  platformApi,
  platformLogin,
} from '../lib/api';

interface PlatformAdmin {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface PlatformStats {
  tenants: { total: number; active: number; suspended: number };
  subscriptions: { active: number; trialing: number; mrr: number; currency: string };
  invoices: { pending: number; paid: number };
}

interface TenantItem {
  id: string;
  name: string;
  legalName?: string;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  subscription: {
    id: string;
    status: string;
    planKey: string;
    planName: string;
    priceMonthly: number | string;
    currency: string;
    currentPeriodEnd: string;
    maxUsers: number;
    maxLocations: number;
    maxMonthlySales: number;
  } | null;
  usage: {
    activeUsers: number;
    locations: number;
    monthlySales: number;
  };
}

interface SaaSInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  amount: number | string;
  currency: string;
  status: 'PAID' | 'PENDING' | 'VOID';
  paymentMethod: string;
  paymentReference?: string;
  paidAt?: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface FestiveOffer {
  id: string;
  label: string;
  sub: string;
  color: string;
  textColor: string;
  isWinning: boolean;
  weight: number;
  maxQuota: number;
  awardedCount: number;
  enabled: boolean;
  rewardType: string;
}

interface FestiveClaim {
  id: string;
  date: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  offerId: string;
  offerLabel: string;
  rewardType: string;
  appliedToSubscription: boolean;
  notes?: string;
}

interface FestiveConfig {
  eventKey: string;
  eventTitle: string;
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
  timeZone?: string;
  maxSpinsPerUser: number;
  offers: FestiveOffer[];
  claims: FestiveClaim[];
}

export function PlatformConsolePage() {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'invoices' | 'commercial' | 'support' | 'festive_wheel' | 'errors_diagnostics' | 'danger_reset'>('overview');
  const [commercialSettings, setCommercialSettings] = useState<any>(null);
  const [tariffInput, setTariffInput] = useState('');
  const [tariffReason, setTariffReason] = useState('');
  const [supportHoursForm, setSupportHoursForm] = useState({ opensAt: '09:00', closesAt: '21:00', timeZone: 'Africa/Ouagadougou' });
  const [savingCommercial, setSavingCommercial] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [ticketReplies, setTicketReplies] = useState<Record<string, string>>({});
  const [moduleModalTenant, setModuleModalTenant] = useState<{ id: string; name: string } | null>(null);
  const [tenantModuleData, setTenantModuleData] = useState<any>(null);
  const [loadingTenantModules, setLoadingTenantModules] = useState(false);

  // Réinitialisation Opérationnelle d'UNE Organisation (Ciblée)
  const [resetModalTenant, setResetModalTenant] = useState<TenantItem | null>(null);
  const [resetPreview, setResetPreview] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [resetTenantPassword, setResetTenantPassword] = useState('');
  const [resetTenantPhrase, setResetTenantPhrase] = useState('');
  const [resetTenantConfirmedScope, setResetTenantConfirmedScope] = useState(false);
  const [resettingTenant, setResettingTenant] = useState(false);
  const [resetResultReport, setResetResultReport] = useState<any | null>(null);

  // Modification d'une Organisation
  const [editModalTenant, setEditModalTenant] = useState<TenantItem | null>(null);
  const [editTenantForm, setEditTenantForm] = useState({ name: '', legalName: '', phone: '', email: '', status: 'ACTIVE' });
  const [savingEditTenant, setSavingEditTenant] = useState(false);

  // Tab 5: Sélection ciblée d'organisation pour réinitialisation
  const [targetResetTenantId, setTargetResetTenantId] = useState<string>('');
  const [targetResetPreview, setTargetResetPreview] = useState<any | null>(null);
  const [loadingTargetPreview, setLoadingTargetPreview] = useState(false);
  const [targetResetPassword, setTargetResetPassword] = useState('');
  const [targetResetPhrase, setTargetResetPhrase] = useState('');
  const [targetResetConfirmedScope, setTargetResetConfirmedScope] = useState(false);
  const [resettingTargetTenant, setResettingTargetTenant] = useState(false);
  const [targetResetReport, setTargetResetReport] = useState<any | null>(null);

  // Diagnostics & Catalogue des Erreurs Plateforme
  const [diagnosticsData, setDiagnosticsData] = useState<any | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [errorCatalog, setErrorCatalog] = useState<any[]>([]);
  const [errorSearchQuery, setErrorSearchQuery] = useState('');
  const [errorDomainFilter, setErrorDomainFilter] = useState('ALL');
  const [errorSeverityFilter, setErrorSeverityFilter] = useState('ALL');

  // Réinitialisation Globale Plateforme (Environnement de démo exclusivement)
  const [showGlobalResetModal, setShowGlobalResetModal] = useState(false);
  const [globalResetPassword, setGlobalResetPassword] = useState('');
  const [globalResetPhrase, setGlobalResetPhrase] = useState('');
  const [resettingGlobal, setResettingGlobal] = useState(false);

  // État de la Roue et Offres Festives (Administration Centralisée)
  const [festiveConfig, setFestiveConfig] = useState<FestiveConfig | null>(null);
  const [festiveLoading, setFestiveLoading] = useState(false);
  const [savingFestive, setSavingFestive] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Platform data
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [invoices, setInvoices] = useState<SaaSInvoice[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!admin || activeTab !== 'commercial') return;
    void platformApi.get<any>('/platform/commercial').then((value) => {
      setCommercialSettings(value);
      setTariffInput(String(value.monthlyReferencePrice));
      setSupportHoursForm({ opensAt: value.support.opensAt, closesAt: value.support.closesAt, timeZone: value.support.timeZone });
    }).catch((error) => showToast(error?.message || 'Impossible de charger la configuration commerciale', 'error'));
  }, [admin, activeTab]);

  const saveTariff = async () => {
    setSavingCommercial(true);
    try {
      const value = await platformApi.put<any>('/platform/commercial/tariff', { monthlyPrice: Number(tariffInput), reason: tariffReason });
      setCommercialSettings(value);
      setTariffReason('');
      showToast('Tarif de référence enregistré. Les nouvelles offres sont recalculées.', 'success');
    } catch (error: any) { showToast(error?.message || 'Échec de la mise à jour du tarif', 'error'); }
    finally { setSavingCommercial(false); }
  };

  const saveSupportHours = async () => {
    setSavingCommercial(true);
    try {
      const value = await platformApi.put<any>('/platform/commercial/support-hours', supportHoursForm);
      setCommercialSettings(value);
      showToast('Horaires du service enregistrés.', 'success');
    } catch (error: any) { showToast(error?.message || 'Échec de la mise à jour des horaires', 'error'); }
    finally { setSavingCommercial(false); }
  };

  useEffect(() => {
    if (!admin || activeTab !== 'support') return;
    void platformApi.get<any[]>('/platform/support/tickets').then(setSupportTickets).catch((error) => showToast(error?.message || 'Impossible de charger les demandes', 'error'));
  }, [admin, activeTab, refreshTrigger]);

  const respondToTicket = async (id: string) => {
    const response = ticketReplies[id]?.trim();
    if (!response) return;
    try {
      const saved = await platformApi.put<any>(`/platform/support/tickets/${id}/reply`, { response });
      setSupportTickets((tickets) => tickets.map((ticket) => ticket.id === id ? saved : ticket));
      setTicketReplies((replies) => ({ ...replies, [id]: '' }));
      showToast('Réponse enregistrée et visible par le demandeur.', 'success');
    } catch (error: any) { showToast(error?.message || 'Échec de la réponse', 'error'); }
  };

  const loadTenantModules = async (tenantId: string) => {
    setLoadingTenantModules(true);
    try { setTenantModuleData(await platformApi.get<any>(`/platform/tenants/${tenantId}/modules`)); }
    catch (error: any) { showToast(error?.message || 'Impossible de charger les modules', 'error'); }
    finally { setLoadingTenantModules(false); }
  };

  const updateTenantModule = async (key: string, enabled: boolean) => {
    if (!moduleModalTenant) return;
    try {
      await platformApi.put(`/platform/tenants/${moduleModalTenant.id}/modules/${encodeURIComponent(key)}`, { enabled });
      await loadTenantModules(moduleModalTenant.id);
      showToast('État du module enregistré et journalisé.', 'success');
    } catch (error: any) { showToast(error?.message || 'Modification du module refusée', 'error'); }
  };

  // Search & filters
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<string>('ALL');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Modals & action state
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState({
    name: '',
    ownerEmail: '',
    ownerName: '',
    ownerPassword: '',
    planKey: 'TRIAL',
    businessType: 'BOUTIQUE',
    initialStoreName: '',
  });

  const [paymentModalInvoice, setPaymentModalInvoice] = useState<SaaSInvoice | null>(null);
  const [payForm, setPayForm] = useState({
    paymentMethod: 'MANUAL_TRANSFER',
    paymentReference: '',
    notes: '',
  });

  const [planModalTenant, setPlanModalTenant] = useState<{ id: string; name: string; currentPlan: string } | null>(null);
  const [selectedNewPlan, setSelectedNewPlan] = useState('STARTER');

  const [suspendModalTenant, setSuspendModalTenant] = useState<{ id: string; name: string } | null>(null);

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Verify auth on mount
  useEffect(() => {
    async function checkAuth() {
      const token = loadPlatformToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await platformApi.get<PlatformAdmin>('/platform/auth/me');
        setAdmin(me);
      } catch {
        clearPlatformToken();
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    }
    void checkAuth();
  }, []);

  // Load platform data once authenticated
  useEffect(() => {
    if (!admin) return;
    async function loadData() {
      try {
        const [statsData, tenantsData, invoicesData] = await Promise.all([
          platformApi.get<PlatformStats>('/platform/stats'),
          platformApi.get<TenantItem[]>('/platform/tenants'),
          platformApi.get<SaaSInvoice[]>('/platform/invoices'),
        ]);
        setStats(statsData);
        setTenants(tenantsData);
        setInvoices(invoicesData);
      } catch (err) {
        console.error('Failed to load platform data', err);
      }
    }
    void loadData();
  }, [admin, refreshTrigger]);

  const loadFestiveConfig = React.useCallback(async () => {
    setFestiveLoading(true);
    try {
      const cfg = await platformApi.get<FestiveConfig>('/platform/festive-wheel/config');
      setFestiveConfig(cfg);
    } catch (err: any) {
      showToast(err?.message || 'Erreur chargement roue festive', 'error');
    } finally {
      setFestiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin && (activeTab === 'festive_wheel' || !festiveConfig)) {
      void loadFestiveConfig();
    }
  }, [admin, activeTab, festiveConfig, loadFestiveConfig]);

  const handleSaveFestiveConfig = async (updatedConfig: FestiveConfig) => {
    setSavingFestive(true);
    try {
      const saved = await platformApi.put<FestiveConfig>('/platform/festive-wheel/config', updatedConfig);
      setFestiveConfig(saved);
      showToast('Quotas et configuration de la roue festive enregistrés avec succès', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la mise à jour', 'error');
    } finally {
      setSavingFestive(false);
    }
  };

  const handleResetSpins = async (email?: string) => {
    try {
      const res = await platformApi.post<{ success: boolean; message: string }>('/platform/festive-wheel/reset-spins', {
        userEmail: email,
      });
      showToast(res.message, 'success');
      void loadFestiveConfig();
      setResetEmail('');
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la réinitialisation des tours', 'error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const adminData = await platformLogin(loginEmail, loginPassword);
      setAdmin(adminData);
      showToast(`Bienvenue dans la console plateforme, ${adminData.fullName}.`, 'success');
    } catch (err: any) {
      setLoginError(err?.message || 'Identifiants superadmin invalides');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearPlatformToken();
    setAdmin(null);
  };

  const loadDiagnosticsAndErrors = React.useCallback(async () => {
    setLoadingDiagnostics(true);
    try {
      const [diag, errors] = await Promise.all([
        platformApi.get('/platform/diagnostics'),
        platformApi.get<any[]>('/platform/error-catalog'),
      ]);
      setDiagnosticsData(diag);
      setErrorCatalog(errors);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors du chargement des diagnostics', 'error');
    } finally {
      setLoadingDiagnostics(false);
    }
  }, []);

  useEffect(() => {
    if (admin && activeTab === 'errors_diagnostics') {
      void loadDiagnosticsAndErrors();
    }
  }, [admin, activeTab, loadDiagnosticsAndErrors]);

  const handleGlobalReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (globalResetPhrase.trim() !== 'REINITIALISER TOUTE LA PLATEFORME') {
      showToast('Phrase de confirmation invalide. Tapez exactement : REINITIALISER TOUTE LA PLATEFORME', 'error');
      return;
    }
    setResettingGlobal(true);
    try {
      const demoTenant = tenants.find(
        (t) =>
          t.name.toLowerCase().includes('demo') ||
          t.name.toLowerCase().includes('test') ||
          t.name.toLowerCase().includes('fixture'),
      );
      if (!demoTenant) {
        showToast(
          'VTM-PLATFORM-RESET-SCOPE-REQUIRED: Aucun tenant de démonstration trouvé. L\'effacement global non borné de tous les comptes est formellement interdit en production.',
          'error',
        );
        return;
      }
      const res = await platformApi.post<{ success: boolean; message: string }>('/platform/reset-all', {
        password: globalResetPassword,
        confirmationPhrase: globalResetPhrase.trim(),
        targetDemoTenantId: demoTenant.id,
      });
      showToast(res.message, 'success');
      setShowGlobalResetModal(false);
      setGlobalResetPassword('');
      setGlobalResetPhrase('');
      setRefreshTrigger((r) => r + 1);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la réinitialisation plateforme', 'error');
    } finally {
      setResettingGlobal(false);
    }
  };

  const handleOpenResetTenantModal = async (tenant: TenantItem) => {
    setResetModalTenant(tenant);
    setResetPreview(null);
    setResetTenantPassword('');
    setResetTenantPhrase('');
    setResetTenantConfirmedScope(false);
    setResetResultReport(null);
    setLoadingPreview(true);
    try {
      const preview = await platformApi.get(`/platform/tenants/${tenant.id}/reset-preview`);
      setResetPreview(preview);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors du chargement de l\'aperçu', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownloadBackup = (tenantId: string, tenantName: string) => {
    const token = loadPlatformToken();
    const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
    const url = `${API_URL}/platform/tenants/${tenantId}/backup`;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Échec du téléchargement (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        const bUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = bUrl;
        link.download = `vtm-backup-${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('Sauvegarde vérifiée téléchargée avec succès (.json).', 'success');
      })
      .catch((err) => showToast(err.message, 'error'));
  };

  const handleExecuteTenantReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalTenant) return;
    setResettingTenant(true);
    try {
      const res = await platformApi.post<{ success: boolean; message: string; report: any }>(
        `/platform/tenants/${resetModalTenant.id}/reset`,
        {
          password: resetTenantPassword,
          confirmationPhrase: resetTenantPhrase.trim(),
          backupConfirmed: resetTenantConfirmedScope,
        },
      );
      setResetResultReport(res);
      showToast(res.message, 'success');
      setRefreshTrigger((r) => r + 1);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la réinitialisation de l\'organisation', 'error');
    } finally {
      setResettingTenant(false);
    }
  };

  const handleSelectTargetResetTenant = async (tenantId: string) => {
    setTargetResetTenantId(tenantId);
    setTargetResetPreview(null);
    setTargetResetReport(null);
    setTargetResetPassword('');
    setTargetResetPhrase('');
    setTargetResetConfirmedScope(false);
    if (!tenantId) return;
    setLoadingTargetPreview(true);
    try {
      const preview = await platformApi.get(`/platform/tenants/${tenantId}/reset-preview`);
      setTargetResetPreview(preview);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors du calcul de l\'aperçu', 'error');
    } finally {
      setLoadingTargetPreview(false);
    }
  };

  const handleExecuteTargetReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetResetTenantId) return;
    const targetTenant = tenants.find((t) => t.id === targetResetTenantId);
    if (!targetTenant) return;

    const phraseClean = targetResetPhrase.trim().toUpperCase();
    const nameClean = targetTenant.name.trim().toUpperCase();
    const isPhraseValid =
      phraseClean === `CONFIRMER REINITIALISATION ${nameClean}` ||
      phraseClean === `REINITIALISER ${nameClean}` ||
      phraseClean === nameClean;

    if (!isPhraseValid) {
      showToast(`Phrase invalide. Tapez « CONFIRMER REINITIALISATION ${targetTenant.name} » ou « ${targetTenant.name} ».`, 'error');
      return;
    }

    setResettingTargetTenant(true);
    try {
      const res = await platformApi.post<{ success: boolean; message: string; report: any }>(
        `/platform/tenants/${targetResetTenantId}/reset`,
        {
          password: targetResetPassword,
          confirmationPhrase: targetResetPhrase.trim(),
          backupConfirmed: targetResetConfirmedScope,
        },
      );
      setTargetResetReport(res);
      showToast(res.message, 'success');
      setRefreshTrigger((r) => r + 1);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la réinitialisation de l\'organisation', 'error');
    } finally {
      setResettingTargetTenant(false);
    }
  };

  const handleOpenEditTenantModal = (t: TenantItem) => {
    setEditModalTenant(t);
    setEditTenantForm({
      name: t.name,
      legalName: t.legalName || t.name,
      phone: t.phone || '',
      email: t.email || '',
      status: t.status,
    });
  };

  const handleSaveEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalTenant) return;
    setSavingEditTenant(true);
    try {
      await platformApi.patch(`/platform/tenants/${editModalTenant.id}`, editTenantForm);
      showToast(`Organisation « ${editTenantForm.name} » mise à jour avec succès.`, 'success');
      setEditModalTenant(null);
      setRefreshTrigger((r) => r + 1);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la mise à jour de l\'organisation', 'error');
    } finally {
      setSavingEditTenant(false);
    }
  };

  const handleExportErrorCatalogCsv = () => {
    if (!errorCatalog.length) return;
    const headers = ['Code', 'Domaine', 'Severite', 'Message FR', 'Message EN', 'Explication Technique', 'Action Diagnostic', 'Solution Recommandee', 'Ref Doc'];
    const rows = errorCatalog.map((e) => [
      `"${e.code}"`,
      `"${e.domain}"`,
      `"${e.severity}"`,
      `"${(e.messageFr || '').replace(/"/g, '""')}"`,
      `"${(e.messageEn || '').replace(/"/g, '""')}"`,
      `"${(e.technicalExplanation || e.diagnostic || '').replace(/"/g, '""')}"`,
      `"${(e.diagnosticAction || '').replace(/"/g, '""')}"`,
      `"${(e.recommendedSolution || e.resolutionFr || '').replace(/"/g, '""')}"`,
      `"${(e.docReference || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vtm-error-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Catalogue des codes d\'erreurs exporté en CSV.', 'success');
  };

  const handleExportErrorCatalogJson = () => {
    if (!errorCatalog.length) return;
    const blob = new Blob([JSON.stringify(errorCatalog, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vtm-error-catalog-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Catalogue des codes d\'erreurs exporté en JSON.', 'success');
  };

  const confirmSuspendTenant = async () => {
    if (!suspendModalTenant) return;
    try {
      await platformApi.post(`/platform/tenants/${suspendModalTenant.id}/suspend`, { reason: 'Action manuelle éditeur' });
      showToast(`Organisation « ${suspendModalTenant.name} » suspendue.`, 'warning');
      setSuspendModalTenant(null);
      setRefreshTrigger((r) => r + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la suspension', 'error');
    }
  };

  const handleReactivateTenant = async (tenantId: string, tenantName: string) => {
    try {
      await platformApi.post(`/platform/tenants/${tenantId}/reactivate`);
      showToast(`Organisation « ${tenantName} » réactivée avec succès.`, 'success');
      setRefreshTrigger((r) => r + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur de réactivation', 'error');
    }
  };

  const confirmChangePlan = async () => {
    if (!planModalTenant) return;
    try {
      await platformApi.post(`/platform/subscriptions/${planModalTenant.id}/change-plan`, {
        planKey: selectedNewPlan.toUpperCase().trim(),
      });
      showToast(`Forfait de « ${planModalTenant.name} » modifié vers ${selectedNewPlan}.`, 'success');
      setPlanModalTenant(null);
      setRefreshTrigger((r) => r + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors du changement de plan', 'error');
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisioning(true);
    try {
      await platformApi.post('/platform/tenants', newTenantForm);
      setShowProvisionModal(false);
      showToast(`Client « ${newTenantForm.name} » provisionné et activé avec succès !`, 'success');
      setNewTenantForm({
        name: '',
        ownerEmail: '',
        ownerName: '',
        ownerPassword: '',
        planKey: 'TRIAL',
        businessType: 'BOUTIQUE',
        initialStoreName: '',
      });
      setRefreshTrigger((r) => r + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors du provisionnement', 'error');
    } finally {
      setProvisioning(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;
    try {
      await platformApi.post(`/platform/invoices/${paymentModalInvoice.id}/pay`, payForm);
      showToast(`Facture ${paymentModalInvoice.invoiceNumber} marquée comme réglée.`, 'success');
      setPaymentModalInvoice(null);
      setRefreshTrigger((r) => r + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur enregistrement paiement', 'error');
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (tenantStatusFilter !== 'ALL' && t.status !== tenantStatusFilter) return false;
      const q = tenantSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.subscription?.planName ?? '').toLowerCase().includes(q)
      );
    });
  }, [tenants, tenantStatusFilter, tenantSearch]);

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.toLowerCase().trim();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.tenantId.toLowerCase().includes(q) ||
        inv.paymentMethod.toLowerCase().includes(q),
    );
  }, [invoices, invoiceSearch]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
        Chargement de la console plateforme...
      </div>
    );
  }

  // ── 1. Écran de Connexion Superadmin ──
  if (!admin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e101f', padding: '1rem' }}>
        <div style={{ background: '#181b34', border: '1px solid #2a2f5a', borderRadius: 12, padding: '2.5rem', width: '100%', maxWidth: 420, color: '#fff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#818cf8', marginBottom: '0.5rem' }}>
              Plateforme SaaS Universelle
            </div>
            <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.5rem', color: '#fff' }}>Superadmin Console</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              Accès réservé aux administrateurs éditeur pour la gestion des tenants et de la facturation.
            </p>
          </div>

          {loginError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Email Superadmin
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Adresse e-mail Super Admin"
                style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0f1225', border: '1px solid #333b6f', borderRadius: 6, color: '#fff', fontSize: '0.9rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Mot de passe
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0f1225', border: '1px solid #333b6f', borderRadius: 6, color: '#fff', fontSize: '0.9rem' }}
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {loggingIn ? 'Authentification...' : 'Se connecter à la plateforme'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── 2. Dashboard Console Propriétaire ──
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: 8,
              fontSize: '0.88rem',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              background: t.type === 'success' ? '#16a34a' : t.type === 'error' ? '#dc2626' : '#2563eb',
              color: '#fff',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Top Header */}
      <header
        style={{
          background: '#0f172a',
          color: '#fff',
          padding: '0.85rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span
            style={{
              fontSize: '0.7rem',
              background: '#4f46e5',
              color: '#fff',
              padding: '0.2rem 0.5rem',
              borderRadius: 4,
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            {admin.role}
          </span>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
            Console Éditeur SaaS Universel
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem' }}>
          <span style={{ color: '#94a3b8' }}>{admin.email}</span>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.35rem 0.75rem',
              background: '#334155',
              border: 'none',
              color: '#fff',
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1240, margin: '2rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* Navigation tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              background: activeTab === 'overview' ? '#4f46e5' : 'transparent',
              color: activeTab === 'overview' ? '#fff' : '#64748b',
            }}
          >
            Indicateurs & Synthèse
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              background: activeTab === 'tenants' ? '#4f46e5' : 'transparent',
              color: activeTab === 'tenants' ? '#fff' : '#64748b',
            }}
          >
            Organisations Clientes ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              background: activeTab === 'invoices' ? '#4f46e5' : 'transparent',
              color: activeTab === 'invoices' ? '#fff' : '#64748b',
            }}
          >
            Facturation SaaS & Envois ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('commercial')}
            style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', background: activeTab === 'commercial' ? '#4f46e5' : 'transparent', color: activeTab === 'commercial' ? '#fff' : '#64748b' }}
          >
            Configuration commerciale
          </button>
          <button
            onClick={() => setActiveTab('support')}
            style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', background: activeTab === 'support' ? '#0f766e' : 'transparent', color: activeTab === 'support' ? '#fff' : '#64748b' }}
          >
            Assistance ({supportTickets.filter((ticket) => ticket.status !== 'ANSWERED').length})
          </button>
          <button
            onClick={() => setActiveTab('festive_wheel')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              background: activeTab === 'festive_wheel' ? '#dc2626' : 'transparent',
              color: activeTab === 'festive_wheel' ? '#fff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🎰</span>
            <span>Roue & Offres Festives (Quotas & Cadeaux)</span>
            {festiveConfig && festiveConfig.claims.length > 0 && (
              <span
                style={{
                  background: activeTab === 'festive_wheel' ? '#ffffff' : '#fee2e2',
                  color: '#dc2626',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 999,
                }}
              >
                {festiveConfig.claims.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('errors_diagnostics')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              background: activeTab === 'errors_diagnostics' ? '#0284c7' : 'transparent',
              color: activeTab === 'errors_diagnostics' ? '#fff' : '#0369a1',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🩺</span>
            <span>Codes d'Erreurs & Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('danger_reset')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              background: activeTab === 'danger_reset' ? '#b91c1c' : 'transparent',
              color: activeTab === 'danger_reset' ? '#fff' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginLeft: 'auto',
            }}
          >
            <span>⚠️</span>
            <span>Reset Plateforme (Démo uniquement)</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & KPIS */}
        {activeTab === 'overview' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  REVENU RÉCURRENT MENSUEL (MRR)
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4f46e5', marginTop: '0.35rem' }}>
                  {stats.subscriptions.mrr.toLocaleString('fr-FR')} {stats.subscriptions.currency}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {stats.subscriptions.active} abonnements actifs payants
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  ORGANISATIONS CLIENTES
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                  {stats.tenants.total}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '0.2rem' }}>
                  {stats.tenants.active} actives ({stats.tenants.suspended} suspendues)
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  PÉRIODES D'ESSAI EN COURS
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: '0.35rem' }}>
                  {stats.subscriptions.trialing}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Prospects en phase de conversion
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  FACTURES SAAS EN ATTENTE
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: stats.invoices.pending > 0 ? '#dc2626' : '#16a34a', marginTop: '0.35rem' }}>
                  {stats.invoices.pending}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {stats.invoices.paid} réglées à ce jour
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem' }}>Actions d'Administration Rapides</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
                Opérations directes de supervision de la plateforme SaaS.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowProvisionModal(true)}
                  style={{
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  + Provisionner un nouveau client SaaS
                </button>
                <button
                  onClick={() => setActiveTab('tenants')}
                  style={{
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Voir les organisations ({tenants.length})
                </button>
                <button
                  onClick={() => setActiveTab('invoices')}
                  style={{
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Consulter les factures ({invoices.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TENANTS */}
        {activeTab === 'commercial' && (
          <section style={{ display: 'grid', gap: '1.25rem' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem' }}>
              <h2 style={{ marginTop: 0 }}>Tarification des abonnements</h2>
              <p style={{ color: '#64748b' }}>Le tarif mensuel de référence est stocké dans la configuration centrale. Les offres client sont calculées exclusivement sur 3, 6, 12 ou 24 mois.</p>
              <label style={{ display: 'grid', gap: 6, maxWidth: 340, fontWeight: 700 }}>Prix mensuel de référence (FCFA)
                <input type="number" min="1" step="1" value={tariffInput} onChange={(event) => setTariffInput(event.target.value)} style={{ padding: 10, border: '1px solid #cbd5e1', borderRadius: 7 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, maxWidth: 500, marginTop: 12, fontWeight: 700 }}>Motif du changement (facultatif)
                <input value={tariffReason} onChange={(event) => setTariffReason(event.target.value)} maxLength={500} style={{ padding: 10, border: '1px solid #cbd5e1', borderRadius: 7 }} />
              </label>
              <button disabled={savingCommercial} onClick={() => void saveTariff()} style={{ marginTop: 12, padding: '10px 16px', border: 0, borderRadius: 7, background: '#4f46e5', color: '#fff', fontWeight: 700 }}>Enregistrer le tarif</button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginTop: 18 }}>
                {(commercialSettings?.plans ?? [3, 6, 12, 24].map((months: number) => ({ months, label: `${months} mois`, totalPrice: Number(tariffInput || 0) * months }))).map((plan: any) => (
                  <div key={plan.months} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8 }}><strong>{plan.label}</strong><div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{Number(plan.totalPrice).toLocaleString('fr-FR')} FCFA</div></div>
                ))}
              </div>
              <div style={{ marginTop: 14, color: '#475569', fontSize: 13 }}>Historique tarifaire</div>
              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                {(commercialSettings?.history ?? []).slice().reverse().map((entry: any, index: number) => <div key={`${entry.changedAt}-${index}`} style={{ fontSize: 13, color: '#475569' }}>{new Date(entry.changedAt).toLocaleString('fr-FR')} · {Number(entry.previousMonthlyPrice).toLocaleString('fr-FR')} → {Number(entry.monthlyPrice).toLocaleString('fr-FR')} FCFA · {entry.actorEmail}{entry.reason ? ` · ${entry.reason}` : ''}</div>)}
                {commercialSettings?.history?.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8' }}>Aucun changement enregistré.</div>}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem' }}>
              <h2 style={{ marginTop: 0 }}>Disponibilité de l’assistance</h2>
              <p style={{ color: '#64748b' }}>Les jours sont fixés du lundi au dimanche. Le fuseau horaire est validé côté serveur.</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label>Ouverture <input type="time" value={supportHoursForm.opensAt} onChange={(event) => setSupportHoursForm({ ...supportHoursForm, opensAt: event.target.value })} /></label>
                <label>Fermeture <input type="time" value={supportHoursForm.closesAt} onChange={(event) => setSupportHoursForm({ ...supportHoursForm, closesAt: event.target.value })} /></label>
                <label>Fuseau horaire <input value={supportHoursForm.timeZone} onChange={(event) => setSupportHoursForm({ ...supportHoursForm, timeZone: event.target.value })} /></label>
              </div>
              <div style={{ marginTop: 8, color: '#475569' }}>Lundi au dimanche · {supportHoursForm.opensAt}–{supportHoursForm.closesAt} · {supportHoursForm.timeZone}</div>
              <button disabled={savingCommercial} onClick={() => void saveSupportHours()} style={{ marginTop: 12, padding: '10px 16px', border: 0, borderRadius: 7, background: '#0f766e', color: '#fff', fontWeight: 700 }}>Enregistrer les horaires</button>
            </div>
          </section>
        )}

        {activeTab === 'support' && (
          <section style={{ display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Demandes d’assistance</h2>
            {supportTickets.length === 0 && <div style={{ padding: 24, background: '#fff', borderRadius: 10 }}>Aucune demande enregistrée.</div>}
            {supportTickets.map((ticket) => <article key={ticket.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>{ticket.subject}</strong><span>{ticket.status} · {new Date(ticket.createdAt).toLocaleString('fr-FR')}</span></div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.message}</p>
              <small>Organisation {ticket.tenantId} · Utilisateur {ticket.userId}</small>
              {ticket.supportResponse && <div style={{ margin: '12px 0', padding: 12, background: '#f0fdfa', borderRadius: 8 }}><strong>Réponse {ticket.respondedBy ? `de ${ticket.respondedBy}` : ''}</strong><p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{ticket.supportResponse}</p></div>}
              <textarea aria-label="Réponse d’assistance" value={ticketReplies[ticket.id] ?? ''} onChange={(event) => setTicketReplies({ ...ticketReplies, [ticket.id]: event.target.value })} rows={3} style={{ width: '100%', boxSizing: 'border-box', marginTop: 10 }} placeholder="Réponse visible par l’auteur du ticket" />
              <button onClick={() => void respondToTicket(ticket.id)} style={{ marginTop: 8, padding: '8px 12px', border: 0, borderRadius: 6, background: '#0f766e', color: '#fff', fontWeight: 700 }}>Enregistrer la réponse</button>
            </article>)}
          </section>
        )}

        {activeTab === 'tenants' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>Organisations clientes (Tenants)</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Supervision des espaces, application des quotas et actions de suspension / réactivation.
                </p>
              </div>
              <button
                onClick={() => setShowProvisionModal(true)}
                style={{
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  padding: '0.6rem 1.1rem',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                + Provisionner un client
              </button>
            </div>

            {/* Filter toolbar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="search"
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Rechercher par nom d'entreprise ou UUID..."
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  width: '320px',
                }}
              />
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => setTenantStatusFilter('ALL')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: tenantStatusFilter === 'ALL' ? '#0f172a' : '#fff',
                    color: tenantStatusFilter === 'ALL' ? '#fff' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Tous ({tenants.length})
                </button>
                <button
                  onClick={() => setTenantStatusFilter('ACTIVE')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: tenantStatusFilter === 'ACTIVE' ? '#16a34a' : '#fff',
                    color: tenantStatusFilter === 'ACTIVE' ? '#fff' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Actifs ({tenants.filter((t) => t.status === 'ACTIVE').length})
                </button>
                <button
                  onClick={() => setTenantStatusFilter('SUSPENDED')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: tenantStatusFilter === 'SUSPENDED' ? '#dc2626' : '#fff',
                    color: tenantStatusFilter === 'SUSPENDED' ? '#fff' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Suspendus ({tenants.filter((t) => t.status === 'SUSPENDED').length})
                </button>
              </div>
            </div>

            {filteredTenants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                Aucune organisation trouvée.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Commerce</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Statut</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Forfait</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Membres</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Boutiques</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Ventes/Mois</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((t) => {
                    const sub = t.subscription;
                    const isSuspended = t.status === 'SUSPENDED';
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '8px',
                                background: t.logoUrl ? '#ffffff' : 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                flexShrink: 0,
                                padding: t.logoUrl ? '2px' : 0,
                              }}
                            >
                              {t.logoUrl ? (
                                <img src={t.logoUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.9rem' }}>
                                  {t.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{t.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                UUID: {t.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: 6,
                              background: isSuspended ? '#fee2e2' : '#dcfce7',
                              color: isSuspended ? '#b91c1c' : '#15803d',
                            }}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <strong>{sub?.planName ?? 'Aucun'}</strong>
                          {sub && Number(sub.priceMonthly) > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {Number(sub.priceMonthly).toLocaleString('fr-FR')} {sub.currency}/m
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          {t.usage.activeUsers} / {sub?.maxUsers ?? '-'}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          {t.usage.locations} / {sub?.maxLocations ?? '-'}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          {t.usage.monthlySales} / {sub?.maxMonthlySales ? sub.maxMonthlySales : '∞'}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenResetTenantModal(t)}
                              style={{
                                padding: '0.35rem 0.7rem',
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #f87171',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              title="Remise à zéro complète des données opérationnelles de cette organisation"
                            >
                              🔄 Réinitialiser
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditTenantModal(t)}
                              style={{
                                padding: '0.35rem 0.7rem',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              title="Modifier les coordonnées et statut de l'organisation"
                            >
                              ✏️ Modifier
                            </button>
                            <button type="button" onClick={() => { setModuleModalTenant({ id: t.id, name: t.name }); setTenantModuleData(null); void loadTenantModules(t.id); }} style={{ padding: '0.35rem 0.7rem', background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                              Modules
                            </button>
                            <button
                              onClick={() => {
                                setPlanModalTenant({ id: t.id, name: t.name, currentPlan: sub?.planKey ?? 'TRIAL' });
                                setSelectedNewPlan(sub?.planKey ?? 'STARTER');
                              }}
                              style={{
                                padding: '0.35rem 0.7rem',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              Changer plan
                            </button>
                            {isSuspended ? (
                              <button
                                onClick={() => handleReactivateTenant(t.id, t.name)}
                                style={{
                                  padding: '0.35rem 0.7rem',
                                  background: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Réactiver
                              </button>
                            ) : (
                              <button
                                onClick={() => setSuspendModalTenant({ id: t.id, name: t.name })}
                                style={{
                                  padding: '0.35rem 0.7rem',
                                  background: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Suspendre
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: INVOICES */}
        {activeTab === 'invoices' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>Factures d'abonnement SaaS & Rapprochement</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Suivi des encaissements périodiques perçus auprès des commerces clients.
                </p>
              </div>
              <input
                type="search"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Rechercher par n° facture ou moyen..."
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  width: '280px',
                }}
              />
            </div>

            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                Aucune facture trouvée.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>N° Facture</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Organisation</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Montant</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Statut</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Période</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Moyen / Réf</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const tenant = tenants.find((t) => t.id === inv.tenantId);
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontFamily: 'monospace' }}>
                          {inv.invoiceNumber}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: 600 }}>{tenant?.name ?? 'Client'}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {inv.tenantId.slice(0, 8)}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <strong>{Number(inv.amount).toLocaleString('fr-FR')} {inv.currency}</strong>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: inv.status === 'PAID' ? '#dcfce7' : '#fef3c7',
                              color: inv.status === 'PAID' ? '#15803d' : '#b45309',
                            }}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>
                          {new Date(inv.periodStart).toLocaleDateString('fr-FR')} au {new Date(inv.periodEnd).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>
                          {inv.paymentMethod} {inv.paymentReference ? `(${inv.paymentReference})` : ''}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                          {inv.status === 'PENDING' && (
                            <button
                              onClick={() => {
                                setPaymentModalInvoice(inv);
                                setPayForm({ paymentMethod: 'MANUAL_TRANSFER', paymentReference: '', notes: '' });
                              }}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Encaisser
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 4: ROUE & OFFRES FESTIVES (QUOTAS & CADEAUX ADMIN) */}
        {activeTab === 'festive_wheel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Bannière Règle de Séparation Stricte & Discrétion Absolue */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
                borderRadius: 12,
                padding: '1.5rem',
                color: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                border: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ maxWidth: 800 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🎰</span>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#f8fafc' }}>
                    Quotas & Cadeaux Festifs de la Plateforme (Espace Superadmin)
                  </h2>
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  <strong>État de l'événement : {festiveConfig?.enabled ? 'activé manuellement' : 'désactivé'}.</strong> Les dates encadrent la période, mais seul le bouton d'activation manuel permet la distribution. Les réglages sont conservés dans PostgreSQL. <strong>Règle de séparation :</strong> Le gestionnaire client est le produit. Le client n’a
                  jamais accès aux quotas, aux codes, ni à la configuration de la plateforme. Les gains sont appliqués
                  automatiquement aux abonnements (+30 jours gratuits) sans nécessiter de code promo.
                  Lorsqu'un quota est atteint (ex: 5 personnes max pour 1 mois gratuit), l'algorithme backend lui
                  attribue un poids de 0 tout en laissant le segment affiché sur la roue des clients (règle <em>« Nul n'est informé »</em>).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {festiveConfig && (
                  <button
                    type="button"
                    disabled={savingFestive || (!festiveConfig.enabled && (!festiveConfig.startsAt || !festiveConfig.endsAt))}
                    onClick={() => handleSaveFestiveConfig({ ...festiveConfig, enabled: !festiveConfig.enabled })}
                    style={{ padding: '0.65rem 1rem', background: festiveConfig.enabled ? '#b91c1c' : '#15803d', color: '#fff', border: 0, borderRadius: 6, fontWeight: 800, cursor: 'pointer' }}
                  >
                    {festiveConfig.enabled ? "Désactiver l'événement" : "Activer l'événement"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => loadFestiveConfig()}
                  disabled={festiveLoading}
                  style={{
                    padding: '0.65rem 1rem',
                    background: '#334155',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {festiveLoading ? '⏳ Synchronisation...' : '🔄 Actualiser'}
                </button>
              </div>
            </div>

            {festiveConfig && (
              <>
                {/* 1. Configuration Générale de la Campagne */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#0f172a' }}>
                    1. Paramètres de l'Événement & Tours Autorisés
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Début de la période :</label>
                      <input type="datetime-local" value={festiveConfig.startsAt || ''} onChange={(e) => setFestiveConfig({ ...festiveConfig, startsAt: e.target.value })} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Fin de la période :</label>
                      <input type="datetime-local" value={festiveConfig.endsAt || ''} onChange={(e) => setFestiveConfig({ ...festiveConfig, endsAt: e.target.value })} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                        Titre de l'événement festif affiché :
                      </label>
                      <input
                        type="text"
                        value={festiveConfig.eventTitle}
                        onChange={(e) => setFestiveConfig({ ...festiveConfig, eventTitle: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                        Nombre de tours autorisés par client / utilisateur :
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={festiveConfig.maxSpinsPerUser}
                        onChange={(e) =>
                          setFestiveConfig({
                            ...festiveConfig,
                            maxSpinsPerUser: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem', fontWeight: 700 }}
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleSaveFestiveConfig(festiveConfig)}
                        disabled={savingFestive}
                        style={{
                          width: '100%',
                          padding: '0.65rem 1rem',
                          background: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {savingFestive ? 'Enregistrement...' : '💾 Sauvegarder les Paramètres'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Quotas Stricts & Algorithme Secret de Tirage */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                        2. Plafonds Stricts par Lot (Quotas Admin)
                      </h3>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                        Définissez combien de personnes max peuvent remporter chaque offre (ex: 5 personnes max pour 1 mois gratuit).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveFestiveConfig(festiveConfig)}
                      disabled={savingFestive}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {savingFestive ? 'Sauvegarde...' : '💾 Valider les Quotas'}
                    </button>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Offre / Cadeau</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Type de Gain</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Quota Max</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Gagnants Attribués</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Poids (Probabilité)</th>
                          <th style={{ padding: '0.75rem 1rem' }}>État Backend</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {festiveConfig.offers.map((off, idx) => {
                          const isFull = off.isWinning && off.awardedCount >= off.maxQuota;
                          return (
                            <tr
                              key={off.id}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: isFull ? '#fff7ed' : '#ffffff',
                              }}
                            >
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 800, color: off.color }}>{off.label}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{off.sub}</div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    background: '#f1f5f9',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: '#334155',
                                  }}
                                >
                                  {off.rewardType}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {off.isWinning ? (
                                  <input
                                    type="number"
                                    min="1"
                                    max="9999"
                                    value={off.maxQuota}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                      const updatedOffers = [...festiveConfig.offers];
                                      updatedOffers[idx] = { ...updatedOffers[idx], maxQuota: val };
                                      setFestiveConfig({ ...festiveConfig, offers: updatedOffers });
                                    }}
                                    style={{
                                      width: '75px',
                                      padding: '0.35rem 0.5rem',
                                      fontSize: '0.85rem',
                                      borderRadius: 4,
                                      border: '1px solid #cbd5e1',
                                      fontWeight: 700,
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>Illimité</span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    fontWeight: 800,
                                    fontSize: '1rem',
                                    color: isFull ? '#c2410c' : '#15803d',
                                  }}
                                >
                                  {off.awardedCount}
                                </span>
                                {off.isWinning && (
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}> / {off.maxQuota}</span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={off.weight}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    const updatedOffers = [...festiveConfig.offers];
                                    updatedOffers[idx] = { ...updatedOffers[idx], weight: val };
                                    setFestiveConfig({ ...festiveConfig, offers: updatedOffers });
                                  }}
                                  style={{
                                    width: '65px',
                                    padding: '0.35rem 0.5rem',
                                    fontSize: '0.85rem',
                                    borderRadius: 4,
                                    border: '1px solid #cbd5e1',
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {isFull ? (
                                  <span
                                    style={{
                                      background: '#ffedd5',
                                      color: '#c2410c',
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    🔒 Plafond Atteint (Poids 0 secret)
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      background: '#dcfce7',
                                      color: '#15803d',
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                    }}
                                  >
                                    ✨ Actif & Disponible
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                {off.awardedCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedOffers = [...festiveConfig.offers];
                                      updatedOffers[idx] = { ...updatedOffers[idx], awardedCount: 0 };
                                      const updated = { ...festiveConfig, offers: updatedOffers };
                                      setFestiveConfig(updated);
                                      handleSaveFestiveConfig(updated);
                                    }}
                                    style={{
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      border: 'none',
                                      borderRadius: 4,
                                      padding: '4px 8px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Remettre à 0
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Outil de Réinitialisation des Tours */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#0f172a' }}>
                    3. Déblocage & Réinitialisation des Tours de Jeu
                  </h3>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#64748b' }}>
                    Permet à l'administrateur de réinitialiser le nombre d'essais d'un utilisateur de test ou de tous les utilisateurs.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="email"
                      placeholder="Email de l'utilisateur (laisser vide pour TOUT réinitialiser)"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      style={{ padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.88rem', minWidth: 320 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleResetSpins(resetEmail.trim() || undefined)}
                      style={{
                        padding: '0.6rem 1rem',
                        background: resetEmail.trim() ? '#4f46e5' : '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {resetEmail.trim() ? `🔄 Réinitialiser pour ${resetEmail}` : '⚠️ Réinitialiser pour TOUS les utilisateurs'}
                    </button>
                  </div>
                </div>

                {/* 4. Journal en Direct des Gains & Réclamations */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                        4. Historique Centralisé des Gains & Application Automatique ({festiveConfig.claims.length})
                      </h3>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                        Traçabilité complète de chaque lot attribué avec l'organisation et le statut comptable.
                      </p>
                    </div>
                  </div>

                  {festiveConfig.claims.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>
                      Aucun gain attribué pour le moment. Dès qu'un client tourne la roue, son gain sera répertorié ici en direct.
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Date & Heure</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Organisation / Client</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Utilisateur Gagnant</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Lot Remporté</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Application Système</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Détails / Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {festiveConfig.claims.map((claim) => (
                            <tr key={claim.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                {claim.date}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{claim.tenantName}</div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                  {claim.tenantId.slice(0, 8)}...
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#334155' }}>
                                {claim.userEmail}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span style={{ fontWeight: 800, color: '#15803d' }}>
                                  {claim.offerLabel}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    background: claim.appliedToSubscription ? '#dcfce7' : '#fef3c7',
                                    color: claim.appliedToSubscription ? '#15803d' : '#b45309',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  {claim.appliedToSubscription ? '✅ Appliqué (+30j auto)' : '⏳ À valider'}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#64748b' }}>
                                {claim.notes || 'Facture cadeau à 0 XOF générée automatiquement'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: CODES D'ERREURS & DIAGNOSTICS SYSTÈME */}
        {activeTab === 'errors_diagnostics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* 1. Diagnostics Système & Santé des Services */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🩺</span>
                    <span>Santé & Diagnostics Système Plateforme</span>
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Surveillance en temps réel des couches d'infrastructure, de la base de données et des paramètres régionaux.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadDiagnosticsAndErrors()}
                  disabled={loadingDiagnostics}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>🔄</span>
                  <span>{loadingDiagnostics ? 'Actualisation...' : 'Actualiser les diagnostics'}</span>
                </button>
              </div>

              {diagnosticsData ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Base de Données
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: diagnosticsData.database?.status === 'CONNECTED' ? '#16a34a' : '#dc2626',
                        }}
                      />
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                        {diagnosticsData.database?.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Latence : <strong>{diagnosticsData.database?.latencyMs} ms</strong>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Mémoire Processus
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                      {diagnosticsData.memory?.rssMb} MB <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>RSS</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Heap Utilisé : <strong>{diagnosticsData.memory?.heapUsedMb} MB</strong> / {diagnosticsData.memory?.heapTotalMb} MB
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Environnement & Uptime
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                      Node {diagnosticsData.nodeVersion}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Uptime : <strong>{Math.round(diagnosticsData.uptimeSeconds / 60)} minutes</strong> ({diagnosticsData.platform})
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Périmètre Régional & Métier
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4f46e5', marginTop: '0.35rem' }}>
                      {diagnosticsData.operationalScope?.regionalDefaults?.currency} (Burkina Faso)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Fuseau : {diagnosticsData.operationalScope?.regionalDefaults?.timezone} • {diagnosticsData.operationalScope?.allowedModules?.length} modules
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                  Chargement des indicateurs de diagnostics...
                </div>
              )}
            </div>

            {/* 2. Catalogue Normatif des Codes d'Erreurs VTM */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📖</span>
                    <span>Catalogue Standardisé des Codes d'Erreurs SaaS (VTM)</span>
                    <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                      {errorCatalog.length} codes normés
                    </span>
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Référentiel unifié des codes diagnostics affichés aux utilisateurs et exploitables par le support technique.
                  </p>
                </div>

                {/* Filtres & Exports */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Rechercher code, titre ou solution..."
                    value={errorSearchQuery}
                    onChange={(e) => setErrorSearchQuery(e.target.value)}
                    style={{
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.85rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      minWidth: 260,
                    }}
                  />
                  <select
                    value={errorDomainFilter}
                    onChange={(e) => setErrorDomainFilter(e.target.value)}
                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    <option value="ALL">Tous les domaines</option>
                    <option value="AUTH">AUTH (Authentification)</option>
                    <option value="SEC">SEC (Sécurité)</option>
                    <option value="STOCK">STOCK (Gestion des Stocks)</option>
                    <option value="SALE">SALE (Ventes & Encaissements)</option>
                    <option value="CASH">CASH (Caisse & Sessions)</option>
                    <option value="CREDIT">CREDIT (Créances & Dettes)</option>
                    <option value="PRINT">PRINT (Impression & Reçus)</option>
                    <option value="PLATFORM">PLATFORM (Plateforme & Reset)</option>
                  </select>
                  <select
                    value={errorSeverityFilter}
                    onChange={(e) => setErrorSeverityFilter(e.target.value)}
                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    <option value="ALL">Toutes sévérités</option>
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleExportErrorCatalogCsv}
                    style={{
                      padding: '0.45rem 0.85rem',
                      background: '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                    title="Exporter tous les codes d'erreurs au format CSV"
                  >
                    <span>📥</span>
                    <span>Exporter CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportErrorCatalogJson}
                    style={{
                      padding: '0.45rem 0.85rem',
                      background: '#4f46e5',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                    title="Exporter tous les codes d'erreurs au format JSON"
                  >
                    <span>📥</span>
                    <span>Exporter JSON</span>
                  </button>
                </div>
              </div>

              {/* Tableau des Codes d'Erreurs */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Code</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Domaine</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Sévérité</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Message Utilisateur (FR)</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Diagnostic Technique</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Résolution Recommandée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorCatalog
                      .filter((err) => {
                        if (errorDomainFilter !== 'ALL' && err.domain !== errorDomainFilter) return false;
                        if (errorSeverityFilter !== 'ALL' && err.severity !== errorSeverityFilter) return false;
                        const q = errorSearchQuery.toLowerCase().trim();
                        if (!q) return true;
                        const tech = (err.technicalExplanation || err.diagnostic || '').toLowerCase();
                        const sol = (err.recommendedSolution || err.resolutionFr || '').toLowerCase();
                        const act = (err.diagnosticAction || '').toLowerCase();
                        return (
                          err.code.toLowerCase().includes(q) ||
                          err.domain.toLowerCase().includes(q) ||
                          (err.messageFr || '').toLowerCase().includes(q) ||
                          (err.messageEn || '').toLowerCase().includes(q) ||
                          tech.includes(q) ||
                          sol.includes(q) ||
                          act.includes(q)
                        );
                      })
                      .map((err) => {
                        const sevColors: Record<string, { bg: string; text: string }> = {
                          INFO: { bg: '#e0f2fe', text: '#0369a1' },
                          WARNING: { bg: '#fef3c7', text: '#b45309' },
                          ERROR: { bg: '#fee2e2', text: '#b91c1c' },
                          CRITICAL: { bg: '#450a0a', text: '#fecaca' },
                        };
                        const c = sevColors[err.severity] || { bg: '#f1f5f9', text: '#475569' };

                        return (
                          <tr key={err.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1e1b4b', background: '#ede9fe', padding: '3px 8px', borderRadius: 4, fontSize: '0.8rem' }}>
                                {err.code}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>
                                {err.domain}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span
                                style={{
                                  background: c.bg,
                                  color: c.text,
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                }}
                              >
                                {err.severity}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                              {err.messageFr}
                              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
                                <em>EN: {err.messageEn}</em>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#475569', fontSize: '0.82rem', maxWidth: 280 }}>
                              <div>{err.technicalExplanation || err.diagnostic}</div>
                              {err.diagnosticAction && (
                                <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                                  🎯 Action : {err.diagnosticAction}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#15803d', fontWeight: 600, fontSize: '0.82rem', maxWidth: 300 }}>
                              💡 {err.recommendedSolution || err.resolutionFr}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DANGER ZONE - RÉINITIALISATION CONTRÔLÉE */}
        {activeTab === 'danger_reset' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* CARTE A (PRINCIPALE & RECOMMANDÉE) : RÉINITIALISATION D'UNE ORGANISATION CIBLÉE */}
            <div
              style={{
                background: '#ffffff',
                border: '2px solid #ea580c',
                borderRadius: 12,
                padding: '1.75rem',
                boxShadow: '0 4px 15px rgba(234, 88, 12, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.8rem' }}>🎯</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#c2410c', fontWeight: 800 }}>
                    1. Remise à Zéro Opérationnelle d'UNE Organisation Ciblée (Recommandée)
                  </h2>
                  <span style={{ fontSize: '0.82rem', color: '#ea580c', fontWeight: 600 }}>
                    Isolation RLS Stricte • Zéro impact sur les autres commerçants
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
                Sélectionnez une organisation pour purger uniquement ses données transactionnelles (ventes, stocks, caisse, créances, dépenses).
                Les comptes utilisateurs, mots de passe, boutiques, dépôts et paramétrages sont <strong>intégralement préservés</strong>.
              </p>

              {/* Sélecteur d'organisation */}
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#9a3412', marginBottom: '0.5rem' }}>
                  Sélectionner l'organisation cliente à réinitialiser :
                </label>
                <select
                  value={targetResetTenantId}
                  onChange={(e) => handleSelectTargetResetTenant(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: 550,
                    padding: '0.65rem 0.85rem',
                    border: '1px solid #fdba74',
                    borderRadius: 6,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    background: '#fff',
                  }}
                >
                  <option value="">-- Choisir une organisation ({tenants.length} enregistrées) --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.status}) — UUID: {t.id}
                    </option>
                  ))}
                </select>
              </div>

              {targetResetTenantId ? (
                (() => {
                  const targetTenant = tenants.find((t) => t.id === targetResetTenantId);
                  if (!targetTenant) return null;

                  if (targetResetReport) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1.25rem', color: '#166534' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.35rem' }}>
                            ✅ Réinitialisation Opérationnelle Effectuée avec Succès !
                          </div>
                          <p style={{ margin: 0, fontSize: '0.88rem' }}>
                            L'organisation <strong>« {targetTenant.name} »</strong> est désormais propre et réinitialisée.
                          </p>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#334155' }}>
                            Rapport d'exécution détaillé :
                          </div>
                          <pre style={{ margin: 0, background: '#0f172a', color: '#38bdf8', padding: '0.75rem', borderRadius: 6, fontSize: '0.75rem', overflowX: 'auto' }}>
                            {JSON.stringify(targetResetReport.report?.deletedRecords ?? targetResetReport, null, 2)}
                          </pre>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetResetReport(null);
                            handleSelectTargetResetTenant(targetTenant.id);
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            padding: '0.6rem 1.25rem',
                            background: '#15803d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Fermer le rapport et réactualiser
                        </button>
                      </div>
                    );
                  }

                  return (
                    <form onSubmit={handleExecuteTargetReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* 1. Aperçu Dry-run */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                              Aperçu des données opérationnelles de « {targetTenant.name} » :
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Statut : <span style={{ fontWeight: 700 }}>{targetTenant.status}</span> • Plan : {targetTenant.subscription?.planName || 'N/A'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadBackup(targetTenant.id, targetTenant.name)}
                            style={{
                              padding: '0.45rem 0.85rem',
                              background: '#0284c7',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <span>📥</span>
                            <span>Sauvegarde Sécurisée (.json)</span>
                          </button>
                        </div>

                        {loadingTargetPreview ? (
                          <div style={{ fontSize: '0.85rem', color: '#c2410c', padding: '0.5rem 0' }}>Calcul des volumes en cours...</div>
                        ) : targetResetPreview ? (
                          <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                              <div style={{ background: '#fff', padding: '0.65rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Ventes & Reçus</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c2410c' }}>
                                  {targetResetPreview.dryRunCounts?.sales ?? targetResetPreview.tableCounts?.sales ?? 0}
                                </div>
                              </div>
                              <div style={{ background: '#fff', padding: '0.65rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Stocks & Lots</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c2410c' }}>
                                  {(targetResetPreview.dryRunCounts?.stockBatches ?? targetResetPreview.tableCounts?.stockBatches ?? 0) +
                                    (targetResetPreview.dryRunCounts?.stockMovements ?? targetResetPreview.tableCounts?.stockMovements ?? 0)}
                                </div>
                              </div>
                              <div style={{ background: '#fff', padding: '0.65rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Sessions Caisse</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c2410c' }}>
                                  {targetResetPreview.dryRunCounts?.cashSessions ?? targetResetPreview.tableCounts?.cashSessions ?? 0}
                                </div>
                              </div>
                              <div style={{ background: '#fff', padding: '0.65rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Comptes Crédit</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c2410c' }}>
                                  {targetResetPreview.dryRunCounts?.creditAccounts ?? targetResetPreview.tableCounts?.creditAccounts ?? 0}
                                </div>
                              </div>
                              <div style={{ background: '#fff', padding: '0.65rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Dépenses</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c2410c' }}>
                                  {targetResetPreview.dryRunCounts?.expenses ?? targetResetPreview.tableCounts?.expenses ?? 0}
                                </div>
                              </div>
                              <div style={{ background: '#fff', padding: '0.65rem', borderRadius: 6, border: '1px solid #fed7aa' }}>
                                <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700 }}>Total Enregistrements</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#991b1b' }}>
                                  {targetResetPreview.totalOperationalRecords ?? targetResetPreview.totalRecords ?? 0}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#166534', background: '#dcfce7', padding: '0.45rem 0.75rem', borderRadius: 6 }}>
                              🛡️ <strong>Données préservées :</strong> Compte propriétaire, mots de passe, rôles, configuration de boutique, dépôts et modèles de factures.
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Confirmation Checkbox */}
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.84rem', color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={targetResetConfirmedScope}
                          onChange={(e) => setTargetResetConfirmedScope(e.target.checked)}
                          style={{ marginTop: '0.15rem' }}
                        />
                        <span>
                          Je confirme vouloir réinitialiser définitivement les tables opérationnelles de l'organisation <strong>« {targetTenant.name} »</strong> sans retour en arrière possible.
                        </span>
                      </label>

                      {/* Phrase de confirmation */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                          Tapez la phrase : <span style={{ color: '#c2410c', background: '#ffedd5', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>CONFIRMER REINITIALISATION {targetTenant.name}</span> *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={`CONFIRMER REINITIALISATION ${targetTenant.name}`}
                          value={targetResetPhrase}
                          onChange={(e) => setTargetResetPhrase(e.target.value)}
                          style={{ width: '100%', maxWidth: 550, padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 600, fontSize: '0.88rem' }}
                        />
                      </div>

                      {/* Mot de passe Super Admin */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                          Votre mot de passe Super Admin *
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={targetResetPassword}
                          onChange={(e) => setTargetResetPassword(e.target.value)}
                          style={{ width: '100%', maxWidth: 350, padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                        />
                      </div>

                      <div>
                        <button
                          type="submit"
                          disabled={
                            resettingTargetTenant ||
                            !targetResetPassword ||
                            !targetResetConfirmedScope ||
                            !targetResetPhrase.trim()
                          }
                          style={{
                            padding: '0.75rem 1.6rem',
                            background:
                              resettingTargetTenant ||
                              !targetResetPassword ||
                              !targetResetConfirmedScope ||
                              !targetResetPhrase.trim()
                                ? '#94a3b8'
                                : '#c2410c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontWeight: 700,
                            cursor:
                              resettingTargetTenant ||
                              !targetResetPassword ||
                              !targetResetConfirmedScope ||
                              !targetResetPhrase.trim()
                                ? 'not-allowed'
                                : 'pointer',
                          }}
                        >
                          {resettingTargetTenant ? 'Réinitialisation en cours...' : `🔄 Réinitialiser « ${targetTenant.name} »`}
                        </button>
                      </div>
                    </form>
                  );
                })()
              ) : (
                <div style={{ padding: '1rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#64748b', fontSize: '0.85rem' }}>
                  Sélectionnez une organisation ci-dessus pour inspecter ses volumes de données et déclencher sa réinitialisation opérationnelle.
                </div>
              )}
            </div>

            {/* CARTE B (SECONDAIRE) : RÉINITIALISATION GLOBALE PLATEFORME (DÉMO/QA UNIQUEMENT) */}
            <div
              style={{
                background: '#fef2f2',
                border: '2px solid #ef4444',
                borderRadius: 12,
                padding: '1.75rem',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.8rem' }}>🚨</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#991b1b', fontWeight: 800 }}>
                      2. Réinitialisation Globale Plateforme
                    </h2>
                    <span style={{ fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600 }}>
                      Purger simultanément tous les comptes de test et démonstration
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  🔒 DÉMO / QA UNIQUEMENT — BLOQUÉ EN PRODUCTION
                </span>
              </div>

              <p style={{ fontSize: '0.88rem', color: '#7f1d1d', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
                Cette opération efface les données de test sur l'ensemble de la plateforme. Elle requiert la présence d'au moins un compte de test et la variable <code>ALLOW_PLATFORM_RESET=true</code>. En production, utilisez exclusivement la réinitialisation ciblée (Carte 1 ci-dessus).
              </p>

              <button
                type="button"
                onClick={() => {
                  setGlobalResetPassword('');
                  setGlobalResetPhrase('');
                  setShowGlobalResetModal(true);
                }}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0.75rem 1.6rem',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                }}
              >
                🚨 Ouvrir la Réinitialisation Globale Plateforme (Démo)
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Provisioning */}
      {showProvisionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>Provisionner un nouveau client SaaS</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Création atomique de l'organisation, du compte propriétaire, de l'emplacement et de l'abonnement.
            </p>
            <form onSubmit={handleProvisionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nom de l'entreprise *</label>
                <input
                  required
                  value={newTenantForm.name}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, name: e.target.value })}
                  placeholder="Ex: Quincaillerie Centrale"
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Email Propriétaire *</label>
                  <input
                    type="email"
                    required
                    value={newTenantForm.ownerEmail}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerEmail: e.target.value })}
                    placeholder="directeur@commerce.com"
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nom Propriétaire *</label>
                  <input
                    required
                    value={newTenantForm.ownerName}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerName: e.target.value })}
                    placeholder="M. Ibrahim Diallo"
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mot de passe initial du directeur (6 caractères minimum) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newTenantForm.ownerPassword}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerPassword: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Forfait commercial</label>
                  <select
                    value={newTenantForm.planKey}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, planKey: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    <option value="TRIAL">TRIAL (Essai 14 jours gratuit)</option>
                    <option value="STARTER">STARTER (15 000 XOF/m)</option>
                    <option value="PRO">PRO (35 000 XOF/m)</option>
                    <option value="ENTERPRISE">ENTERPRISE (75 000 XOF/m)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Profil métier</label>
                  <select
                    value={newTenantForm.businessType}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, businessType: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    <option value="BOUTIQUE">Boutique de détail</option>
                    <option value="SERVICES">Prestataire de services</option>
                    <option value="RESTAURANT">Restaurant / Bar</option>
                    <option value="PHARMACIE">Pharmacie / Dépôt</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nom de la boutique principale</label>
                <input
                  required
                  value={newTenantForm.initialStoreName}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, initialStoreName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  style={{ padding: '0.6rem 1rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={provisioning}
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {provisioning ? 'Création...' : 'Créer et activer le tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Changement de Plan */}
      {planModalTenant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 440 }}>
            <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>Changer le forfait de l'organisation</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Organisation : <strong>{planModalTenant.name}</strong> (actuel : {planModalTenant.currentPlan})
            </p>
            <div style={{ margin: '1.25rem 0' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Sélectionner le nouveau forfait :
              </label>
              <select
                value={selectedNewPlan}
                onChange={(e) => setSelectedNewPlan(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem' }}
              >
                <option value="TRIAL">TRIAL (Essai gratuit)</option>
                <option value="STARTER">STARTER (15 000 XOF/mois)</option>
                <option value="PRO">PRO (35 000 XOF/mois)</option>
                <option value="ENTERPRISE">ENTERPRISE (75 000 XOF/mois)</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setPlanModalTenant(null)}
                style={{ padding: '0.6rem 1rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmChangePlan}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Appliquer le changement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Suspension Confirmation */}
      {suspendModalTenant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 440 }}>
            <h2 style={{ marginTop: 0, color: '#dc2626', fontSize: '1.2rem' }}>Suspendre l'espace de travail ?</h2>
            <p style={{ color: '#475569', fontSize: '0.88rem' }}>
              Êtes-vous sûr de vouloir suspendre l'organisation <strong>« {suspendModalTenant.name} »</strong> ? Les utilisateurs ne pourront plus enregistrer d'écritures (ventes, stocks, utilisateurs).
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setSuspendModalTenant(null)}
                style={{ padding: '0.6rem 1rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmSuspendTenant}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Oui, suspendre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Paiement */}
      {paymentModalInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 440 }}>
            <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>Enregistrer le règlement SaaS</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Facture {paymentModalInvoice.invoiceNumber} — {Number(paymentModalInvoice.amount).toLocaleString('fr-FR')} {paymentModalInvoice.currency}
            </p>
            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Mode de règlement</label>
                <select
                  value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                >
                  <option value="MANUAL_TRANSFER">Virement bancaire</option>
                  <option value="CASH">Espèces au guichet éditeur</option>
                  <option value="MOBILE_MONEY">Mobile Money (Orange/Moov/Wave)</option>
                  <option value="CARD">Carte Bancaire</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Référence bancaire / transaction *</label>
                <input
                  required
                  placeholder="ex: VIR-BICI-2026-092"
                  value={payForm.paymentReference}
                  onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Notes de rapprochement</label>
                <input
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder="Vérifié avec relevé bancaire"
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  style={{ padding: '0.6rem 1rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Confirmer l'encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Réinitialisation Globale Super Admin */}
      {showGlobalResetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '2rem', width: '100%', maxWidth: 520, border: '2px solid #dc2626', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#991b1b' }}>Confirmation Super Admin : Réinitialisation Globale</h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>S'applique à TOUS les gestionnaires de la plateforme</span>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Pour confirmer la remise à zéro totale de la plateforme SaaS, saisissez votre mot de passe Super Admin
              et recopiez exactement la phrase de validation ci-dessous :
            </p>

            <form onSubmit={handleGlobalReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  Tapez exactement : <span style={{ color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>REINITIALISER TOUTE LA PLATEFORME</span> *
                </label>
                <input
                  type="text"
                  required
                  placeholder="REINITIALISER TOUTE LA PLATEFORME"
                  value={globalResetPhrase}
                  onChange={(e) => setGlobalResetPhrase(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  Mot de passe Administrateur Principal *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Votre mot de passe..."
                  value={globalResetPassword}
                  onChange={(e) => setGlobalResetPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  disabled={resettingGlobal}
                  onClick={() => setShowGlobalResetModal(false)}
                  style={{ padding: '0.65rem 1.25rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resettingGlobal || !globalResetPassword || globalResetPhrase.trim() !== 'REINITIALISER TOUTE LA PLATEFORME'}
                  style={{
                    padding: '0.65rem 1.4rem',
                    background: resettingGlobal || !globalResetPassword || globalResetPhrase.trim() !== 'REINITIALISER TOUTE LA PLATEFORME' ? '#94a3b8' : '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: resettingGlobal || !globalResetPassword || globalResetPhrase.trim() !== 'REINITIALISER TOUTE LA PLATEFORME' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {resettingGlobal ? 'Réinitialisation en cours...' : '🚨 Confirmer pour TOUT LE MONDE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Réinitialisation Ciblée d'UNE Organisation */}
      {resetModalTenant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '2rem', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', border: '2px solid #ea580c', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '2rem' }}>🔄</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#c2410c' }}>
                  Réinitialisation Opérationnelle : {resetModalTenant.name}
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  ID: {resetModalTenant.id} • Action isolée sans impact sur les autres organisations
                </span>
              </div>
            </div>

            {resetResultReport ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1.25rem', color: '#166534' }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.35rem' }}>
                    ✅ Réinitialisation Opérationnelle Effectuée avec Succès !
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    L'organisation <strong>« {resetModalTenant.name} »</strong> a été remise à zéro. Le directeur principal, son authentification, l'identité commerciale et l'abonnement ont été conservés ; les autres comptes et données opérationnelles ont été supprimés.
                  </p>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#334155' }}>
                    Bilan des suppressions opérationnelles :
                  </div>
                  <pre style={{ margin: 0, background: '#0f172a', color: '#38bdf8', padding: '0.75rem', borderRadius: 6, fontSize: '0.75rem', overflowX: 'auto' }}>
                    {JSON.stringify({ report: resetResultReport.report, before: resetResultReport.before, after: resetResultReport.after, preservedDirector: resetResultReport.preservedDirector }, null, 2)}
                  </pre>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setResetModalTenant(null);
                      setResetResultReport(null);
                    }}
                    style={{
                      padding: '0.65rem 1.5rem',
                      background: '#15803d',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Fermer et actualiser
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteTenantReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {/* 1. Aperçu Dry-run */}
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#9a3412', marginBottom: '0.5rem' }}>
                    1. Aperçu des données qui seront définitivement effacées (Dry-run) :
                  </div>

                  {loadingPreview ? (
                    <div style={{ fontSize: '0.82rem', color: '#c2410c' }}>Calcul du volume des données en cours...</div>
                  ) : resetPreview ? (
                    <div>
                      <div style={{ marginBottom: '0.75rem', padding: '0.55rem 0.7rem', background: '#fff', border: '1px solid #fdba74', borderRadius: 6, fontSize: '0.8rem', color: '#334155' }}>
                        <strong>Directeur principal conservé :</strong> {resetPreview.principalDirector ? `${resetPreview.principalDirector.fullName} — ${resetPreview.principalDirector.email} (${resetPreview.principalDirector.status})` : 'Aucun rôle directeur principal unique détecté — le serveur refusera le reset.'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 6, border: '1px solid #fdba74' }}>
                          <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700 }}>Ventes & Reçus</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c2410c' }}>
                            {resetPreview.dryRunCounts?.sales ?? 0}
                          </div>
                        </div>
                        <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 6, border: '1px solid #fdba74' }}>
                          <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700 }}>Stocks & Lots</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c2410c' }}>
                            {(resetPreview.dryRunCounts?.stockBatches ?? 0) + (resetPreview.dryRunCounts?.stockMovements ?? 0)}
                          </div>
                        </div>
                        <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 6, border: '1px solid #fdba74' }}>
                          <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700 }}>Sessions Caisse</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c2410c' }}>
                            {resetPreview.dryRunCounts?.cashSessions ?? 0}
                          </div>
                        </div>
                        <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 6, border: '1px solid #fdba74' }}>
                          <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700 }}>Comptes Crédit</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c2410c' }}>
                            {resetPreview.dryRunCounts?.creditAccounts ?? 0}
                          </div>
                        </div>
                        <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 6, border: '1px solid #fdba74' }}>
                          <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700 }}>Dépenses</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c2410c' }}>
                            {resetPreview.dryRunCounts?.expenses ?? 0}
                          </div>
                        </div>
                        <div style={{ background: '#fff', padding: '0.5rem', borderRadius: 6, border: '1px solid #fdba74' }}>
                          <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700 }}>Total Enregistrements</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#991b1b' }}>
                            {resetPreview.totalOperationalRecords ?? 0}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#166534', background: '#dcfce7', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
                        🛡️ <strong>Données préservées :</strong> Organisation, directeur principal et son mot de passe, identité commerciale, abonnement, boutiques et dépôts. Les comptes secondaires, leurs sessions et rôles personnalisés sont supprimés.
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* 2. Export préalable de sauvegarde */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.85rem 1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                      2. Sauvegarde préalable de sécurité (requise)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Export JSON de toutes les tables tenant, avec empreinte SHA-256. Le serveur vérifie aussi une sauvegarde fraîche avant suppression.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup(resetModalTenant.id, resetModalTenant.name)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span>📥</span>
                    <span>Télécharger Sauvegarde (.json)</span>
                  </button>
                </div>

                {/* 3. Checkbox de confirmation */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={resetTenantConfirmedScope}
                    onChange={(e) => setResetTenantConfirmedScope(e.target.checked)}
                    style={{ marginTop: '0.15rem' }}
                  />
                  <span>
                    J'ai vérifié la sauvegarde ou confirme vouloir réinitialiser définitivement les tables opérationnelles de <strong>« {resetModalTenant.name} »</strong> sans possibilité de retour en arrière.
                  </span>
                </label>

                {/* 4. Phrase de confirmation exacte */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    4. Tapez exactement : <span style={{ color: '#c2410c', background: '#ffedd5', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>CONFIRMER REINITIALISATION {resetModalTenant.name}</span> *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`CONFIRMER REINITIALISATION ${resetModalTenant.name}`}
                    value={resetTenantPhrase}
                    onChange={(e) => setResetTenantPhrase(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 600, fontSize: '0.88rem' }}
                  />
                </div>

                {/* 5. Mot de passe Super Admin */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    5. Votre mot de passe Super Admin *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={resetTenantPassword}
                    onChange={(e) => setResetTenantPassword(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>

                {/* Boutons d'action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    disabled={resettingTenant}
                    onClick={() => setResetModalTenant(null)}
                    style={{ padding: '0.65rem 1.25rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={
                      resettingTenant ||
                      !resetTenantPassword ||
                      !resetTenantConfirmedScope ||
                      !(() => {
                        const p = resetTenantPhrase.trim().toUpperCase();
                        const n = resetModalTenant.name.trim().toUpperCase();
                        return p === `CONFIRMER REINITIALISATION ${n}` || p === `REINITIALISER ${n}` || p === n;
                      })()
                    }
                    style={{
                      padding: '0.65rem 1.4rem',
                      background:
                        resettingTenant ||
                        !resetTenantPassword ||
                        !resetTenantConfirmedScope ||
                        !(() => {
                          const p = resetTenantPhrase.trim().toUpperCase();
                          const n = resetModalTenant.name.trim().toUpperCase();
                          return p === `CONFIRMER REINITIALISATION ${n}` || p === `REINITIALISER ${n}` || p === n;
                        })()
                          ? '#94a3b8'
                          : '#c2410c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 700,
                      cursor:
                        resettingTenant ||
                        !resetTenantPassword ||
                        !resetTenantConfirmedScope ||
                        !(() => {
                          const p = resetTenantPhrase.trim().toUpperCase();
                          const n = resetModalTenant.name.trim().toUpperCase();
                          return p === `CONFIRMER REINITIALISATION ${n}` || p === `REINITIALISER ${n}` || p === n;
                        })()
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {resettingTenant ? 'Réinitialisation en cours...' : '🔄 Réinitialiser l\'organisation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Modification d'une Organisation */}
      {moduleModalTenant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1100 }}>
          <section role="dialog" aria-modal="true" style={{ width: 'min(760px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 12, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}><div><h2 style={{ margin: 0 }}>Modules — {moduleModalTenant.name}</h2><p style={{ color: '#64748b' }}>Les changements passent par les dépendances, le plan et l’audit du tenant.</p></div><button onClick={() => { setModuleModalTenant(null); setTenantModuleData(null); }}>Fermer</button></div>
            {loadingTenantModules && <p>Chargement…</p>}
            {tenantModuleData && <><div style={{ padding: 10, borderRadius: 7, background: '#f8fafc', marginBottom: 10 }}>Plan: <strong>{tenantModuleData.planKey}</strong></div><div style={{ display: 'grid', gap: 8 }}>{tenantModuleData.modules.map((module: any) => <div key={module.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}><div><strong>{module.label}</strong><div style={{ fontSize: 12, color: '#64748b' }}>{module.category} · dépendances: {module.dependencies?.join(', ') || 'aucune'}{!module.availableOnPlan ? ' · indisponible sur ce plan' : ''}</div></div><label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={Boolean(module.enabled)} disabled={module.category === 'CORE' || module.category === 'AUTOMATIC' || !module.availableOnPlan} onChange={(event) => void updateTenantModule(module.key, event.target.checked)} />{module.enabled ? 'Activé' : 'Désactivé'}</label></div>)}</div></>}
          </section>
        </div>
      )}

      {/* Modal Modification d'une Organisation */}
      {editModalTenant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.25rem', color: '#0f172a' }}>
              Modifier l'organisation : {editModalTenant.name}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Mise à jour des coordonnées officielles, du statut et du nom légal de l'entreprise.
            </p>

            <form onSubmit={handleSaveEditTenant} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nom usuel / Commercial *</label>
                <input
                  required
                  value={editTenantForm.name}
                  onChange={(e) => setEditTenantForm({ ...editTenantForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Raison Sociale / Nom Légal</label>
                <input
                  value={editTenantForm.legalName}
                  onChange={(e) => setEditTenantForm({ ...editTenantForm, legalName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Téléphone</label>
                  <input
                    value={editTenantForm.phone}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, phone: e.target.value })}
                    placeholder="+226 70 00 00 00"
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Statut Organisation</label>
                  <select
                    value={editTenantForm.status}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, status: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="GRACE_PERIOD">GRACE_PERIOD</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Email de contact</label>
                <input
                  type="email"
                  value={editTenantForm.email}
                  onChange={(e) => setEditTenantForm({ ...editTenantForm, email: e.target.value })}
                  placeholder="contact@commerce.com"
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setEditModalTenant(null)}
                  style={{ padding: '0.6rem 1rem', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEditTenant}
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {savingEditTenant ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
