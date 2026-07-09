-- Symptom/note capture at dose-log time.
--
-- dose_events is append-only (no UPDATE policy; corrections get new rows).
-- The symptom tracker needs to attach a note to the dose that was *just*
-- logged, so this narrow SECURITY DEFINER RPC lets the caregiver who logged
-- a dose set only its note, only within an hour of logging.

create or replace function public.set_dose_note(dose_event_uuid uuid, note_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dose_events
     set note = nullif(trim(note_text), '')
   where id = dose_event_uuid
     and logged_by = auth.uid()
     and logged_at > now() - interval '1 hour';
  if not found then
    raise exception 'Dose not found or the note window has closed';
  end if;
end;
$$;

-- Grants are reset when a function is recreated — always re-apply.
revoke execute on function public.set_dose_note(uuid, text) from anon, public;
grant execute on function public.set_dose_note(uuid, text) to authenticated;
