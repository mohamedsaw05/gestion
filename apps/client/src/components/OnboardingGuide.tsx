import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  path: string;
}

interface OnboardingStatus {
  isNewOrganization: boolean;
  isNewUser: boolean;
  dismissed: boolean;
  completedCount: number;
  totalSteps: number;
  progressPercent: number;
  steps: OnboardingStep[];
}

export function OnboardingGuide() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);

  const fetchStatus = () => {
    api
      .get<OnboardingStatus>('/me/onboarding-status')
      .then((res) => {
        setStatus(res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDismiss = async () => {
    try {
      await api.patch('/me/onboarding-dismiss', {});
      if (status) {
        setStatus({ ...status, dismissed: true });
      }
    } catch {
      // Ignorer
    }
  };

  if (loading || !status) return null;
  if (status.dismissed || status.progressPercent === 100) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#f8fafc',
        borderRadius: 'var(--radius)',
        padding: minimized ? '0.85rem 1.25rem' : '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🚀</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
              Guide de Démarrage & Configuration Initiale
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              Progression : {status.completedCount} sur {status.totalSteps} étapes complétées ({status.progressPercent}%)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setMinimized(!minimized)}
            className="btn-secondary"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: 'none',
            }}
          >
            {minimized ? 'Déplier le guide' : 'Réduire'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Masquer définitivement"
          >
            ✕ Masquer
          </button>
        </div>
      </div>

      {/* Barre de progression */}
      <div
        style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '3px',
          marginTop: '0.85rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${status.progressPercent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {!minimized && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.85rem',
            marginTop: '1.25rem',
          }}
        >
          {status.steps.map((step) => (
            <div
              key={step.id}
              style={{
                background: step.done ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: step.done ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: step.done ? '#6ee7b7' : '#f8fafc' }}>
                    {step.title}
                  </span>
                  <span>{step.done ? '✅' : '⏳'}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                  {step.description}
                </p>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                {step.done ? (
                  <span style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 600 }}>
                    Étape validée
                  </span>
                ) : (
                  <Link
                    to={step.path}
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.6rem',
                      background: '#3b82f6',
                      color: '#ffffff',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Configurer →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
