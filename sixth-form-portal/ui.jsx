// ui.jsx — shared UI primitives for YCHS portal screens
// Mobile screen header, status pill, progress bar, etc.

const YC_LOGO = 'assets/logo-badge.webp';

// Top bar inside an iOS phone screen (below status bar)
function ScreenHeader({ title, onBack, right, dark = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px 14px',
      background: dark ? 'transparent' : 'transparent',
      color: dark ? '#fff' : 'var(--ink)',
    }}>
      <div style={{ width: 36, display: 'flex', alignItems: 'center' }}>
        {onBack ? (
          <button onClick={onBack} style={{
            width: 36, height: 36, borderRadius: 10, border: '1px solid ' + (dark ? 'rgba(255,255,255,0.18)' : 'var(--line)'),
            background: dark ? 'rgba(255,255,255,0.08)' : 'var(--paper)',
            color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
          }}><Icon name="arrow-left" size={18}/></button>
        ) : null}
      </div>
      <div className="serif" style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      <div style={{ width: 36, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

function Pill({ tone = 'neutral', children, size = 'md' }) {
  const tones = {
    neutral: { bg: '#eee6d6', fg: 'var(--ink-2)' },
    maroon:  { bg: 'var(--maroon-soft)', fg: 'var(--maroon)' },
    gold:    { bg: 'var(--gold-soft)', fg: '#7a5a05' },
    green:   { bg: 'var(--green-soft)', fg: 'var(--green)' },
    amber:   { bg: 'var(--amber-soft)', fg: 'var(--amber)' },
    rose:    { bg: 'var(--rose-soft)', fg: 'var(--rose)' },
    blue:    { bg: 'var(--blue-soft)', fg: 'var(--blue)' },
    dark:    { bg: 'var(--ink)', fg: '#fbf4d8' },
  }[tone];
  const pad = size === 'sm' ? '3px 8px' : '5px 10px';
  const fs  = size === 'sm' ? 10 : 11;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 999,
      background: tones.bg, color: tones.fg,
      font: '600 ' + fs + 'px/1 Inter, sans-serif',
      letterSpacing: 0.04 + 'em',
    }}>{children}</span>
  );
}

// Progress bar (0-1)
function Progress({ value, color = 'var(--maroon)' }) {
  return (
    <div style={{ height: 6, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: (value * 100) + '%', background: color, borderRadius: 999, transition: 'width .3s' }}/>
    </div>
  );
}

// Step dots
function Stepper({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 4,
          flex: i === current ? 2 : 1,
          borderRadius: 4,
          background: i <= current ? 'var(--maroon)' : 'var(--line-2)',
          transition: 'all .2s',
        }}/>
      ))}
    </div>
  );
}

// Bottom tab bar for the post-submit student dashboard
function TabBar({ active, onTab }) {
  const tabs = [
    { id: 'home', label: 'Status', icon: 'spark' },
    { id: 'app',  label: 'My App', icon: 'doc' },
    { id: 'msg',  label: 'Messages', icon: 'chat' },
    { id: 'me',   label: 'Profile', icon: 'user' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--line)',
      padding: '10px 12px 28px',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onTab && onTab(t.id)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          color: active === t.id ? 'var(--maroon)' : 'var(--ink-3)',
          padding: 4,
        }}>
          <Icon name={t.icon} size={22}/>
          <span style={{ font: '600 10px/1 Inter, sans-serif' }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// Section header inside a screen
function SectionTitle({ eyebrow, title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '4px 4px 10px' }}>
      <div>
        {eyebrow ? <div style={{ font: '600 10px/1 Inter', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{eyebrow}</div> : null}
        <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

// Faux phone wrapper that sizes to 390x844 — full bleed scrollable inside
function PhoneShell({ children, dark = false }) {
  return (
    <IOSDevice dark={dark}>
      <div className="yc-screen" style={{ background: dark ? 'var(--ink)' : 'var(--cream)' }}>
        {children}
      </div>
    </IOSDevice>
  );
}

window.ScreenHeader = ScreenHeader;
window.Pill = Pill;
window.Progress = Progress;
window.Stepper = Stepper;
window.TabBar = TabBar;
window.SectionTitle = SectionTitle;
window.PhoneShell = PhoneShell;
window.YC_LOGO = YC_LOGO;
