import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { DoseEvent } from './doses';

/**
 * Subscribe to dose_events INSERTs for any child in the given family.
 * Returns a `dispose` function to unsubscribe.
 *
 * Note: RLS still applies to realtime payloads — you'll only receive
 * events for rows you're authorized to see.
 */
/** Monotonic suffix so concurrent subscribers never share a channel topic. */
let channelSeq = 0;

export const subscribeFamilyDoses = (
  familyId: string,
  childIds: string[],
  onDose: (dose: DoseEvent) => void,
): (() => void) => {
  if (childIds.length === 0) return () => undefined;

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
      filter: `child_id=in.(${childIds.join(',')})`,
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
