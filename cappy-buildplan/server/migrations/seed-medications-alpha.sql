-- Seed: alpha medication catalog (acetaminophen variants only)
-- Source: standard OTC pediatric acetaminophen formulations
-- Note: this is reference data, not clinical guidance. The product
-- displays this info but does not compute doses in alpha.

BEGIN;

INSERT INTO medications (
    generic_name, brand_name, concentration_label,
    concentration_mg_per_ml, formulation, rx_status, min_age_months
) VALUES
(
    'acetaminophen', 'Tylenol Infants',
    '160 mg / 5 mL (oral suspension)',
    32.000, 'infant_drops', 'otc', 0
),
(
    'acetaminophen', 'Tylenol Children''s',
    '160 mg / 5 mL (oral suspension)',
    32.000, 'liquid_suspension', 'otc', 24
),
(
    'acetaminophen', 'Tylenol Children''s Chewables',
    '160 mg per chewable',
    0.000, 'chewable', 'otc', 24
),
(
    'acetaminophen', 'Tylenol Jr. Meltaways',
    '160 mg per tablet',
    0.000, 'oral_disintegrating', 'otc', 72
);

COMMIT;
