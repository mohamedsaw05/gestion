/**
 * Utilitaire de formatage compact anti-débordement VTM.
 * Évite les ruptures d'affichage et les textes qui dépassent des cadres
 * (ex: remplace "100000000 FCFA" par "100 M FCFA" ou "150 000" par "150 K").
 */

export function formatCompactNumber(
  value: number | string | null | undefined,
  currency?: string,
  maxDecimals = 1,
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/\s+/g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '0';

  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);

  let formatted = '';
  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    formatted = `${val.toFixed(val >= 10 ? 0 : maxDecimals).replace(/\.0$/, '')} Md`;
  } else if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    formatted = `${val.toFixed(val >= 10 ? 0 : maxDecimals).replace(/\.0$/, '')} M`;
  } else if (abs >= 10_000) {
    const val = abs / 1_000;
    formatted = `${val.toFixed(val >= 100 ? 0 : maxDecimals).replace(/\.0$/, '')} K`;
  } else {
    formatted = new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: maxDecimals,
    }).format(abs);
  }

  const result = `${sign}${formatted}`;
  return currency ? `${result} ${currency}`.trim() : result;
}

export function formatFullNumber(
  value: number | string | null | undefined,
  currency?: string,
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/\s+/g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '0';

  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  }).format(num);

  return currency ? `${formatted} ${currency}`.trim() : formatted;
}
