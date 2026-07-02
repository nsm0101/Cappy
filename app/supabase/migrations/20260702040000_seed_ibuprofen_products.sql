-- Seed: ibuprofen product (added to cappy-dev manually during alpha, never
-- tracked — this migration makes fresh environments like cappy-prod match).
-- Idempotent: guarded by NOT EXISTS on (generic, brand, concentration).

insert into public.medications
  (generic_name, brand_name, concentration_label, concentration_mg_per_ml,
   formulation, rx_status, min_age_months, min_interval_hours, max_doses_per_24h)
select
  'ibuprofen', 'Motrin Children''s', '100 mg / 5 mL (oral suspension)',
  20.0, 'liquid_suspension', 'otc', 6, 6, 4
where not exists (
  select 1 from public.medications
  where generic_name = 'ibuprofen'
    and brand_name = 'Motrin Children''s'
    and concentration_label = '100 mg / 5 mL (oral suspension)'
);
