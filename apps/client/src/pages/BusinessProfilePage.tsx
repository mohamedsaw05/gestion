import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';

interface BusinessTypeDefinition {
  value: string;
  label: string;
  suggestedCapabilities: string[];
}

interface CapabilityDefinition {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  implemented: boolean;
}

interface ModuleDefinition {
  key: string;
  label: string;
  category: 'CORE' | 'AUTOMATIC' | 'OPTIONAL' | 'ADVANCED' | 'HIDDEN';
  requiresCapability?: string;
  dependencies?: string[];
}

interface Catalog {
  businessTypes: BusinessTypeDefinition[];
  capabilities: CapabilityDefinition[];
  modules: ModuleDefinition[];
}

interface ResolvedModule {
  key: string;
  label: string;
  category: string;
  enabled: boolean;
}

interface Context {
  profile: { businessType: string; onboardedAt: string | null } | null;
  capabilities: Record<string, boolean>;
  modules: ResolvedModule[];
}

export function BusinessProfilePage() {
  const { refreshMenu } = useAuth();
  const { addToast } = useToast();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [businessType, setBusinessType] = useState('BOUTIQUE');
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [touchedModules, setTouchedModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get<Catalog>('/business-profile/catalog'), api.get<Context>('/business-profile/context')])
      .then(([cat, ctx]) => {
        setCatalog(cat);
        setContext(ctx);
        setBusinessType(ctx.profile?.businessType ?? 'BOUTIQUE');
        setCapabilities({ ...ctx.capabilities });
        const moduleState: Record<string, boolean> = {};
        for (const m of ctx.modules) moduleState[m.key] = m.enabled;
        setModules(moduleState);
        setTouchedModules({});
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement du profil', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySuggestions = (typeValue: string) => {
    setBusinessType(typeValue);
    const def = catalog?.businessTypes.find((t) => t.value === typeValue);
    if (!def) return;
    setCapabilities((prev) => {
      const next = { ...prev };
      for (const cap of catalog!.capabilities) {
        if (cap.implemented) next[cap.key] = def.suggestedCapabilities.includes(cap.key);
      }
      return next;
    });
    addToast(`Suggestions appliquées pour le type « ${def.label} ».`, 'info');
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.put<Context['profile']>('/business-profile/onboarding', {
        businessType,
        capabilities,
        modules: touchedModules,
      });
      setContext((prev) => (prev ? { ...prev, profile: updated, capabilities } : prev));
      await refreshMenu();
      const ctx = await api.get<Context>('/business-profile/context');
      setContext(ctx);
      const moduleState: Record<string, boolean> = {};
      for (const m of ctx.modules) moduleState[m.key] = m.enabled;
      setModules(moduleState);
      setTouchedModules({});
      addToast('Configuration du commerce et permissions enregistrées avec succès.', 'success');
    } catch (e) {
      addToast(e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement", 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !catalog || !context) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Chargement du profil et des fonctionnalités métier...
      </div>
    );
  }

  const isFirstSetup = !context.profile?.onboardedAt;
  const toggleableModules = catalog.modules.filter((m) => m.category === 'OPTIONAL' || m.category === 'ADVANCED');

  return (
    <div>
      <PageHeader
        title="Profil & Personnalisation du Commerce"
        subtitle={
          isFirstSetup
            ? 'Assistant d’initialisation : activez les capacités adaptées à vos besoins pour configurer vos menus et autorisations'
            : 'Personnalisation des fonctionnalités actives et modules optionnels de votre organisation'
        }
        badges={[
          { label: catalog.businessTypes.find((t) => t.value === businessType)?.label ?? businessType, variant: 'info' },
          {
            label: `${Object.values(capabilities).filter(Boolean).length} capacités actives`,
            variant: 'success',
          },
        ]}
        primaryAction={{
          label: saving ? 'Enregistrement...' : '✓ Enregistrer la configuration',
          onClick: save,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '820px' }}>
        {/* BLOC 1: TYPE DE COMMERCE */}
        <section
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem' }}>1. Type de commerce</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
            Sélectionnez votre secteur pour pré-activer automatiquement les modules et flux recommandés. Vous restez libre de personnaliser chaque case ci-dessous.
          </p>
          <select
            value={businessType}
            onChange={(e) => applySuggestions(e.target.value)}
            style={{ width: '100%', maxWidth: '380px', fontSize: '0.9rem', fontWeight: 600 }}
          >
            {catalog.businessTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </section>

        {/* BLOC 2: FONCTIONNALITÉS */}
        <section
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem' }}>2. Capacités & Flux opérationnels</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
            Chaque case active des règles serveur réelles (ex: contrôle du stock strict, remises volume, facturation officielle).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {catalog.capabilities.map((cap) => {
              const isChecked = Boolean(capabilities[cap.key]);
              return (
                <div
                  key={cap.key}
                  style={{
                    background: isChecked ? 'var(--primary-soft, #f5f7ff)' : 'var(--surface-muted, #f8fafc)',
                    border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem',
                    opacity: cap.implemented ? 1 : 0.6,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <label
                    className="checkbox-row"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      cursor: cap.implemented ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!cap.implemented}
                      checked={isChecked}
                      onChange={(e) => setCapabilities((prev) => ({ ...prev, [cap.key]: e.target.checked }))}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <span>{cap.label}</span>
                      {!cap.implemented && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                          (bientôt disponible)
                        </span>
                      )}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '0.2rem' }}>
                        {cap.description}
                      </div>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        {/* BLOC 3: MODULES OPTIONNELS */}
        <section
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem' }}>3. Modules optionnels dans le menu</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
            Les fonctions fondamentales (Vente, Catalogue, Stocks, Clients, Paramètres) restent toujours visibles.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {toggleableModules.map((mod) => {
              const capabilityMissing =
                mod.requiresCapability && !capabilities[mod.requiresCapability];
              const isChecked = Boolean(modules[mod.key]);

              return (
                <label
                  key={mod.key}
                  className="checkbox-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: isChecked ? 'var(--primary-soft, #f5f7ff)' : 'var(--surface-muted, #f8fafc)',
                    border: `1px solid ${isChecked ? 'var(--primary, #3b82f6)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 0.85rem',
                    opacity: capabilityMissing ? 0.5 : 1,
                    cursor: capabilityMissing ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={Boolean(capabilityMissing)}
                    checked={isChecked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const nextModules = { ...modules, [mod.key]: checked };
                      const nextTouched = { ...touchedModules, [mod.key]: checked };
                      if (checked && mod.dependencies) {
                        for (const depKey of mod.dependencies) {
                          nextModules[depKey] = true;
                          nextTouched[depKey] = true;
                        }
                      }
                      setModules(nextModules);
                      setTouchedModules(nextTouched);
                    }}
                  />
                  <span>{mod.label}</span>
                  {mod.dependencies && mod.dependencies.length > 0 && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        background: '#eff6ff',
                        color: '#2563eb',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        marginLeft: 'auto',
                        fontWeight: 600,
                      }}
                      title={`Nécessite que le module ${mod.dependencies.join(', ')} soit activé`}
                    >
                      🔗 Dépend de {mod.dependencies.join(', ')}
                    </span>
                  )}
                  {capabilityMissing && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--danger)', marginLeft: 'auto' }}>
                      (requis désactivé)
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="primary"
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: 700 }}
          >
            {saving ? 'Enregistrement des modifications...' : 'Enregistrer la configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
