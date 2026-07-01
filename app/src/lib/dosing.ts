/**
 * Cappy antipyretic dosing engine.
 *
 * This is a faithful port of the closedose.com homepage calculator
 * (public/widget/close-dose-calculator.js) so dosing is identical across
 * the brand's web calculator and the Cappy app.
 *
 * SAFETY: This module is the single source of truth for dose math. Any
 * change must be reviewed against the closedose.com calculator. It is a
 * coordination aid, not medical advice — callers must surface the
 * not-medical-advice disclaimer and never auto-administer.
 *
 * Age gates (by exact age):
 *   < 2 months          → emergency  (no dose; seek care)
 *   2 to < 6 months      → infant     (acetaminophen only, q4h)
 *   6 months to < 12 yr  → pediatric  (acetaminophen + ibuprofen, q6h)
 *   >= 12 years          → adolescent (higher single-dose caps, q6h)
 */

export type AgeGate = 'emergency' | 'infant' | 'pediatric' | 'adolescent';
export type MedicationKind = 'acetaminophen' | 'ibuprofen';

export const LBS_PER_KG = 2.20462;
export const kgFromLbs = (lbs: number): number => lbs / LBS_PER_KG;
export const lbsFromKg = (kg: number): number => kg * LBS_PER_KG;

const MONTHS_IN_12_YEARS = 144;

/** Map an exact age in months to a dosing pathway. */
export const resolveAgeGate = (ageMonths: number): AgeGate => {
  if (ageMonths < 2) return 'emergency';
  if (ageMonths < 6) return 'infant';
  if (ageMonths < MONTHS_IN_12_YEARS) return 'pediatric';
  return 'adolescent';
};

/** Whole-month age from a date of birth (ISO date string). */
export const ageMonthsFromDob = (dobISO: string, now: Date = new Date()): number => {
  const dob = new Date(dobISO);
  if (Number.isNaN(dob.getTime())) return 0;
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return Math.max(0, months);
};

const round0 = (n: number): number => Math.round(n);
const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface DoseVolumeOption {
  /** Human label for the product / concentration. */
  label: string;
  concentrationMgPerMl: number;
  /** Precise volume in mL. */
  ml: number;
  /** Volume rounded to 1 decimal for display. */
  displayMl: number;
}

export interface MedDose {
  medication: MedicationKind;
  /** Precise capped dose in mg (use for storage). */
  recommendedMg: number;
  /** Dose rounded to whole mg for display. */
  displayMg: number;
  /** True if the weight-based dose was limited by the single-dose cap. */
  capped: boolean;
  /** The single-dose cap (mg) applied for this age gate. */
  capMg: number;
  /** Minimum hours between doses for this pathway. */
  intervalHours: number;
  frequencyLabel: string;
  /** One or more product-volume options for the same mg dose. */
  volumes: DoseVolumeOption[];
}

export interface DosingResult {
  ageGate: AgeGate;
  ageMonths: number;
  weightKg: number;
  /** True for < 2 months — no dose; the UI must show the emergency path. */
  emergency: boolean;
  acetaminophen: MedDose | null;
  ibuprofen: MedDose | null;
  /** When ibuprofen is intentionally not offered (e.g. < 6 months). */
  ibuprofenSuppressedReason: string | null;
  /** Spacing/safety reminder text appropriate to the pathway. */
  spacingReminder: string;
}

// Product concentrations (mg per mL).
const ACETAMINOPHEN_160_5 = 160 / 5; // 32 mg/mL  (160 mg / 5 mL)
const IBUPROFEN_CHILD_100_5 = 100 / 5; // 20 mg/mL (Children's 100 mg / 5 mL)
const IBUPROFEN_INFANT_50_125 = 50 / 1.25; // 40 mg/mL (Infant's 50 mg / 1.25 mL)

const FREQ_Q4 = 'Every 4 hours as needed for fever or pain';
const FREQ_Q6 = 'Every 6 hours as needed for fever or pain';

const IBUPROFEN_UNDER_6_MONTHS =
  'Ibuprofen is not recommended for infants under six months. Consult your pediatrician.';

const acetaminophenDose = (
  weightKg: number,
  mgPerKg: number,
  capMg: number,
  intervalHours: number,
  frequencyLabel: string,
): MedDose => {
  const calculated = mgPerKg * weightKg;
  const mg = Math.min(calculated, capMg);
  const ml = (mg / 160) * 5;
  return {
    medication: 'acetaminophen',
    recommendedMg: mg,
    displayMg: round0(mg),
    capped: calculated > capMg,
    capMg,
    intervalHours,
    frequencyLabel,
    volumes: [
      {
        label: 'Acetaminophen 160 mg / 5 mL',
        concentrationMgPerMl: ACETAMINOPHEN_160_5,
        ml,
        displayMl: round1(ml),
      },
    ],
  };
};

const ibuprofenDose = (weightKg: number, capMg: number): MedDose => {
  const calculated = 10 * weightKg;
  const mg = Math.min(calculated, capMg);
  const ml100 = (mg / 100) * 5;
  const ml50 = (mg / 50) * 1.25;
  return {
    medication: 'ibuprofen',
    recommendedMg: mg,
    displayMg: round0(mg),
    capped: calculated > capMg,
    capMg,
    intervalHours: 6,
    frequencyLabel: FREQ_Q6,
    volumes: [
      {
        label: "Children's ibuprofen 100 mg / 5 mL",
        concentrationMgPerMl: IBUPROFEN_CHILD_100_5,
        ml: ml100,
        displayMl: round1(ml100),
      },
      {
        label: "Infant's ibuprofen 50 mg / 1.25 mL",
        concentrationMgPerMl: IBUPROFEN_INFANT_50_125,
        ml: ml50,
        displayMl: round1(ml50),
      },
    ],
  };
};

const spacingReminder = (
  acet: MedDose | null,
  ibu: MedDose | null,
): string => {
  const acetCapped = acet?.capped ?? false;
  const ibuCapped = ibu?.capped ?? false;
  if (acetCapped || ibuCapped) {
    const acetCap = acet?.capMg;
    const ibuCap = ibu?.capMg;
    if (acetCap && ibuCap) {
      return `Never exceed ${acetCap} mg of acetaminophen or ${ibuCap} mg of ibuprofen in a single dose, and allow at least 6 hours between doses.`;
    }
  }
  return 'Allow at least 6 hours between doses of acetaminophen or ibuprofen. Follow the product instructions for maximum amounts.';
};

/**
 * Compute the full antipyretic dosing result for a patient.
 *
 * @param weightKg patient weight in kilograms
 * @param ageMonths patient age in whole months
 */
export const computeDosing = (weightKg: number, ageMonths: number): DosingResult => {
  const ageGate = resolveAgeGate(ageMonths);
  const base = { ageGate, ageMonths, weightKg } as const;

  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return {
      ...base,
      emergency: ageGate === 'emergency',
      acetaminophen: null,
      ibuprofen: null,
      ibuprofenSuppressedReason: null,
      spacingReminder: '',
    };
  }

  if (ageGate === 'emergency') {
    return {
      ...base,
      emergency: true,
      acetaminophen: null,
      ibuprofen: null,
      ibuprofenSuppressedReason: null,
      spacingReminder: '',
    };
  }

  if (ageGate === 'infant') {
    const acet = acetaminophenDose(weightKg, 12.5, 160, 4, FREQ_Q4);
    return {
      ...base,
      emergency: false,
      acetaminophen: acet,
      ibuprofen: null,
      ibuprofenSuppressedReason: IBUPROFEN_UNDER_6_MONTHS,
      spacingReminder:
        'Allow at least 4 hours between doses of acetaminophen. Follow the product instructions for maximum amounts.',
    };
  }

  // pediatric or adolescent
  const acetCap = ageGate === 'pediatric' ? 480 : 1000;
  const ibuCap = ageGate === 'pediatric' ? 400 : 600;
  const acet = acetaminophenDose(weightKg, 15, acetCap, 6, FREQ_Q6);
  const ibu = ibuprofenDose(weightKg, ibuCap);

  return {
    ...base,
    emergency: false,
    acetaminophen: acet,
    ibuprofen: ibu,
    ibuprofenSuppressedReason: null,
    spacingReminder: spacingReminder(acet, ibu),
  };
};

/** Convenience: pick the dose for a specific medication kind. */
export const doseForMedication = (
  result: DosingResult,
  kind: MedicationKind,
): MedDose | null => (kind === 'acetaminophen' ? result.acetaminophen : result.ibuprofen);
