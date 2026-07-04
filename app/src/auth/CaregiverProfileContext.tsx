import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { profiles as profilesApi, type CaregiverProfile } from '@/api';
import { useAuth } from './AuthContext';

/**
 * The consent version the app currently requires. Bump this string whenever
 * the terms/privacy policy materially changes; caregivers whose
 * `consent_version` differs will be re-prompted through the setup gate.
 */
export const CURRENT_CONSENT_VERSION = '2026-07-01';

type CaregiverProfileContextValue = {
  profile: CaregiverProfile | null;
  loading: boolean;
  /** True when the caregiver must complete first-run setup (name/DOB/consent). */
  needsSetup: boolean;
  refresh: () => Promise<void>;
};

const CaregiverProfileContext = createContext<CaregiverProfileContextValue | undefined>(
  undefined,
);

export const CaregiverProfileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn } = useAuth();
  const [profile, setProfile] = useState<CaregiverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await profilesApi.getMyProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needsSetup =
    isSignedIn &&
    !loading &&
    !(
      profile &&
      profile.display_name?.trim() &&
      profile.date_of_birth &&
      profile.consent_accepted_at &&
      profile.consent_version === CURRENT_CONSENT_VERSION
    );

  return (
    <CaregiverProfileContext.Provider value={{ profile, loading, needsSetup, refresh }}>
      {children}
    </CaregiverProfileContext.Provider>
  );
};

export const useCaregiverProfile = (): CaregiverProfileContextValue => {
  const ctx = useContext(CaregiverProfileContext);
  if (!ctx) {
    throw new Error('useCaregiverProfile must be used inside <CaregiverProfileProvider>');
  }
  return ctx;
};
