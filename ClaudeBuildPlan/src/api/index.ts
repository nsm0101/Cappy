export { supabase } from './client';
export type { Session, User } from './client';

export * as auth from './auth';
export * as families from './families';
export * as children from './children';
export * as doses from './doses';
export * as nfc from './nfc';
export * as realtime from './realtime';

export type { Database } from './database.types';
export type { Family, FamilyCaregiver, FamilyWithRole, CaregiverWithProfile } from './families';
export type { Child } from './children';
export type { DoseEvent, DoseStatus, DoseStatusResult, LogDoseInput, DoseEventWithDetails } from './doses';
export type { ResolvedTag } from './nfc';

