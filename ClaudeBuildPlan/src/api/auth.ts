import { supabase } from './client';
import type { Session, User } from './client';

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
): Promise<{ error: Error | null }> => {
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
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
