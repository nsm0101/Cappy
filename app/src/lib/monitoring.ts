/**
 * M3: crash/error reporting (Sentry), staged like health.ts.
 *
 * Activates only when BOTH are true:
 *  - `@sentry/react-native` is installed (rides native build 3), and
 *  - EXPO_PUBLIC_SENTRY_DSN is set (eas.json profile env / .env).
 * Otherwise a silent no-op, so this ships safely today.
 *
 * PRIVACY: a medication app must not leak PHI into crash reports.
 * `sendDefaultPii` stays false and a beforeSend scrubber drops obvious
 * identifiers. Never add names, DOBs, weights, or dose details to
 * breadcrumbs or messages.
 */

export const initMonitoring = (): void => {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
    const Sentry: any = require('@sentry/react-native');
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beforeSend(event: any) {
        if (event?.user) delete event.user;
        if (event?.request?.headers) delete event.request.headers;
        return event;
      },
    });
  } catch {
    // Package not installed yet — no-op until native build 3.
  }
};
