import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '@/api/auth';
import type { Session, User } from '@/api';

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
};

type AuthContextValue = AuthState & {
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  verifyEmailOtp: (
    email: string,
    token: string,
  ) => Promise<{ error: Error | null }>;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: Error | null; needsEmailConfirm?: boolean }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
    isSignedIn: false,
  });

  useEffect(() => {
    let mounted = true;

    void authApi.getSession().then((session) => {
      if (!mounted) return;
      setState({
        session,
        user: session?.user ?? null,
        isLoading: false,
        isSignedIn: Boolean(session?.user),
      });
    });

    const { unsubscribe } = authApi.onAuthStateChange((session) => {
      setState({
        session,
        user: session?.user ?? null,
        isLoading: false,
        isSignedIn: Boolean(session?.user),
      });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signInWithEmail: authApi.signInWithEmail,
      verifyEmailOtp: async (email: string, token: string) => {
        const result = await authApi.verifyEmailOtp(email, token);
        return { error: result.error };
      },
      signInWithPassword: authApi.signInWithPassword,
      signUpWithPassword: authApi.signUpWithPassword,
      signInWithApple: authApi.signInWithApple,
      signOut: async () => {
        await authApi.signOut();
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
