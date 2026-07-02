import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { families as familiesApi, type FamilyWithRole } from '@/api';
import { useAuth } from '@/auth/AuthContext';

type ActiveFamilyContextValue = {
  families: FamilyWithRole[];
  activeFamily: FamilyWithRole | null;
  loading: boolean;
  setActiveFamily: (f: FamilyWithRole) => Promise<void>;
  refreshFamilies: () => Promise<void>;
};

const ActiveFamilyContext = createContext<ActiveFamilyContextValue | undefined>(undefined);

const STORAGE_KEY = 'cappy.activeFamilyId';

export const ActiveFamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSignedIn } = useAuth();
  const [families, setFamilies] = useState<FamilyWithRole[]>([]);
  const [activeFamily, setActiveFamilyState] = useState<FamilyWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshFamilies = useCallback(async () => {
    try {
      const fams = await familiesApi.listMyFamilies();
      setFamilies(fams);

      // Read stored id from AsyncStorage
      const storedId = await AsyncStorage.getItem(STORAGE_KEY);

      // Resolution rule: stored id if it exists and is in the fetched list; otherwise fams[0] ?? null
      let next: FamilyWithRole | null = null;
      if (storedId && fams.some((f) => f.id === storedId)) {
        next = fams.find((f) => f.id === storedId) ?? null;
      } else {
        next = fams[0] ?? null;
      }

      setActiveFamilyState(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('refreshFamilies error', err);
    }
  }, []);

  const setActiveFamily = useCallback(async (f: FamilyWithRole) => {
    setActiveFamilyState(f);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, f.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('setActiveFamily storage error', err);
    }
  }, []);

  // (Re)load families whenever the auth session appears or changes.
  // The provider mounts at app root before session restore completes, so a
  // mount-only fetch would race sign-in and leave existing users staring at
  // the "Start a family" empty state. Signing out clears the family state.
  useEffect(() => {
    if (!isSignedIn) {
      setFamilies([]);
      setActiveFamilyState(null);
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      await refreshFamilies();
      setLoading(false);
    })();
  }, [isSignedIn, refreshFamilies]);

  return (
    <ActiveFamilyContext.Provider value={{ families, activeFamily, loading, setActiveFamily, refreshFamilies }}>
      {children}
    </ActiveFamilyContext.Provider>
  );
};

export const useActiveFamily = (): ActiveFamilyContextValue => {
  const ctx = useContext(ActiveFamilyContext);
  if (!ctx) {
    throw new Error('useActiveFamily must be used inside <ActiveFamilyProvider>');
  }
  return ctx;
};
