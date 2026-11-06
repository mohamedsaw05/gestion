import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderBadge {
  label: string;
  variant?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  badges?: PageHeaderBadge[];
  primaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
  };
  secondaryActions?: ReactNode;
  showBack?: boolean;
  backUrl?: string;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  badges,
  primaryAction,
  secondaryActions,
  showBack,
  backUrl,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="page-header">
      <div className="page-header-main">
        <div className="page-header-title-row">
          {showBack && (
            <button
              type="button"
              className="btn-back"
              onClick={() => (backUrl ? navigate(backUrl) : navigate(-1))}
              aria-label="Retour"
              title="Retourner à la page précédente"
            >
              ←
            </button>
          )}
          <h1 className="page-title">{title}</h1>
          {badge && <div className="page-header-badge">{badge}</div>}
          {badges && badges.length > 0 && (
            <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
              {badges.map((b, i) => (
                <span key={i} className={`badge ${b.variant ? `badge-${b.variant}` : 'badge-info'}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>

      {(primaryAction || secondaryActions) && (
        <div className="page-header-actions">
          {secondaryActions}
          {primaryAction && (
            <button
              type="button"
              className={primaryAction.variant === 'secondary' ? 'btn-secondary btn-primary-action' : 'primary btn-primary-action'}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
            >
              {primaryAction.loading ? (
                'Chargement...'
              ) : (
                <>
                  {primaryAction.icon && <span className="btn-icon">{primaryAction.icon}</span>}
                  {primaryAction.label}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
