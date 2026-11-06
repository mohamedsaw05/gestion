import { useLocation, Link } from 'react-router-dom';

interface ContextHelpData {
  pageTitle: string;
  badge: string;
  objective: string;
  keySteps: string[];
  tips: string[];
  video?: {
    title: string;
    mp4: string;
    poster: string;
  };
}

const CONTEXTUAL_GUIDES: Record<string, ContextHelpData> = {
  '/sales': {
    pageTitle: 'Caisse & Point de Vente (POS)',
    badge: 'Vente Comptoir & Encaissement',
    objective: 'Enregistrer une vente en quelques secondes, choisir le moyen de paiement, appliquer des remises autorisées et imprimer le ticket de caisse ou la facture.',
    keySteps: [
      '1. Ajoutez des articles au panier en tapant leur nom, en scannant leur code-barres ou via le raccourci global Ctrl+K.',
      '2. Modifiez les quantités ou appliquez une remise conforme aux règles de votre établissement.',
      '3. Sélectionnez un client si la vente est à crédit ou nécessite une facture nominative.',
      '4. Choisissez le mode de règlement (Espèces, Mobile Money, Carte, Crédit client) et validez.',
    ],
    tips: [
      'Raccourci clavier : Appuyez sur F4 pour ouvrir instantanément la fenêtre d\'encaissement.',
      'Pour les tickets de caisse, le format thermique 80mm est le standard le plus rapide et économique.',
    ],
    video: {
      title: 'Tutoriel Vidéo : Caisse Tactile & Encaissement Rapide',
      mp4: '/videos/VTM_04_Point_De_Vente_Et_Encaissement_FR.mp4',
      poster: '/videos/VTM_04_Point_De_Vente_Et_Encaissement_FR_thumb.jpg',
    },
  },
  '/inventory': {
    pageTitle: 'Gestion des Stocks & Dépôts',
    badge: 'Traçabilité & Mouvements',
    objective: 'Suivre les niveaux de stock en temps réel dans vos boutiques et dépôts, réceptionner les commandes fournisseurs et gérer les transferts.',
    keySteps: [
      '1. Consultez la liste des articles avec leur quantité disponible et leur statut (En stock, Stock faible, Rupture).',
      '2. Utilisez le bouton « Entrée en stock » pour ajouter des marchandises suite à un achat.',
      '3. Initiez un « Transfert » pour déplacer des produits d\'un dépôt vers une boutique de vente.',
      '4. Surveillez les alertes de péremption pour les produits avec date limite de consommation.',
    ],
    tips: [
      'Le bouton de filtre rapide vous permet d\'afficher en un clic tous les articles en rupture ou sous le seuil d\'alerte.',
      'La valorisation patrimoniale de votre stock au coût d\'achat est actualisée automatiquement à chaque mouvement.',
    ],
    video: {
      title: 'Tutoriel Vidéo : Recherche Produit & Gestion des Stocks',
      mp4: '/videos/VTM_03_Rechercher_Produit_Stock_FR.mp4',
      poster: '/videos/VTM_03_Rechercher_Produit_Stock_FR_thumb.jpg',
    },
  },
  '/services': {
    pageTitle: 'Atelier & Prestations de Services',
    badge: 'SAV & Ordres de Réparation',
    objective: 'Gérer les interventions techniques, réparations et prestations sans bloquer ni fausser votre stock marchandise.',
    keySteps: [
      '1. Créez un ordre de réparation avec le nom du client, le modèle de l\'appareil et le diagnostic initial.',
      '2. Assignez un technicien responsable de l\'intervention.',
      '3. Ajoutez les pièces détachées requises et le montant de la main-d\'œuvre.',
      '4. Clôturez l\'ordre lors de la remise au client et encaissez directement à la caisse.',
    ],
    tips: [
      'Imprimez le bon de prise en charge avec numéro d\'ordre pour le remettre au client lors du dépôt de l\'appareil.',
    ],
    video: {
      title: 'Tutoriel Vidéo : Atelier & Prestations de Services',
      mp4: '/videos/VTM_05_Prestations_Et_Atelier_FR.mp4',
      poster: '/videos/VTM_05_Prestations_Et_Atelier_FR_thumb.jpg',
    },
  },
  '/expenses': {
    pageTitle: 'Dépenses & Charges Opérationnelles',
    badge: 'Rentabilité Réelle & Trésorerie',
    objective: 'Enregistrer tous les frais de fonctionnement (loyers, électricité, transport, salaires) pour calculer votre bénéfice net exact.',
    keySteps: [
      '1. Cliquez sur « Nouvelle Dépense » et choisissez la catégorie appropriée.',
      '2. Renseignez le montant en FCFA (XOF) et le mode de décaissement (Caisse boutique, Banque, Mobile Money).',
      '3. Téléversez un justificatif ou une photo de reçu pour la comptabilité.',
      '4. Consultez le tableau de bord pour mesurer l\'impact direct sur votre résultat d\'exploitation.',
    ],
    tips: [
      'Les dépenses prélevées directement de la caisse sont automatiquement imputées à la session de caisse en cours.',
    ],
    video: {
      title: 'Tutoriel Vidéo : Dépenses & Maîtrise de la Trésorerie',
      mp4: '/videos/VTM_06_Depenses_Et_Tresorerie_FR.mp4',
      poster: '/videos/VTM_06_Depenses_Et_Tresorerie_FR_thumb.jpg',
    },
  },
  '/credit': {
    pageTitle: 'Crédits Clients & Recouvrement',
    badge: 'Gestion des Créances',
    objective: 'Suivre les dettes clients, fixer des plafonds autorisés et enregistrer les remboursements partiels ou totaux.',
    keySteps: [
      '1. Consultez la liste des clients ayant un solde débiteur avec le nombre de jours d\'ancienneté de la dette.',
      '2. Ouvrez la fiche client pour visualiser l\'historique détaillé des achats à crédit et des versements.',
      '3. Cliquez sur « Encaisser un règlement » pour enregistrer un acompte avec reçu de décharge.',
      '4. Envoyez une relance WhatsApp préformatée avec le solde exact restant dû.',
    ],
    tips: [
      'Fixez un plafond de crédit maximum par client dans leurs fiches pour empêcher les dépassements imprévus.',
    ],
  },
  '/cash': {
    pageTitle: 'Sessions de Caisse & Clôtures',
    badge: 'Contrôle des Encaissements',
    objective: 'Ouvrir la journée avec un fond de caisse précis, suivre les entrées/sorties et clôturer avec contrôle automatique d\'écart.',
    keySteps: [
      '1. Ouvrez la session en renseignant le montant physique présent dans le tiroir-caisse (fond de roulement).',
      '2. Les ventes et les décaissements de la journée alimentent le solde théorique calculé.',
      '3. En fin de service, effectuez le comptage physique des billets et pièces.',
      '4. Validez la clôture : le système calcule l\'écart éventuel et édite le rapport de fin de journée Z.',
    ],
    tips: [
      'Ne laissez jamais une session ouverte pendant la nuit pour garantir la clarté des rapports comptables.',
    ],
  },
  '/staff': {
    pageTitle: 'Personnel & Feuilles de Temps',
    badge: 'Pointage & Horaires Paramétrables',
    objective: 'Gérer les heures d\'arrivée et de départ, les plannings personnalisés et les tâches journalières.',
    keySteps: [
      '1. Les collaborateurs effectuent leur pointage d\'arrivée en 1 clic.',
      '2. Le planning hebdomadaire paramétrable prend en compte vos jours de fermeture (les dimanches ne sont pas comptés en absence).',
      '3. Assignez des tâches opérationnelles pour la journée (inventaire d\'un rayon, nettoyage, réassort).',
      '4. Exportez les relevés mensuels d\'heures pour la préparation des salaires.',
    ],
    tips: [
      'Vous pouvez définir des jours de repos spécifiques par collaborateur dans l\'onglet Configuration du planning.',
    ],
  },
};

const DEFAULT_GUIDE: ContextHelpData = {
  pageTitle: 'Tableau de Bord & Vue d\'Ensemble VTM',
  badge: 'Pilotage Opérationnel',
  objective: 'Consulter vos indicateurs clés en direct : chiffre d\'affaires du jour, marge brute, nombre de ventes et alertes prioritaires.',
  keySteps: [
    '1. Examinez les cartes de performance en haut de l\'écran pour suivre vos ventes en temps réel.',
    '2. Utilisez le menu latéral de gauche pour naviguer rapidement vers la caisse, les stocks ou les finances.',
    '3. Consultez la section Alertes pour identifier les réapprovisionnements urgents à effectuer.',
    '4. Utilisez la recherche globale (Ctrl+K) pour retrouver n\'importe quelle facture, article ou client en 1 seconde.',
  ],
  tips: [
    'Passez la souris sur les chiffres pour afficher les détails de calcul ou les pourcentages d\'évolution.',
    'Chaque abonnement VTM inclut une session de formation offerte pour 1 personne référente.',
  ],
  video: {
    title: 'Tutoriel Vidéo : Présentation Générale de VTM',
    mp4: '/videos/VTM_01_Presentation_Generale_FR.mp4',
    poster: '/videos/VTM_01_Presentation_Generale_FR_thumb.jpg',
  },
};

interface ContextualHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContextualHelpModal({ isOpen, onClose }: ContextualHelpModalProps) {
  const location = useLocation();

  if (!isOpen) return null;

  // Trouver le guide le plus adapté à l'URL actuelle
  const matchingKey = Object.keys(CONTEXTUAL_GUIDES).find(
    (key) => location.pathname === key || location.pathname.startsWith(`${key}/`)
  );
  const guide = matchingKey ? CONTEXTUAL_GUIDES[matchingKey] : DEFAULT_GUIDE;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 17, 40, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.6rem' }}>💡</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                  {guide.pageTitle}
                </h2>
                <span
                  style={{
                    background: '#e0e7ff',
                    color: '#4338ca',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {guide.badge}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                Page active : <code>{location.pathname}</code>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Objectif */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              🎯 Objectif de cet écran
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#14532d', lineHeight: 1.5 }}>
              {guide.objective}
            </p>
          </div>

          {/* Étapes clés */}
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📋</span>
              <span>Comment utiliser cette page en 4 étapes simples</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {guide.keySteps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    fontSize: '0.85rem',
                    color: '#334155',
                    background: '#f8fafc',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Astuces pratiques */}
          {guide.tips.length > 0 && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '0.35rem' }}>
                💡 Bon à savoir :
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.5 }}>
                {guide.tips.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Vidéo intégrée si disponible */}
          {guide.video && (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
              <div style={{ padding: '0.65rem 1rem', background: '#1e293b', color: '#f8fafc', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🎬</span>
                <span>{guide.video.title}</span>
              </div>
              <video
                controls
                playsInline
                preload="metadata"
                poster={guide.video.poster}
                style={{ width: '100%', maxHeight: 280, display: 'block', background: '#000' }}
              >
                <source src={guide.video.mp4} type="video/mp4" />
                Votre navigateur ne prend pas en charge la lecture vidéo HTML5.
              </video>
            </div>
          )}

          {/* Cadre Assistance & Formation Offerte */}
          <div
            style={{
              background: '#fdf4ff',
              border: '1px solid #f0abfc',
              borderRadius: 10,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🎓</span>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#86198f' }}>
                Formation offerte pour 1 personne référente par entreprise
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#701a75', lineHeight: 1.5 }}>
              Votre abonnement VTM inclut une séance complète d'accompagnement pour 1 gérant, caissier ou gestionnaire de stock. Formation en présentiel à Ouagadougou (quartier Tampouy, vers le collège Ave Maria) ou en visioconférence personnalisée.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <a
                href="https://wa.me/22672744595?text=Bonjour%20VTM,%20j'ai%20une%20question%20sur%20l'utilisation%20du%20logiciel"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#16a34a',
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                <span>💬</span>
                <span>Assistance WhatsApp : +226 72 74 45 95</span>
              </a>

              <Link
                to="/help"
                onClick={onClose}
                style={{
                  color: '#2563eb',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textDecoration: 'underline',
                }}
              >
                Ouvrir le Centre d'Aide & Vidéos complet →
              </Link>
            </div>
          </div>
        </div>

        {/* Pied */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#f8fafc',
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1.25rem',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Compris, fermer
          </button>
        </div>
      </div>
    </div>
  );
}
