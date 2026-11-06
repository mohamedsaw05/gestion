/**
 * VTM SaaS Bilinguisme Officiel (Français 🇫🇷 / Anglais 🇬🇧)
 * Fournit une source de vérité unique pour les traductions et le formatage des devises/dates.
 */
import { useEffect, useState } from 'react';

export type SupportedLocale = 'fr' | 'en';

export const DICTIONARY = {
  fr: {
    // Actions
    save: 'Enregistrer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    delete: 'Supprimer',
    search: 'Rechercher...',
    print: 'Imprimer',
    download: 'Télécharger',
    export: 'Exporter',
    import: 'Importer',
    back: 'Retour',
    close: 'Fermer',
    edit: 'Modifier',
    create: 'Créer',
    filter: 'Filtrer',
    reset: 'Réinitialiser',
    // POS / Vente
    pos_title: 'Nouvelle Vente & Caisse',
    checkout: 'Encaisser',
    cart_empty: 'Le panier est vide',
    hold_cart: 'Mettre en attente',
    resume_cart: 'Reprendre panier',
    total: 'Total',
    subtotal: 'Sous-total',
    discount: 'Remise',
    tax: 'TVA',
    cash_given: 'Montant reçu',
    change_due: 'Monnaie à rendre',
    paid: 'Payé',
    unpaid: 'Non réglé',
    credit_sale: 'Vente à crédit',
    customer: 'Client',
    payment_method: 'Mode de règlement',
    receipt: 'Reçu de caisse',
    invoice: 'Facture',
    // Statuts
    status_active: 'Actif',
    status_suspended: 'Suspendu',
    status_pending: 'En attente',
    status_completed: 'Terminé',
    status_cancelled: 'Annulé',
    status_refunded: 'Remboursé',
    // Pagination
    items_per_page: 'Éléments par page',
    page_of: 'Page {page} sur {total}',
    no_results: 'Aucun résultat trouvé',
  },
  en: {
    // Actions
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    search: 'Search...',
    print: 'Print',
    download: 'Download',
    export: 'Export',
    import: 'Import',
    back: 'Back',
    close: 'Close',
    edit: 'Edit',
    create: 'Create',
    filter: 'Filter',
    reset: 'Reset',
    // POS / Vente
    pos_title: 'New Sale & POS',
    checkout: 'Checkout',
    cart_empty: 'Cart is empty',
    hold_cart: 'Hold Cart',
    resume_cart: 'Resume Cart',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    cash_given: 'Cash Received',
    change_due: 'Change Due',
    paid: 'Paid',
    unpaid: 'Unpaid',
    credit_sale: 'Credit Sale',
    customer: 'Customer',
    payment_method: 'Payment Method',
    receipt: 'Receipt',
    invoice: 'Invoice',
    // Statuts
    status_active: 'Active',
    status_suspended: 'Suspended',
    status_pending: 'Pending',
    status_completed: 'Completed',
    status_cancelled: 'Cancelled',
    status_refunded: 'Refunded',
    // Pagination
    items_per_page: 'Items per page',
    page_of: 'Page {page} of {total}',
    no_results: 'No results found',
  },
} as const;

export type TranslationKey = keyof typeof DICTIONARY.fr;

export function getStoredLocale(): SupportedLocale {
  try {
    const saved = localStorage.getItem('vtm_lang');
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    // Ignore
  }
  return 'fr';
}

export function setStoredLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem('vtm_lang', locale);
    document.documentElement.lang = locale;
    window.dispatchEvent(new CustomEvent('vtm_lang_changed', { detail: locale }));
  } catch {
    // Ignore
  }
}

export function t(key: TranslationKey, locale?: SupportedLocale, params?: Record<string, string | number>): string {
  const current = locale ?? getStoredLocale();
  let text: string = DICTIONARY[current]?.[key] || DICTIONARY.fr[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function formatCurrency(amount: number, currency = 'XOF', locale?: SupportedLocale): string {
  const loc = (locale ?? getStoredLocale()) === 'fr' ? 'fr-FR' : 'en-US';
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: currency === 'FCFA' ? 'XOF' : currency,
      maximumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString(loc)} ${currency}`;
  }
}

export function formatDate(date: string | Date | number, locale?: SupportedLocale): string {
  const loc = (locale ?? getStoredLocale()) === 'fr' ? 'fr-FR' : 'en-US';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(loc, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function useI18n() {
  const [locale, setLocaleState] = useState<SupportedLocale>(getStoredLocale);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<SupportedLocale>;
      if (custom.detail) setLocaleState(custom.detail);
    };
    window.addEventListener('vtm_lang_changed', handler);
    return () => window.removeEventListener('vtm_lang_changed', handler);
  }, []);

  const changeLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
  };

  return {
    locale,
    setLocale: changeLocale,
    t: (key: TranslationKey, params?: Record<string, string | number>) => t(key, locale, params),
    formatCurrency: (amount: number, currency?: string) => formatCurrency(amount, currency, locale),
    formatDate: (date: string | Date | number) => formatDate(date, locale),
  };
}
