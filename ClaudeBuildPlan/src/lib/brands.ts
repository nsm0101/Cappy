import type { MedicationKind } from './dosing';

/**
 * Brand options per generic. We use brand-associated ACCENT COLORS and the
 * brand NAME only (no third-party logos/trade dress — those need licensing).
 * `accent` themes the dose card for the selected brand. 'generic' is the
 * default (Cappy teal).
 */
export type Brand = { key: string; name: string; accent: string };

const CAPPY_TEAL = '#1FA89B';

export const BRANDS_BY_GENERIC: Record<MedicationKind, Brand[]> = {
  acetaminophen: [
    { key: 'generic', name: 'Generic', accent: CAPPY_TEAL },
    { key: 'tylenol', name: 'Tylenol', accent: '#E4002B' },
  ],
  ibuprofen: [
    { key: 'generic', name: 'Generic', accent: CAPPY_TEAL },
    { key: 'motrin', name: 'Motrin', accent: '#005EB8' },
    { key: 'advil', name: 'Advil', accent: '#0B3D91' },
  ],
};

const FALLBACK: Brand = { key: 'generic', name: 'Generic', accent: CAPPY_TEAL };

/** Resolve a brand for a generic + stored brand_key (defaults to Generic). */
export const brandFor = (genericName: string, brandKey?: string): Brand => {
  const kind = (genericName.toLowerCase() === 'ibuprofen' ? 'ibuprofen' : 'acetaminophen') as MedicationKind;
  const list = BRANDS_BY_GENERIC[kind] ?? [];
  return list.find((b) => b.key === brandKey) ?? list[0] ?? FALLBACK;
};

export const brandsForGeneric = (genericName: string): Brand[] => {
  const kind = (genericName.toLowerCase() === 'ibuprofen' ? 'ibuprofen' : 'acetaminophen') as MedicationKind;
  return BRANDS_BY_GENERIC[kind] ?? [FALLBACK];
};
