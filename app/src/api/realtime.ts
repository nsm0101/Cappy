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
export const subscribeFamilyDoses = (
  familyId: string,
  childIds: string[],
  onDose: (dose: DoseEvent) => void,
): (() => void) => {
  if (childIds.length === 0) return () => undefined;

  const channel: RealtimeChannel = supabase.channel(`family:${familyId}:doses`).on(
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
