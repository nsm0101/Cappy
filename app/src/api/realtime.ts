import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { DoseEvent } from './doses';

/**
 * Subscribe to every dose_events INSERT for the given family — both child
 * recipients and adult caregiver recipients (e.g. a parent logging their own
 * acetaminophen). Returns a `dispose` function to unsubscribe.
 *
 * Filtering on `family_id` (rather than a list of child ids) is deliberate:
 * a per-child-id filter misses caregiver-recipient doses entirely (those
 * rows have `child_id = null`), and it has to be rebuilt every time a child
 * is added/removed. `family_id` is set on every dose_events row regardless
 * of recipient kind and never changes, so one subscription covers the
 * family for its whole lifetime.
 *
 * Note: RLS still applies to realtime payloads — you'll only receive
 * events for rows you're authorized to see.
 */
/** Monotonic suffix so concurrent subscribers never share a channel topic. */
let channelSeq = 0;

export const subscribeFamilyDoses = (
  familyId: string,
  onDose: (dose: DoseEvent) => void,
): (() => void) => {
  // The topic must be unique PER SUBSCRIBER: `supabase.channel(name)` returns
  // the existing channel when the topic matches, and adding postgres_changes
  // callbacks to an already-subscribed channel throws
  // "cannot add `postgres_changes` callbacks ... after `subscribe()`".
  // Home, Timeline, and Schedule all subscribe for the same family, so a
  // family-only topic collides as soon as two of those screens have mounted.
  channelSeq += 1;
  const channel: RealtimeChannel = supabase.channel(`family:${familyId}:doses:${channelSeq}`).on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'dose_events',
      filter: `family_id=eq.${familyId}`,
    },
    (payload) => {
      onDose(payload.new as DoseEvent);
    },
  );

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
