import type * as React from 'react';

export type DoseStatus = 'due' | 'early' | 'recent' | 'overdue';

export interface DoseStatusPillProps {
  /**
   * Dose-safety state:
   * - `due` — enough time has passed; a dose may be given (calm teal)
   * - `early` — too soon for another dose; wait (amber caution)
   * - `recent` — a dose was just logged; informational (capybara blue)
   * - `overdue` — an expected/scheduled dose window has passed (soft coral)
   */
  status?: DoseStatus;
  /** Visual size. `sm` for dense lists, `md` (default) for cards and banners. */
  size?: 'sm' | 'md';
  /** Override the default status label text. */
  label?: string;
  /** Show the leading status dot. Defaults to true. */
  dot?: boolean;
  /** Custom content; overrides `label` and the default text. */
  children?: React.ReactNode;
}

/**
 * The signature Cappy dose-safety chip. Color reinforces safe-vs-too-early
 * without implying clinical certainty — always accompany it with the safety
 * line ("Always confirm dosing before administering medication.") on real
 * dosing surfaces.
 */
export function DoseStatusPill(props: DoseStatusPillProps): JSX.Element;
