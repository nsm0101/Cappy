/* DoseStatusPill — Cappy's core dose-safety status chip.
   The four states tell a caregiver, at a glance, whether a dose may be given.
   Color reinforces safe-vs-too-early WITHOUT implying clinical certainty —
   always pair it with the safety line in real dosing surfaces. */
export function DoseStatusPill({ status = 'due', size = 'md', label, dot = true, children }) {
  const MAP = {
    due:     { bg: 'var(--dose-due-bg)',     fg: 'var(--dose-due-fg)',     solid: 'var(--dose-due-solid)',     text: 'Due now' },
    early:   { bg: 'var(--dose-early-bg)',   fg: 'var(--dose-early-fg)',   solid: 'var(--dose-early-solid)',   text: 'Too early' },
    recent:  { bg: 'var(--dose-recent-bg)',  fg: 'var(--dose-recent-fg)',  solid: 'var(--dose-recent-solid)',  text: 'Given recently' },
    overdue: { bg: 'var(--dose-overdue-bg)', fg: 'var(--dose-overdue-fg)', solid: 'var(--dose-overdue-solid)', text: 'Window passed' },
  };
  const s = MAP[status] || MAP.due;
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 6 : 7, whiteSpace: 'nowrap',
      fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: sm ? 11 : 12.5,
      padding: sm ? '4px 9px' : '6px 12px', borderRadius: 999,
      background: s.bg, color: s.fg,
    }}>
      {dot && <span style={{ width: sm ? 6 : 7, height: sm ? 6 : 7, borderRadius: '50%', background: s.solid, flex: '0 0 auto' }} />}
      {children || label || s.text}
    </span>
  );
}
