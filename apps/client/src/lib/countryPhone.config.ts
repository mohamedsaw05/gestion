export interface CountryDefinition {
  code: string; // ISO Code (BF, CI, etc.)
  name: string;
  flag: string;
  dialCode: string;
  currencyCode: string;
  currencySymbol: string;
  phoneDigits: number;
  phonePlaceholder: string;
  phoneFormatPattern: string; // Ex: "XX XX XX XX"
  region: 'AFRICA' | 'INTERNATIONAL';
}

export const SUPPORTED_COUNTRIES: CountryDefinition[] = [
  // 1. Burkina Faso (Obligatoire & Par Défaut)
  {
    code: 'BF',
    name: 'Burkina Faso',
    flag: '🇧🇫',
    dialCode: '+226',
    currencyCode: 'XOF',
    currencySymbol: 'FCFA',
    phoneDigits: 8,
    phonePlaceholder: '70 12 34 56',
    phoneFormatPattern: 'XX XX XX XX',
    region: 'AFRICA',
  },
  // 2. Côte d'Ivoire
  {
    code: 'CI',
    name: "Côte d'Ivoire",
    flag: '🇨🇮',
    dialCode: '+225',
    currencyCode: 'XOF',
    currencySymbol: 'FCFA',
    phoneDigits: 10,
    phonePlaceholder: '07 12 34 56 78',
    phoneFormatPattern: 'XX XX XX XX XX',
    region: 'AFRICA',
  },
  // 3. Sénégal
  {
    code: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    dialCode: '+221',
    currencyCode: 'XOF',
    currencySymbol: 'FCFA',
    phoneDigits: 9,
    phonePlaceholder: '77 123 45 67',
    phoneFormatPattern: 'XX XXX XX XX',
    region: 'AFRICA',
  },
  // 4. Mali
  {
    code: 'ML',
    name: 'Mali',
    flag: '🇲🇱',
    dialCode: '+223',
    currencyCode: 'XOF',
    currencySymbol: 'FCFA',
    phoneDigits: 8,
    phonePlaceholder: '76 12 34 56',
    phoneFormatPattern: 'XX XX XX XX',
    region: 'AFRICA',
  },
  // 5. Togo
  {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    dialCode: '+228',
    currencyCode: 'XOF',
    currencySymbol: 'FCFA',
    phoneDigits: 8,
    phonePlaceholder: '90 12 34 56',
    phoneFormatPattern: 'XX XX XX XX',
    region: 'AFRICA',
  },
  // 6. Bénin
  {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    dialCode: '+229',
    currencyCode: 'XOF',
    currencySymbol: 'FCFA',
    phoneDigits: 8,
    phonePlaceholder: '97 12 34 56',
    phoneFormatPattern: 'XX XX XX XX',
    region: 'AFRICA',
  },
  // 7. France (Extérieur 1)
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    dialCode: '+33',
    currencyCode: 'EUR',
    currencySymbol: '€',
    phoneDigits: 9,
    phonePlaceholder: '6 12 34 56 78',
    phoneFormatPattern: 'X XX XX XX XX',
    region: 'INTERNATIONAL',
  },
  // 8. États-Unis / Canada (Extérieur 2)
  {
    code: 'US',
    name: 'États-Unis',
    flag: '🇺🇸',
    dialCode: '+1',
    currencyCode: 'USD',
    currencySymbol: '$',
    phoneDigits: 10,
    phonePlaceholder: '202 555 0143',
    phoneFormatPattern: 'XXX XXX XXXX',
    region: 'INTERNATIONAL',
  },
  // 9. Émirats Arabes Unis (Extérieur 3)
  {
    code: 'AE',
    name: 'Émirats Arabes Unis',
    flag: '🇦🇪',
    dialCode: '+971',
    currencyCode: 'AED',
    currencySymbol: 'AED',
    phoneDigits: 9,
    phonePlaceholder: '50 123 4567',
    phoneFormatPattern: 'XX XXX XXXX',
    region: 'INTERNATIONAL',
  },
  // 10. Chine (Extérieur 4)
  {
    code: 'CN',
    name: 'Chine',
    flag: '🇨🇳',
    dialCode: '+86',
    currencyCode: 'CNY',
    currencySymbol: '¥',
    phoneDigits: 11,
    phonePlaceholder: '138 0013 8000',
    phoneFormatPattern: 'XXX XXXX XXXX',
    region: 'INTERNATIONAL',
  },
  // 11. Belgique (Extérieur 5)
  {
    code: 'BE',
    name: 'Belgique',
    flag: '🇧🇪',
    dialCode: '+32',
    currencyCode: 'EUR',
    currencySymbol: '€',
    phoneDigits: 9,
    phonePlaceholder: '470 12 34 56',
    phoneFormatPattern: 'XXX XX XX XX',
    region: 'INTERNATIONAL',
  },
];

export const DEFAULT_COUNTRY = SUPPORTED_COUNTRIES[0]; // Burkina Faso (+226)

/**
 * Nettoie et formate un numéro de téléphone selon le pays sélectionné.
 */
export function formatPhoneNumber(rawInput: string, country: CountryDefinition = DEFAULT_COUNTRY): string {
  // Retire tous les caractères non numériques
  let cleaned = rawInput.replace(/\D/g, '');

  // Si l'utilisateur a entré l'indicatif (ex: 22670123456)
  const dialDigits = country.dialCode.replace(/\D/g, '');
  if (cleaned.startsWith(dialDigits)) {
    cleaned = cleaned.slice(dialDigits.length);
  }

  // Si le premier chiffre est 0 pour certains pays internationaux (ex: France 06...)
  if (country.code === 'FR' && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }

  // Limite au nombre de chiffres requis
  cleaned = cleaned.slice(0, country.phoneDigits);

  // Application du masque d'espacement
  let formatted = '';
  let cleanedIdx = 0;
  for (let i = 0; i < country.phoneFormatPattern.length; i++) {
    if (cleanedIdx >= cleaned.length) break;
    const char = country.phoneFormatPattern[i];
    if (char === 'X') {
      formatted += cleaned[cleanedIdx++];
    } else {
      formatted += char;
    }
  }

  return formatted;
}

/**
 * Vérifie si un numéro de téléphone est complet et valide pour un pays donné.
 */
export function isValidPhoneNumber(phoneNumber: string, country: CountryDefinition = DEFAULT_COUNTRY): boolean {
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  const dialDigits = country.dialCode.replace(/\D/g, '');
  const effectiveDigits = digitsOnly.startsWith(dialDigits)
    ? digitsOnly.slice(dialDigits.length)
    : digitsOnly;

  return effectiveDigits.length === country.phoneDigits;
}

/**
 * Construit le lien direct WhatsApp pré-rempli.
 */
export function buildWhatsAppLink(phoneNumber: string, message: string, country: CountryDefinition = DEFAULT_COUNTRY): string {
  let digits = phoneNumber.replace(/\D/g, '');
  const dialDigits = country.dialCode.replace(/\D/g, '');
  if (!digits.startsWith(dialDigits)) {
    digits = `${dialDigits}${digits}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
