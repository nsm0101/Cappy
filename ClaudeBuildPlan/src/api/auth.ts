import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './client';
import type { Session, User } from './client';

/**
 * Native Sign in with Apple. Uses the device's Apple ID to obtain an
 * identity token, then exchanges it with Supabase. Requires the Apple
 * provider to be enabled in Supabase Auth with the app's bundle ID
 * (com.closedose.cappy) as an authorized client ID.
 */
export const signInWithApple = async (): Promise<{ error: Error | null }> => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      return { error: new Error('No identity token returned from Apple.') };
    }
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    return { error };
  } catch (e) {
    // User cancelled the Apple sheet — not an error.
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return { error: null };
    }
    return { error: e instanceof Error ? e : new Error('Apple sign-in failed.') };
  }
};

/**
 * Send a 6-digit email OTP code. We use the code (not a magic-link
 * redirect) as the primary mobile path because it works regardless of
 * which device/app the email is opened in, and needs no deep-link
 * redirect handling. The user enters the code, which `verifyEmailOtp`
 * exchanges for a session.
 *
 * NOTE: the Supabase "Magic Link" email template must include the
 * `{{ .Token }}` variable so the recipient actually sees the code.
 */
export const signInWithEmail = async (email: string): Promise<{ error: Error | null }> => {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
    },
  });
  return { error };
};

/**
 * Verify a 6-digit OTP code received by email.
 * Used when the magic-link path doesn't work (e.g., user opens the
 * email on a different device from the one they're signing in on).
 */
export const verifyEmailOtp = async (
  email: string,
  token: string,
): Promise<{ session: Session | null; error: Error | null }> => {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email',
  });
  return { session: data.session, error };
};

/**
 * Create an account with email + password. With "Confirm email" disabled
 * in Supabase Auth settings, this returns a session immediately (the user
 * is signed in). With confirmation enabled, session is null until they
 * confirm via email.
 */
export const signUpWithPassword = async (
  email: string,
  password: string,
  displayName?: string,
): Promise<{ error: Error | null }> => {
  const trimmedName = displayName?.trim();
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: trimmedName ? { data: { display_name: trimmedName } } : undefined,
  });
  return { error };
};

/** Sign in with an existing email + password. */
export const signInWithPassword = async (
  email: string,
  password: string,
): Promise<{ error: Error | null }> => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return { error };
};

export const signOut = async (): Promise<{ error: Error | null }> => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async (): Promise<Session | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

export const getUser = async (): Promise<User | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user;
};

export const onAuthStateChange = (
  callback: (session: Session | null) => void,
): { unsubscribe: () => void } => {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return {
    unsubscribe: () => {
      data.subscription.unsubscribe();
    },
  };
};
