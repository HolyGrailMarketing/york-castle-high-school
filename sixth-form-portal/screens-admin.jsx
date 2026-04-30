// screens-admin.jsx — Admin review screens (desktop / laptop frame)
// Three views: Queue, Application detail, Decision panel.

function LaptopFrame({ children, w = 1180, h = 720 }) {
  return (
    <div style={{ width: w, height: h, background:'#1a1410', borderRadius: 14, padding: 10, boxShadow:'0 30px 80px rgba(0,0,0,0.18)' }}>
      <div style={{ width:'100%', height:'100%', borderRadius: 8, overflow:'hidden', background:'#fafafa', position:'relative' }}>
        {/* Browser-ish chrome */}
        <div style={{ height: 36, background:'var(--cream-2)', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', padding:'0 14px', gap: 10 }}>
          <span style={{ width: 11, height: 11, borderRadius: 99, background:'#e06b6b' }}/>
          <span style={{ width: 11, height: 11, borderRadius: 99, background:'#e0b96b' }}/>
          <span style={{ width: 11, height: 11, borderRadius: 99, background:'#7fb96b' }}/>
          <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
            <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 8, padding:'4px 14px', font:'500 11px/1 Inter', color:'var(--ink-3)', display:'flex', alignItems:'center', gap: 6 }}>
              <Icon name="lock" size={11} color="var(--ink-3)"/> admin.yorkcastle.edu.jm/sixth-form
            </div>
          </div>
        </div>
        <div style={{ height: 'calc(100% - 36px)', display:'flex' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AdminSidebar({ active = 'apps' }) {
  const items = [
    { id:'home',   t:'Overview',     icon:'home',     count: null },
    { id:'apps',   t:'Applications', icon:'doc',      count: 662 },
    { id:'inter',  t:'Interviews',   icon:'calendar', count: 176 },
    { id:'subj',   t:'Programmes',   icon:'beaker',   count: null },
    { id:'team',   t:'Reviewers',    icon:'user',     count: null },
    { id:'msg',    t:'Messages',     icon:'chat',     count: 3 },
  ];
  return (
    <div style={{ width: 220, background:'var(--ink)', color:'#fbf4d8', height:'100%', display:'flex', flexDirection:'column', padding:'18px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 10, padding:'4px 8px 18px' }}>
        <img src={YC_LOGO} style={{ width: 28, height: 28, objectFit:'contain' }}/>
        <div>
          <div style={{ font:'700 11px/1 Inter', letterSpacing:'0.14em' }}>YCHS</div>
          <div style={{ font:'500 10px/1 Inter', opacity: 0.55, marginTop: 4 }}>Admin · 6th Form</div>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 2, flex: 1 }}>
        {items.map(it=>(
          <button key={it.id} style={{
            display:'flex', alignItems:'center', gap: 10, padding:'9px 10px', borderRadius: 8,
            background: it.id === active ? 'rgba(201,162,39,0.12)' : 'transparent',
            color: it.id === active ? 'var(--gold)' : '#fbf4d8',
            border:'none', cursor:'pointer',
            font:'500 13px/1 Inter',
          }}>
            <Icon name={it.icon} size={16}/>
            <span style={{ flex: 1, textAlign:'left' }}>{it.t}</span>
            {it.count !== null && <span style={{ font:'600 10px Inter', opacity: 0.55 }}>{it.count}</span>}
          </button>
        ))}
      </div>
      <div style={{ padding:'10px 8px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 99, background:'var(--maroon)', display:'flex', alignItems:'center', justifyContent:'center', font:'700 12px Inter', color:'#fff' }}>QC</div>
        <div style={{ flex: 1 }}>
          <div style={{ font:'600 12px/1 Inter' }}>Q. Cummings</div>
          <div style={{ font:'400 10px/1 Inter', opacity: 0.5, marginTop: 3 }}>Sciences Coord.</div>
        </div>
      </div>
    </div>
  );
}

// Queue
function A_Queue() {
  // Real applicants pulled from the cleaned dataset (names anonymized only where flagged)
  const apps = [
    { ref:'YC-26-1184', name:'Tanika Brown',         pathway:'Natural Sciences',   avg:'1.6', state:'NEW',          color:'green',  date:'28 Apr', flag:false, ref_count:'1/2', reviewer:null },
    { ref:'YC-26-1183', name:'Andre McKenzie',       pathway:'Entrepreneurship',   avg:'1.9', state:'IN REVIEW',    color:'amber',  date:'28 Apr', flag:false, ref_count:'2/2', reviewer:'Quasheba C.' },
    { ref:'YC-26-1182', name:'Tasha Walker',         pathway:'Natural Sciences',   avg:'1.4', state:'INTERVIEW',    color:'maroon', date:'27 Apr', flag:true,  ref_count:'2/2', reviewer:'Akimeo T.' },
    { ref:'YC-26-1181', name:'Marcus Reid',          pathway:'Law',                avg:'2.3', state:'IN REVIEW',    color:'amber',  date:'27 Apr', flag:false, ref_count:'1/2', reviewer:'Danniel F.' },
    { ref:'YC-26-1180', name:'Shanique Powell',      pathway:'Natural Sciences',   avg:'1.7', state:'ENROLLED',     color:'green',  date:'26 Apr', flag:false, ref_count:'2/2', reviewer:'Quasheba C.' },
    { ref:'YC-26-1179', name:'Joel Henry',           pathway:'ICT',                avg:'2.1', state:'IN REVIEW',    color:'amber',  date:'26 Apr', flag:false, ref_count:'2/2', reviewer:'adenique b.' },
    { ref:'YC-26-1178', name:'Cherise Bent',         pathway:'Tourism',            avg:'1.8', state:'NEW',          color:'green',  date:'26 Apr', flag:false, ref_count:'0/2', reviewer:null },
    { ref:'YC-26-1177', name:'Daniel Foster',        pathway:'Industrial Tech.',   avg:'2.6', state:'DOCS PENDING', color:'rose',   date:'25 Apr', flag:true,  ref_count:'2/2', reviewer:'Akimeo T.' },
    { ref:'YC-26-1176', name:'Aliya Stewart',        pathway:'Entrepreneurship',   avg:'1.5', state:'ENROLLED',     color:'green',  date:'25 Apr', flag:false, ref_count:'2/2', reviewer:'Danniel F.' },
  ];
  // Top-line numbers from the actual cleaned dataset (n=662, last cycle)
  const stats = [
    { l:'Total submissions', v:'662', d:'+12 this week' },
    { l:'Awaiting review',   v:'323', d:'48 over 5 days', warn:true },
    { l:'Offers issued',     v:'149', d:'113 to programme of choice' },
    { l:'Enrolled',          v:'144', d:'108 packages picked up' },
  ];
  return (
    <LaptopFrame>
      <AdminSidebar active="apps"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#fafaf6' }}>
        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', borderBottom:'1px solid var(--line)' }}>
          <div>
            <div style={{ font:'500 11px Inter', color:'var(--ink-3)', letterSpacing:'0.1em' }}>SIXTH FORM · 2026 INTAKE</div>
            <div className="serif" style={{ font:'600 22px Inter', marginTop: 2, letterSpacing:'-0.01em' }}>Applications</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <div style={{ display:'flex', alignItems:'center', gap: 8, padding:'8px 12px', background:'#fff', border:'1px solid var(--line)', borderRadius: 10 }}>
              <Icon name="search" size={15} color="var(--ink-3)"/>
              <input placeholder="Search by name, ref…" style={{ border:'none', outline:'none', background:'transparent', font:'500 13px Inter', width: 180 }}/>
            </div>
            <button className="btn btn-primary" style={{ padding:'10px 16px', fontSize:13 }}><Icon name="upload" size={14}/> Export</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12, padding: 24, borderBottom:'1px solid var(--line)' }}>
          {stats.map((s,i)=>(
            <div key={i} style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <div style={{ font:'500 11px Inter', color:'var(--ink-3)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{s.l}</div>
              <div className="serif" style={{ font:'600 32px/1 Fraunces', marginTop: 10, letterSpacing:'-0.02em' }}>{s.v}</div>
              <div style={{ font:'500 11px Inter', marginTop: 8, color: s.warn ? 'var(--amber)' : 'var(--ink-3)' }}>
                {s.warn ? '⚠ ' : ''}{s.d}
              </div>
            </div>
          ))}
        </div>

        {/* Filters — real CSV statuses */}
        <div style={{ padding: '14px 24px', display:'flex', alignItems:'center', gap: 8, borderBottom:'1px solid var(--line)' }}>
          {['All · 662','Application Received · 323','Interview Email Sent · 176','Enrolled · 144','Results Updated · 15','Disenrolled · 3'].map((t,i)=>(
            <button key={i} style={{
              padding:'7px 12px', borderRadius: 8,
              background: i===0 ? 'var(--ink)' : 'transparent',
              color: i===0 ? '#fff' : 'var(--ink-2)',
              border: i===0 ? 'none' : '1px solid var(--line-2)',
              font:'600 12px/1 Inter', cursor:'pointer',
            }}>{t}</button>
          ))}
          <div style={{ flex:1 }}/>
          <button style={{ padding:'7px 10px', borderRadius: 8, background:'transparent', border:'1px solid var(--line-2)', font:'600 12px Inter', cursor:'pointer', display:'flex', alignItems:'center', gap: 6 }}>
            <Icon name="filter" size={13}/> Programme · all
          </button>
        </div>

        {/* Table */}
        <div style={{ flex:1, overflow:'auto', padding:'0 24px 24px' }}>
          <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 12, marginTop: 14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr 1.1fr 0.6fr 0.7fr 1fr 1.1fr 0.4fr', gap: 12, padding:'12px 18px', borderBottom:'1px solid var(--line)', font:'600 10px Inter', color:'var(--ink-3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
              <span>Reference</span>
              <span>Applicant</span>
              <span>Programme</span>
              <span>Avg</span>
              <span>Refs</span>
              <span>Status</span>
              <span>Reviewer</span>
              <span></span>
            </div>
            {apps.map((a,i)=>(
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr 1.1fr 0.6fr 0.7fr 1fr 1.1fr 0.4fr', gap: 12, padding:'14px 18px', borderBottom: i<apps.length-1 ? '1px solid var(--line)' : 'none', alignItems:'center', cursor:'pointer', background: a.ref==='YC-26-1184' ? 'var(--gold-soft)' : 'transparent' }}>
                <span className="mono" style={{ font:'500 12px Inter', color:'var(--ink-2)' }}>{a.ref}</span>
                <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 99, background:'var(--maroon-soft)', color:'var(--maroon)', display:'flex', alignItems:'center', justifyContent:'center', font:'700 11px Inter' }}>
                    {a.name.split(' ').map(p=>p[0]).join('')}
                  </div>
                  <div>
                    <div style={{ font:'600 13px/1.2 Inter', display:'flex', alignItems:'center', gap: 6 }}>
                      {a.name} {a.flag ? <span style={{ color:'var(--rose)' }}>★</span> : null}
                    </div>
                    <div style={{ font:'400 11px/1 Inter', color:'var(--ink-3)', marginTop: 3 }}>Submitted {a.date}</div>
                  </div>
                </div>
                <span style={{ font:'500 12px Inter' }}>{a.pathway}</span>
                <span className="serif" style={{ font:'600 14px Fraunces' }}>{a.avg}</span>
                <span style={{ font:'500 12px Inter', color: a.ref_count==='2/2' ? 'var(--green)' : (a.ref_count==='0/2' ? 'var(--rose)' : 'var(--amber)') }}>{a.ref_count}</span>
                <span><Pill tone={a.color} size="sm">{a.state}</Pill></span>
                <span style={{ font:'500 12px Inter', color: a.reviewer ? 'var(--ink-2)' : 'var(--ink-3)', fontStyle: a.reviewer ? 'normal' : 'italic' }}>
                  {a.reviewer || 'Unassigned'}
                </span>
                <Icon name="arrow-right" size={14} color="var(--ink-3)"/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LaptopFrame>
  );
}

// Detail
function A_Detail() {
  return (
    <LaptopFrame>
      <AdminSidebar active="apps"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fafaf6', overflow:'hidden' }}>
        <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10, font:'500 12px Inter', color:'var(--ink-3)' }}>
            <span>Applications</span> <span>›</span> <span style={{ color:'var(--ink)', fontWeight: 600 }}>YC-26-1184 · Tanika Brown</span>
          </div>
          <div style={{ display:'flex', gap: 8 }}>
            <button style={{ padding:'8px 14px', borderRadius: 8, border:'1px solid var(--line-2)', background:'#fff', font:'600 12px Inter', cursor:'pointer' }}>Previous</button>
            <button style={{ padding:'8px 14px', borderRadius: 8, border:'1px solid var(--line-2)', background:'#fff', font:'600 12px Inter', cursor:'pointer' }}>Next ↓</button>
          </div>
        </div>

        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1.55fr 1fr', gap: 16, padding: 20, overflow:'auto' }}>
          {/* Left: applicant data */}
          <div>
            <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 14, padding: 22 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: 99, background:'var(--maroon)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', font:'700 24px Fraunces' }}>TB</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    <h2 className="serif" style={{ font:'600 24px Inter', margin: 0, letterSpacing:'-0.01em' }}>Tanika Brown</h2>
                    <Pill tone="green" size="sm"><Icon name="check" size={11}/> Eligible</Pill>
                    <Pill tone="maroon" size="sm">Natural Sciences</Pill>
                  </div>
                  <div style={{ font:'500 12px Inter', color:'var(--ink-3)', marginTop: 6 }}>
                    <span className="mono">YC-26-1184</span> · 18 yrs · St. Ann · Submitted 28 Apr 14:32
                  </div>
                  <div style={{ display:'flex', gap: 18, marginTop: 14 }}>
                    <div><div style={{ font:'500 10px Inter', color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>CSEC avg</div><div className="serif" style={{ font:'600 22px Fraunces', marginTop: 4 }}>1.6</div></div>
                    <div><div style={{ font:'500 10px Inter', color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Passes</div><div className="serif" style={{ font:'600 22px Fraunces', marginTop: 4 }}>7 of 8</div></div>
                    <div><div style={{ font:'500 10px Inter', color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>References</div><div className="serif" style={{ font:'600 22px Fraunces', marginTop: 4 }}>1 / 2</div></div>
                    <div><div style={{ font:'500 10px Inter', color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Documents</div><div className="serif" style={{ font:'600 22px Fraunces', marginTop: 4 }}>3 / 4</div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ marginTop: 14, display:'flex', gap: 4, borderBottom:'1px solid var(--line)' }}>
              {['Overview','CSEC results','CAPE choices','References','Documents','Personal'].map((t,i)=>(
                <button key={t} style={{
                  padding:'10px 14px', background:'transparent', border:'none', cursor:'pointer',
                  font:'600 12px Inter',
                  color: i===0 ? 'var(--ink)' : 'var(--ink-3)',
                  borderBottom: i===0 ? '2px solid var(--maroon)' : '2px solid transparent',
                  marginBottom: -1,
                }}>{t}</button>
              ))}
            </div>

            <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 14, padding: 20, marginTop: 14 }}>
              <div className="serif" style={{ font:'600 15px Inter', marginBottom: 12 }}>CSEC results · 8 subjects</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 8 }}>
                {[
                  ['English Lang.','I'],['Mathematics','I'],['Biology','I'],['Chemistry','II'],
                  ['Physics','II'],['Geography','I'],['Info Tech.','II'],['Spanish','III'],
                ].map(([s,g],i)=>(
                  <div key={i} style={{ padding: 10, background:'var(--cream)', borderRadius: 8, display:'flex', alignItems:'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background:'var(--maroon)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', font:'700 12px Fraunces' }}>{g}</div>
                    <div style={{ font:'500 12px/1.2 Inter' }}>{s}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 18, paddingTop: 18, borderTop:'1px solid var(--line)' }}>
                <div className="serif" style={{ font:'600 15px Inter', marginBottom: 10 }}>CAPE selection</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
                  {[['Biology','green'],['Chemistry','green'],['Pure Mathematics','gold'],['Caribbean Studies','blue'],['Communication Studies','blue']].map((x,i)=>(
                    <Pill key={i} tone={x[1]} size="md">{x[0]}</Pill>
                  ))}
                </div>
                <div style={{ marginTop: 14, padding: 14, background:'var(--green-soft)', borderRadius: 10, font:'500 12px/1.5 Inter', color:'var(--green)' }}>
                  ✓ Subject prerequisites met for all three CAPE units. Class capacity: <b>Biology 18/24</b> · <b>Chemistry 21/24</b> · <b>Pure Maths 14/22</b>.
                </div>
              </div>

              <div style={{ marginTop: 18, paddingTop: 18, borderTop:'1px solid var(--line)' }}>
                <div className="serif" style={{ font:'600 15px Inter', marginBottom: 10 }}>Personal statement</div>
                <p style={{ font:'400 13px/1.6 Inter', color:'var(--ink-2)', margin: 0, fontStyle:'italic' }}>
                  "I want to keep studying with the teachers who helped me discover that I love biology — and to stay in the house community that's been my second family. My goal is to study medicine at UWI Mona…"
                </p>
              </div>
            </div>
          </div>

          {/* Right: review actions */}
          <div>
            <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 14, padding: 18 }}>
              <div className="serif" style={{ font:'600 15px Inter', marginBottom: 12 }}>Review · 2 of 3 reviewers</div>
              <div style={{ display:'grid', gap: 10 }}>
                {[
                  { n:'Quasheba Cummings', r:'Sciences Coord.',     v:'Recommend offer',   c:'green' },
                  { n:'Akimeo Timoll',     r:'V-Principal',         v:'Recommend offer',   c:'green' },
                  { n:'You · D. Francis',  r:'6th Form Coord.',     v:'Pending',           c:'amber' },
                ].map((rv,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 99, background:'var(--cream-2)', color:'var(--ink-2)', display:'flex', alignItems:'center', justifyContent:'center', font:'700 11px Inter' }}>{rv.n.split(' ').slice(-2).map(p=>p[0]).join('').slice(0,2)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ font:'600 12px Inter' }}>{rv.n}</div>
                      <div style={{ font:'500 11px Inter', color:'var(--ink-3)', marginTop: 2 }}>{rv.r}</div>
                    </div>
                    <Pill tone={rv.c} size="sm">{rv.v}</Pill>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop:'1px solid var(--line)' }}>
                <label className="label">Your recommendation</label>
                <div style={{ display:'grid', gap: 6 }}>
                  {[
                    { v:'Offer',     c:'var(--green)',  bg:'var(--green-soft)' },
                    { v:'Interview', c:'var(--maroon)', bg:'var(--maroon-soft)' },
                    { v:'Waitlist',  c:'var(--amber)',  bg:'var(--amber-soft)' },
                    { v:'Decline',   c:'var(--rose)',   bg:'var(--rose-soft)' },
                  ].map((b,i)=>(
                    <button key={b.v} style={{
                      padding:'10px 12px', borderRadius: 9,
                      background: i===1 ? b.bg : '#fff',
                      border: '1.5px solid ' + (i===1 ? b.c : 'var(--line)'),
                      color: i===1 ? b.c : 'var(--ink)',
                      font:'600 12px Inter', textAlign:'left', cursor:'pointer',
                    }}>{b.v}{i===1 ? '  · selected' : ''}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label className="label">Notes for committee</label>
                <textarea className="field" rows="3" style={{ fontSize: 12, padding: 10 }}
                  defaultValue="Strong CSEC profile and clear pathway. Suggest panel interview to confirm fit for Sciences."/>
              </div>

              <button className="btn btn-primary btn-block" style={{ marginTop: 14, padding: '12px', fontSize: 13 }}>
                Submit recommendation
              </button>
            </div>

            <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 14, padding: 18, marginTop: 14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
                <div className="serif" style={{ font:'600 14px Inter' }}>Audit log</div>
                <span style={{ font:'500 10px Inter', color:'var(--ink-3)', letterSpacing:'0.06em' }}>5 ENTRIES</span>
              </div>
              <div style={{ display:'grid', gap: 0, font:'500 11px/1.4 Inter' }}>
                {[
                  { d:'2026-04-28T14:32:00Z', who:'system',           act:'Application submitted',                                tone:'ink' },
                  { d:'2026-04-28T14:35:11Z', who:'system',           act:'Auto-routed to Natural Sciences panel',                tone:'ink' },
                  { d:'2026-04-29T09:14:22Z', who:'Mr. Devon Campbell (referee)', act:'Reference submitted',                      tone:'green' },
                  { d:'2026-04-29T16:02:48Z', who:'Quasheba Cummings', act:'Recommended offer for programme of choice',           tone:'green' },
                  { d:'2026-04-30T10:21:03Z', who:'Akimeo Timoll',    act:'Recommended offer for programme of choice',            tone:'green' },
                ].map((e,i)=>{
                  const dt = new Date(e.d);
                  const date = dt.toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
                  const dot = e.tone==='green' ? 'var(--green)' : 'var(--ink-3)';
                  return (
                    <div key={i} style={{ display:'flex', gap: 10, padding:'9px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, paddingTop: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius:99, background: dot }}/>
                        {i < 4 ? <span style={{ width:1, flex:1, background:'var(--line)', marginTop: 4 }}/> : null}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ font:'500 11px Inter', color:'var(--ink-3)' }}>{date}</div>
                        <div style={{ font:'500 12px/1.4 Inter', color:'var(--ink)', marginTop: 2 }}>
                          <b style={{ fontWeight: 600 }}>{e.act}</b>
                        </div>
                        <div style={{ font:'500 11px Inter', color:'var(--ink-3)', marginTop: 1 }}>by {e.who}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LaptopFrame>
  );
}

// Decision composer (preview/send offer)
function A_Decision() {
  return (
    <LaptopFrame>
      <AdminSidebar active="apps"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fafaf6', overflow:'hidden' }}>
        <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap: 10, font:'500 12px Inter', color:'var(--ink-3)' }}>
          <span>Applications</span> <span>›</span>
          <span>YC-26-1184</span> <span>›</span>
          <span style={{ color:'var(--ink)', fontWeight: 600 }}>Decision</span>
        </div>

        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1.1fr', gap: 18, padding: 22, overflow:'auto' }}>
          {/* Composer */}
          <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 14, padding: 22 }}>
            <Pill tone="green" size="sm">FINAL DECISION</Pill>
            <h2 className="serif" style={{ font:'600 22px Inter', margin: '12px 0 4px', letterSpacing:'-0.01em' }}>Issue offer · Tanika Brown</h2>
            <div style={{ font:'500 12px Inter', color:'var(--ink-3)' }}>Committee: Quasheba Cummings ✓ · Akimeo Timoll ✓ · Danniel Francis ✓ · 3 of 3 recommend offer</div>

            <div style={{ marginTop: 22, display:'grid', gap: 12 }}>
              <div>
                <label className="label">Programme</label>
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                  {['Natural Sciences','Entrepreneurship','ICT','Industrial Tech.','Law','Tourism'].map((p,i)=>(
                    <button key={p} style={{
                      padding:'8px 12px', borderRadius: 8,
                      background: i===0 ? 'var(--maroon)' : '#fff',
                      color: i===0 ? '#fff' : 'var(--ink-2)',
                      border: i===0 ? 'none' : '1px solid var(--line-2)',
                      font:'600 12px Inter', cursor:'pointer',
                    }}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">CAPE units offered</label>
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                  {['Biology ✓','Chemistry ✓','Pure Maths ✓','Caribbean Studies (core)','Communication Studies (core)'].map((s)=>(
                    <span key={s} style={{ padding:'7px 11px', borderRadius: 8, background:'var(--green-soft)', color:'var(--green)', font:'600 11px Inter' }}>{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Conditions</label>
                <div style={{ display:'grid', gap: 6 }}>
                  {[
                    'Submit final CSEC results by 1 Aug',
                    'Confirm acceptance by 2 Aug',
                    'Attend orientation 25–29 Aug',
                  ].map((c,i)=>(
                    <label key={i} style={{ display:'flex', gap: 10, alignItems:'center', font:'500 13px Inter', padding:'8px 10px', background:'var(--cream)', borderRadius: 8 }}>
                      <input type="checkbox" defaultChecked style={{ accentColor:'var(--maroon)' }}/>
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Personal note from principal</label>
                <textarea className="field" rows="3" style={{ fontSize: 13 }}
                  defaultValue="Tanika — your application stood out for its clarity and warmth. We can't wait to see what you do in the next two years."/>
              </div>
            </div>

            <div style={{ display:'flex', gap: 10, marginTop: 22, paddingTop: 18, borderTop:'1px solid var(--line)' }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }}>Save draft</button>
              <button className="btn btn-primary" style={{ flex: 2, fontSize: 13 }}>
                <Icon name="check" size={14}/> Send offer to applicant
              </button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <div style={{ font:'500 11px Inter', color:'var(--ink-3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom: 10 }}>Preview · what Tanika will see</div>
            <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius: 14, overflow:'hidden' }}>
              <div style={{ background:'var(--maroon)', color:'#fff', padding:'24px 22px', textAlign:'center', position:'relative' }}>
                <div style={{ position:'absolute', inset: 0, opacity: 0.18, backgroundImage:'radial-gradient(circle at 20% 0%, var(--gold) 0, transparent 45%), radial-gradient(circle at 100% 100%, var(--gold) 0, transparent 55%)' }}/>
                <div style={{ position:'relative' }}>
                  <img src={YC_LOGO} style={{ width: 50, height: 50, objectFit:'contain', marginBottom: 8 }}/>
                  <Pill tone="gold" size="sm">DECISION · 19 JUL 2026</Pill>
                  <div className="serif" style={{ font:'600 28px/1.05 Fraunces', marginTop: 12, letterSpacing:'-0.02em' }}>
                    <em style={{ color:'var(--gold)', fontStyle:'italic' }}>Welcome,</em> Tanika.
                  </div>
                  <div style={{ font:'400 12px/1.5 Inter', opacity: 0.85, marginTop: 8, padding:'0 6px' }}>
                    We are <b style={{ color:'var(--gold)' }}>delighted</b> to offer you a place in the YCHS Sixth Form, Class of 2028.
                  </div>
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ font:'500 10px Inter', color:'var(--ink-3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Programme</div>
                <div className="serif" style={{ font:'600 16px Inter', marginTop: 4 }}>Associate of Science · Natural Sciences</div>
                <div style={{ marginTop: 10, display:'grid', gap: 6 }}>
                  {['Biology', 'Chemistry', 'Pure Mathematics', 'Caribbean Studies (core)', 'Communication Studies (core)'].map((s,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap: 8, font:'500 12px Inter' }}>
                      <Icon name="check" size={13} color="var(--green)"/> {s}
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary btn-block" style={{ marginTop: 16, padding: 12, fontSize: 13 }}>
                  Accept my place
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LaptopFrame>
  );
}

window.A_Queue = A_Queue;
window.A_Detail = A_Detail;
window.A_Decision = A_Decision;
