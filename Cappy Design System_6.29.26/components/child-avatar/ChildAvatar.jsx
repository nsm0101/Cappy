/* ChildAvatar — the child & caregiver identity disc used across Cappy.
   Photo when available, colored monogram fallback otherwise. Optionally wraps
   in a caregiver role ring and/or a corner role badge. One stable color per
   person keeps identity recognizable at a glance across every screen. */
export function ChildAvatar({ name = '', photo, color = 'teal', size = 48, ring, badge }) {
  const GRAD = {
    teal:  'linear-gradient(150deg,var(--teal-400),var(--teal-600))',
    blue:  'linear-gradient(150deg,var(--blue-400),var(--blue-600))',
    amber: 'linear-gradient(150deg,var(--amber-500),var(--amber-700))',
    coral: 'linear-gradient(150deg,var(--coral-500),var(--coral-700))',
    tan:   'linear-gradient(150deg,var(--tan-300),var(--tan-500))',
  };
  const mono = String(name).trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const disc = {
    width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
    overflow: 'hidden', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800,
    fontSize: Math.round(size * 0.36), flex: '0 0 auto', boxShadow: 'var(--shadow-1)',
    background: photo ? 'var(--bg-inset)' : (GRAD[color] || GRAD.teal),
  };
  const discEl = (
    <div style={disc}>
      {photo ? <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : mono}
    </div>
  );
  const badgeEl = badge ? (
    <span style={{
      position: 'absolute', right: -2, bottom: -2, zIndex: 3,
      minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999,
      border: '2px solid var(--bg)', background: badge.color || 'var(--slate-400)',
      display: 'grid', placeItems: 'center', color: '#fff',
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, lineHeight: 1,
    }}>{badge.label}</span>
  ) : null;
  if (ring || badge) {
    return (
      <span style={{
        position: 'relative', display: 'inline-grid', placeItems: 'center',
        padding: ring ? 3 : 0, borderRadius: '50%', background: ring || 'transparent',
      }}>
        {discEl}
        {badgeEl}
      </span>
    );
  }
  return discEl;
}
