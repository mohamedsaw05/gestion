import { useEffect, useState, useRef, useMemo, type KeyboardEvent } from 'react';
import { api } from '../lib/api';

export interface ProductResult {
  id: string;
  name: string;
  sku?: string | null;
  basePrice: string;
  unit: string;
  isService?: boolean;
  hasVariants?: boolean;
  barcodes?: string[];
  brand?: string | null;
  stockOnHand?: number;
  stockReserved?: number;
  stockAvailable?: number;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SERVICE';
  otherLocationsStock?: {
    locationId: string;
    locationName: string;
    available: number;
  }[];
}

interface ProductSearchSelectorProps {
  selectedProduct: ProductResult | null;
  onSelect: (product: ProductResult, autoImmediateRestock?: boolean) => void;
  onClear?: () => void;
  locationId: string;
  placeholder?: string;
  disabled?: boolean;
  onTransferClick?: (product: ProductResult) => void;
}

export function ProductSearchSelector({
  selectedProduct,
  onSelect,
  onClear,
  locationId,
  placeholder = 'Rechercher par nom, référence SKU, code-barres, marque...',
  disabled = false,
  onTransferClick,
}: ProductSearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [filterType, setFilterType] = useState<'ALL' | 'IN_STOCK' | 'SERVICES'>('ALL');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Recherche serveur avec limite stricte à 10 résultats et indexation en temps réel
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<ProductResult[]>(
          `/products?search=${encodeURIComponent(query.trim())}&limit=10${locationId ? `&locationId=${locationId}` : ''}`,
        )
        .then((items) => {
          // Seuls les produits simples ou variantes sont vendables (les produits parents avec variantes ne sont pas vendables directement)
          const valid = (items || []).filter((p) => !p.hasVariants).slice(0, 10);
          setResults(valid);
          setHighlightedIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 150);

    return () => clearTimeout(timer);
  }, [query, isOpen, locationId]);

  // Fermer le dropdown lors d'un clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrage local rapide supplémentaire si l'utilisateur utilise les onglets
  const displayedResults = useMemo(() => {
    if (filterType === 'IN_STOCK') {
      return results.filter((p) => p.isService || (p.stockAvailable ?? 0) > 0);
    }
    if (filterType === 'SERVICES') {
      return results.filter((p) => p.isService);
    }
    return results;
  }, [results, filterType]);

  // Prise en charge des douchettes de codes-barres et navigation clavier intuitive
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < displayedResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Si un lecteur de code-barres a scanné ou si l'utilisateur a appuyé sur Entrée
      if (displayedResults.length > 0 && displayedResults[highlightedIndex]) {
        handleChoose(displayedResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleChoose = (prod: ProductResult) => {
    onSelect(prod);
    setIsOpen(false);
    setQuery('');
  };

  const formatPrice = (val: string | number) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString('fr-FR');
  };

  const formatStock = (val?: number) => {
    if (val === undefined || val === null) return '0';
    return Math.round(val).toLocaleString('fr-FR');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* ── État 1 : Produit sélectionné (Carte très claire, lisible et détaillée) ── */}
      {selectedProduct ? (
        <div
          style={{
            background: 'var(--surface, #ffffff)',
            border: '1.5px solid #cbd5e1',
            borderLeft: '5px solid #2563eb',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            transition: 'border-color 0.2s',
          }}
        >
          {/* Ligne 1 : Nom du produit en très grand et très lisible + Prix fort */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1 }}>
              <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                {selectedProduct.isService ? '🛠️' : '📦'}
              </span>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    color: '#0f172a',
                    lineHeight: 1.35,
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedProduct.name}
                </div>
                {selectedProduct.brand && (
                  <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 500, marginTop: '2px' }}>
                    Marque : <strong>{selectedProduct.brand}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Prix affiché en grand */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>
                {formatPrice(selectedProduct.basePrice)} XOF
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                par {selectedProduct.unit || 'unité'}
              </div>
            </div>
          </div>

          {/* Ligne 2 : Badges informatifs (Réf, Code-barres, État du stock) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
              {selectedProduct.sku && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: '#334155',
                    background: '#f1f5f9',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  Réf : {selectedProduct.sku}
                </span>
              )}

              {selectedProduct.barcodes && selectedProduct.barcodes.length > 0 && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: '#334155',
                    background: '#f1f5f9',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 500,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  Code : {selectedProduct.barcodes[0]}
                </span>
              )}

              {/* Statut du stock dans le magasin courant */}
              {selectedProduct.isService ? (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: '#0369a1',
                    background: '#e0f2fe',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                    border: '1px solid #bae6fd',
                  }}
                >
                  🛠️ Prestation de service (aucun stock physique)
                </span>
              ) : (selectedProduct.stockAvailable ?? 0) > 0 ? (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: '#15803d',
                    background: '#dcfce7',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                    border: '1px solid #bbf7d0',
                  }}
                >
                  ✓ En stock : {formatStock(selectedProduct.stockAvailable)} {selectedProduct.unit} disponible(s)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: '#b91c1c',
                    background: '#fee2e2',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                    border: '1px solid #fecaca',
                  }}
                >
                  ✕ Rupture dans ce magasin (0 disponible)
                </span>
              )}
            </div>

            {/* Boutons d'action : Remplacer l'article ou Supprimer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setIsOpen(true);
                  setTimeout(() => inputRef.current?.focus(), 60);
                }}
                className="btn-secondary"
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#1e293b',
                }}
              >
                🔍 Changer d'article
              </button>

              {onClear && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onClear}
                  title="Retirer cet article"
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.82rem',
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── État 2 : Aucun produit sélectionné (Champ de recherche grand format) ── */
        <div
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 60);
            }
          }}
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--surface, #ffffff)',
            border: '2px dashed #94a3b8',
            borderRadius: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!disabled) (e.currentTarget.style.borderColor = '#2563eb');
          }}
          onMouseLeave={(e) => {
            if (!disabled) (e.currentTarget.style.borderColor = '#94a3b8');
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem', color: '#2563eb' }}>🔍</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#1e293b' }}>
                Cliquez ici pour choisir ou scanner un produit
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Recherche par nom, référence SKU, marque ou douchette code-barres
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.85rem', color: '#64748b', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
            Choisir ▾
          </span>
        </div>
      )}

      {/* ── Dropdown Flottant : Menu de recherche & sélection professionnelle ── */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 2000,
            background: '#ffffff',
            border: '1.5px solid #94a3b8',
            borderRadius: '8px',
            boxShadow: '0 15px 35px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.06)',
            marginTop: '6px',
            maxHeight: '480px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Entête du menu : Champ de saisie et indicateur de douchette */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '0.75rem', fontSize: '1rem', color: '#64748b' }}>
                🔍
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                style={{
                  width: '100%',
                  fontSize: '0.95rem',
                  padding: '0.6rem 2.2rem 0.6rem 2.4rem',
                  borderRadius: '6px',
                  border: '1.5px solid #2563eb',
                  outline: 'none',
                  boxShadow: '0 0 0 3px rgba(37,99,235,0.15)',
                }}
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
                    background: 'none',
                    border: 'none',
                    fontSize: '1.1rem',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                  title="Effacer la recherche"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Guide et Filtres rapides pour l'utilisateur normal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#0369a1', background: '#e0f2fe', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                <span>📷 Douchette code-barres active</span>
                <span style={{ color: '#0284c7' }}>· Valide immédiatement à l'Entrée</span>
              </div>

              {/* Filtres rapides */}
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: filterType === 'ALL' ? '#2563eb' : '#ffffff',
                    color: filterType === 'ALL' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Tous ({results.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('IN_STOCK')}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: filterType === 'IN_STOCK' ? '#16a34a' : '#ffffff',
                    color: filterType === 'IN_STOCK' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  En stock
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('SERVICES')}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: filterType === 'SERVICES' ? '#0284c7' : '#ffffff',
                    color: filterType === 'SERVICES' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Services
                </button>
              </div>
            </div>
          </div>

          {/* Liste des résultats scrollable */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '340px' }}>
            {loading ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.9rem', color: '#64748b' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>⏳</div>
                Recherche de vos produits en cours...
              </div>
            ) : displayedResults.length === 0 ? (
              <div style={{ padding: '2rem 1.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#64748b' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>📦</div>
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>
                  {query ? `Aucun article trouvé pour « ${query} »` : 'Commencez à taper un nom ou scannez un article'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
                  Vérifiez l'orthographe du nom, la référence SKU ou essayez de saisir le code-barres complet.
                </div>
              </div>
            ) : (
              displayedResults.map((p, idx) => {
                const isSelected = idx === highlightedIndex;
                const isService = p.isService;
                const avail = p.stockAvailable ?? 0;
                const otherDepots = p.otherLocationsStock?.filter((o) => o.available > 0) || [];

                return (
                  <div
                    key={p.id}
                    onClick={() => handleChoose(p)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isSelected ? '#f0fdf4' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #16a34a' : '4px solid transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Nom de l'article en grand, clair et gras + Prix */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1 }}>
                        <span style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>
                          {isService ? '🛠️' : '📦'}
                        </span>
                        <div>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.98rem',
                              color: '#0f172a',
                              lineHeight: 1.35,
                            }}
                          >
                            {p.name}
                          </span>
                          {p.brand && (
                            <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.4rem', fontWeight: 500 }}>
                              ({p.brand})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Prix de vente */}
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: '#16a34a',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {formatPrice(p.basePrice)} XOF
                      </span>
                    </div>

                    {/* Ligne des badges : Réf, Code-barres et Disponibilité */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {p.sku && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              color: '#475569',
                              background: '#f1f5f9',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '3px',
                              fontWeight: 600,
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            Réf: {p.sku}
                          </span>
                        )}

                        {p.barcodes && p.barcodes.length > 0 && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              color: '#475569',
                              background: '#f1f5f9',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '3px',
                              fontWeight: 500,
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            Code: {p.barcodes[0]}
                          </span>
                        )}

                        {/* Disponibilité locale */}
                        {isService ? (
                          <span style={{ color: '#0284c7', fontWeight: 600, background: '#e0f2fe', padding: '0.1rem 0.45rem', borderRadius: '3px' }}>
                            🛠️ Prestation (non stocké)
                          </span>
                        ) : avail > 0 ? (
                          <span style={{ color: '#16a34a', fontWeight: 600, background: '#dcfce7', padding: '0.1rem 0.45rem', borderRadius: '3px' }}>
                            ✓ En stock magasin : {formatStock(avail)} {p.unit}
                          </span>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: '#dc2626', fontWeight: 600, background: '#fee2e2', padding: '0.1rem 0.45rem', borderRadius: '3px' }}>
                              ✕ Épuisé dans ce magasin
                            </span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onSelect(p, true);
                                setIsOpen(false);
                                setQuery('');
                              }}
                              style={{
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0.15rem 0.5rem',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
                              }}
                              title="Ajouter au panier avec approvisionnement immédiat et vendre directement"
                            >
                              ⚡ Vendre direct
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Disponibilité dans un autre dépôt avec transfert en 1 clic */}
                      {otherDepots.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 500 }}>
                            📦 Dispo ailleurs :{' '}
                            {otherDepots.map((o) => `${o.locationName} (${formatStock(o.available)})`).join(', ')}
                          </span>
                          {onTransferClick && (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setIsOpen(false);
                                onTransferClick(p);
                              }}
                              style={{
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                borderRadius: '4px',
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Transférer ici ⇄
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pied du dropdown : Raccourcis clavier d'assistance */}
          <div
            style={{
              padding: '0.45rem 0.85rem',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.74rem',
              color: '#64748b',
            }}
          >
            <span>
              <kbd style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>↑</kbd>{' '}
              <kbd style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>↓</kbd> Naviguer ·{' '}
              <kbd style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>Entrée</kbd> Valider ·{' '}
              <kbd style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>Échap</kbd> Fermer
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.76rem',
              }}
            >
              Fermer le menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
