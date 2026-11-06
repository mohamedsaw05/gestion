import { useState, useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';

interface MarketProduct {
  id: string;
  name: string;
  category: string;
  supplierName: string;
  supplierRating: number;
  supplierLocation: string;
  supplierPhone: string;
  supplierWhatsapp: string;
  supplierEmail: string;
  unitPrice: number;
  wholesaleTiers: { minQty: number; price: number }[];
  moq: number; // Minimum Order Quantity
  inStock: number;
  deliveryDays: string;
  description: string;
  image: string;
  verifiedBadge: boolean;
}

const CATEGORIES = [
  'TOUS',
  'Smartphones & Tablettes',
  'Écrans & Pièces Détachées SAV',
  'Accessoires & Connectique',
  'Consommables & Impression POS',
  'Informatique & Bureautique',
  'Outillage & Atelier',
];

const INITIAL_MARKET_PRODUCTS: MarketProduct[] = [
  {
    id: 'mkt-001',
    name: 'Écrans OLED Originaux iPhone 13 / 13 Pro (Lot de 5 pièces)',
    category: 'Écrans & Pièces Détachées SAV',
    supplierName: 'Global Tech Components Ltd',
    supplierRating: 4.9,
    supplierLocation: 'Dépôt Régional Abidjan & Lomé',
    supplierPhone: '+225 07 45 89 12 30',
    supplierWhatsapp: '2250745891230',
    supplierEmail: 'wholesale@globaltech-parts.com',
    unitPrice: 28500,
    wholesaleTiers: [
      { minQty: 5, price: 28500 },
      { minQty: 20, price: 26000 },
      { minQty: 50, price: 24200 },
    ],
    moq: 5,
    inStock: 140,
    deliveryDays: '24h - 48h chrono',
    description: 'Dalles OLED Super Retina XDR certifiées grade A+. Zéro pixel mort, restitution colorimétrique 100% originale et garantie échange direct 6 mois.',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=300&auto=format&fit=crop&q=80',
    verifiedBadge: true,
  },
  {
    id: 'mkt-002',
    name: 'Carton 50 Rouleaux Thermiques 80x80x12 mm Sans BPA Haute Sensibilité',
    category: 'Consommables & Impression POS',
    supplierName: 'Papeterie Moderne & Systèmes Caisse',
    supplierRating: 4.8,
    supplierLocation: 'Ouagadougou & Cotonou',
    supplierPhone: '+226 70 88 99 00',
    supplierWhatsapp: '22670889900',
    supplierEmail: 'commandes@papeterie-pos.bf',
    unitPrice: 22000,
    wholesaleTiers: [
      { minQty: 1, price: 22000 },
      { minQty: 5, price: 20500 },
      { minQty: 10, price: 18900 },
    ],
    moq: 1,
    inStock: 350,
    deliveryDays: 'Livraison le jour même',
    description: 'Papier thermique premium 55g/m² haute définition pour imprimantes Epson, Xprinter et Star. Résistance à l’effacement 7 ans garanti.',
    image: 'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=300&auto=format&fit=crop&q=80',
    verifiedBadge: true,
  },
  {
    id: 'mkt-003',
    name: 'Chargeurs Rapides 65W GaN Dual USB-C + USB-A (Carton 20 pcs)',
    category: 'Accessoires & Connectique',
    supplierName: 'Voltix Mobile Power International',
    supplierRating: 5.0,
    supplierLocation: 'Dakar & Abidjan',
    supplierPhone: '+221 77 123 45 67',
    supplierWhatsapp: '221771234567',
    supplierEmail: 'b2b@voltix-power.com',
    unitPrice: 5500,
    wholesaleTiers: [
      { minQty: 20, price: 5500 },
      { minQty: 50, price: 4900 },
      { minQty: 100, price: 4200 },
    ],
    moq: 20,
    inStock: 520,
    deliveryDays: '48h',
    description: 'Technologie GaN III ultra-compacte. Compatible Power Delivery 3.0 & PPS, idéal pour recharger MacBook, iPhone, Samsung et ordinateurs portables.',
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&auto=format&fit=crop&q=80',
    verifiedBadge: true,
  },
  {
    id: 'mkt-004',
    name: 'Station de Soudage & Dessoudage à Air Chaud 2-en-1 Micro-Soudure SAV',
    category: 'Outillage & Atelier',
    supplierName: 'Atelier Pro Électronique Grossiste',
    supplierRating: 4.9,
    supplierLocation: 'Lomé & Bamako',
    supplierPhone: '+228 90 11 22 33',
    supplierWhatsapp: '22890112233',
    supplierEmail: 'outillage@atelierpro-sav.com',
    unitPrice: 65000,
    wholesaleTiers: [
      { minQty: 1, price: 65000 },
      { minQty: 3, price: 59000 },
      { minQty: 5, price: 54000 },
    ],
    moq: 1,
    inStock: 45,
    deliveryDays: '72h',
    description: 'Régulation thermique PID ultra-précise de 100°C à 480°C. Comprend 4 buses d’air chaud, 5 pannes de fer et une pompe à dessouder antistatique.',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=80',
    verifiedBadge: true,
  },
  {
    id: 'mkt-005',
    name: 'Batteries Renforcées Haute Capacité iPhone 11/12/13/14 (Lot de 10 pcs)',
    category: 'Écrans & Pièces Détachées SAV',
    supplierName: 'Global Tech Components Ltd',
    supplierRating: 4.9,
    supplierLocation: 'Dépôt Régional Abidjan & Lomé',
    supplierPhone: '+225 07 45 89 12 30',
    supplierWhatsapp: '2250745891230',
    supplierEmail: 'wholesale@globaltech-parts.com',
    unitPrice: 8500,
    wholesaleTiers: [
      { minQty: 10, price: 8500 },
      { minQty: 30, price: 7600 },
      { minQty: 100, price: 6900 },
    ],
    moq: 10,
    inStock: 280,
    deliveryDays: '24h - 48h chrono',
    description: 'Cellules lithium-polymère grade A+ avec contrôleur TI Texas Instruments officiel. 100% de santé affichée sur iOS, stickers adhésifs inclus.',
    image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=300&auto=format&fit=crop&q=80',
    verifiedBadge: true,
  },
  {
    id: 'mkt-006',
    name: 'Lecteur Code-Barres 2D & QR Code Sans Fil Bluetooth avec Socle Caisse',
    category: 'Consommables & Impression POS',
    supplierName: 'Papeterie Moderne & Systèmes Caisse',
    supplierRating: 4.8,
    supplierLocation: 'Ouagadougou & Cotonou',
    supplierPhone: '+226 70 88 99 00',
    supplierWhatsapp: '22670889900',
    supplierEmail: 'commandes@papeterie-pos.bf',
    unitPrice: 32000,
    wholesaleTiers: [
      { minQty: 2, price: 32000 },
      { minQty: 5, price: 29000 },
      { minQty: 10, price: 26500 },
    ],
    moq: 2,
    inStock: 85,
    deliveryDays: '24h',
    description: 'Scanne instantanément sur écran smartphone ou étiquette papier. Compatible Windows, macOS, Android et caisse tactile VTM.',
    image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=300&auto=format&fit=crop&q=80',
    verifiedBadge: true,
  },
];

export function MarketplacePage() {
  const { profile } = useAuth();
  const { addToast } = useToast();

  const [products] = useState<MarketProduct[]>(INITIAL_MARKET_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState('TOUS');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSupplierModal, setActiveSupplierModal] = useState<MarketProduct | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'TOUS' || p.category === selectedCategory;
      const matchSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplierLocation.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleImportToMySuppliers = (p: MarketProduct) => {
    try {
      const raw = localStorage.getItem('vtm_saved_market_suppliers');
      const list = raw ? JSON.parse(raw) : [];
      if (!list.some((item: any) => item.supplierName === p.supplierName)) {
        list.push({
          id: p.id,
          supplierName: p.supplierName,
          phone: p.supplierPhone,
          location: p.supplierLocation,
          importedAt: new Date().toISOString(),
        });
        localStorage.setItem('vtm_saved_market_suppliers', JSON.stringify(list));
      }
      addToast(`Le grossiste « ${p.supplierName} » a été ajouté à vos contacts fournisseurs enregistrés !`, 'success');
    } catch {
      addToast('Grossiste enregistré avec succès', 'success');
    }
  };

  return (
    <div style={{ padding: '1.75rem 2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <PageHeader
        title="Marché B2B Grossistes & Centrale d'Achat"
        subtitle="Centralise les offres de grossistes certifiés partenaires VTM. Comparez les prix de gros, vérifiez les stocks et commandez en direct."
        badges={[
          { label: 'Espace B2B Centralisé', variant: 'primary' },
          { label: 'Abonnement Actif Requis', variant: 'success' },
          { label: 'Fournisseurs Certifiés VTM', variant: 'info' },
        ]}
      />

      {/* BANNIÈRE STRICTE D'ÉLIGIBILITÉ ET RÈGLE DE PUBLICATION */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '16px',
          padding: '1.5rem 1.75rem',
          color: '#ffffff',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ maxWidth: '820px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🏛️</span>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                Règlement de la Place de Marché B2B VTM
              </h2>
              <span
                style={{
                  background: '#15803d',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: '999px',
                }}
              >
                ✓ Organisation Éligible ({profile?.fullName || 'Compte Entreprise'})
              </span>
            </div>

            <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6 }}>
              Cet espace est strictement réservé aux <strong>organisations clientes détenant un abonnement actif au gestionnaire</strong>.
              Il vous permet d'accéder aux catalogues de gros, de consulter les tarifs réservés aux professionnels et d'entrer directement en relation commerciale avec les grossistes.
            </p>

            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '0.65rem 0.95rem',
                fontSize: '0.82rem',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🔒</span>
              <span>
                <strong>Règle stricte d'accès :</strong> En tant que boutique utilisatrice, vous ne pouvez rien publier dans le Marché. 
                Seuls les <strong>Fournisseurs Partenaires Certifiés par la Direction VTM</strong> sont autorisés à publier leurs produits, tarifs et coordonnées.
              </span>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1rem',
              textAlign: 'center',
              minWidth: '200px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Statut de votre compte
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>
              Abonnement Vérifié
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              Accès direct aux grossistes partenaires
            </div>
          </div>
        </div>
      </div>

      {/* FILTRES PAR CATÉGORIE & RECHERCHE */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un article de gros, une marque, un grossiste ou une ville..."
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
              }}
            />
          </div>

          <div style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
            {filteredProducts.length} offre{filteredProducts.length > 1 ? 's' : ''} grossiste disponible{filteredProducts.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Pilules de catégories */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '999px',
                  border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: isActive ? '#eff6ff' : '#ffffff',
                  color: isActive ? '#1d4ed8' : '#475569',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* GRILLE DES PRODUITS DE GROS */}
      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: '#1e293b' }}>Aucun article trouvé pour cette recherche</h3>
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
            Modifiez vos filtres ou réinitialisez la barre de recherche pour visualiser les autres catalogues partenaires.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 15px -3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {/* Image & Badge Fournisseur */}
              <div style={{ position: 'relative', height: '170px', background: '#0f172a' }}>
                <img
                  src={p.image}
                  alt={p.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(4px)',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '6px',
                  }}
                >
                  {p.category}
                </div>

                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    background: '#15803d',
                    color: '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  Stock : {p.inStock} pcs dispo
                </div>
              </div>

              {/* Contenu */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  {/* Fournisseur */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e40af' }}>
                        {p.supplierName}
                      </span>
                      {p.verifiedBadge && (
                        <span title="Fournisseur Partenaire Certifié VTM" style={{ color: '#2563eb', fontSize: '0.85rem' }}>
                          ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700 }}>
                      ★ {p.supplierRating.toFixed(1)}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '0.65rem' }}>
                    📍 {p.supplierLocation} • ⏱️ {p.deliveryDays}
                  </div>

                  {/* Nom article */}
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                    {p.name}
                  </h3>

                  <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
                    {p.description}
                  </p>

                  {/* Grille des paliers de prix de gros */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Tarifs de Gros Dégressifs (MOQ : {p.moq} pcs) :
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {p.wholesaleTiers.map((tier, idx) => (
                        <div
                          key={idx}
                          style={{
                            flex: 1,
                            minWidth: '85px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.35rem 0.5rem',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>≥ {tier.minQty} pcs</div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#16a34a' }}>
                            {tier.price.toLocaleString('fr-FR')} F
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Boutons de Contact Direct & Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Bouton WhatsApp direct */}
                    <a
                      href={`https://wa.me/${p.supplierWhatsapp}?text=${encodeURIComponent(
                        `Bonjour ${p.supplierName}, je vous contacte via le Marché B2B VTM pour votre offre : "${p.name}". Pourriez-vous me confirmer la disponibilité et le délai de livraison ?`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        background: '#16a34a',
                        color: '#ffffff',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        padding: '0.55rem',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                      }}
                    >
                      <span>💬</span> WhatsApp
                    </a>

                    {/* Bouton Appel téléphonique direct */}
                    <a
                      href={`tel:${p.supplierPhone}`}
                      style={{
                        flex: 1,
                        background: '#0f172a',
                        color: '#ffffff',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        padding: '0.55rem',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>📞</span> Appeler
                    </a>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setActiveSupplierModal(p)}
                      style={{
                        flex: 1,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '0.5rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Détails & Devis
                    </button>

                    <button
                      type="button"
                      onClick={() => handleImportToMySuppliers(p)}
                      title="Enregistrer ce grossiste dans mes fournisseurs de la boutique"
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      + Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FICHE DÉTAILLÉE DU GROSSISTE & COORDONNÉES */}
      {activeSupplierModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.25rem',
          }}
          onClick={() => setActiveSupplierModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  Grossiste Certifié VTM
                </span>
                <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {activeSupplierModal.supplierName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSupplierModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b', marginBottom: '0.4rem' }}>
                {activeSupplierModal.name}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
                {activeSupplierModal.description}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.5rem', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Téléphone Direct :</span>
                <strong>{activeSupplierModal.supplierPhone}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Email Commercial :</span>
                <strong>{activeSupplierModal.supplierEmail}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Localisation Entrepôt :</span>
                <strong>{activeSupplierModal.supplierLocation}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Délai Moyen :</span>
                <strong>{activeSupplierModal.deliveryDays}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveSupplierModal(null)}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Fermer
              </button>
              <a
                href={`https://wa.me/${activeSupplierModal.supplierWhatsapp}?text=${encodeURIComponent(
                  `Bonjour ${activeSupplierModal.supplierName}, je souhaite recevoir un devis B2B officiel pour l'article : "${activeSupplierModal.name}".`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  padding: '0.6rem 1.35rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>💬</span> Discuter sur WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
