/* Cappy marketing site — family medication-coordination story.
   Tweak-driven: accent, headline, hero visual, trust chips, feature focus. */

/* ── Accent presets (Teal-led vs Capybara-blue-led) ─────────────────── */
const ACCENTS = {
  teal: {
    name: 'Teal',
    solid: 'var(--teal-500)', hover: 'var(--teal-600)',
    tint: 'color-mix(in srgb, var(--teal-500) 14%, transparent)',
    deepA: 'var(--teal-700)', deepB: 'var(--teal-800)',
    onDark: 'var(--mint-200)',
  },
  blue: {
    name: 'Capybara blue',
    solid: 'var(--blue-500)', hover: 'var(--blue-600)',
    tint: 'color-mix(in srgb, var(--blue-500) 15%, transparent)',
    deepA: 'var(--blue-600)', deepB: 'var(--blue-800)',
    onDark: 'var(--blue-200)',
  },
};

/* ── Headline variants ──────────────────────────────────────────────── */
const HEADLINES = {
  'same-page': {
    h: 'Everyone caring for your kids, finally on the same page.',
    sub: 'Cappy keeps parents, grandparents, and sitters in sync — tap to log a dose, see what was already given, and know in an instant whether it’s safe to give more.',
  },
  'no-double': {
    h: 'One family. One dose log. Zero double-doses.',
    sub: 'The moment anyone gives a dose, everyone sees it. Cappy turns a frantic group text into a single, trustworthy record the whole care team shares.',
  },
  'coordinate': {
    h: 'Coordinate every dose, across every caregiver.',
    sub: 'Real-time dose tracking for the whole household. Tap your phone to the bottle, log in one tap, and let Cappy make the safe call obvious.',
  },
};

/* ── Status tokens (dose-safety system) ─────────────────────────────── */
const STATUS = {
  due:    { bg:'var(--dose-due-bg)',    fg:'var(--dose-due-fg)',    solid:'var(--dose-due-solid)',    label:'Due now' },
  early:  { bg:'var(--dose-early-bg)',  fg:'var(--dose-early-fg)',  solid:'var(--dose-early-solid)',  label:'Too early' },
  recent: { bg:'var(--dose-recent-bg)', fg:'var(--dose-recent-fg)', solid:'var(--dose-recent-solid)', label:'Given recently' },
};

function StatusPill({ kind, small }) {
  const s = STATUS[kind];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
      fontSize: small ? 10.5 : 11.5, fontWeight:700,
      padding: small ? '4px 9px' : '5px 11px', borderRadius:999,
      background:s.bg, color:s.fg
    }}>
      <span style={{width:6, height:6, borderRadius:'50%', background:s.solid}}/>{s.label}
    </span>
  );
}

function Avatar({ mono, grad, size = 38 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flex:'0 0 auto',
      display:'grid', placeItems:'center', color:'#fff', background:grad,
      fontFamily:'var(--font-display)', fontWeight:800, fontSize:size*0.36
    }}>{mono}</div>
  );
}

/* ── Header ──────────────────────────────────────────────────────────── */
function Header({ accent }) {
  return (
    <header style={{
      position:'sticky', top:0, zIndex:10,
      background:'var(--bg)', borderBottom:'1px solid var(--hairline)',
      padding:'13px 32px',
      display:'flex', alignItems:'center', justifyContent:'space-between'
    }}>
      <a href="#" style={{display:'flex', alignItems:'center', gap:10, textDecoration:'none'}}>
        <img src="../../assets/cappy-mark.png" alt="" style={{height:34, width:34, borderRadius:'50%', display:'block'}}/>
        <span style={{fontFamily:'var(--font-display)', fontSize:23, fontWeight:800, color:'var(--fg)', letterSpacing:'-0.03em'}}>Cappy</span>
      </a>
      <nav style={{display:'flex', gap:30, alignItems:'center'}}>
        <a href="#" style={{color:'var(--fg-2)', fontSize:14, fontWeight:600, textDecoration:'none'}}>For families</a>
        <a href="#" style={{color:'var(--fg-2)', fontSize:14, fontWeight:600, textDecoration:'none'}}>Caregivers</a>
        <a href="#" style={{color:'var(--fg-2)', fontSize:14, fontWeight:600, textDecoration:'none'}}>Safety</a>
        <button className="btn btn-primary" style={{width:'auto', padding:'10px 18px', fontSize:14}}>Get Cappy</button>
      </nav>
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */
function Hero({ accent, headline, showChips, visual }) {
  const copy = HEADLINES[headline] || HEADLINES['same-page'];
  return (
    <section style={{
      position:'relative', padding:'76px 32px 92px', overflow:'hidden',
      display:'grid', gridTemplateColumns:'1.05fr 0.95fr', gap:48, alignItems:'center', maxWidth:1240, margin:'0 auto'
    }}>
      <div style={{
        position:'absolute', right:'-120px', top:'-60px', width:620, height:620, borderRadius:'50%',
        background:`radial-gradient(circle, ${accent.tint} 0%, transparent 62%)`, zIndex:0, pointerEvents:'none'
      }}/>

      <div style={{position:'relative', zIndex:1}}>
        <div className="eyebrow" style={{marginBottom:18}}>For the whole care team</div>
        <h1 className="title-display" style={{fontSize:62, fontWeight:800, marginBottom:22, color:'var(--fg)', maxWidth:580, letterSpacing:'-0.03em'}}>
          {copy.h}
        </h1>
        <p style={{fontSize:18, lineHeight:1.55, color:'var(--fg-2)', maxWidth:500, marginBottom:30}}>
          {copy.sub}
        </p>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <button className="btn btn-primary btn-lg" style={{width:'auto'}}>Get Cappy <Icon name="arrowRight" size={18}/></button>
          <button className="btn btn-ghost" style={{width:'auto', padding:'14px 18px'}}>See how it works</button>
        </div>
        {showChips && (
          <div style={{marginTop:28, display:'flex', gap:18, alignItems:'center', color:'var(--fg-3)', fontSize:13, flexWrap:'wrap'}}>
            <div style={{display:'flex', alignItems:'center', gap:6}}><Icon name="sync" size={16}/> Real-time sync</div>
            <div style={{display:'flex', alignItems:'center', gap:6}}><Icon name="users" size={16}/> Caregiver roles</div>
            <div style={{display:'flex', alignItems:'center', gap:6}}><Icon name="moon" size={16}/> Warm dark mode</div>
          </div>
        )}
      </div>

      <div style={{position:'relative', height:540, zIndex:1}}>
        <StackedCards accent={accent} visual={visual}/>
      </div>
    </section>
  );
}

function StackedCards({ accent, visual }) {
  const fan = [
    { rotate:-6, x:0,   y:6,   kind:'dashboard' },
    { rotate:6,  x:140, y:92,  kind:'family' },
    { rotate:0,  x:46,  y:232, kind:'doselog' },
  ];
  const stack = [
    { rotate:0, x:0,  y:0,   kind:'dashboard' },
    { rotate:0, x:36, y:40,  kind:'family' },
    { rotate:0, x:72, y:80,  kind:'doselog' },
  ];
  const cards = visual === 'stack' ? stack : fan;
  return (
    <div style={{position:'relative', width:'100%', height:'100%'}}>
      {cards.map((c, i) => (
        <div key={i} style={{
          position:'absolute', left:`${c.x}px`, top:`${c.y}px`,
          width:284, transform:`rotate(${c.rotate}deg)`,
          transition:'transform 320ms cubic-bezier(0.2,0,0,1)',
          filter:'drop-shadow(0 20px 40px rgba(11,30,29,0.18))', zIndex:i
        }}>
          {c.kind==='dashboard' && <HeroDashboardCard/>}
          {c.kind==='doselog' && <HeroDoseLogCard accent={accent}/>}
          {c.kind==='family' && <HeroFamilyCard accent={accent}/>}
        </div>
      ))}
    </div>
  );
}

function HeroDashboardCard() {
  const kids = [
    { mono:'EM', name:'Emma', grad:'linear-gradient(150deg,var(--teal-400),var(--teal-600))', meta:'5 yr · 38 lb', status:'due' },
    { mono:'NO', name:'Noah', grad:'linear-gradient(150deg,var(--blue-400),var(--blue-600))', meta:'3 yr · 31 lb', status:'early' },
    { mono:'AV', name:'Ava',  grad:'linear-gradient(150deg,var(--amber-500),var(--amber-700))', meta:'18 mo · 24 lb', status:'recent' },
  ];
  return (
    <div style={{background:'var(--bg-card)', borderRadius:24, padding:20, border:'1px solid var(--hairline)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14}}>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, color:'var(--fg)'}}>Your family today</div>
        <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--fg-3)'}}>4 in sync</div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {kids.map((k,i)=>(
          <div key={i} style={{display:'flex', alignItems:'center', gap:11}}>
            <Avatar mono={k.mono} grad={k.grad} size={38}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, color:'var(--fg)'}}>{k.name}</div>
              <div style={{fontSize:11, color:'var(--fg-3)'}}>{k.meta}</div>
            </div>
            <StatusPill kind={k.status} small/>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroDoseLogCard({ accent }) {
  return (
    <div style={{background:'var(--bg-card)', borderRadius:24, padding:20, border:'1px solid var(--hairline)'}}>
      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:14}}>
        <div style={{width:30, height:30, borderRadius:'50%', background:accent.solid, display:'grid', placeItems:'center', flex:'0 0 auto'}}>
          <Icon name="nfc" size={16} color="#fff"/>
        </div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, color:'var(--fg)'}}>Tag detected</div>
      </div>
      <div style={{background:'var(--dose-due-bg)', borderRadius:14, padding:'12px 13px', marginBottom:12, display:'flex', gap:10, alignItems:'center'}}>
        <div style={{width:34, height:34, borderRadius:10, background:'var(--dose-due-solid)', color:'#fff', display:'grid', placeItems:'center', fontFamily:'var(--font-display)', fontWeight:800}}>✓</div>
        <div>
          <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, color:'var(--dose-due-fg)'}}>Safe to give</div>
          <div style={{fontSize:11, color:'var(--dose-due-fg)', opacity:0.82}}>For Emma · last dose 5h 12m ago</div>
        </div>
      </div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-inset)', borderRadius:12, padding:'9px 12px', marginBottom:12}}>
        <span style={{fontFamily:'var(--font-mono)', fontSize:9.5, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--fg-3)'}}>Amount</span>
        <span style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:18, color:'var(--fg)'}}>5 mL</span>
      </div>
      <div style={{height:46, borderRadius:13, background:accent.solid, color:'#fff', display:'grid', placeItems:'center', fontWeight:700, fontSize:14}}>Log 5 mL for Emma</div>
    </div>
  );
}

function HeroFamilyCard({ accent }) {
  const team = [
    { mono:'SA', name:'Sara', role:'Parent · admin', grad:'linear-gradient(150deg,var(--teal-400),var(--teal-600))' },
    { mono:'DA', name:'David', role:'Co-parent', grad:'linear-gradient(150deg,var(--blue-400),var(--blue-600))' },
    { mono:'GR', name:'Grandpa Lou', role:'Sitter · Ava only', grad:'linear-gradient(150deg,var(--amber-500),var(--amber-700))' },
  ];
  return (
    <div style={{background:'var(--bg-card)', borderRadius:24, padding:20, border:'1px solid var(--hairline)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, color:'var(--fg)'}}>Care team</div>
        <span style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:accent.solid}}>
          <span style={{width:6, height:6, borderRadius:'50%', background:accent.solid}}/>in sync
        </span>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {team.map((m,i)=>(
          <div key={i} style={{display:'flex', alignItems:'center', gap:11}}>
            <Avatar mono={m.mono} grad={m.grad} size={36}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:13.5, color:'var(--fg)'}}>{m.name}</div>
              <div style={{fontSize:11, color:'var(--fg-3)'}}>{m.role}</div>
            </div>
            <Icon name="check" size={15} color={accent.solid}/>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Feature grid ────────────────────────────────────────────────────── */
const FEATURES = {
  sync:   { icon:'sync',    title:'Real-time family sync', body:'Every caregiver sees the same dose log the moment it updates — no group texts, no guessing.' },
  tap:    { icon:'zap',     title:'Tap to log',            body:'Tap your phone to the bottle and Cappy opens the dosing card. Log a dose in one tap.' },
  roles:  { icon:'users',   title:'Caregiver roles',       body:'Invite co-parents, grandparents, and sitters. You control who sees and logs for each child.' },
  status: { icon:'shield',  title:'Dose-safety status',    body:'Due now, too early, or just given — Cappy makes the safe call obvious at a glance.' },
  kids:   { icon:'baby',    title:'Every kid, one place',  body:'Each child carries their own weight, meds, and shared history. Switch in a tap.' },
  timeline:{icon:'history', title:'Shared timeline',       body:'A single, trustworthy record of who gave what, and when — across the whole family.' },
};

function FeatureGrid({ accent, focus }) {
  const order = focus === 'safety'
    ? ['status','sync','timeline','kids','roles','tap']
    : ['sync','tap','roles','status','kids','timeline'];
  const heading = focus === 'safety'
    ? 'The safe call, made obvious.'
    : 'One family. One source of truth.';
  return (
    <section style={{padding:'92px 32px', maxWidth:1240, margin:'0 auto'}}>
      <div style={{maxWidth:700, marginBottom:52}}>
        <div className="eyebrow" style={{marginBottom:14}}>Why Cappy</div>
        <h2 className="title" style={{fontSize:46, color:'var(--fg)', letterSpacing:'-0.02em'}}>{heading}</h2>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:20}}>
        {order.map((key) => {
          const f = FEATURES[key];
          return (
            <div key={key} className="card" style={{padding:'28px 24px', display:'flex', flexDirection:'column', gap:14}}>
              <div style={{
                width:46, height:46, borderRadius:13,
                background:accent.tint, color:accent.solid,
                display:'flex', alignItems:'center', justifyContent:'center'
              }}>
                <Icon name={f.icon} size={22} stroke={2}/>
              </div>
              <div style={{fontFamily:'var(--font-display)', fontSize:21, fontWeight:800, color:'var(--fg)', letterSpacing:'-0.01em'}}>{f.title}</div>
              <div style={{fontSize:15, lineHeight:1.55, color:'var(--fg-2)'}}>{f.body}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── CTA ─────────────────────────────────────────────────────────────── */
function CTA({ accent }) {
  return (
    <section style={{padding:'0 32px 92px'}}>
      <div style={{
        maxWidth:1100, margin:'0 auto',
        background:`linear-gradient(135deg, ${accent.deepA} 0%, ${accent.deepB} 100%)`,
        borderRadius:32, padding:'60px 56px',
        color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', gap:32, flexWrap:'wrap'
      }}>
        <div style={{maxWidth:580}}>
          <div className="eyebrow" style={{color:accent.onDark, marginBottom:14}}>Free to use</div>
          <h2 className="title" style={{fontSize:42, marginBottom:16, color:'#fff', letterSpacing:'-0.02em'}}>Get your whole care team on the same page.</h2>
          <p style={{fontSize:17, lineHeight:1.55, color:'rgba(255,255,255,0.85)'}}>Invite your family in under a minute. Cappy keeps everyone in sync from the very first dose.</p>
        </div>
        <button className="btn btn-lg" style={{
          background:'#FFFFFF', color:accent.deepB, width:'auto', padding:'18px 28px', fontSize:17
        }}>
          Get Cappy <Icon name="arrowRight" size={18}/>
        </button>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{
      borderTop:'1px solid var(--hairline)', padding:'40px 32px 56px',
      maxWidth:1240, margin:'0 auto',
      display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16
    }}>
      <div style={{display:'flex', alignItems:'center', gap:9}}>
        <img src="../../assets/cappy-mark.png" alt="" style={{height:26, width:26, borderRadius:'50%'}}/>
        <span style={{fontFamily:'var(--font-display)', fontSize:16, fontWeight:800, color:'var(--fg)', letterSpacing:'-0.02em'}}>Cappy</span>
        <span style={{fontSize:12, color:'var(--fg-3)', marginLeft:12}}>© 2026</span>
      </div>
      <div style={{fontSize:12, color:'var(--fg-3)', maxWidth:580, textAlign:'right', lineHeight:1.5}}>
        Always confirm dosing before administering medication. Cappy helps families coordinate doses of common medications for generally healthy children. Not a substitute for medical advice.
      </div>
    </footer>
  );
}

Object.assign(window, {
  ACCENTS, HEADLINES,
  Header, Hero, FeatureGrid, CTA, Footer,
});
