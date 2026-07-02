import {
  computeDosing,
  resolveAgeGate,
  ageMonthsFromDob,
  doseForMedication,
  kgFromLbs,
  lbsFromKg,
} from '../dosing';

describe('dosing engine', () => {
  describe('computeDosing – golden table', () => {
    it('5 kg, 3 months (infant): acetaminophen only, 62.5 mg recommended, 63 mg displayed, q4h', () => {
      const result = computeDosing(5, 3);
      expect(result.weightKg).toBe(5);
      expect(result.ageMonths).toBe(3);
      expect(result.ageGate).toBe('infant');
      expect(result.emergency).toBe(false);

      // Acetaminophen: 5 kg * 12.5 mg/kg = 62.5 mg (no cap at infant)
      expect(result.acetaminophen).not.toBeNull();
      expect(result.acetaminophen!.recommendedMg).toBe(62.5);
      expect(result.acetaminophen!.displayMg).toBe(63);
      expect(result.acetaminophen!.capped).toBe(false);
      expect(result.acetaminophen!.intervalHours).toBe(4);
      expect(result.acetaminophen!.volumes[0]!.ml).toBeCloseTo((62.5 / 160) * 5, 1); // ~1.953 mL
      expect(result.acetaminophen!.volumes[0]!.displayMl).toBeCloseTo(2.0, 1);

      // Ibuprofen suppressed
      expect(result.ibuprofen).toBeNull();
      expect(result.ibuprofenSuppressedReason).toBe(
        'Ibuprofen is not recommended for infants under six months. Consult your pediatrician.'
      );

      // Spacing reminder
      expect(result.spacingReminder).toContain('at least 4 hours');
    });

    it('10 kg, 18 months (pediatric): acetaminophen 150 mg, ibuprofen 100 mg, q6h', () => {
      const result = computeDosing(10, 18);
      expect(result.weightKg).toBe(10);
      expect(result.ageMonths).toBe(18);
      expect(result.ageGate).toBe('pediatric');
      expect(result.emergency).toBe(false);

      // Acetaminophen: 10 kg * 15 mg/kg = 150 mg (cap is 480)
      expect(result.acetaminophen).not.toBeNull();
      expect(result.acetaminophen!.recommendedMg).toBe(150);
      expect(result.acetaminophen!.displayMg).toBe(150);
      expect(result.acetaminophen!.capped).toBe(false);
      expect(result.acetaminophen!.intervalHours).toBe(6);
      expect(result.acetaminophen!.volumes[0]!.displayMl).toBeCloseTo(4.7, 1);

      // Ibuprofen: 10 kg * 10 mg/kg = 100 mg (cap is 400)
      expect(result.ibuprofen).not.toBeNull();
      expect(result.ibuprofen!.recommendedMg).toBe(100);
      expect(result.ibuprofen!.displayMg).toBe(100);
      expect(result.ibuprofen!.capped).toBe(false);
      expect(result.ibuprofen!.intervalHours).toBe(6);
      expect(result.ibuprofen!.volumes[0]!.displayMl).toBeCloseTo(5, 1); // 100/100 * 5
      expect(result.ibuprofen!.volumes[1]!.displayMl).toBeCloseTo(2.5, 1); // 100/50 * 1.25

      // Spacing reminder for non-capped pediatric
      expect(result.spacingReminder).toContain('Allow at least 6 hours');
    });

    it('40 kg, 120 months (pediatric): acetaminophen capped at 480 mg, ibuprofen NOT capped (400 mg calculated == cap)', () => {
      const result = computeDosing(40, 120);
      expect(result.weightKg).toBe(40);
      expect(result.ageMonths).toBe(120);
      expect(result.ageGate).toBe('pediatric');
      expect(result.emergency).toBe(false);

      // Acetaminophen: 40 kg * 15 mg/kg = 600 mg, capped at 480
      expect(result.acetaminophen).not.toBeNull();
      expect(result.acetaminophen!.recommendedMg).toBe(480);
      expect(result.acetaminophen!.displayMg).toBe(480);
      expect(result.acetaminophen!.capped).toBe(true);
      expect(result.acetaminophen!.capMg).toBe(480);
      expect(result.acetaminophen!.intervalHours).toBe(6);

      // Ibuprofen: 40 kg * 10 mg/kg = 400 mg, cap is 400
      // 400 > 400 is false, so capped should be false (strict >)
      expect(result.ibuprofen).not.toBeNull();
      expect(result.ibuprofen!.recommendedMg).toBe(400);
      expect(result.ibuprofen!.displayMg).toBe(400);
      expect(result.ibuprofen!.capped).toBe(false); // NOT capped: 400 is not > 400
      expect(result.ibuprofen!.capMg).toBe(400);
      expect(result.ibuprofen!.intervalHours).toBe(6);

      // Spacing reminder should mention both caps because acet is capped
      expect(result.spacingReminder).toContain('480 mg');
      expect(result.spacingReminder).toContain('400 mg');
    });

    it('70 kg, 168 months (adolescent): acetaminophen capped at 1000 mg, ibuprofen capped at 600 mg', () => {
      const result = computeDosing(70, 168);
      expect(result.weightKg).toBe(70);
      expect(result.ageMonths).toBe(168);
      expect(result.ageGate).toBe('adolescent');
      expect(result.emergency).toBe(false);

      // Acetaminophen: 70 kg * 15 mg/kg = 1050 mg, capped at 1000
      expect(result.acetaminophen).not.toBeNull();
      expect(result.acetaminophen!.recommendedMg).toBe(1000);
      expect(result.acetaminophen!.displayMg).toBe(1000);
      expect(result.acetaminophen!.capped).toBe(true);
      expect(result.acetaminophen!.capMg).toBe(1000);
      expect(result.acetaminophen!.intervalHours).toBe(6);
      expect(result.acetaminophen!.volumes[0]!.displayMl).toBeCloseTo(31.3, 1);

      // Ibuprofen: 70 kg * 10 mg/kg = 700 mg, capped at 600
      expect(result.ibuprofen).not.toBeNull();
      expect(result.ibuprofen!.recommendedMg).toBe(600);
      expect(result.ibuprofen!.displayMg).toBe(600);
      expect(result.ibuprofen!.capped).toBe(true); // 700 > 600
      expect(result.ibuprofen!.capMg).toBe(600);
      expect(result.ibuprofen!.intervalHours).toBe(6);
      expect(result.ibuprofen!.volumes[0]!.displayMl).toBeCloseTo(30, 1); // 600/100 * 5
      expect(result.ibuprofen!.volumes[1]!.displayMl).toBeCloseTo(15, 1); // 600/50 * 1.25

      // Spacing reminder should mention both caps
      expect(result.spacingReminder).toContain('1000 mg');
      expect(result.spacingReminder).toContain('600 mg');
    });

    it('4 kg, 1 month (emergency): both medications null, emergency true', () => {
      const result = computeDosing(4, 1);
      expect(result.weightKg).toBe(4);
      expect(result.ageMonths).toBe(1);
      expect(result.ageGate).toBe('emergency');
      expect(result.emergency).toBe(true);
      expect(result.acetaminophen).toBeNull();
      expect(result.ibuprofen).toBeNull();
      expect(result.ibuprofenSuppressedReason).toBeNull();
      expect(result.spacingReminder).toBe('');
    });

    it('0 kg, 18 months: both medications null, spacingReminder empty', () => {
      const result = computeDosing(0, 18);
      expect(result.acetaminophen).toBeNull();
      expect(result.ibuprofen).toBeNull();
      expect(result.ibuprofenSuppressedReason).toBeNull();
      expect(result.spacingReminder).toBe('');
    });

    it('NaN kg, 18 months: both medications null, spacingReminder empty', () => {
      const result = computeDosing(NaN, 18);
      expect(result.acetaminophen).toBeNull();
      expect(result.ibuprofen).toBeNull();
      expect(result.ibuprofenSuppressedReason).toBeNull();
      expect(result.spacingReminder).toBe('');
    });
  });

  describe('resolveAgeGate', () => {
    it('0 months → emergency', () => {
      expect(resolveAgeGate(0)).toBe('emergency');
    });

    it('1 month → emergency', () => {
      expect(resolveAgeGate(1)).toBe('emergency');
    });

    it('2 months → infant', () => {
      expect(resolveAgeGate(2)).toBe('infant');
    });

    it('5 months → infant', () => {
      expect(resolveAgeGate(5)).toBe('infant');
    });

    it('6 months → pediatric', () => {
      expect(resolveAgeGate(6)).toBe('pediatric');
    });

    it('143 months → pediatric', () => {
      expect(resolveAgeGate(143)).toBe('pediatric');
    });

    it('144 months (12 years) → adolescent', () => {
      expect(resolveAgeGate(144)).toBe('adolescent');
    });
  });

  describe('ageMonthsFromDob', () => {
    it('dob 2024-01-15, now 2026-07-02T12:00:00Z → 29 months', () => {
      const now = new Date('2026-07-02T12:00:00Z');
      const result = ageMonthsFromDob('2024-01-15', now);
      expect(result).toBe(29);
    });

    it('dob 2024-07-02, now 2026-07-02T12:00:00Z → 24 months', () => {
      const now = new Date('2026-07-02T12:00:00Z');
      const result = ageMonthsFromDob('2024-07-02', now);
      expect(result).toBe(24);
    });

    it('invalid dob "not-a-date" → 0', () => {
      const now = new Date('2026-07-02T12:00:00Z');
      const result = ageMonthsFromDob('not-a-date', now);
      expect(result).toBe(0);
    });

    it('future dob "2027-01-01" → 0', () => {
      const now = new Date('2026-07-02T12:00:00Z');
      const result = ageMonthsFromDob('2027-01-01', now);
      expect(result).toBe(0);
    });
  });

  describe('doseForMedication', () => {
    it('retrieves acetaminophen dose from result', () => {
      const result = computeDosing(10, 18);
      const dose = doseForMedication(result, 'acetaminophen');
      expect(dose).not.toBeNull();
      expect(dose!.medication).toBe('acetaminophen');
      expect(dose!.displayMg).toBe(150);
    });

    it('retrieves ibuprofen dose from result', () => {
      const result = computeDosing(10, 18);
      const dose = doseForMedication(result, 'ibuprofen');
      expect(dose).not.toBeNull();
      expect(dose!.medication).toBe('ibuprofen');
      expect(dose!.displayMg).toBe(100);
    });
  });

  describe('weight conversion round-trip', () => {
    it('kgFromLbs and lbsFromKg round-trip correctly', () => {
      const kg = 22;
      const lbs = lbsFromKg(kg);
      const backToKg = kgFromLbs(lbs);
      expect(backToKg).toBeCloseTo(kg, 5);
    });
  });
});
