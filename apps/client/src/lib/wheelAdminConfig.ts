export interface WheelOffer {
  id: string;
  label: string;
  sub: string;
  coupon: string;
  color: string;
  textColor: string;
  isWinning: boolean;
  weight: number;
  maxQuota: number; // Plafond strict défini par l'Admin (ex: 5 personnes max pour 1 mois gratuit)
  awardedCount: number; // Nombre de gagnants ayant déjà remporté ce lot
  enabled: boolean;
}

export interface WheelWinnerRecord {
  id: string;
  date: string;
  userEmail: string;
  offerId: string;
  label: string;
  coupon: string;
}

export interface WheelAdminConfig {
  eventKey: string;
  eventTitle: string;
  maxSpinsPerUser: number; // Déterminé par l'Admin : nombre d'essais autorisés par utilisateur
  offers: WheelOffer[];
  history: WheelWinnerRecord[];
}

const STORAGE_KEY = 'vtm_wheel_global_admin_config';

export const DEFAULT_OFFERS: WheelOffer[] = [
  {
    id: 'seg-1',
    label: '50% Réduction',
    sub: 'Sur le prochain abonnement',
    coupon: 'NOEL-50-VTM',
    color: '#dc2626',
    textColor: '#ffffff',
    isWinning: true,
    weight: 20,
    maxQuota: 10, // Max 10 personnes
    awardedCount: 0,
    enabled: true,
  },
  {
    id: 'seg-2',
    label: '1 Mois Gratuit',
    sub: 'Mois offert sur tout le gestionnaire',
    coupon: 'VTM-1MOIS-OFFERT',
    color: '#15803d',
    textColor: '#ffffff',
    isWinning: true,
    weight: 15,
    maxQuota: 5, // Strictement 5 personnes max (demande utilisateur)
    awardedCount: 0,
    enabled: true,
  },
  {
    id: 'seg-3',
    label: '0 (Perdu)',
    sub: 'Retentez votre chance l’an prochain',
    coupon: '',
    color: '#475569',
    textColor: '#ffffff',
    isWinning: false,
    weight: 25,
    maxQuota: 999999, // Illimité
    awardedCount: 0,
    enabled: true,
  },
  {
    id: 'seg-4',
    label: '-20% Services',
    sub: 'Valable sur toutes les réparations',
    coupon: 'REPAR-20-PROMO',
    color: '#2563eb',
    textColor: '#ffffff',
    isWinning: true,
    weight: 20,
    maxQuota: 20,
    awardedCount: 0,
    enabled: true,
  },
  {
    id: 'seg-5',
    label: '10 000 FCFA',
    sub: 'Bon d’achat déduit au comptoir',
    coupon: 'BON-10000-FCFA',
    color: '#d97706',
    textColor: '#ffffff',
    isWinning: true,
    weight: 10,
    maxQuota: 5, // 5 personnes max
    awardedCount: 0,
    enabled: true,
  },
  {
    id: 'seg-6',
    label: 'Livraison Offerte',
    sub: 'Sur vos 5 prochaines commandes',
    coupon: 'EXPED-GRATUITE',
    color: '#7c3aed',
    textColor: '#ffffff',
    isWinning: true,
    weight: 15,
    maxQuota: 15,
    awardedCount: 0,
    enabled: true,
  },
  {
    id: 'seg-7',
    label: 'Surprise VIP VTM',
    sub: 'Accès exclusif aux fonctions d’IA',
    coupon: 'VIP-GOLD-ACCES',
    color: '#db2777',
    textColor: '#ffffff',
    isWinning: true,
    weight: 5,
    maxQuota: 3, // 3 personnes max
    awardedCount: 0,
    enabled: true,
  },
];

export function getWheelAdminConfig(): WheelAdminConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WheelAdminConfig;
      if (parsed && Array.isArray(parsed.offers)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  const defConfig: WheelAdminConfig = {
    eventKey: 'NOEL_2026',
    eventTitle: 'Fêtes de Fin d’Année 2026',
    maxSpinsPerUser: 1, // 1 tour par défaut, ajustable par l'Admin
    offers: DEFAULT_OFFERS,
    history: [],
  };
  saveWheelAdminConfig(defConfig);
  return defConfig;
}

export function saveWheelAdminConfig(config: WheelAdminConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event('vtm-wheel-admin-config-changed'));
}

/**
 * RÈGLE ABSOLUE DE TIRAGE :
 * Détermine l'offre gagnante lors d'un tour.
 * Si le quota max d'une offre est atteint (ex: 5 personnes pour "1 Mois Gratuit"),
 * son poids est forcé à 0 et elle n'est PLUS JAMAIS sélectionnée.
 * Les utilisateurs continuent de voir le segment sur la roue sans savoir que le quota est épuisé.
 */
export function drawWinningOffer(userEmail: string): { offer: WheelOffer; offerIndex: number } {
  const config = getWheelAdminConfig();

  // Filtrer les offres éligibles : activées et quota non atteint
  const eligibleIndices: number[] = [];
  const weights: number[] = [];

  for (let i = 0; i < config.offers.length; i++) {
    const off = config.offers[i];
    if (off.enabled && off.awardedCount < off.maxQuota && off.weight > 0) {
      eligibleIndices.push(i);
      weights.push(off.weight);
    }
  }

  // Si par exception toutes les offres gagnantes sont épuisées, repli sur le segment perdu / retry
  if (eligibleIndices.length === 0) {
    const fallbackIndex = config.offers.findIndex((o) => !o.isWinning) >= 0 ? config.offers.findIndex((o) => !o.isWinning) : 0;
    return { offer: config.offers[fallbackIndex], offerIndex: fallbackIndex };
  }

  // Tirage aléatoire pondéré
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let rand = Math.random() * totalWeight;
  let chosenIndex = eligibleIndices[0];

  for (let k = 0; k < eligibleIndices.length; k++) {
    rand -= weights[k];
    if (rand <= 0) {
      chosenIndex = eligibleIndices[k];
      break;
    }
  }

  const winningOffer = config.offers[chosenIndex];

  // Incrémenter le quota attribué si c'est un lot gagnant avec quota
  if (winningOffer.isWinning) {
    winningOffer.awardedCount += 1;
    config.history.unshift({
      id: `win-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toLocaleString('fr-FR'),
      userEmail: userEmail || 'utilisateur@commerce.com',
      offerId: winningOffer.id,
      label: winningOffer.label,
      coupon: winningOffer.coupon,
    });

    // Sauvegarder la nouvelle attribution
    saveWheelAdminConfig(config);
  }

  return { offer: winningOffer, offerIndex: chosenIndex };
}

/**
 * Nombre de tours déjà effectués par un utilisateur pour l'événement courant
 */
export function getUserSpinCount(eventKey: string, userEmail: string): number {
  try {
    const key = `vtm_user_spins_${eventKey}_${userEmail.trim().toLowerCase()}`;
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Enregistrer un tour consommé par un utilisateur
 */
export function recordUserSpin(eventKey: string, userEmail: string): number {
  const current = getUserSpinCount(eventKey, userEmail);
  const next = current + 1;
  const key = `vtm_user_spins_${eventKey}_${userEmail.trim().toLowerCase()}`;
  localStorage.setItem(key, String(next));
  return next;
}
