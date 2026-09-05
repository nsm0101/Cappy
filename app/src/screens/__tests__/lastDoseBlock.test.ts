// LastDoseBlock reaches the theme, which persists the light/dark preference
// through AsyncStorage. There is no global jest setup file in this project, so
// the native module is stubbed here rather than in shared config.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  describeLastDose,
  childDoseStatusPill,
  DOSE_STATUS_LABEL,
} from '@/components/LastDoseBlock';

/**
 * ADR-0009 ticket 8. These cover the two pieces of the last-dose block that
 * are pure logic and safety-relevant: the words on the pill, and the spoken
 * summary that a screen-reader user hears before the Log button.
 *
 * The rendering itself (ordering on screen) is a layout concern verified in
 * the QA matrix; what must never drift silently is the copy.
 */

const HOUR = 3600 * 1000;

describe('describeLastDose', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(now);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it('leads with the amount, then who logged it, then how long ago', () => {
    expect(
      describeLastDose({
        givenAt: new Date(now.getTime() - 2 * HOUR).toISOString(),
        amountLabel: '5 mL',
        loggedByLabel: 'Sarah',
      }),
    ).toBe('5 mL, logged by Sarah, 2h ago.');
  });

  it('says "you" verbatim when the caller resolved the logger to the signed-in user', () => {
    expect(
      describeLastDose({
        givenAt: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
        amountLabel: '160 mg',
        loggedByLabel: 'you',
      }),
    ).toBe('160 mg, logged by you, 40 min ago.');
  });

  it('degrades to the timestamp alone when the dose row was not resolvable', () => {
    expect(
      describeLastDose({
        givenAt: new Date(now.getTime() - HOUR).toISOString(),
        amountLabel: null,
        loggedByLabel: null,
      }),
    ).toBe('1h ago.');
  });

  it('treats no-prior-dose as a first-class state, not an error', () => {
    expect(
      describeLastDose({
        givenAt: null,
        emptyText: 'No one has logged Tylenol for Emma yet. This would be the first.',
      }),
    ).toBe('No one has logged Tylenol for Emma yet. This would be the first.');
  });

  it('never renders an empty summary', () => {
    expect(describeLastDose({ givenAt: null })).toBe('Nothing on record yet.');
  });
});

describe('childDoseStatusPill', () => {
  it('reports a prior dose is on record when it is safe to give', () => {
    expect(childDoseStatusPill('due', true)).toEqual({ label: 'OK to give now', status: 'due' });
  });

  it('distinguishes "no prior dose" from "OK to give now"', () => {
    expect(childDoseStatusPill('due', false)).toEqual({ label: 'No prior dose', status: 'due' });
  });

  it('treats overdue as safe-to-give, as the sheet always has', () => {
    expect(childDoseStatusPill('overdue', true)).toEqual({
      label: 'OK to give now',
      status: 'due',
    });
  });

  it('collapses recent and early into one too-early state', () => {
    expect(childDoseStatusPill('recent', true)).toEqual({ label: 'Too early', status: 'early' });
    expect(childDoseStatusPill('early', true)).toEqual({ label: 'Too early', status: 'early' });
  });

  it('surfaces the 24-hour cap as its own pill, not as "too early"', () => {
    expect(childDoseStatusPill('max_reached', true)).toEqual({
      label: '24-hour limit reached',
      status: 'max_reached',
    });
  });

  it('never claims a dose is safe when the status could not be computed', () => {
    expect(childDoseStatusPill('unknown', true)).toEqual({
      label: 'Status unavailable',
      status: 'unknown',
    });
  });
});

describe('DOSE_STATUS_LABEL', () => {
  it('covers every dose status with non-clinical coordination copy', () => {
    const labels = Object.values(DOSE_STATUS_LABEL);
    expect(Object.keys(DOSE_STATUS_LABEL)).toHaveLength(6);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      // Copy rules (AGENTS.md §2 / ADR-0009): Cappy coordinates, it does not
      // prescribe. "Due for a dose" / "time for medication" are forbidden.
      expect(label.toLowerCase()).not.toContain('due for');
      expect(label.toLowerCase()).not.toContain('time for');
    }
  });
});
