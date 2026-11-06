import { useEffect, useState } from 'react';

const APP_LOGIN_URL = (import.meta as any).env?.VITE_APP_URL || 'http://localhost:5180/login';
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';
const WHATSAPP_URL = 'https://wa.me/22672744595?text=Bonjour%20VTM,%20je%20souhaite%20d%C3%A9marrer%20mon%20essai%20gratuit%20de%2014%20jours';
const PHONE_NUMBER = '+226 72 74 45 95';

interface FeatureItem {
  icon: string;
  title: string;
  tag: string;
  description: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: '🛒',
    title: 'Caisse POS & Vente Comptoir',
    tag: 'Vitesse & Fluidité',
    description: 'Enregistrez un article en 2 secondes au clavier (Ctrl+K) ou au lecteur code-barres. Calcul automatique du rendu de monnaie et impression instantanée.',
  },
  {
    icon: '📦',
    title: 'Gestion des Stocks & Lots',
    tag: 'Traçabilité',
    description: 'Suivi rigoureux des quantités par boutique et par dépôt. Gestion des numéros de lot et alertes sur les dates de péremption pour éviter les pertes.',
  },
  {
    icon: '🧾',
    title: 'Factures & Reçus Thermiques',
    tag: 'Impression 80mm & A4',
    description: '5 modèles de factures professionnelles avec votre logo, devise XOF et mentions légales. Compatible imprimantes thermiques de caisse et laser.',
  },
  {
    icon: '💳',
    title: 'Crédits Clients & Balance Âgée',
    tag: 'Recouvrement',
    description: 'Ne perdez plus un seul franc de créance. Suivez les soldes dus, les plafonds autorisés et imprimez les relevés de compte pour vos clients.',
  },
  {
    icon: '💸',
    title: 'Dépenses & Charges Opérationnelles',
    tag: 'Rentabilité Réelle',
    description: 'Enregistrez vos loyers, électricité, frais de transport et salaires. Le système déduit automatiquement ces montants pour calculer votre bénéfice net.',
  },
  {
    icon: '⏱️',
    title: 'Personnel & Feuilles de Temps',
    tag: 'Gestion RH',
    description: 'Pointage personnel des arrivées et départs. Planning hebdomadaire paramétrable : les jours de fermeture ne sont jamais comptabilisés en absence.',
  },
  {
    icon: '🛠️',
    title: 'Prestations de Services & SAV',
    tag: 'Ateliers & Réparations',
    description: 'Gestion des ordres de réparation, suivi d’avancement technique, devis d’intervention et pièces détachées associées au dossier.',
  },
  {
    icon: '🚚',
    title: 'Fournisseurs & Réceptions',
    tag: 'Achats & Coûts',
    description: 'Bons de commande fournisseurs, contrôle des arrivages en magasin et réactualisation automatique des prix de revient moyens pondérés.',
  },
  {
    icon: '🏬',
    title: 'Multi-Boutiques & Dépôts',
    tag: 'Réseau de Vente',
    description: 'Contrôlez plusieurs magasins ou réserves de stockage depuis un seul compte. Effectuez des transferts de marchandises sécurisés d’un clic.',
  },
  {
    icon: '📱',
    title: 'E-commerce & Réseaux Sociaux',
    tag: 'Vente Connectée',
    description: 'Générez des liens de commande prêts à partager sur WhatsApp, TikTok et Facebook avec catalogue photo et calcul du total panier.',
  },
  {
    icon: '🔒',
    title: 'Rôles & Permissions Sécurisées',
    tag: 'Protection des Données',
    description: 'Vos caissiers n’ont pas accès aux marges ni au bénéfice. Les gérants contrôlent la caisse et seuls les administrateurs valident les annulations.',
  },
  {
    icon: '📊',
    title: 'Valorisation & Ratios Métiers',
    tag: 'Indicateurs Financiers',
    description: 'Calcul en direct de la valeur patrimoniale de votre stock, de la rotation des articles et de la marge brute par famille de produits.',
  },
  {
    icon: '🔌',
    title: 'Douchettes & Scanners USB/Bluetooth',
    tag: 'Matériel Plug-and-Play',
    description: 'Les lecteurs USB ou Bluetooth qui saisissent les codes comme un clavier peuvent être utilisés dans les champs adaptés. Le support caméra dépend du navigateur et du terminal.',
  },
  {
    icon: '📥',
    title: 'Sauvegarde Intégrale Zéro Perte',
    tag: 'Indépendance Totale',
    description: 'Téléchargez à tout moment une copie complète de vos clients, articles et ventes en format JSON et Excel pour une souveraineté totale de vos données.',
  },
  {
    icon: '⚡',
    title: 'Résilience & Mode Déconnecté',
    tag: 'Continuité de Service',
    description: 'Le gestionnaire requiert une connexion Internet pour accéder aux données et enregistrer les opérations en ligne.',
  },
  {
    icon: '🤝',
    title: 'Support & Assistance à Ouagadougou',
    tag: 'Proximité Locale',
    description: 'Une équipe locale disponible tous les jours de 09h à 21h, heure d’Ouagadougou. Vous pouvez déposer une demande à tout moment.',
  },
];

const FAQS = [
  {
    q: 'Combien coûte réellement le logiciel VTM ?',
    a: 'Après 14 jours d’essai gratuit, choisissez une formule trimestrielle, semestrielle, annuelle ou biennale. Les durées d’un et deux mois ne sont pas proposées à l’achat.',
  },
  {
    q: 'Faut-il renseigner une carte bancaire pour démarrer l’essai gratuit ?',
    a: 'Non, aucune carte bancaire ni aucun paiement n’est exigé pour démarrer. Vous disposez de 14 jours d’accès complet pour tester le logiciel dans votre magasin avec vos propres articles.',
  },
  {
    q: 'Comment se déroule la formation de la personne référente ?',
    a: 'Chaque abonnement inclut une session complète de formation pour 1 personne de votre équipe (gérant, caissier ou responsable de stock). La formation se fait soit en présentiel dans nos locaux à Ouagadougou (quartier Tampouy), soit en visioconférence HD personnalisée.',
  },
  {
    q: 'Le logiciel fonctionne-t-il sur mon téléphone ou ma tablette ?',
    a: 'Oui ! VTM est 100% responsive et fonctionne parfaitement sur smartphone Android, iPhone, tablette iPad/Android et ordinateur PC (Windows, Mac, Linux) via un navigateur web moderne.',
  },
  {
    q: 'Quelles imprimantes de reçus sont compatibles ?',
    a: 'VTM est compatible avec toutes les imprimantes thermiques de caisse standards (format 80mm et 58mm en USB, Bluetooth ou Réseau/Ethernet) ainsi qu’avec les imprimantes de bureau ordinaires pour les factures A4.',
  },
  {
    q: 'Que se passe-t-il si j’ai un problème ou une question ?',
    a: 'Vous contactez directement notre équipe d’assistance au +226 72 74 45 95 (Appel & WhatsApp). Nous répondons rapidement et pouvons nous déplacer dans votre magasin à Ouagadougou si nécessaire.',
  },
];

export default function App() {
  const [commercialSettings, setCommercialSettings] = useState<any | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerPassword: '',
    businessType: 'BOUTIQUE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/commercial/settings`)
      .then((response) => { if (!response.ok) throw new Error('settings unavailable'); return response.json(); })
      .then((value) => { if (active) setCommercialSettings(value); })
      .catch(() => { if (active) setCommercialSettings(null); });
    return () => { active = false; };
  }, []);

  const handleTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erreur lors de la création de l’organisation');
      }
      setSubmitSuccess(data);
      if (data.accessToken) {
        try {
          localStorage.setItem('vtm_access_token', data.accessToken);
          localStorage.setItem('vtm_refresh_token', data.refreshToken);
        } catch {}
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Impossible de joindre le serveur. Vérifiez votre connexion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top Bar Avis & Localisation ── */}
      <div style={{ background: '#0e1222', color: '#94a3b8', fontSize: '0.8rem', padding: '0.45rem 0', borderBottom: '1px solid #1e2648' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📍</span>
            <span>Ouagadougou, quartier Tampouy, vers collège Ave Maria</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a href={`tel:${PHONE_NUMBER.replace(/\s+/g, '')}`} style={{ color: '#38bdf8', fontWeight: 600 }}>
              📞 {PHONE_NUMBER}
            </a>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>🟢 Assistance 7j/7 (09h–21h, Ouagadougou)</span>
          </div>
        </div>
      </div>

      {/* ── Navigation Header ── */}
      <header className="glass-header">
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '70px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', color: '#fff' }}>
              V
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.2rem', letterSpacing: '-0.02em', color: '#fff' }}>
                VTM <span style={{ color: '#818cf8', fontSize: '0.82rem', fontWeight: 700 }}>ViralTech Market</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '-2px' }}>
                Gestion Commerciale SaaS Universelle
              </div>
            </div>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', fontSize: '0.9rem', fontWeight: 600 }} className="desktop-nav">
            <a href="#features" style={{ color: '#cbd5e1' }}>Fonctionnalités</a>
            <a href="#training" style={{ color: '#cbd5e1' }}>Formation Incluse</a>
            <a href="#pricing" style={{ color: '#cbd5e1' }}>Formules & tarifs</a>
            <a href="#faq" style={{ color: '#cbd5e1' }}>Questions (FAQ)</a>
            <a href="#contact" style={{ color: '#cbd5e1' }}>Contact & Agence</a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a
              href={APP_LOGIN_URL}
              className="btn-outline"
              style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
            >
              Se connecter
            </a>
            <button
              type="button"
              onClick={() => {
                setSubmitSuccess(null);
                setSubmitError(null);
                setShowTrialModal(true);
              }}
              className="btn-primary"
              style={{ padding: '0.55rem 1.15rem', fontSize: '0.85rem' }}
            >
              Essai Gratuit 14j
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="hero-gradient">
        <div className="container" style={{ textAlign: 'center', maxWidth: 960 }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <span className="badge-offer">
              ✨ 14 JOURS D'ESSAI GRATUIT · FORMULES DE 3 À 24 MOIS
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.1rem, 4.5vw, 3.4rem)', fontWeight: 900, lineHeight: 1.18, letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>
            Le logiciel tout-en-un de caisse, stocks et facturation pour commerçants exigeants
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 1.8vw, 1.2rem)', color: '#94a3b8', lineHeight: 1.6, maxWidth: 820, margin: '0 auto 2.5rem' }}>
            Enregistrez vos ventes en 5 secondes, surveillez vos stocks et encaissez vos créances sans erreurs de calcul. Conçu sur mesure pour les boutiques, magasins et entreprises du Burkina Faso et de la sous-région.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
            <button
              type="button"
              onClick={() => {
                setSubmitSuccess(null);
                setSubmitError(null);
                setShowTrialModal(true);
              }}
              className="btn-primary"
              style={{ fontSize: '1.05rem', padding: '1rem 2rem' }}
            >
              <span>🚀</span>
              <span>Démarrer l'Essai Gratuit 14 Jours</span>
            </button>

            <a
              href={`https://wa.me/22672744595`}
              target="_blank"
              rel="noreferrer"
              className="btn-whatsapp"
              style={{ fontSize: '1.05rem', padding: '1rem 1.75rem' }}
            >
              <span>💬</span>
              <span>WhatsApp : +226 72 74 45 95</span>
            </a>
          </div>

          {/* Micro-atouts rassurants */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#38bdf8' }}>14 Jours Offerts</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Sans carte bancaire requise</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>{commercialSettings ? `${Number(commercialSettings.monthlyReferencePrice).toLocaleString('fr-FR')} FCFA / mois de référence` : 'Tarifs officiels'}</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Formules payantes 3, 6, 12 ou 24 mois</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b' }}>Formation Incluse</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>1 personne référente formée</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#a855f7' }}>Assistance Locale</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Ouverte 7j/7 de 09h à 21h</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section : Formation Certifiée Incluse ── */}
      <section id="training" style={{ background: '#ffffff', padding: '4.5rem 0', borderBottom: '1px solid #e2e8f0' }}>
        <div className="container">
          <div
            style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
              borderRadius: '20px',
              padding: '2.5rem 3rem',
              color: '#ffffff',
              boxShadow: '0 20px 40px rgba(49, 46, 129, 0.2)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2.5rem',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ background: '#4f46e5', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: '6px', textTransform: 'uppercase' }}>
                Engagement VTM Qualité
              </span>
              <h2 style={{ fontSize: '1.9rem', fontWeight: 900, margin: '0.75rem 0 1rem', lineHeight: 1.25, color: '#ffffff' }}>
                🎓 Formation complète incluse pour 1 personne référente
              </h2>
              <p style={{ fontSize: '0.95rem', color: '#e0e7ff', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Nous ne vous laissons jamais seul avec le logiciel. Chaque abonnement comprend une formation opérationnelle personnalisée de votre gérant, caissier principal ou magasinier pour garantir une maîtrise parfaite dès le premier jour.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.9rem', color: '#c7d2fe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#34d399', fontWeight: 800 }}>✓</span>
                  <span><strong>Au choix :</strong> En présentiel à notre agence de Ouagadougou (Tampouy) ou en visioconférence HD.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#34d399', fontWeight: 800 }}>✓</span>
                  <span>Paramétrage complet de vos articles, prix, logo et imprimante de tickets.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#34d399', fontWeight: 800 }}>✓</span>
                  <span>Entraînement pratique aux ventes, encaissements, remises et inventaires.</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '1.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📍</div>
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#ffffff' }}>Agence VTM Ouagadougou</h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                Quartier Tampouy, vers le collège Ave Maria<br />Ouagadougou, Burkina Faso
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <a
                  href="https://wa.me/22672744595"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: '#22c55e',
                    color: '#fff',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    textDecoration: 'none',
                  }}
                >
                  Prendre rendez-vous sur WhatsApp
                </a>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Lundi au dimanche : 09h00–21h00 (Africa/Ouagadougou)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section : 16 Fonctionnalités Clés ── */}
      <section id="features" style={{ padding: '5rem 0', background: '#f8fafc' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 780, margin: '0 auto 3.5rem' }}>
            <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Périmètre Fonctionnel Complet
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', margin: '0.5rem 0 1rem', letterSpacing: '-0.02em' }}>
              Tout ce dont votre commerce a besoin pour grandir en toute sérénité
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6 }}>
              Fini les cahiers de vente raturés, les ruptures de stock imprévues et les calculs de bénéfice approximatifs. VTM automatise l'ensemble de votre chaîne commerciale.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {FEATURES.map((feat, idx) => (
              <div key={idx} className="feature-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '2.2rem' }}>{feat.icon}</span>
                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                      {feat.tag}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.55 }}>
                    {feat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarification officielle chargée depuis la configuration centrale ── */}
      <section id="pricing" style={{ padding: '5rem 0', background: '#0a0d1a', color: '#ffffff' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 3rem' }}>
            <span style={{ color: '#818cf8', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Transparence & Simplicité
            </span>
            <h2 style={{ fontSize: '2.3rem', fontWeight: 900, margin: '0.5rem 0 1rem' }}>
              Choisissez votre durée d’abonnement.
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem' }}>
              Les montants sont calculés depuis le tarif mensuel de référence. Les paiements d’un ou deux mois ne sont pas proposés.
            </p>
          </div>

          {!commercialSettings ? <p role="status" style={{ textAlign: 'center', color: '#cbd5e1' }}>Les tarifs officiels sont momentanément indisponibles. Réessayez lorsque la connexion au service sera rétablie.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {commercialSettings.plans.map((plan: { months: number; label: string; totalPrice: number }) => <div key={plan.months} className="pricing-card-highlight" style={{ minHeight: 'auto' }}>
              <div style={{ position: 'absolute', top: 20, right: 20 }}>
                <span style={{ background: '#22c55e', color: '#ffffff', padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800 }}>
                  OFFRE OFFICIELLE
                </span>
              </div>

              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#c7d2fe', marginBottom: '0.5rem' }}>
                Formule {plan.label}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2.6rem', fontWeight: 900, color: '#ffffff' }}>{Number(plan.totalPrice).toLocaleString('fr-FR')}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#818cf8' }}>FCFA / {plan.months} mois</span>
              </div>
              <div style={{ color: '#cbd5e1', marginBottom: 16 }}>{Number(commercialSettings.monthlyReferencePrice).toLocaleString('fr-FR')} FCFA par mois · début à la confirmation · échéance après {plan.months} mois calendaires</div>

              <div style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 700, marginBottom: '2rem' }}>
                ✓ 14 jours d'essai 100% gratuit avant le premier paiement
              </div>

              <div style={{ borderTop: '1px solid #2a3356', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.75rem', color: '#f1f5f9' }}>
                  Inclus dans votre forfait :
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem', color: '#cbd5e1' }}>
                  <div>✓ Utilisateurs et caissiers illimités</div>
                  <div>✓ Nombre de ventes et reçus illimité</div>
                  <div>✓ Catalogue d'articles et codes-barres illimité</div>
                  <div>✓ Multi-boutiques et multi-dépôts inclus</div>
                  <div>✓ Factures normalisées & reçus 80mm avec votre logo</div>
                  <div>✓ <strong>1 session de formation offerte</strong> pour votre référent</div>
                  <div>✓ Assistance tous les jours de {commercialSettings.support.opensAt} à {commercialSettings.support.closesAt} ({commercialSettings.support.timeZone})</div>
                  <div>✓ Mises à jour automatiques incluses</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSubmitSuccess(null);
                  setSubmitError(null);
                  setShowTrialModal(true);
                }}
                className="btn-primary"
                style={{ width: '100%', textAlign: 'center', padding: '1rem', fontSize: '1.05rem', cursor: 'pointer' }}
              >
                Démarrer mon Essai Gratuit de 14 Jours
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.85rem', fontSize: '0.76rem', color: '#64748b' }}>
                Règlement par Orange Money, Moov Money, Wave, Virement ou Espèces.
              </div>
            </div>)}
          </div>}
        </div>
      </section>

      {/* ── Section : FAQ ── */}
      <section id="faq" style={{ padding: '5rem 0', background: '#ffffff' }}>
        <div className="container" style={{ maxWidth: 840 }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>
              Foire Aux Questions
            </span>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', margin: '0.5rem 0 0.5rem' }}>
              Questions Fréquentes des Commerçants
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
              Toutes les réponses transparentes pour démarrer en toute confiance.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    style={{
                      width: '100%',
                      padding: '1.1rem 1.25rem',
                      background: isOpen ? '#f8fafc' : '#ffffff',
                      border: 'none',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: '0.98rem',
                      color: isOpen ? '#4f46e5' : '#0f172a',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{item.q}</span>
                    <span style={{ fontSize: '1.2rem', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '1rem 1.25rem 1.25rem', background: '#ffffff', color: '#475569', fontSize: '0.9rem', lineHeight: 1.6, borderTop: '1px solid #f1f5f9' }}>
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section : Contact & Localisation ── */}
      <section id="contact" style={{ padding: '5rem 0', background: '#f1f5f9', borderTop: '1px solid #e2e8f0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>
                Contact Direct & Visite
              </span>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', margin: '0.5rem 0 1rem' }}>
                Passez nous voir à notre agence ou écrivez-nous
              </h2>
              <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Notre équipe est à votre disposition pour vous faire une démonstration en direct, vous conseiller sur le matériel de caisse ou vous aider à importer vos articles.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.3rem' }}>📍</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Adresse de l'Agence :</div>
                    <div style={{ color: '#475569', fontSize: '0.88rem' }}>
                      Ouagadougou, quartier Tampouy, vers le collège Ave Maria<br />Burkina Faso
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.3rem' }}>📞</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Téléphone & WhatsApp :</div>
                    <a href={`tel:${PHONE_NUMBER.replace(/\s+/g, '')}`} style={{ color: '#4f46e5', fontWeight: 700, fontSize: '0.95rem' }}>
                      {PHONE_NUMBER}
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.3rem' }}>🕒</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Horaires d'Ouverture :</div>
                    <div style={{ color: '#475569', fontSize: '0.88rem' }}>Tous les jours, de 09h00 à 21h00 (Africa/Ouagadougou). Vous pouvez déposer une demande en dehors de ces heures.</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: '#0f172a' }}>
                Démarrer immédiatement
              </h3>
              <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                Cliquez pour vous connecter à votre gestionnaire ou contactez notre conseiller commercial.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <a
                  href={APP_LOGIN_URL}
                  className="btn-primary"
                  style={{ textAlign: 'center', width: '100%', padding: '0.85rem' }}
                >
                  Accéder à mon Espace Gestionnaire
                </a>

                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-whatsapp"
                  style={{ textAlign: 'center', width: '100%', padding: '0.85rem' }}
                >
                  Écrire à un Conseiller sur WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#0a0d1a', color: '#94a3b8', padding: '3rem 0 2rem', borderTop: '1px solid #1e2648', fontSize: '0.85rem' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem', marginBottom: '0.25rem' }}>
              VTM — ViralTech Market
            </div>
            <div>Gestion Commerciale SaaS Universelle • Burkina Faso</div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <a href="#features" style={{ color: '#cbd5e1' }}>Fonctionnalités</a>
            <a href="#pricing" style={{ color: '#cbd5e1' }}>Formules & tarifs</a>
            <a href="#contact" style={{ color: '#cbd5e1' }}>Agence Ouagadougou</a>
            <a href={APP_LOGIN_URL} style={{ color: '#818cf8', fontWeight: 700 }}>Espace Client</a>
          </div>

          <div style={{ color: '#64748b' }}>
            © {new Date().getFullYear()} ViralTech Market. Tous droits réservés.
          </div>
        </div>
      </footer>
      {/* ── Modal Inscription Essai Gratuit 14 Jours ── */}
      {showTrialModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 22, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTrialModal(false);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              position: 'relative',
              color: '#0f172a',
            }}
          >
            <button
              type="button"
              onClick={() => setShowTrialModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#f1f5f9',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#64748b',
              }}
            >
              ✕
            </button>

            {submitSuccess ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.5rem' }}>
                  Félicitations ! Votre organisation est créée.
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
                  Votre commerce <strong>{submitSuccess.tenant?.name}</strong> bénéficie dès maintenant de <strong>14 jours d’essai gratuit</strong>. Les formules payantes disponibles durent 3, 6, 12 ou 24 mois.
                </p>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.35rem' }}>✓ Compte configuré avec succès :</div>
                  <div style={{ color: '#15803d' }}>• Identifiant email : <strong>{form.ownerEmail}</strong></div>
                  <div style={{ color: '#15803d' }}>• Boutique créée : <strong>Boutique Principale</strong></div>
                  <div style={{ color: '#15803d' }}>• 1 session de formation offerte pour votre référent</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <a
                    href={`${APP_LOGIN_URL}?tenantId=${submitSuccess.tenant?.id || ''}&email=${encodeURIComponent(form.ownerEmail)}`}
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', textAlign: 'center' }}
                  >
                    👉 Ouvrir mon Espace Gestionnaire
                  </a>

                  <a
                    href={`https://wa.me/22672744595?text=Bonjour%20VTM,%20je%20viens%20de%20cr%C3%A9er%20mon%20organisation%20${encodeURIComponent(form.name)}%20et%20je%20souhaite%20planifier%20ma%20formation%20offerte.`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-whatsapp"
                    style={{ width: '100%', padding: '0.85rem', fontSize: '0.92rem', textAlign: 'center' }}
                  >
                    💬 Planifier ma formation offerte sur WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    14 Jours Offerts
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>
                    ● Sans carte bancaire
                  </span>
                </div>

                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.4rem' }}>
                  Démarrer mon Essai Gratuit
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 1.25rem', lineHeight: 1.45 }}>
                  Créez votre compte en 1 minute. Vous aurez accès immédiatement à la caisse, aux stocks et à l'impression des tickets.
                </p>

                {submitError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: 600 }}>
                    ⚠️ {submitError}
                  </div>
                )}

                <form onSubmit={handleTrialSubmit}>
                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
                      Nom de votre commerce ou entreprise * :
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Boutique Élégance, Quincaillerie Wend-Panga..."
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
                        Nom du responsable * :
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Amadou Ouedraogo"
                        value={form.ownerName}
                        onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
                        Type d'activité :
                      </label>
                      <select
                        value={form.businessType}
                        onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                      >
                        <option value="BOUTIQUE">Boutique / Commerce de détail</option>
                        <option value="SERVICES">Prestation de services / SAV / Réparation</option>
                        <option value="RESTAURANT">Restaurant / Fast-food / Maquis</option>
                        <option value="ALIMENTATION">Superette / Épicerie</option>
                        <option value="PHARMACIE">Pharmacie / Parapharmacie</option>
                        <option value="ELECTRONIQUE">Informatique / Électronique</option>
                        <option value="AUTRE">Autre activité commerciale</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
                        Email de connexion * :
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="nom@commerce.bf"
                        value={form.ownerEmail}
                        onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
                        Téléphone WhatsApp :
                      </label>
                      <input
                        type="tel"
                        placeholder="Ex: 70 00 00 00"
                        value={form.ownerPhone}
                        onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
                      Mot de passe du compte (min. 6 caractères) * :
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={form.ownerPassword}
                      onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 800, opacity: isSubmitting ? 0.7 : 1, cursor: 'pointer' }}
                  >
                    {isSubmitting ? 'Création de votre organisation...' : '✨ Créer mon Organisation & Commencer l’Essai'}
                  </button>

                  <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                  Après l’essai, les durées proposées sont 3, 6, 12 et 24 mois; consultez les tarifs officiels sur cette page.<br />
                    Besoin d'aide ?{' '}
                    <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>
                      Assistance WhatsApp directe
                    </a>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
