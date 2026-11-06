import { describe, expect, it } from 'vitest';

describe('Catalog Search & Unit Precision (Section 2 & 4 CDC)', () => {
  it('identifie correctement les unités discrètes devant refuser les quantités décimales', () => {
    const discreteUnits = ['piece', 'pcs', 'carton', 'boite', 'paquet', 'unite'];
    const isDiscrete = (unit: string) => discreteUnits.includes(unit.toLowerCase().trim());

    expect(isDiscrete('piece')).toBe(true);
    expect(isDiscrete('Carton')).toBe(true);
    expect(isDiscrete('kg')).toBe(false);
    expect(isDiscrete('metre')).toBe(false);
  });

  it('refuse une quantité décimale sans arrondi silencieux pour les produits en unités entières', () => {
    const validateQuantity = (qty: number, isFractional: boolean) => {
      if (!isFractional && !Number.isInteger(qty)) {
        throw new Error('Les articles gérés en unités entières refusent les quantités décimales.');
      }
      return true;
    };

    expect(() => validateQuantity(3.5, false)).toThrow(/unités entières/);
    expect(() => validateQuantity(0.001, false)).toThrow(/unités entières/);
    expect(validateQuantity(3, false)).toBe(true);
    expect(validateQuantity(3.5, true)).toBe(true); // Autorisé si produit fractionnable (kg, litre)
  });

  it('attribue le score de pertinence maximal aux correspondances exactes de code-barres et SKU', () => {
    const calculateScore = (
      query: string,
      product: { name: string; sku?: string; barcodes?: string[]; aliases?: string[] },
    ) => {
      const q = query.toLowerCase().trim();
      if (product.barcodes?.some((b) => b.toLowerCase() === q)) return 100;
      if (product.sku?.toLowerCase() === q) return 95;
      if (product.name.toLowerCase() === q) return 90;
      if (product.aliases?.some((a) => a.toLowerCase() === q)) return 88;
      if (product.name.toLowerCase().includes(q)) return 60;
      return 10;
    };

    const prod = {
      name: 'Riz Parfumé 25kg',
      sku: 'RIZ-25-P',
      barcodes: ['6191234567890'],
      aliases: ['Riz jasmin', 'Sac de riz'],
    };

    expect(calculateScore('6191234567890', prod)).toBe(100);
    expect(calculateScore('RIZ-25-P', prod)).toBe(95);
    expect(calculateScore('Riz jasmin', prod)).toBe(88);
    expect(calculateScore('Riz', prod)).toBe(60);
  });
});
