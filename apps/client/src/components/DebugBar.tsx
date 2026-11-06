import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { estimateCacheSizeMb, purgeAppCache } from '../lib/cacheManager';
import { useToast } from './ToastContext';

export function DebugBar() {
  const { profile } = useAuth();
  const { addToast } = useToast();

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    return localStorage.getItem('vtm_debug_mode') === 'true';
  });

  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [cacheSize, setCacheSize] = useState<number>(estimateCacheSizeMb);
  const [festiveMode, setFestiveMode] = useState<string>(() => {
    return localStorage.getItem('vtm_festive_override') || 'CHRISTMAS';
  });
  const [costVisible, setCostVisible] = useState<boolean>(() => {
    return localStorage.getItem('vtm_permission_cost') === 'true';
  });

  // Global Ctrl + D shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsOpen((prev) => {
          const next = !prev;
          localStorage.setItem('vtm_debug_mode', String(next));
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Measure API latency
  const checkHealth = async () => {
    const start = performance.now();
    try {
      await api.get('/health');
      const latency = Math.round(performance.now() - start);
      setApiLatency(latency);
    } catch {
      setApiLatency(Math.round(performance.now() - start));
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkHealth();
      setCacheSize(estimateCacheSizeMb());
      const interval = setInterval(checkHealth, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handlePurgeCache = async () => {
    const res = await purgeAppCache(true);
    setCacheSize(estimateCacheSizeMb());
    addToast(`Cache système optimisé : ${res.freedMb} Mo libérés (${res.purgedItems} éléments nettoyés)`, 'success');
  };

  const handleSetFestive = (mode: 'CHRISTMAS' | 'NEW_YEAR' | 'DISABLED') => {
    localStorage.setItem('vtm_festive_override', mode);
    setFestiveMode(mode);
    window.dispatchEvent(new Event('vtm-festive-change'));
    addToast(
      mode === 'CHRISTMAS'
        ? '🎅 Mode Fêtes de Noël activé (neige, bonnet et cadeaux)'
        : mode === 'NEW_YEAR'
        ? '🎆 Mode Nouvel An activé (feux d’artifice et paillettes d’or)'
        : 'Thème standard rétabli',
      'info',
    );
  };

  const handleToggleCostVisibility = () => {
    const next = !costVisible;
    setCostVisible(next);
    localStorage.setItem('vtm_permission_cost', String(next));
    window.dispatchEvent(new Event('vtm-permission-change'));
    addToast(`Visibilité du prix d'achat : ${next ? 'ACTIVÉE (visible)' : 'MASQUÉE (confidentiel)'}`, 'info');
  };

  if (!isOpen) return null;

  return (
    <div className="vtm-debug-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span className="vtm-debug-badge">
          🐞 VTM DEBUG MODE (Ctrl+D)
        </span>

        <span className="vtm-debug-item">
          Tenant: <strong>{profile?.tenantId ? profile.tenantId.slice(0, 12) + '...' : 'Public'}</strong>
        </span>

        <span className="vtm-debug-item">
          Utilisateur: <strong>{profile?.fullName || profile?.email || 'Visiteur'}</strong>
        </span>

        <span className="vtm-debug-item">
          Latence API:
          <strong style={{ color: apiLatency !== null && apiLatency < 100 ? '#4ade80' : '#f87171' }}>
            {apiLatency !== null ? `${apiLatency} ms` : '...'}
          </strong>
        </span>

        <span className="vtm-debug-item">
          Cache: <strong>{cacheSize} Mo</strong>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {/* Règle Confidentialité Prix d'Achat */}
        <button
          type="button"
          onClick={handleToggleCostVisibility}
          className={`vtm-debug-btn ${costVisible ? 'active' : ''}`}
          title="Permet de basculer la visibilité du prix d'achat pour tester le rôle confidentiel"
        >
          {costVisible ? '👁️ Prix Achat: Visible' : '🔒 Prix Achat: Masqué'}
        </button>

        {/* Bouton Purge Cache */}
        <button
          type="button"
          onClick={handlePurgeCache}
          className="vtm-debug-btn"
          title="Vider et nettoyer le cache instantanément"
        >
          🧹 Vider Cache
        </button>

        {/* Festive Mode Switch */}
        <div style={{ display: 'flex', gap: '2px', background: '#334155', padding: '2px', borderRadius: '4px' }}>
          <button
            type="button"
            onClick={() => handleSetFestive('DISABLED')}
            className={`vtm-debug-btn ${festiveMode === 'DISABLED' ? 'active' : ''}`}
            style={{ border: 'none', padding: '2px 6px' }}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => handleSetFestive('CHRISTMAS')}
            className={`vtm-debug-btn ${festiveMode === 'CHRISTMAS' ? 'active' : ''}`}
            style={{ border: 'none', padding: '2px 6px', background: festiveMode === 'CHRISTMAS' ? '#b91c1c' : undefined }}
          >
            🎅 Noël
          </button>
          <button
            type="button"
            onClick={() => handleSetFestive('NEW_YEAR')}
            className={`vtm-debug-btn ${festiveMode === 'NEW_YEAR' ? 'active' : ''}`}
            style={{ border: 'none', padding: '2px 6px', background: festiveMode === 'NEW_YEAR' ? '#d97706' : undefined }}
          >
            🎆 Nouvel An
          </button>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            localStorage.setItem('vtm_debug_mode', 'false');
          }}
          className="vtm-debug-btn"
          title="Fermer la barre de debug (vous pouvez la rouvrir avec Ctrl+D)"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
