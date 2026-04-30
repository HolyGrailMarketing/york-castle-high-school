// app.jsx — wires canvas + state + tweaks
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "maroon",
  "showAdmin": true
}/*EDITMODE-END*/;

const ACCENTS = {
  maroon:  { primary:'#7a1f2b', deep:'#5d1620', soft:'#f6ecec', gold:'#c9a227' },
  navy:    { primary:'#1f3a6e', deep:'#15275a', soft:'#e7ecf5', gold:'#c9a227' },
  forest:  { primary:'#1f5d3b', deep:'#163f29', soft:'#e6f0ea', gold:'#c9a227' },
  ink:     { primary:'#1a1410', deep:'#000',    soft:'#ece8e0', gold:'#c9a227' },
};

function applyAccent(key) {
  const a = ACCENTS[key] || ACCENTS.maroon;
  const r = document.documentElement.style;
  r.setProperty('--maroon', a.primary);
  r.setProperty('--maroon-deep', a.deep);
  r.setProperty('--maroon-soft', a.soft);
  r.setProperty('--gold', a.gold);
}

// Per-flow state — one for student, one for admin (3 admin views)
function StudentFlow({ initial = 'landing' }) {
  const [screen, setScreen] = useState(initial);
  const Map = {
    landing:  S_Landing,
    signup:   S_SignUp,
    login:    S_Login,
    overview: S_Overview,
    personal: S_Personal,
    academic: S_Academic,
    cxc:      S_CXC,
    subjects: S_Subjects,
    refs:     S_Refs,
    docs:     S_Docs,
    review:   S_Review,
    status:   S_Status,
    schedule: S_Schedule,
    offer:    S_Offer,
    dashboard: S_Status,
  };
  const Cur = Map[screen] || S_Landing;
  return <Cur go={setScreen}/>;
}

function App() {
  const [tweak, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useEffect(() => { applyAccent(tweak.accent); }, [tweak.accent]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="student" title="Student application portal" subtitle="Mobile-first · 14 screens · maroon + gold modernized · click any phone to focus">
          <DCArtboard id="s1" label="01 · Landing"        width={390} height={844}><StudentFlow initial="landing"/></DCArtboard>
          <DCArtboard id="s2" label="02 · Sign up"        width={390} height={844}><StudentFlow initial="signup"/></DCArtboard>
          <DCArtboard id="s3" label="03 · Sign in"        width={390} height={844}><StudentFlow initial="login"/></DCArtboard>
          <DCArtboard id="s4" label="04 · App checklist"  width={390} height={844}><StudentFlow initial="overview"/></DCArtboard>
          <DCArtboard id="s5" label="05 · Personal"       width={390} height={844}><StudentFlow initial="personal"/></DCArtboard>
          <DCArtboard id="s6" label="06 · Academic"       width={390} height={844}><StudentFlow initial="academic"/></DCArtboard>
          <DCArtboard id="s7" label="07 · CSEC results"   width={390} height={844}><StudentFlow initial="cxc"/></DCArtboard>
          <DCArtboard id="s8" label="08 · CAPE subjects"  width={390} height={844}><StudentFlow initial="subjects"/></DCArtboard>
          <DCArtboard id="s9" label="09 · References"     width={390} height={844}><StudentFlow initial="refs"/></DCArtboard>
          <DCArtboard id="s10" label="10 · Documents"     width={390} height={844}><StudentFlow initial="docs"/></DCArtboard>
          <DCArtboard id="s11" label="11 · Review"        width={390} height={844}><StudentFlow initial="review"/></DCArtboard>
          <DCArtboard id="s12" label="12 · Status (rich)" width={390} height={844}><StudentFlow initial="status"/></DCArtboard>
          <DCArtboard id="s13" label="13 · Schedule interview" width={390} height={844}><StudentFlow initial="schedule"/></DCArtboard>
          <DCArtboard id="s14" label="14 · Offer letter"  width={390} height={844}><StudentFlow initial="offer"/></DCArtboard>
        </DCSection>

        {tweak.showAdmin && (
          <DCSection id="admin" title="Admin review dashboard" subtitle="Desktop · for the admissions team · queue, detail, decision">
            <DCArtboard id="a1" label="A1 · Application queue" width={1180} height={720}><A_Queue/></DCArtboard>
            <DCArtboard id="a2" label="A2 · Application detail" width={1180} height={720}><A_Detail/></DCArtboard>
            <DCArtboard id="a3" label="A3 · Decision composer" width={1180} height={720}><A_Decision/></DCArtboard>
          </DCSection>
        )}
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Brand accent">
          <TweakRadio
            label="Primary color"
            value={tweak.accent}
            onChange={(v) => setTweak('accent', v)}
            options={[
              { value:'maroon', label:'Maroon' },
              { value:'navy',   label:'Navy' },
              { value:'forest', label:'Forest' },
              { value:'ink',    label:'Ink' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Canvas">
          <TweakToggle
            label="Show admin section"
            value={tweak.showAdmin}
            onChange={(v) => setTweak('showAdmin', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
