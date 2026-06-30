import type { Database } from '@/api/database.types';

type MedicationFormulation = Database['public']['Enums']['medication_formulation'];

/**
 * Format a dose amount for display, picking the most natural unit
 * based on the medication's formulation.
 *
 *   liquid_suspension, infant_drops → "5 mL" (volume primary)
 *   chewable, oral_disintegrating   → "1 chewable" (count primary)
 */
export const formatDoseAmount = (input: {
  formulation: MedicationFormulation;
  amountMg?: number | null;
  amountVolumeMl?: number | null;
  unitCount?: number | null;
}): { primary: string; secondary?: string } => {
  const { formulation, amountMg, amountVolumeMl, unitCount } = input;

  if (formulation === 'liquid_suspension' || formulation === 'infant_drops') {
    if (amountVolumeMl != null) {
      return {
        primary: `${trimNumber(amountVolumeMl)} mL`,
        secondary: amountMg ? `${trimNumber(amountMg)} mg` : undefined,
      };
    }
  }

  if (formulation === 'chewable' || formulation === 'oral_disintegrating') {
    if (unitCount != null) {
      const noun = formulation === 'chewable' ? 'chewable' : 'tablet';
      return {
        primary: `${unitCount} ${unitCount === 1 ? noun : noun + 's'}`,
        secondary: amountMg ? `${trimNumber(amountMg)} mg` : undefined,
      };
    }
  }

  if (amountMg != null) {
    return { primary: `${trimNumber(amountMg)} mg` };
  }
  return { primary: '—' };
};

/**
 * "32.000" → "32"; "5.5" → "5.5"
 */
const trimNumber = (n: number): string => {
  const str = n.toFixed(3);
  return str.replace(/\.?0+$/, '');
};

/**
 * Compute initials from a display name, max 2 chars.
 *   "Ava M." → "AM"
 *   "Leonardo" → "LE"
 *   "Baby" → "BA"
 */
export const initialsFromName = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '').toUpperCase();
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase();
};

/**
 * Weight: prefer pounds in en-US, kilograms elsewhere.
 * For alpha we hardcode "lb" since design partners are US-based.
 *
 *   formatWeight(17_237) → "38 lb"
 */
export const formatWeightFromGrams = (
  grams: number | null | undefined,
  unit: 'lb' | 'kg' = 'lb',
): string => {
  if (grams == null) return '—';
  if (unit === 'kg') {
    const kg = grams / 1000;
    return `${kg.toFixed(1)} kg`;
  }
  const lb = grams / 453.592;
  return `${Math.round(lb)} lb`;
};
