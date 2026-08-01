import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Copy guard for the ADR-0009 notification surfaces.
 *
 * Cappy provides coordination and a shared record. A pediatrician provides
 * medical advice. Notification copy is *awareness* of a dose that has already
 * been logged, and must never present timing as clinical guidance
 * (AGENTS.md §2; ADR-0009 "Notification copy").
 *
 * This is a source-level guard rather than a render test: the repo has no
 * React renderer in its test deps, and the failure mode we care about is a
 * forbidden phrase being typed into a string, which the source catches just
 * as well and much earlier.
 */

const SRC = join(__dirname, '..', '..');

const FILES = [
  join(SRC, 'components', 'Switch.tsx'),
  join(SRC, 'components', 'NotificationPrimingSheet.tsx'),
  join(SRC, 'screens', 'NotificationsScreen.tsx'),
];

/** Collapse JSX line wrapping so multi-line copy can be matched verbatim. */
const normalize = (s: string): string => s.replace(/\s+/g, ' ');

const read = (path: string): string => normalize(readFileSync(path, 'utf8'));

/**
 * Phrasing that presents dose timing as an instruction. The first two are
 * named explicitly in ADR-0009 as forbidden; the rest are the same claim
 * worded differently.
 */
const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /due for a dose/i, why: 'presents timing as medical guidance' },
  { pattern: /time for [^.]*\b(dose|medication|medicine)\b/i, why: 'instructs a dose' },
  { pattern: /it'?s time to (give|take)/i, why: 'instructs a dose' },
  { pattern: /needs? (a|another|their|his|her) (dose|medication)/i, why: 'asserts clinical need' },
  { pattern: /should (give|take) /i, why: 'gives a clinical instruction' },
  { pattern: /\boverdue\b/i, why: 'asserts a missed clinical window' },
  { pattern: /\bsafe to (give|take)\b/i, why: 'asserts clinical safety' },
];

describe('ADR-0009 notification copy', () => {
  it.each(FILES)('%s contains no clinical-instruction phrasing', (path) => {
    const source = read(path);
    for (const { pattern, why } of FORBIDDEN) {
      expect({ file: path, match: pattern.exec(source)?.[0] ?? null, why }).toEqual({
        file: path,
        match: null,
        why,
      });
    }
  });

  it('keeps the ADR-0009 permission-denied banner copy verbatim', () => {
    expect(read(join(SRC, 'screens', 'NotificationsScreen.tsx'))).toContain(
      'Notifications are turned off for Cappy in your device settings',
    );
  });

  it('keeps the ADR-0009 priming copy verbatim, parameterized by child', () => {
    expect(read(join(SRC, 'components', 'NotificationPrimingSheet.tsx'))).toContain(
      'Get told when another caregiver logs a dose for {childName} — even when Cappy is closed.',
    );
  });

  it('disclaims clinical guidance on both notification surfaces', () => {
    for (const path of [
      join(SRC, 'components', 'NotificationPrimingSheet.tsx'),
      join(SRC, 'screens', 'NotificationsScreen.tsx'),
    ]) {
      expect(read(path)).toMatch(/does not tell you when to give a dose/);
    }
  });
});
