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

/**
 * Stable, brand-independent visual identity for a generic medication.
 *
 * Used so the two medications are always distinguishable AT A GLANCE —
 * even when both are set to "Generic" (which shares the Cappy-teal brand
 * accent). Acetaminophen reads warm/red, ibuprofen reads cool/blue, with
 * a distinct letter badge and icon on every surface (Schedule chips,
 * clock arcs, timeline lanes, dashboard rows).
 */
export type MedVisual = {
  kind: MedicationKind;
  /** Human label, e.g. "Acetaminophen". */
  label: string;
  /** Single-letter badge, e.g. "A" / "I". */
  letter: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Stable identity color (independent of brand selection). */
  color: string;
};

const MED_VISUALS: Record<MedicationKind, MedVisual> = {
  acetaminophen: {
    kind: 'acetaminophen',
    label: 'Acetaminophen',
    letter: 'A',
    icon: 'thermometer',
    color: '#E4002B',
  },
  ibuprofen: {
    kind: 'ibuprofen',
    label: 'Ibuprofen',
    letter: 'I',
    icon: 'flame',
    color: '#0B62C4',
  },
};

/** Resolve the at-a-glance visual identity for a generic medication. */
export const medVisualForGeneric = (genericName: string): MedVisual => {
  const kind = (genericName.toLowerCase() === 'ibuprofen'
    ? 'ibuprofen'
    : 'acetaminophen') as MedicationKind;
  return MED_VISUALS[kind];
};
