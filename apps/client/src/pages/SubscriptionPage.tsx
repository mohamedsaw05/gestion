import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';

interface SubscriptionData {
  id: string;
  status: 'ACTIVE' | 'TRIALING' | 'SUSPENDED' | 'PAST_DUE' | 'CANCELLED';
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEnd?: string;
  plan: {
    key: string;
    name: string;
    description: string;
    priceMonthly: string | number;
    currency: string;
    allowedCapabilities: string[];
  };
  quotas: {
    users: { current: number; max: number; isReached: boolean };
    locations: { current: number; max: number; isReached: boolean };
    monthlySales: { current: number; max: number; isReached: boolean };
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string | number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'VOID';
  paymentMethod: string;
  paymentReference?: string;
  paidAt?: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

interface CommercialSettings {
  monthlyReferencePrice: number;
  plans: { months: number; label: string; totalPrice: number }[];
  trialDays: number;
  support: { opensAt: string; closesAt: string; timeZone: string };
}

const STATUS_BADGE: Record<SubscriptionData['status'], { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  ACTIVE: { label: 'Abonnement Actif', variant: 'success' },
  TRIALING: { label: 'Période d’essai', variant: 'warning' },
  SUSPENDED: { label: 'Suspendu', variant: 'danger' },
  PAST_DUE: { label: 'Paiement en retard', variant: 'danger' },
  CANCELLED: { label: 'Résilié', variant: 'danger' },
};

export function SubscriptionPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [commercial, setCommercial] = useState<CommercialSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [subData, invData, commercialData] = await Promise.all([
          api.get<SubscriptionData>('/tenant-subscription/current'),
          api.get<Invoice[]>('/tenant-subscription/invoices'),
          api.get<CommercialSettings>('/commercial/settings'),
        ]);
        setData(subData);
        setInvoices(invData);
        setCommercial(commercialData);
      } catch (err) {
        addToast(err instanceof ApiError ? err.message : 'Erreur de chargement de l’abonnement', 'error');
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Chargement des données de votre abonnement...
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Mon Forfait & Quotas SaaS" subtitle="Informations sur votre abonnement de service" />
        <EmptyState
          title="Aucun abonnement rattaché"
          description="Votre organisation ne dispose d’aucun abonnement actif. Veuillez contacter l'administrateur de la plateforme."
        />
      </div>
    );
  }

  const { plan, quotas } = data;
  const isExpired =
    ['SUSPENDED', 'PAST_DUE', 'CANCELLED', 'EXPIRED'].includes(data.status) ||
    (Boolean(data.currentPeriodEnd) && new Date(data.currentPeriodEnd).getTime() < Date.now());
  const statusMeta = STATUS_BADGE[data.status] ?? { label: data.status, variant: 'warning' };

  const userPercent = Math.min(100, Math.round((quotas.users.current / (quotas.users.max || 1)) * 100));
  const locPercent = Math.min(100, Math.round((quotas.locations.current / (quotas.locations.max || 1)) * 100));
  const salesPercent =
    quotas.monthlySales.max > 0
      ? Math.min(100, Math.round((quotas.monthlySales.current / quotas.monthlySales.max) * 100))
      : 0;

  return (
    <div>
      <PageHeader
        title="Mon Forfait & Quotas SaaS"
        subtitle="Suivi en temps réel de votre formule d'abonnement, consommation des quotas serveur et historique comptable"
        badges={[
          { label: statusMeta.label, variant: statusMeta.variant },
          { label: `Forfait ${plan.name}`, variant: 'info' },
        ]}
      />

      {isExpired && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fef2f2, #fff7ed)',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '1.75rem',
            marginBottom: '1.75rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.8rem' }}>⚠️</span>
            <div>
              <h2 style={{ color: '#991b1b', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Votre abonnement est arrivé à échéance
              </h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#7f1d1d' }}>
                Vous êtes bien connecté à votre espace. Toutes vos données sont en sécurité et conservées. Pour réactiver vos accès complets et poursuivre vos opérations sans interruption, veuillez nous contacter directement :
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
            <a
              href="https://wa.me/22600000000?text=Bonjour%2C%20je%20souhaite%20renouveler%20mon%20abonnement%20Gestionnaire"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.9rem 1.15rem',
                background: '#16a34a',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>💬</span>
              <div>
                <div>Contacter sur WhatsApp</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Réponse rapide en direct</div>
              </div>
            </a>

            <a
              href="tel:+22600000000"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.9rem 1.15rem',
                background: '#2563eb',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>📞</span>
              <div>
                <div>Appeler le Support</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>+226 00 00 00 00</div>
              </div>
            </a>

            <a
              href="mailto:contact@gestionnaire-commerce.com?subject=Demande%20de%20renouvellement%20d%27abonnement"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.9rem 1.15rem',
                background: '#475569',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>✉️</span>
              <div>
                <div>Envoyer un Email</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>support@gestionnaire.com</div>
              </div>
            </a>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '860px' }}>
        {/* Forfait actuel */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{plan.name}</h2>
                <span className={`badge ${statusMeta.variant === 'success' ? 'badge-success' : 'badge-danger'}`}>
                  {statusMeta.label}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
                {plan.description || 'Formule commerciale SaaS universelle'}
              </p>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Renouvellement automatique / Prochaine échéance :{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {new Date(data.currentPeriodEnd).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                {commercial ? `${Number(commercial.monthlyReferencePrice).toLocaleString('fr-FR')} FCFA` : '—'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>tarif mensuel de référence</div>
            </div>
          </div>
        </div>

        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ marginTop: 0 }}>Formules payantes disponibles</h3>
          <p style={{ color: 'var(--text-muted)' }}>L’essai gratuit de 14 jours est distinct des formules. Les abonnements d’un ou deux mois ne sont pas commercialisés. Les nouvelles périodes sont calculées depuis le tarif central et n’altèrent pas les achats antérieurs.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            {(commercial?.plans ?? []).map((offer) => <div key={offer.months} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}><strong>{offer.label}</strong><div style={{ fontSize: 18, fontWeight: 800, marginTop: 5 }}>{offer.totalPrice.toLocaleString('fr-FR')} FCFA</div><small>{commercial?.monthlyReferencePrice.toLocaleString('fr-FR')} FCFA/mois de référence</small></div>)}
          </div>
          {commercial && <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>Renouvellement à demander avant l’échéance · service d’assistance tous les jours {commercial.support.opensAt}–{commercial.support.closesAt} ({commercial.support.timeZone}).</p>}
        </section>

        {/* Quotas Serveur */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem' }}>Consommation des quotas serveur</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {/* Utilisateurs */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                background: 'var(--surface-muted, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Comptes collaborateurs</span>
                <span style={{ fontWeight: 700, color: quotas.users.isReached ? 'var(--danger)' : 'var(--text)' }}>
                  {quotas.users.current} / {quotas.users.max}
                </span>
              </div>
              <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${userPercent}%`,
                    height: '100%',
                    background: quotas.users.isReached ? 'var(--danger)' : userPercent > 80 ? 'var(--warning)' : 'var(--primary)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              {quotas.users.isReached && (
                <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: 500 }}>
                  Quota atteint — Passez au forfait supérieur pour inviter d'autres collaborateurs.
                </div>
              )}
            </div>

            {/* Emplacements */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                background: 'var(--surface-muted, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Boutiques & Dépôts</span>
                <span style={{ fontWeight: 700, color: quotas.locations.isReached ? 'var(--danger)' : 'var(--text)' }}>
                  {quotas.locations.current} / {quotas.locations.max}
                </span>
              </div>
              <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${locPercent}%`,
                    height: '100%',
                    background: quotas.locations.isReached ? 'var(--danger)' : 'var(--primary)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              {quotas.locations.isReached && (
                <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: 500 }}>
                  Limite d'emplacements atteinte pour votre offre.
                </div>
              )}
            </div>

            {/* Ventes mensuelles */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                background: 'var(--surface-muted, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Volume de ventes ce mois</span>
                <span style={{ fontWeight: 700, color: quotas.monthlySales.isReached ? 'var(--danger)' : 'var(--text)' }}>
                  {quotas.monthlySales.current} / {quotas.monthlySales.max > 0 ? quotas.monthlySales.max : 'Illimité'}
                </span>
              </div>
              <div style={{ width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: quotas.monthlySales.max > 0 ? `${salesPercent}%` : '5%',
                    height: '100%',
                    background: quotas.monthlySales.isReached ? 'var(--danger)' : 'var(--primary)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Factures d'abonnement */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Historique des factures SaaS</h3>
          {invoices.length === 0 ? (
            <EmptyState
              title="Aucune facture émise"
              description="Votre historique de facturation SaaS est actuellement vierge."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>N° Facture</th>
                    <th>Montant</th>
                    <th>Période de couverture</th>
                    <th>Statut</th>
                    <th>Règlement</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{inv.invoiceNumber}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700 }}>
                          {Number(inv.amount).toLocaleString('fr-FR')} {inv.currency}
                        </span>
                      </td>
                      <td>
                        {new Date(inv.periodStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au{' '}
                        {new Date(inv.periodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span className={`badge ${inv.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                          {inv.status === 'PAID' ? 'RÉGLÉE' : 'EN ATTENTE'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {inv.paymentMethod} {inv.paymentReference ? `(${inv.paymentReference})` : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
