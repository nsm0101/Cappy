import type * as React from 'react';

export type AvatarColor = 'teal' | 'blue' | 'amber' | 'coral' | 'tan';

export interface AvatarBadge {
  /** Short badge text, e.g. "A" (admin), "R" (read-only). */
  label: string;
  /** Badge background color (CSS color or token). Defaults to slate. */
  color?: string;
}

export interface ChildAvatarProps {
  /** Person's name — used for the monogram fallback (first two initials). */
  name?: string;
  /** Photo URL. When set, the photo is shown instead of the monogram. */
  photo?: string;
  /** Identity color for the monogram disc. Keep one stable color per person. */
  color?: AvatarColor;
  /** Diameter in px. Font and badge scale with it. */
  size?: number;
  /** Caregiver role ring color (CSS color/token). Omit for no ring. */
  ring?: string;
  /** Optional corner role badge. */
  badge?: AvatarBadge;
}

/**
 * Child & caregiver identity disc. Photo when available, colored monogram
 * fallback otherwise, with an optional caregiver role ring and corner badge.
 */
export function ChildAvatar(props: ChildAvatarProps): JSX.Element;
