// screens-student.jsx — All student-facing portal screens
// Each Screen is a self-contained 390x844 view rendered inside a PhoneShell.

const C = (...xs) => xs.filter(Boolean).join(' ');
const stop = (e) => e && e.stopPropagation && e.stopPropagation();

// ─── 1. LANDING ─────────────────────────────────────────────────────
function S_Landing({ go }) {
  return (
    <PhoneShell>
      <div style={{ position: 'relative', height: 520 }}>
        <img src="assets/campus-1.webp" alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e)=>{e.target.style.display='none';}}/>
        <div style={{ position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(122,31,43,0.55) 0%, rgba(93,22,32,0.85) 70%, var(--maroon-deep) 100%)' }}/>
        <div style={{ position: 'relative', padding: '60px 24px 28px', color: '#fff', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={YC_LOGO} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }}/>
            <div>
              <div style={{ font: '700 11px/1 Inter', letterSpacing: '0.18em' }}>YORK CASTLE HIGH</div>
              <div style={{ font: '500 10px/1.2 Inter', opacity: 0.7, marginTop: 3 }}>Brown's Town · St. Ann · Jamaica</div>
            </div>
          </div>
          <div style={{ flex: 1 }}/>
          <Pill tone="gold" size="sm"><span style={{ width:6, height:6, borderRadius:99, background: 'var(--gold)' }}/> APPLICATIONS OPEN · 2026 INTAKE</Pill>
          <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.02, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.02em' }}>
            Your <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>next two years</em><br/>start here.
          </h1>
          <p style={{ font: '400 14px/1.5 Inter', opacity: 0.85, margin: 0 }}>
            Apply to the York Castle Sixth Form CAPE programme — a two-year journey to university, designed by teachers who've sent over <b style={{ color: 'var(--gold)', fontWeight: 700 }}>1,400 students</b> on to higher education.
          </p>
        </div>
      </div>
      <div style={{ padding: '20px 20px 24px' }}>
        <button className="btn btn-primary btn-block" onClick={() => go('signup')} style={{ marginBottom: 10 }}>
          Begin your application <Icon name="arrow-right" size={16}/>
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => go('login')}>
          I've already started — sign in
        </button>

        <div style={{ marginTop: 28 }}>
          <SectionTitle eyebrow="At a glance" title="What you'll need"/>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { icon:'doc',     t:'CSEC results slip',     d:'Or pending exam centre #' },
              { icon:'user',    t:'Two referees',          d:'Principal + subject teacher' },
              { icon:'beaker',  t:'Three CAPE subjects',   d:'Pick from 18 offered units' },
              { icon:'clock',   t:'About 25 minutes',      d:'You can save and resume anytime' },
            ].map((r,i)=>(
              <div key={i} className="card" style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 14px' }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'var(--maroon-soft)', color:'var(--maroon)', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={r.icon} size={20}/></div>
                <div style={{ flex:1 }}>
                  <div style={{ font:'600 14px/1.2 Inter' }}>{r.t}</div>
                  <div style={{ font:'400 12px/1.2 Inter', color:'var(--ink-3)', marginTop:3 }}>{r.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 20, padding: 16, background: 'var(--gold-soft)', border:'1px solid #ecd98e' }}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            <Icon name="calendar" size={18} color="#7a5a05"/>
            <div>
              <div style={{ font:'700 12px/1 Inter', color:'#7a5a05', letterSpacing:'0.06em', textTransform:'uppercase' }}>Important dates</div>
              <div style={{ font:'500 13px/1.5 Inter', color:'#574000', marginTop:6 }}>
                Applications close <b>15 June 2026</b><br/>
                Interview week <b>1–5 July 2026</b><br/>
                Decisions <b>by 19 July 2026</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

// ─── 2. SIGN UP ─────────────────────────────────────────────────────
function S_SignUp({ go }) {
  return (
    <PhoneShell>
      <ScreenHeader onBack={()=>go('landing')} title="Create account"/>
      <div style={{ padding: '8px 24px 24px' }}>
        <h1 className="serif" style={{ fontSize: 30, lineHeight: 1.05, fontWeight: 600, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>One step closer.</h1>
        <p style={{ font: '400 14px/1.5 Inter', color: 'var(--ink-2)', margin: '0 0 22px' }}>
          We'll save your progress so you can come back anytime — even from a different phone.
        </p>

        <div style={{ display:'grid', gap: 14 }}>
          <div>
            <label className="label">Full name</label>
            <input className="field" defaultValue="Tanika Brown" placeholder="As it appears on your CSEC slip"/>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="field" defaultValue="tanika.b@gmail.com" type="email"/>
          </div>
          <div>
            <label className="label">Phone (Jamaica)</label>
            <input className="field" defaultValue="+1 876 555 0142"/>
          </div>
          <div>
            <label className="label">Create password</label>
            <div style={{ position:'relative' }}>
              <input className="field" type="password" defaultValue="••••••••••" style={{ paddingRight: 44 }}/>
              <Icon name="eye" size={18} color="var(--ink-3)" style={{ position:'absolute', right: 14, top: 14 }}/>
            </div>
            <div style={{ marginTop:8, display:'flex', gap:5 }}>
              {[1,1,1,0].map((v,i)=>(<div key={i} style={{ height:3, flex:1, background: v ? 'var(--green)' : 'var(--line)', borderRadius: 4 }}/>))}
            </div>
            <div style={{ font:'500 11px/1 Inter', color: 'var(--green)', marginTop: 6 }}>Strong</div>
          </div>
          <label style={{ display:'flex', gap:10, alignItems:'flex-start', font:'400 13px/1.4 Inter', color:'var(--ink-2)', marginTop:4 }}>
            <input type="checkbox" defaultChecked style={{ marginTop: 3, accentColor: 'var(--maroon)' }}/>
            <span>I confirm the information I provide will be true and complete to the best of my knowledge.</span>
          </label>
        </div>

        <button className="btn btn-primary btn-block" style={{ marginTop: 22 }} onClick={()=>go('overview')}>
          Create account & continue
        </button>
        <div style={{ textAlign:'center', font:'500 13px/1 Inter', color:'var(--ink-3)', marginTop: 16 }}>
          Already have one? <a onClick={()=>go('login')} style={{ color: 'var(--maroon)', fontWeight: 600, cursor:'pointer' }}>Sign in</a>
        </div>
      </div>
    </PhoneShell>
  );
}

// ─── 3. LOGIN ─────────────────────────────────────────────────────
function S_Login({ go }) {
  return (
    <PhoneShell>
      <div style={{ position:'relative', minHeight:'100%' }}>
        <div style={{ height: 240, background: 'var(--maroon)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, opacity:0.18,
            backgroundImage: 'radial-gradient(circle at 30% 30%, var(--gold) 0, transparent 50%), radial-gradient(circle at 80% 90%, var(--gold) 0, transparent 60%)' }}/>
          <ScreenHeader title="" onBack={()=>go('landing')} dark/>
          <div style={{ padding:'10px 24px', color:'#fff', position:'relative' }}>
            <img src={YC_LOGO} alt="" style={{ width: 56, height: 56, objectFit:'contain', marginBottom:14 }}/>
            <div className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing:'-0.01em' }}>Welcome back.</div>
            <div style={{ font:'400 14px/1.4 Inter', opacity:0.8, marginTop:6 }}>Pick up where you left off.</div>
          </div>
        </div>
        <div style={{ padding:'24px', display:'grid', gap: 14 }}>
          <div>
            <label className="label">Email</label>
            <input className="field" defaultValue="tanika.b@gmail.com"/>
          </div>
          <div>
            <label className="label">Password</label>
            <input className="field" type="password" defaultValue="••••••••••"/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <label style={{ display:'flex', gap:8, alignItems:'center', font:'500 13px Inter', color:'var(--ink-2)' }}>
              <input type="checkbox" defaultChecked style={{ accentColor:'var(--maroon)' }}/> Keep me signed in
            </label>
            <a style={{ font:'600 13px Inter', color:'var(--maroon)', cursor:'pointer' }}>Forgot?</a>
          </div>
          <button className="btn btn-primary btn-block" onClick={()=>go('dashboard')}>Sign in</button>
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'10px 0' }}>
            <div style={{ height:1, background:'var(--line)', flex:1 }}/>
            <div style={{ font:'500 11px Inter', color:'var(--ink-3)', letterSpacing:'0.1em' }}>OR</div>
            <div style={{ height:1, background:'var(--line)', flex:1 }}/>
          </div>
          <button className="btn btn-ghost btn-block">
            <span style={{ width:18, height:18, borderRadius:99, background:'#fff', border:'1px solid var(--line-2)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:'var(--ink)' }}>G</span>
            Continue with Google
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}

// ─── 4. APPLICATION OVERVIEW (logged-in checklist) ────────────────────
function S_Overview({ go }) {
  const sections = [
    { id:'personal',  t:'Personal details',     d:'Name, address, contact', icon:'user',     done:true,  step:'personal' },
    { id:'academic',  t:'Academic history',     d:'Schools attended',       icon:'book',     done:true,  step:'academic' },
    { id:'cxc',       t:'CSEC results',         d:'8 subjects entered',     icon:'doc',      done:true,  step:'cxc' },
    { id:'subjects',  t:'CAPE subjects',        d:'Choose 3 units',         icon:'beaker',   done:false, current:true, step:'subjects' },
    { id:'refs',      t:'References',           d:'2 of 2',                 icon:'star',     done:false, step:'refs' },
    { id:'docs',      t:'Documents',            d:'Upload 4 files',         icon:'upload',   done:false, step:'docs' },
    { id:'review',    t:'Review & submit',      d:'',                       icon:'check-circle', done:false, step:'review' },
  ];
  const completed = sections.filter(s=>s.done).length;
  const pct = completed / sections.length;
  return (
    <PhoneShell>
      <div style={{ background:'var(--maroon)', color:'#fff', padding: '54px 22px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 18 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <img src={YC_LOGO} style={{ width:32, height:32, objectFit:'contain' }}/>
            <div style={{ font:'600 12px/1 Inter', letterSpacing:'0.16em' }}>YCHS · SIXTH FORM</div>
          </div>
          <Icon name="bell" size={20}/>
        </div>
        <div style={{ font:'400 13px/1 Inter', opacity:0.7, marginBottom: 6 }}>Hi Tanika 👋</div>
        <div className="serif" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.01em', marginBottom: 16 }}>
          You're <em style={{ color:'var(--gold)', fontStyle:'italic' }}>43% there.</em><br/>Just three sections left.
        </div>
        <Progress value={pct} color="var(--gold)"/>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10, font:'500 11px/1 Inter', opacity:0.8 }}>
          <span>{completed} of {sections.length} complete</span>
          <span>Closes 15 Jun · 48 days left</span>
        </div>
      </div>

      <div style={{ padding:'18px 18px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
          <div className="serif" style={{ fontSize: 17, fontWeight: 600 }}>Your application</div>
          <button style={{ background:'none', border:'none', font:'600 12px Inter', color:'var(--maroon)', cursor:'pointer' }}>Save & exit</button>
        </div>

        <div style={{ display:'grid', gap: 8 }}>
          {sections.map((s,i) => (
            <button key={s.id} onClick={()=>s.step && go(s.step)} className="card" style={{
              display:'flex', alignItems:'center', gap: 14, padding: '14px 14px',
              border: s.current ? '1.5px solid var(--maroon)' : '1px solid var(--line)',
              background: s.current ? 'var(--paper)' : 'var(--paper)',
              boxShadow: s.current ? '0 4px 18px rgba(122,31,43,0.10)' : 'none',
              textAlign:'left', cursor:'pointer', width:'100%',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: s.done ? 'var(--green-soft)' : (s.current ? 'var(--maroon-soft)' : '#f1ead9'),
                color:    s.done ? 'var(--green)'    : (s.current ? 'var(--maroon)'    : 'var(--ink-3)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.done ? <Icon name="check" size={18}/> : <Icon name={s.icon} size={18}/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ font:'600 14px/1 Inter' }}>{s.t}</span>
                  {s.current ? <Pill tone="maroon" size="sm">Continue</Pill> : null}
                </div>
                <div style={{ font:'400 12px/1.2 Inter', color: 'var(--ink-3)', marginTop: 4 }}>{s.d || (s.done ? 'Complete' : 'Not started')}</div>
              </div>
              <Icon name="arrow-right" size={16} color="var(--ink-3)"/>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: 14, borderRadius: 14, background:'#fbf4d8', border:'1px solid #ecd98e', display:'flex', gap: 10, alignItems:'flex-start' }}>
          <Icon name="spark" size={18} color="#7a5a05"/>
          <div style={{ font:'500 12px/1.45 Inter', color: '#574000' }}>
            <b>Tip:</b> Complete CAPE subjects first — your referee selections depend on the subjects you pick.
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

// ─── 5. PERSONAL ─────────────────────────────────────────────────────
function FormScreen({ go, step, total, title, eyebrow, prev, next, children, nextLabel='Continue' }) {
  return (
    <PhoneShell>
      <div style={{ padding: '50px 20px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 18 }}>
          <button onClick={()=>go(prev)} style={{ background:'none', border:'none', display:'flex', alignItems:'center', gap:6, color:'var(--ink-2)', font:'600 13px Inter', cursor:'pointer' }}>
            <Icon name="arrow-left" size={16}/> Back
          </button>
          <div style={{ font:'600 12px/1 Inter', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>STEP {step} OF {total}</div>
          <button onClick={()=>go('overview')} style={{ background:'none', border:'none', font:'600 13px Inter', color:'var(--maroon)', cursor:'pointer' }}>Save</button>
        </div>
        <Stepper total={total} current={step-1}/>
        <div style={{ marginTop: 18 }}>
          <div style={{ font:'600 11px/1 Inter', color:'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{eyebrow}</div>
          <h1 className="serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15, margin: 0, letterSpacing:'-0.01em' }}>{title}</h1>
        </div>
      </div>
      <div style={{ padding: '6px 20px 100px' }}>
        {children}
      </div>
      <div style={{ position:'absolute', bottom: 0, left: 0, right: 0, padding: '14px 20px 26px', background: 'linear-gradient(to top, var(--cream) 60%, transparent)' }}>
        <button className="btn btn-primary btn-block" onClick={()=>go(next)}>{nextLabel} <Icon name="arrow-right" size={16}/></button>
      </div>
    </PhoneShell>
  );
}

function S_Personal({ go }) {
  return (
    <FormScreen go={go} step={1} total={6} eyebrow="Section 1 · Personal" title="Tell us about you." prev="overview" next="academic">
      <div style={{ display:'grid', gap: 14, marginTop: 18 }}>
        <div>
          <label className="label">Legal name</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
            <input className="field" defaultValue="Tanika" placeholder="First"/>
            <input className="field" defaultValue="Brown"  placeholder="Last"/>
          </div>
        </div>
        <div>
          <label className="label">Date of birth</label>
          <input className="field" defaultValue="14 March 2008"/>
        </div>
        <div>
          <label className="label">Gender</label>
          <div style={{ display:'flex', gap:8 }}>
            {['Female','Male','Prefer not to say'].map((g,i)=>(
              <button key={i} className="field" style={{ padding:'12px 12px', textAlign:'center', flex:1, background: i===0 ? 'var(--maroon-soft)' : 'var(--paper)', borderColor: i===0 ? 'var(--maroon)' : 'var(--line)', color: i===0 ? 'var(--maroon)' : 'var(--ink-2)', fontWeight: 600, fontSize: 13, cursor:'pointer' }}>{g}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">TRN (Tax Reg. Number)</label>
          <input className="field" defaultValue="118-453-902"/>
        </div>
        <div>
          <label className="label">Home address</label>
          <textarea className="field" rows="3" defaultValue="14 Mango Walk, Brown's Town&#10;St. Ann, Jamaica"/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label className="label">Parish</label>
            <div style={{ position:'relative' }}>
              <select className="field" defaultValue="St. Ann" style={{ appearance:'none', paddingRight: 36, cursor:'pointer' }}>
                {['Clarendon','Hanover','Kingston','Manchester','Portland','St. Andrew','St. Ann','St. Catherine','St. Elizabeth','St. James','St. Mary','St. Thomas','Trelawny','Westmoreland'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--ink-3)' }}>
                <Icon name="chevron-down" size={16}/>
              </span>
            </div>
          </div>
          <div>
            <label className="label">Postal code</label>
            <input className="field" defaultValue="JMAAN02"/>
          </div>
        </div>
        <div>
          <label className="label">Parent / guardian name</label>
          <input className="field" defaultValue="Marcia Brown"/>
        </div>
        <div>
          <label className="label">Parent / guardian phone</label>
          <input className="field" defaultValue="+1 876 555 0188"/>
        </div>
      </div>
    </FormScreen>
  );
}

// ─── 6. ACADEMIC HISTORY ─────────────────────────────────────────────
function S_Academic({ go }) {
  return (
    <FormScreen go={go} step={2} total={6} eyebrow="Section 2 · Academic" title="Where have you studied?" prev="personal" next="cxc">
      <div style={{ display:'grid', gap: 12, marginTop: 18 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <Pill tone="maroon" size="sm">CURRENT</Pill>
              <div style={{ font:'600 15px/1.2 Inter', marginTop: 8 }}>York Castle High School</div>
              <div style={{ font:'400 12px/1.3 Inter', color:'var(--ink-3)', marginTop: 4 }}>Grade 11 · 2022 – present</div>
            </div>
            <Icon name="pencil" size={16} color="var(--ink-3)"/>
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <Pill tone="neutral" size="sm">PREVIOUS</Pill>
              <div style={{ font:'600 15px/1.2 Inter', marginTop: 8 }}>Brown's Town Primary</div>
              <div style={{ font:'400 12px/1.3 Inter', color:'var(--ink-3)', marginTop: 4 }}>Grades 1–6 · 2014 – 2020</div>
            </div>
            <Icon name="pencil" size={16} color="var(--ink-3)"/>
          </div>
        </div>
        <button className="card" style={{ padding: 14, display:'flex', alignItems:'center', justifyContent:'center', gap: 8, color:'var(--maroon)', font:'600 14px Inter', background:'transparent', borderStyle:'dashed', cursor:'pointer' }}>
          <Icon name="plus" size={16}/> Add another school
        </button>

        <div style={{ marginTop: 6 }}>
          <label className="label">Awards or notable achievements</label>
          <textarea className="field" rows="4" defaultValue="House Vice-Captain (Mico, 2025)&#10;Math Club regional finalist 2024&#10;Bronze, Jamaica Cultural Development arts speech"/>
        </div>
        <div>
          <label className="label">Why CAPE at York Castle?</label>
          <textarea className="field" rows="5" placeholder="Tell us in 2–3 short paragraphs what draws you to our sixth form." defaultValue="I want to keep studying with the teachers who helped me discover that I love biology — and to stay in the house community that's been my second family."/>
          <div style={{ font:'500 11px Inter', color:'var(--ink-3)', marginTop:6, textAlign:'right' }}>184 / 600 chars</div>
        </div>
      </div>
    </FormScreen>
  );
}

// ─── 7. CXC RESULTS ENTRY ────────────────────────────────────────────
function S_CXC({ go }) {
  const grades = ['I', 'II', 'III', 'IV', 'V', 'VI', 'Pending'];
  const subj = [
    { s:'English Language', g:'I',  yr:'2025' },
    { s:'Mathematics',      g:'I',  yr:'2025' },
    { s:'Biology',          g:'I',  yr:'2025' },
    { s:'Chemistry',        g:'II', yr:'2025' },
    { s:'Physics',          g:'II', yr:'2025' },
    { s:'Geography',        g:'I',  yr:'2025' },
    { s:'Information Tech.', g:'II', yr:'2025' },
    { s:'Spanish',          g:'III',yr:'2025' },
  ];
  return (
    <FormScreen go={go} step={3} total={6} eyebrow="Section 3 · Results" title="Your CSEC results." prev="academic" next="subjects">
      <div className="card" style={{ marginTop: 16, padding: 14, background:'var(--blue-soft)', borderColor:'#c7d8ec', display:'flex', gap:10 }}>
        <Icon name="spark" size={18} color="var(--blue)"/>
        <div style={{ font:'500 12px/1.45 Inter', color:'var(--blue)' }}>
          We need at least <b>5 passes including English & Maths</b> at Grades I–III for sixth-form entry.
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
          <div className="serif" style={{ font:'600 16px Inter' }}>Subjects · {subj.length}</div>
          <Pill tone="green" size="sm"><Icon name="check" size={11}/> 7 of 8 passed</Pill>
        </div>

        <div style={{ display:'grid', gap: 8 }}>
          {subj.map((r,i)=>{
            const passed = ['I','II','III'].includes(r.g);
            return (
              <div key={i} className="card" style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: passed ? 'var(--maroon)' : '#e8d8d8',
                  color: passed ? '#fff' : 'var(--rose)',
                  font:'700 14px/1 Fraunces, serif',
                }}>{r.g}</div>
                <div style={{ flex:1 }}>
                  <div style={{ font:'600 14px/1.2 Inter' }}>{r.s}</div>
                  <div style={{ font:'400 12px/1 Inter', color: 'var(--ink-3)', marginTop: 3 }}>CSEC · {r.yr}</div>
                </div>
                <Icon name="pencil" size={15} color="var(--ink-3)"/>
              </div>
            );
          })}
        </div>

        <button className="card" style={{ marginTop: 10, padding: 14, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap: 8, color:'var(--maroon)', font:'600 14px Inter', background:'transparent', borderStyle:'dashed', cursor:'pointer' }}>
          <Icon name="plus" size={16}/> Add a subject
        </button>

        <div style={{ marginTop: 18 }}>
          <label className="label">Exam centre number</label>
          <input className="field" defaultValue="100126"/>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="label">Candidate number</label>
          <input className="field" defaultValue="0034218"/>
        </div>
      </div>
    </FormScreen>
  );
}

// ─── 8. CAPE SUBJECTS — real YCHS programmes + AI nudge ──────────────
// Programme list & AI text mirrored from the live applications dataset.
function S_Subjects({ go }) {
  const [picked, setPicked] = React.useState('nat-sci');
  // Real programmes, in popularity order from the cleaned dataset
  const programmes = [
    { id:'nat-sci',  name:'Natural Sciences',         faculty:'Associate of Science', icon:'beaker',
      color:'var(--green)',  bg:'var(--green-soft)',  apps: 32,
      core:['Biology','Chemistry','Pure Mathematics'],
      careers:'Medicine · Nursing · Marine Biotech · Environmental Science', pop:true },
    { id:'biz',      name:'Entrepreneurship',         faculty:'Associate of Arts · Business Studies', icon:'briefcase',
      color:'var(--maroon)', bg:'var(--maroon-soft)', apps: 10,
      core:['Management of Business','Accounting','Economics'],
      careers:'Founding a business · Trading · Family enterprise' },
    { id:'ict',      name:'Information & Communication Technology', faculty:'Associate of Science', icon:'spark',
      color:'#5a4400',       bg:'var(--gold-soft)',   apps: 8,
      core:['Computer Science','Pure Mathematics','Physics'],
      careers:'Software · Game development · IT services' },
    { id:'law',      name:'Law',                      faculty:'Associate of Arts · Humanities', icon:'book',
      color:'var(--blue)',   bg:'var(--blue-soft)',   apps: 6,
      core:['Caribbean Studies','Comm. Studies','Literatures in English','History'],
      careers:'Law school · Public administration' },
    { id:'ind-tech', name:'Industrial Technology',    faculty:'Associate of Science', icon:'briefcase',
      color:'#5a3a05',       bg:'#f0e3c8',            apps: 5,
      core:['Physics','Pure Mathematics','Building & Mech. Engineering Drawing'],
      careers:'Engineering · Industrial electrician · Skilled trades' },
    { id:'tour',     name:'Tourism',                  faculty:'Associate of Arts · Humanities', icon:'globe',
      color:'#0a6072',       bg:'#dcefea',            apps: 5,
      core:['Geography','Spanish','Tourism','Caribbean Studies'],
      careers:'Hospitality · Heritage · Travel ops' },
    { id:'vc',       name:'Visual Communication',     faculty:'Associate of Arts · Humanities', icon:'palette',
      color:'#7a2664',       bg:'#f4e4ee',            apps: 3,
      core:['Visual Arts','Comm. Studies','Lit. in English'],
      careers:'Design · Branding · Media' },
    { id:'soc',      name:'Sociology',                faculty:'Associate of Arts · Humanities', icon:'user',
      color:'var(--blue)',   bg:'var(--blue-soft)',   apps: 3,
      core:['Sociology','Caribbean Studies','Comm. Studies'],
      careers:'Social work · Public policy · Counselling' },
  ];
  const cur = programmes.find(p => p.id === picked) || programmes[0];

  return (
    <PhoneShell>
      <div style={{ padding: '50px 20px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 18 }}>
          <button onClick={()=>go('cxc')} style={{ background:'none', border:'none', display:'flex', alignItems:'center', gap:6, color:'var(--ink-2)', font:'600 13px Inter', cursor:'pointer' }}>
            <Icon name="arrow-left" size={16}/> Back
          </button>
          <div style={{ font:'600 12px/1 Inter', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>STEP 4 OF 6</div>
          <button onClick={()=>go('overview')} style={{ background:'none', border:'none', font:'600 13px Inter', color:'var(--maroon)', cursor:'pointer' }}>Save</button>
        </div>
        <Stepper total={6} current={3}/>
        <div style={{ marginTop: 18 }}>
          <div style={{ font:'600 11px/1 Inter', color:'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Section 4 · Programme</div>
          <h1 className="serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15, margin: 0, letterSpacing:'-0.01em' }}>
            Choose your CAPE programme. <em style={{ color:'var(--ink-3)', fontStyle:'italic', fontWeight: 400 }}>One faculty, three units.</em>
          </h1>
        </div>

        {/* AI Recommendation nudge — based on real CSEC profile + career goal */}
        <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border:'1px solid var(--gold)', background:'linear-gradient(180deg, var(--gold-soft) 0%, #fff 80%)' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width:24, height:24, borderRadius: 7, background:'var(--gold)', color:'var(--ink)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="sparkle" size={13} strokeWidth={2}/>
            </span>
            <span style={{ font:'600 11px/1 Inter', color:'#5a4400', letterSpacing:'0.1em' }}>SUGGESTED FOR YOU</span>
          </div>
          <p style={{ font:'500 13px/1.5 Inter', color:'var(--ink)', margin:0 }}>
            Based on your <b>CSEC profile</b> (Bio I · Chem II · Maths I) and your goal of <b>medicine at UWI Mona</b>, the <b>Natural Sciences</b> programme is the strongest fit. It builds directly on the subjects you've already passed.
          </p>
          <button onClick={()=>setPicked('nat-sci')} style={{ marginTop:10, background:'transparent', border:'none', font:'600 12px Inter', color:'#5a4400', display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:0 }}>
            Pick Natural Sciences <Icon name="arrow-right" size={13}/>
          </button>
        </div>
      </div>

      <div style={{ padding: '6px 20px 110px', display:'grid', gap: 10 }}>
        {programmes.map(p => {
          const sel = picked === p.id;
          return (
            <button key={p.id} onClick={()=>setPicked(p.id)} style={{
              textAlign:'left', padding: 0, borderRadius: 14,
              background: sel ? '#fff' : 'var(--paper)',
              border: sel ? '2px solid var(--maroon)' : '1px solid var(--line)',
              boxShadow: sel ? '0 6px 18px rgba(122,31,43,0.10)' : 'none',
              cursor:'pointer', overflow:'hidden', transition:'all .12s',
            }}>
              <div style={{ padding: '14px 14px 12px', display:'flex', alignItems:'flex-start', gap: 12 }}>
                <div style={{ width:40, height:40, borderRadius: 10, background: p.bg, color: p.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon name={p.icon} size={18}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom: 3 }}>
                    <div className="serif" style={{ font:'600 16px/1.2 Inter', color:'var(--ink)' }}>{p.name}</div>
                    {p.pop ? <span style={{ font:'600 9px/1 Inter', letterSpacing:'0.1em', color: p.color }}>★ MOST PICKED</span> : null}
                  </div>
                  <div style={{ font:'500 11px/1.3 Inter', color:'var(--ink-3)' }}>{p.faculty}</div>
                  <div style={{ font:'400 11px/1.4 Inter', color:'var(--ink-2)', marginTop: 6 }}>{p.careers}</div>
                </div>
                <div style={{ width:22, height:22, borderRadius:99, border: sel ? '1.5px solid var(--maroon)' : '1.5px solid var(--line-2)', background: sel ? 'var(--maroon)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:4 }}>
                  {sel ? <Icon name="check" size={12} color="#fff" strokeWidth={2.6}/> : null}
                </div>
              </div>
              {sel ? (
                <div style={{ padding:'10px 14px', borderTop:'1px solid var(--line)', background:'var(--cream)' }}>
                  <div style={{ font:'600 10px/1 Inter', color:'var(--ink-3)', letterSpacing:'0.1em', marginBottom:8 }}>YOU'LL TAKE</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
                    {p.core.map(c => (
                      <span key={c} style={{ padding:'5px 10px', borderRadius:8, background:'#fff', border:'1px solid var(--line)', font:'600 11px/1 Inter', color:'var(--ink)' }}>{c}</span>
                    ))}
                    <span style={{ padding:'5px 10px', borderRadius:8, background:'var(--ink)', color:'var(--gold)', font:'600 11px/1 Inter' }}>+ Caribbean Studies</span>
                    <span style={{ padding:'5px 10px', borderRadius:8, background:'var(--ink)', color:'var(--gold)', font:'600 11px/1 Inter' }}>+ Comm. Studies</span>
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ position:'absolute', bottom: 0, left: 0, right: 0, padding: '14px 20px 26px', background: 'linear-gradient(to top, var(--cream) 60%, transparent)' }}>
        <button className="btn btn-primary btn-block" onClick={()=>go('refs')}>
          Continue · {cur.name} <Icon name="arrow-right" size={16}/>
        </button>
      </div>
    </PhoneShell>
  );
}

// ─── 9. REFERENCES ────────────────────────────────────────────────────
function S_Refs({ go }) {
  const refs = [
    { name:'Mr. Devon Campbell',   role:'Principal',                email:'d.campbell@yorkcastle.edu.jm', sent:true,  status:'Submitted', date:'18 Apr' },
    { name:'Mrs. Patricia Hibbert', role:'Biology · Form Tutor',     email:'p.hibbert@yorkcastle.edu.jm',  sent:true,  status:'Awaiting',  date:'Sent 22 Apr' },
  ];
  return (
    <FormScreen go={go} step={5} total={6} eyebrow="Section 5 · References" title="Two people who'll vouch for you." prev="subjects" next="docs">
      <p style={{ font:'400 13px/1.5 Inter', color:'var(--ink-2)', marginTop: 12 }}>
        We email a short form directly to each referee. They submit privately — you won't see their answers.
      </p>
      <div style={{ display:'grid', gap: 10, marginTop: 14 }}>
        {refs.map((r,i)=>(
          <div key={i} className="card" style={{ padding: 14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ font:'600 14px/1.2 Inter' }}>{r.name}</div>
                <div style={{ font:'400 12px/1.3 Inter', color:'var(--ink-3)', marginTop:3 }}>{r.role}</div>
                <div style={{ font:'500 12px/1 Inter', color:'var(--ink-2)', marginTop:8 }}>{r.email}</div>
              </div>
              <Pill tone={r.status==='Submitted' ? 'green' : 'amber'} size="sm">
                {r.status==='Submitted' ? <Icon name="check" size={11}/> : <Icon name="clock" size={11}/>} {r.status}
              </Pill>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 10, paddingTop: 10, borderTop:'1px solid var(--line)' }}>
              <span style={{ font:'500 11px Inter', color:'var(--ink-3)' }}>{r.date}</span>
              <button style={{ background:'none', border:'none', font:'600 12px Inter', color:'var(--maroon)', cursor:'pointer' }}>Resend ↻</button>
            </div>
          </div>
        ))}
        <button className="card" style={{ padding: 14, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap: 8, color:'var(--maroon)', font:'600 14px Inter', background:'transparent', borderStyle:'dashed', cursor:'pointer' }}>
          <Icon name="plus" size={16}/> Add a third (optional)
        </button>
      </div>
    </FormScreen>
  );
}

// ─── 10. DOCUMENTS ────────────────────────────────────────────────────
function S_Docs({ go }) {
  const docs = [
    { t:'CSEC slip / certificate', s:'PDF or photo · max 10MB',  state:'uploaded', file:'csec-results-2025.pdf', size:'1.2 MB' },
    { t:'Birth certificate',       s:'PDF or photo',             state:'uploaded', file:'birth-cert.jpg',         size:'2.4 MB' },
    { t:'Photo ID (Passport/ID)',  s:'For interview verification', state:'uploaded', file:'national-id.jpg',     size:'870 KB' },
    { t:'Most recent transcript',  s:'From your current school', state:'pending' },
    { t:'Headshot photograph',     s:'Plain background',          state:'optional' },
  ];
  return (
    <FormScreen go={go} step={6} total={6} eyebrow="Section 6 · Documents" title="Upload your supporting files." prev="refs" next="review" nextLabel="Review my application">
      <div style={{ display:'grid', gap: 10, marginTop: 16 }}>
        {docs.map((d,i)=>(
          <div key={i} className="card" style={{ padding: 14 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap: 12 }}>
              <div style={{
                width: 38, height: 46, borderRadius: 6,
                background: d.state==='uploaded' ? 'var(--maroon-soft)' : '#f1ead9',
                color:      d.state==='uploaded' ? 'var(--maroon)' : 'var(--ink-3)',
                display:'flex', alignItems:'center', justifyContent:'center',
                position:'relative',
              }}>
                <Icon name="doc" size={20}/>
                {d.state==='uploaded' && <span style={{ position:'absolute', bottom:-4, right:-4, width:18, height:18, borderRadius:99, background:'var(--green)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="check" size={11} strokeWidth={2.6}/></span>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ font:'600 14px/1.2 Inter' }}>{d.t}{d.state==='optional' ? <span style={{ font:'500 11px Inter', color:'var(--ink-3)', marginLeft:6 }}>· optional</span> : null}</div>
                <div style={{ font:'400 12px/1.3 Inter', color:'var(--ink-3)', marginTop: 3 }}>{d.s}</div>
                {d.state === 'uploaded' ? (
                  <div style={{ marginTop: 10, padding:'8px 10px', borderRadius: 8, background:'var(--cream-2)', display:'flex', alignItems:'center', gap: 8 }}>
                    <Icon name="paperclip" size={13} color="var(--ink-2)"/>
                    <span style={{ font:'500 12px/1 Inter', color:'var(--ink)', flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.file}</span>
                    <span style={{ font:'500 11px Inter', color:'var(--ink-3)' }}>{d.size}</span>
                    <Icon name="x" size={14} color="var(--ink-3)"/>
                  </div>
                ) : (
                  <button style={{ marginTop: 8, padding:'8px 12px', border:'1px dashed var(--line-2)', background:'transparent', borderRadius: 8, font:'600 12px Inter', color:'var(--maroon)', cursor:'pointer', display:'inline-flex', alignItems:'center', gap: 6 }}>
                    <Icon name="upload" size={13}/> Choose file
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </FormScreen>
  );
}

// ─── 11. REVIEW & SUBMIT ─────────────────────────────────────────────
function S_Review({ go }) {
  const Row = ({ icon, label, value, edit }) => (
    <div style={{ padding:'12px 0', display:'flex', gap: 12, alignItems:'flex-start', borderBottom:'1px solid var(--line)' }}>
      <Icon name={icon} size={16} color="var(--ink-3)"/>
      <div style={{ flex:1 }}>
        <div style={{ font:'500 11px/1 Inter', color:'var(--ink-3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 5 }}>{label}</div>
        <div style={{ font:'500 13px/1.4 Inter', color:'var(--ink)' }}>{value}</div>
      </div>
      <button onClick={()=>go(edit)} style={{ background:'none', border:'none', font:'600 12px Inter', color:'var(--maroon)', cursor:'pointer' }}>Edit</button>
    </div>
  );
  return (
    <PhoneShell>
      <ScreenHeader title="Review" onBack={()=>go('docs')}/>
      <div style={{ padding:'8px 22px 24px' }}>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, margin: '4px 0 6px', letterSpacing:'-0.01em' }}>One last look.</h1>
        <p style={{ font:'400 13px/1.5 Inter', color:'var(--ink-2)', margin: '0 0 18px' }}>You'll be able to make changes up until the deadline if needed.</p>

        <div className="card" style={{ padding:'4px 16px 4px' }}>
          <Row icon="user"     label="Personal" value="Tanika Brown · 14 Mar 2008 · Brown's Town" edit="personal"/>
          <Row icon="book"     label="Academic" value="York Castle High · Grade 11 · 2022–present" edit="academic"/>
          <Row icon="doc"      label="CSEC"     value="8 subjects · 7 passes · I,I,I,II,II,I,II,III" edit="cxc"/>
          <Row icon="beaker"   label="CAPE"     value="Natural Sciences · Bio · Chem · Pure Maths" edit="subjects"/>
          <Row icon="star"     label="Refs"     value="Mr. Campbell ✓ · Mrs. Hibbert (awaiting)" edit="refs"/>
          <Row icon="upload"   label="Docs"     value="3 of 4 uploaded · transcript pending" edit="docs"/>
        </div>

        {/* Eligibility check — mirrors the admin dataset's pass/fail logic */}
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width:22, height:22, borderRadius:6, background:'var(--green)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="check" size={13} strokeWidth={2.6}/>
            </span>
            <div className="serif" style={{ font:'600 15px Inter', color:'var(--ink)' }}>You qualify for Natural Sciences</div>
          </div>
          {[
            { ok:true, t:'General education met', d:'≥ 5 CSEC passes incl. English & Maths · you have 7' },
            { ok:true, t:'Core science subjects', d:'Biology, Chemistry, Maths — all Grade I or II' },
            { ok:true, t:'No subject duplicates', d:'CAPE units do not duplicate already-passed CSEC level' },
            { ok:'wait', t:'Awaiting one reference', d:'Mrs. Hibbert\'s response · sent 22 Apr' },
          ].map((c,i)=>(
            <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 0', borderTop: i===0 ? '1px solid var(--line)' : 'none' }}>
              <span style={{
                width:18, height:18, borderRadius:99, marginTop:1,
                background: c.ok===true ? 'var(--green-soft)' : 'var(--amber-soft)',
                color:      c.ok===true ? 'var(--green)'      : 'var(--amber)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
              }}>
                {c.ok===true ? <Icon name="check" size={11} strokeWidth={2.6}/> : <Icon name="clock" size={11} strokeWidth={2.4}/>}
              </span>
              <div>
                <div style={{ font:'600 13px/1.3 Inter', color:'var(--ink)' }}>{c.t}</div>
                <div style={{ font:'400 12px/1.4 Inter', color:'var(--ink-3)', marginTop: 2 }}>{c.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 16, padding: 14, background: 'var(--gold-soft)', borderColor: '#ecd98e', display:'flex', alignItems:'flex-start', gap: 10 }}>
          <Icon name="clock" size={18} color="#7a5a05"/>
          <div style={{ font:'500 12px/1.5 Inter', color:'#574000' }}>
            One outstanding item: <b>school transcript</b>. You can submit now and add it before the deadline — most applicants do.
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <label style={{ display:'flex', gap:10, alignItems:'flex-start', font:'500 13px/1.45 Inter', color:'var(--ink-2)', marginBottom: 10 }}>
            <input type="checkbox" defaultChecked style={{ marginTop: 3, accentColor: 'var(--maroon)' }}/>
            <span>I declare that the information in this application is true and accurate.</span>
          </label>
          <label style={{ display:'flex', gap:10, alignItems:'flex-start', font:'500 13px/1.45 Inter', color:'var(--ink-2)' }}>
            <input type="checkbox" defaultChecked style={{ marginTop: 3, accentColor: 'var(--maroon)' }}/>
            <span>I authorize York Castle High School to contact my referees and previous schools.</span>
          </label>
        </div>

        <button className="btn btn-primary btn-block" style={{ marginTop: 22, padding: '18px' }} onClick={()=>go('status')}>
          Submit application
        </button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={()=>go('overview')}>
          Save & return later
        </button>
      </div>
    </PhoneShell>
  );
}

// ─── 12. STATUS / DASHBOARD (post-submit, rich) ────────────────────────
function S_Status({ go }) {
  const stages = [
    { t:'Submitted',     d:'28 Apr 2026 · 14:32',   state:'done' },
    { t:'Under review',  d:'Admin team reviewing', state:'active' },
    { t:'Interview',     d:'Scheduled 4 July',     state:'upcoming' },
    { t:'Decision',      d:'By 19 July',           state:'upcoming' },
  ];
  return (
    <PhoneShell>
      <div style={{ padding:'50px 20px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <img src={YC_LOGO} style={{ width:30, height:30, objectFit:'contain' }}/>
            <div style={{ font:'600 11px/1 Inter', color:'var(--ink-2)', letterSpacing:'0.12em' }}>YCHS · SIXTH FORM</div>
          </div>
          <Icon name="bell" size={20} color="var(--ink-2)"/>
        </div>
      </div>

      <div style={{ padding: '18px 20px 0' }}>
        <Pill tone="green" size="sm"><span style={{ width:6, height:6, borderRadius:99, background:'var(--green)' }} className="pulse"/> APPLICATION RECEIVED</Pill>
        <h1 className="serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.05, margin: '12px 0 8px', letterSpacing:'-0.01em' }}>
          Beautifully done, Tanika.<br/>
          <em style={{ color: 'var(--maroon)', fontStyle:'italic' }}>We'll take it from here.</em>
        </h1>
        <p style={{ font:'400 13px/1.5 Inter', color:'var(--ink-2)', margin: 0 }}>
          Reference: <span className="mono" style={{ color:'var(--ink)', fontWeight: 600 }}>YC-26-1184</span>
        </p>
      </div>

      {/* Timeline card */}
      <div style={{ padding: '20px' }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="serif" style={{ font:'600 15px Inter', marginBottom: 16 }}>Where you stand</div>
          <div style={{ position:'relative' }}>
            {stages.map((s,i)=>{
              const isLast = i === stages.length-1;
              const dotBg = s.state==='done' ? 'var(--maroon)' : (s.state==='active' ? 'var(--gold)' : '#f1ead9');
              const dotFg = s.state==='done' ? '#fff' : (s.state==='active' ? 'var(--ink)' : 'var(--ink-3)');
              return (
                <div key={i} style={{ display:'flex', gap: 14, position:'relative', paddingBottom: isLast ? 0 : 16 }}>
                  <div style={{ width: 28, display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 99, background: dotBg, color: dotFg,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      border: s.state==='active' ? '2px solid var(--gold)' : 'none',
                      boxShadow: s.state==='active' ? '0 0 0 4px rgba(201,162,39,0.18)' : 'none',
                    }}>
                      {s.state==='done' ? <Icon name="check" size={13} strokeWidth={2.6}/> : (s.state==='active' ? <span style={{ width:7, height:7, borderRadius:99, background:'var(--ink)' }} className="pulse"/> : <span style={{ width:5, height:5, borderRadius:99, background:'var(--ink-3)' }}/>)}
                    </div>
                    {!isLast && <div style={{ width: 2, flex: 1, background: stages[i+1].state==='upcoming' ? 'var(--line)' : 'var(--maroon)', marginTop: 4 }}/>}
                  </div>
                  <div style={{ flex:1, paddingTop: 2 }}>
                    <div style={{ font:'600 14px/1.2 Inter', color: s.state==='upcoming' ? 'var(--ink-3)' : 'var(--ink)' }}>{s.t}</div>
                    <div style={{ font:'400 12px/1.3 Inter', color:'var(--ink-3)', marginTop: 3 }}>{s.d}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next action card */}
        <div className="card" style={{ marginTop: 14, padding: 18, background:'var(--maroon)', color:'#fff', borderColor:'var(--maroon)' }}>
          <Pill tone="gold" size="sm">NEXT UP</Pill>
          <div className="serif" style={{ font:'600 22px/1.2 Inter', marginTop: 10, letterSpacing:'-0.01em' }}>Schedule your interview.</div>
          <div style={{ font:'400 13px/1.5 Inter', opacity:0.85, marginTop: 6 }}>Slots open Tuesday. Pick a 20-minute window with the admissions panel.</div>
          <button className="btn btn-gold btn-block" style={{ marginTop: 14 }} onClick={()=>go('schedule')}>
            Pick a time <Icon name="arrow-right" size={16}/>
          </button>
        </div>

        {/* Checklist of small things */}
        <div style={{ marginTop: 22 }}>
          <SectionTitle eyebrow="Checklist" title="A few small things"/>
          <div style={{ display:'grid', gap: 8 }}>
            {[
              { t:'Upload school transcript',  d:'Optional now, required by 1 Jul', tone:'amber', icon:'upload' },
              { t:'Confirm parent/guardian email', d:'We sent a verify link to Marcia', tone:'amber', icon:'mail' },
              { t:'Mrs. Hibbert reference',     d:'Awaiting · gentle nudge sent 22 Apr', tone:'amber', icon:'star' },
              { t:'Read the sixth-form charter', d:'PDF · 4 pages',                tone:'neutral', icon:'doc' },
            ].map((r,i)=>(
              <div key={i} className="card" style={{ padding: 12, display:'flex', alignItems:'center', gap: 12 }}>
                <div style={{ width:32, height:32, borderRadius:8, background: r.tone==='amber' ? 'var(--amber-soft)' : '#f1ead9', color: r.tone==='amber' ? 'var(--amber)' : 'var(--ink-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon name={r.icon} size={16}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ font:'600 13px/1.2 Inter' }}>{r.t}</div>
                  <div style={{ font:'400 11px/1.3 Inter', color:'var(--ink-3)', marginTop: 3 }}>{r.d}</div>
                </div>
                <Icon name="arrow-right" size={14} color="var(--ink-3)"/>
              </div>
            ))}
          </div>
        </div>

        {/* Application summary card */}
        <div className="card" style={{ marginTop: 20, padding: 16, marginBottom: 96 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
            <div className="serif" style={{ font:'600 15px Inter' }}>Your submission</div>
            <button onClick={()=>go('offer')} style={{ background:'none', border:'none', font:'600 12px Inter', color:'var(--maroon)', cursor:'pointer' }}>Preview offer ↗</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 8 }}>
            {[
              { l:'CSEC',     v:'8 subj' },
              { l:'CAPE',     v:'3 picked' },
              { l:'Refs',     v:'1 of 2' },
            ].map((m,i)=>(
              <div key={i} style={{ padding: 10, borderRadius: 10, background:'var(--cream-2)' }}>
                <div style={{ font:'500 10px Inter', color:'var(--ink-3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom: 4 }}>{m.l}</div>
                <div className="serif" style={{ font:'600 18px Fraunces' }}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <TabBar active="home"/>
    </PhoneShell>
  );
}

// ─── 13. INTERVIEW SCHEDULING ─────────────────────────────────────────
function S_Schedule({ go }) {
  const [picked, setPicked] = React.useState('1100');
  const days = [
    { d:'Mon', n:'1', mo:'Jul', avail: 4 },
    { d:'Tue', n:'2', mo:'Jul', avail: 6 },
    { d:'Wed', n:'3', mo:'Jul', avail: 0, full: true },
    { d:'Thu', n:'4', mo:'Jul', avail: 5, selected: true },
    { d:'Fri', n:'5', mo:'Jul', avail: 3 },
  ];
  const slots = ['09:00','09:40','10:20','11:00','11:40','13:30','14:10','14:50','15:30'];
  const [day, setDay] = React.useState('4');
  const taken = ['09:00','13:30','14:50'];
  return (
    <PhoneShell>
      <ScreenHeader title="Interview" onBack={()=>go('status')}/>
      <div style={{ padding:'8px 22px 24px' }}>
        <Pill tone="gold" size="sm">YOUR PANEL</Pill>
        <h1 className="serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, margin: '12px 0 6px', letterSpacing:'-0.01em' }}>
          Pick a 20-minute window.
        </h1>
        <p style={{ font:'400 13px/1.5 Inter', color:'var(--ink-2)', margin: '0 0 16px' }}>
          You'll meet with the Vice-Principal and Sixth Form coordinator. Held over Google Meet — no need to come on campus.
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 6, marginBottom: 20 }}>
          {days.map(dy=>{
            const sel = dy.n === day;
            return (
              <button key={dy.n} disabled={dy.full} onClick={()=>setDay(dy.n)} style={{
                padding:'10px 4px', borderRadius: 10, border: 'none', cursor: dy.full ? 'not-allowed' : 'pointer',
                background: sel ? 'var(--maroon)' : (dy.full ? 'var(--cream-2)' : 'var(--paper)'),
                color: sel ? '#fff' : (dy.full ? 'var(--ink-3)' : 'var(--ink)'),
                border: sel ? '1.5px solid var(--maroon)' : '1px solid var(--line)',
                opacity: dy.full ? 0.55 : 1,
              }}>
                <div style={{ font:'600 10px/1 Inter', opacity: 0.8, letterSpacing:'0.06em' }}>{dy.d.toUpperCase()}</div>
                <div className="serif" style={{ font:'600 22px/1 Fraunces', margin:'4px 0 2px' }}>{dy.n}</div>
                <div style={{ font:'500 9px/1 Inter', opacity: 0.65 }}>{dy.full ? 'Full' : dy.avail+' free'}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
          <div className="serif" style={{ font:'600 15px Inter' }}>Thursday, 4 July</div>
          <Pill tone="neutral" size="sm">EST · UTC-5</Pill>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 8 }}>
          {slots.map(t=>{
            const isTaken = taken.includes(t);
            const sel = t.replace(':','') === picked;
            return (
              <button key={t} disabled={isTaken} onClick={()=>setPicked(t.replace(':',''))} style={{
                padding:'12px 0', borderRadius: 10, cursor: isTaken ? 'not-allowed' : 'pointer',
                background: sel ? 'var(--maroon)' : (isTaken ? 'var(--cream-2)' : 'var(--paper)'),
                color: sel ? '#fff' : (isTaken ? 'var(--ink-3)' : 'var(--ink)'),
                border: sel ? '1.5px solid var(--maroon)' : '1px solid var(--line)',
                opacity: isTaken ? 0.5 : 1,
                font:'600 14px/1 Inter',
                textDecoration: isTaken ? 'line-through' : 'none',
              }}>{t}</button>
            );
          })}
        </div>

        <div className="card" style={{ marginTop: 18, padding: 14, background:'var(--maroon-soft)', borderColor:'#e6c8cd' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap: 10 }}>
            <Icon name="calendar" size={18} color="var(--maroon)"/>
            <div>
              <div style={{ font:'600 13px/1.2 Inter', color:'var(--maroon)' }}>Thu 4 Jul · 11:00 – 11:20 AM</div>
              <div style={{ font:'400 12px/1.4 Inter', color:'var(--ink-2)', marginTop: 4 }}>You'll get a Google Meet link by email. We recommend a quiet room and headphones.</div>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-block" style={{ marginTop: 22 }} onClick={()=>go('status')}>
          Confirm interview slot
        </button>
      </div>
    </PhoneShell>
  );
}

// ─── 14. OFFER LETTER ────────────────────────────────────────────────
function S_Offer({ go }) {
  return (
    <PhoneShell>
      <div style={{ background: 'var(--maroon)', padding:'50px 22px 56px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset: 0, opacity: 0.16,
          backgroundImage:'radial-gradient(circle at 20% 0%, var(--gold) 0, transparent 45%), radial-gradient(circle at 100% 100%, var(--gold) 0, transparent 55%)' }}/>
        <ScreenHeader title="" onBack={()=>go('status')} dark/>
        <div style={{ position:'relative', textAlign:'center', color:'#fff', padding:'20px 0 0' }}>
          <img src={YC_LOGO} style={{ width: 64, height: 64, objectFit:'contain', marginBottom: 14 }}/>
          <Pill tone="gold" size="sm">DECISION · 19 JULY 2026</Pill>
          <div className="serif" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.0, marginTop: 18, letterSpacing:'-0.02em' }}>
            <em style={{ color:'var(--gold)', fontStyle:'italic' }}>Welcome,</em><br/>
            Tanika.
          </div>
          <div style={{ font:'400 14px/1.5 Inter', opacity: 0.85, marginTop: 14, padding:'0 18px' }}>
            We are <b style={{ color: 'var(--gold)' }}>delighted</b> to offer you a place in the York Castle Sixth Form, Class of 2028.
          </div>
        </div>
      </div>

      <div style={{ padding:'24px 22px 24px' }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ font:'500 11px Inter', color:'var(--ink-3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom: 6 }}>Programme</div>
          <div className="serif" style={{ font:'600 18px Inter' }}>CAPE · Sciences pathway</div>
          <div style={{ marginTop: 14, display:'grid', gap: 8 }}>
            {[
              { l:'Biology',           u:'Units 1 + 2', col:'var(--green)' },
              { l:'Chemistry',         u:'Units 1 + 2', col:'var(--green)' },
              { l:'Pure Mathematics',  u:'Units 1 + 2', col:'#7a5a05' },
              { l:'Caribbean Studies', u:'Core',        col:'var(--blue)' },
              { l:'Communication Studies', u:'Core',    col:'var(--blue)' },
            ].map((s,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding:'8px 0', borderBottom: i<4 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ width: 6, height: 24, borderRadius: 3, background: s.col }}/>
                <span style={{ font:'600 14px/1 Inter', flex: 1 }}>{s.l}</span>
                <span style={{ font:'500 12px Inter', color:'var(--ink-3)' }}>{s.u}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 14, padding: 16, background:'var(--gold-soft)', borderColor:'#ecd98e' }}>
          <div style={{ font:'500 11px Inter', color:'#7a5a05', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom: 6 }}>Conditions</div>
          <ul style={{ margin: 0, paddingLeft: 18, font:'500 13px/1.6 Inter', color:'#574000' }}>
            <li>Confirm acceptance by <b>2 August 2026</b></li>
            <li>Submit final CSEC results in person</li>
            <li>Attend orientation week 25–29 August</li>
          </ul>
        </div>

        <button className="btn btn-primary btn-block" style={{ marginTop: 22, padding: 18 }}>
          <Icon name="check" size={16}/> Accept my place
        </button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }}>
          <Icon name="upload" size={14}/> Download offer letter (PDF)
        </button>

        <div style={{ marginTop: 24, textAlign:'center', font:'400 11px/1.5 Inter', color:'var(--ink-3)' }}>
          Signed by Mr. Devon Campbell · Principal<br/>York Castle High School · Brown's Town · St. Ann
        </div>
      </div>
    </PhoneShell>
  );
}

window.S_Landing = S_Landing;
window.S_SignUp = S_SignUp;
window.S_Login = S_Login;
window.S_Overview = S_Overview;
window.S_Personal = S_Personal;
window.S_Academic = S_Academic;
window.S_CXC = S_CXC;
window.S_Subjects = S_Subjects;
window.S_Refs = S_Refs;
window.S_Docs = S_Docs;
window.S_Review = S_Review;
window.S_Status = S_Status;
window.S_Schedule = S_Schedule;
window.S_Offer = S_Offer;
