import type { ReactNode } from 'react';

interface EmptyStateProps {
  type?: 'no-data' | 'no-results' | 'error' | 'unauthorized';
  title?: string;
  description?: string;
  icon?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({
  type = 'no-data',
  title,
  description,
  icon,
  action,
  children,
}: EmptyStateProps) {
  let defaultIcon = '📂';
  let defaultTitle = 'Aucun élément';
  let defaultDescription = 'Aucune donnée enregistrée pour le moment.';

  if (type === 'no-results') {
    defaultIcon = '🔍';
    defaultTitle = 'Aucun résultat trouvé';
    defaultDescription = 'Essayez de modifier ou de réinitialiser vos termes de recherche et filtres.';
  } else if (type === 'error') {
    defaultIcon = '⚠️';
    defaultTitle = 'Impossible de charger les données';
    defaultDescription = 'Une erreur est survenue lors de la communication avec le serveur.';
  } else if (type === 'unauthorized') {
    defaultIcon = '🔒';
    defaultTitle = 'Accès restreint';
    defaultDescription = 'Votre profil ne dispose pas des droits requis pour afficher ces données.';
  }

  return (
    <div className={`empty-state empty-state-${type}`}>
      <div className="empty-state-icon" aria-hidden="true">
        {icon ?? defaultIcon}
      </div>
      <h3 className="empty-state-title">{title ?? defaultTitle}</h3>
      <p className="empty-state-description">{description ?? defaultDescription}</p>
      {action && (
        <button
          type="button"
          className={type === 'no-data' ? 'primary' : ''}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
