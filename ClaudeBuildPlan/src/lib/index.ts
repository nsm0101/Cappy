export { formatRelativeTime, formatTimeUntil, formatClockTime } from './time';
export { formatDoseAmount, initialsFromName, formatWeightFromGrams } from './format';
export { uuidv4 } from './uuid';
export {
  computeDosing,
  doseForMedication,
  resolveAgeGate,
  ageMonthsFromDob,
  kgFromLbs,
  lbsFromKg,
  LBS_PER_KG,
} from './dosing';
export type {
  AgeGate,
  MedicationKind,
  MedDose,
  DoseVolumeOption,
  DosingResult,
} from './dosing';
