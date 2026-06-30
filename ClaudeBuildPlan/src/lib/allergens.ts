import type { MedicationKind } from './dosing';

export type Allergen = { key: string; label: string };

/**
 * Curated allergen catalog. Selection is restricted to this list so the
 * canonical `key` can be used to gate medication recommendations.
 */
export const ALLERGEN_CATALOG: Allergen[] = [
  { key: 'acetaminophen', label: 'Acetaminophen (Tylenol)' },
  { key: 'ibuprofen', label: 'Ibuprofen (Motrin / Advil)' },
  { key: 'nsaid', label: 'NSAIDs (general)' },
  { key: 'aspirin', label: 'Aspirin' },
  { key: 'naproxen', label: 'Naproxen (Aleve)' },
  { key: 'penicillin', label: 'Penicillin' },
  { key: 'amoxicillin', label: 'Amoxicillin' },
  { key: 'cephalosporin', label: 'Cephalosporins' },
  { key: 'sulfa', label: 'Sulfa drugs' },
  { key: 'codeine', label: 'Codeine' },
  { key: 'erythromycin', label: 'Erythromycin' },
  { key: 'latex', label: 'Latex' },
  { key: 'peanut', label: 'Peanuts' },
  { key: 'tree_nut', label: 'Tree nuts' },
  { key: 'egg', label: 'Eggs' },
  { key: 'soy', label: 'Soy' },
  { key: 'dairy', label: 'Dairy / milk' },
  { key: 'dye', label: 'Food dyes' },
];

/** Type-to-narrow search over the curated catalog. */
export const searchAllergens = (query: string): Allergen[] => {
  const q = query.trim().toLowerCase();
  if (!q) return ALLERGEN_CATALOG;
  return ALLERGEN_CATALOG.filter(
    (a) => a.label.toLowerCase().includes(q) || a.key.includes(q),
  );
};

// Allergen keys that contraindicate each antipyretic (conservative —
// ibuprofen is blocked by any NSAID-class allergy).
const BLOCKING: Record<MedicationKind, string[]> = {
  acetaminophen: ['acetaminophen'],
  ibuprofen: ['ibuprofen', 'nsaid', 'aspirin', 'naproxen'],
};

/** True if any of the child's allergen keys contraindicate the medication. */
export const isAllergicToMedication = (
  kind: MedicationKind,
  allergenKeys: string[],
): boolean => {
  const blockers = BLOCKING[kind];
  return allergenKeys.some((k) => blockers.includes(k));
};
