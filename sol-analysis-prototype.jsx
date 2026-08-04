import React, { useState, useEffect, useMemo, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  쏠 · 작품분석 시제품                                                */
/*  안 B(표준 구조화 폼) 5단계 위저드 + 강사 첨삭 화면                    */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');

.sol * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.sol {
  --blue: #3182F6; --blue-dark: #1B64DA; --blue-bg: #E8F3FF;
  --g900:#191F28; --g800:#333D4B; --g700:#4E5968; --g600:#6B7684;
  --g500:#8B95A1; --g400:#B0B8C1; --g300:#D1D6DB; --g200:#E5E8EB;
  --g100:#F2F4F6; --g50:#F9FAFB;
  --red:#F04452; --red-bg:#FFF0F0; --green:#00B25E; --yellow:#FFB700;
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif;
  color: var(--g900);
  letter-spacing: -0.3px;
  display:flex; justify-content:center; align-items:flex-start;
  background: #E9EBEE; min-height: 100vh; padding: 0 0 0;
}
.phone {
  width:100%; min-height:100vh; background:#fff;
  position:relative; display:flex; flex-direction:column; overflow:hidden;
}
@media (min-width:520px){
  .sol { padding: 20px 0 32px; }
  .phone { min-height: 840px; height:840px; border-radius:28px; box-shadow:0 18px 50px rgba(0,0,0,.16); }
}

/* header */
.hd { height:56px; display:flex; align-items:center; gap:4px; padding:0 8px 0 4px; flex:0 0 auto; background:#fff; z-index:5;}
.icobtn { width:44px; height:44px; border:0; background:none; display:flex; align-items:center; justify-content:center; cursor:pointer; border-radius:12px; color:var(--g800);}
.icobtn:active { background:var(--g100); }
.hd-t { font-size:16px; font-weight:600; color:var(--g800); }
.hd-r { margin-left:auto; padding-right:8px; font-size:14px; font-weight:600; color:var(--g500); display:flex; align-items:center; gap:6px;}
.prog { height:3px; background:var(--g200); flex:0 0 auto;}
.prog i { display:block; height:100%; background:var(--blue); border-radius:0 3px 3px 0; transition:width .35s cubic-bezier(.2,.8,.2,1); }

/* body */
.body { flex:1 1 auto; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:8px 24px 140px; }
.body.pad0 { padding-left:0; padding-right:0; }
.title { font-size:24px; font-weight:700; line-height:1.42; letter-spacing:-0.7px; margin:12px 0 8px; white-space:pre-line;}
.sub { font-size:15px; color:var(--g600); line-height:1.55; margin-bottom:28px; }
.sec { font-size:13px; font-weight:700; color:var(--g500); margin:30px 0 12px; letter-spacing:0;}

/* field */
.f { margin-bottom:24px; }
.f-l { display:flex; align-items:center; gap:5px; font-size:14px; font-weight:600; color:var(--g700); margin-bottom:9px; }
.dot { width:4px; height:4px; border-radius:50%; background:var(--blue); display:inline-block; margin-bottom:8px;}
.f-in, .f-ta {
  width:100%; border:1.5px solid transparent; background:var(--g100); border-radius:12px;
  padding:15px 16px; font-size:16px; font-family:inherit; color:var(--g900); outline:none;
  letter-spacing:-0.3px; transition:border-color .15s, background .15s;
}
.f-ta { resize:none; line-height:1.6; min-height:104px; }
.f-in::placeholder, .f-ta::placeholder { color:var(--g400); }
.f-in:focus, .f-ta:focus { background:#fff; border-color:var(--blue); }
.f-ex { font-size:13px; color:var(--g500); line-height:1.55; margin-top:8px; padding-left:2px; }
.f-ex b { color:var(--g600); font-weight:600; }
.f-cnt { font-size:12px; color:var(--g400); text-align:right; margin-top:6px; font-variant-numeric:tabular-nums;}
.f-cnt.over { color:var(--red); }

/* chips */
.chips { display:flex; flex-wrap:wrap; gap:8px; }
.chip {
  border:1.5px solid var(--g200); background:#fff; color:var(--g700);
  border-radius:999px; padding:9px 14px; font-size:14px; font-weight:600; font-family:inherit;
  cursor:pointer; transition:.15s;
}
.chip:active { transform:scale(.96); }
.chip.on { background:var(--blue-bg); border-color:var(--blue-bg); color:var(--blue-dark); }
.chip.add { color:var(--g500); border-style:dashed; }

/* select cards */
.pick { width:100%; text-align:left; display:flex; align-items:center; gap:14px; background:var(--g50);
  border:1.5px solid transparent; border-radius:16px; padding:18px; margin-bottom:12px; cursor:pointer; font-family:inherit; transition:.15s;}
.pick:active { transform:scale(.985); }
.pick.on { border-color:var(--blue); background:var(--blue-bg); }
.pick-t { font-size:16px; font-weight:700; color:var(--g900); }
.pick-d { font-size:13px; color:var(--g600); margin-top:3px; line-height:1.45;}
.badge { font-size:11px; font-weight:700; color:var(--blue-dark); background:var(--blue-bg); border-radius:6px; padding:3px 6px; margin-left:6px;}

/* cta */
.cta-wrap { position:absolute; left:0; right:0; bottom:0; padding:12px 24px calc(20px + env(safe-area-inset-bottom));
  background:linear-gradient(to top, #fff 62%, rgba(255,255,255,0)); }
.cta { width:100%; height:56px; border:0; border-radius:14px; background:var(--blue); color:#fff;
  font-size:17px; font-weight:700; font-family:inherit; cursor:pointer; letter-spacing:-0.4px; transition:.15s;}
.cta:active { background:var(--blue-dark); }
.cta:disabled { background:var(--g100); color:var(--g400); cursor:default; }
.cta.ghost { background:var(--g100); color:var(--g700); }

/* list */
.card { background:#fff; border-radius:18px; padding:20px; margin-bottom:12px; cursor:pointer; border:1px solid var(--g100); }
.card:active { background:var(--g50); }
.row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.tag { font-size:11px; font-weight:700; border-radius:6px; padding:4px 7px; }
.tag.draft { background:var(--g100); color:var(--g600); }
.tag.sub { background:var(--blue-bg); color:var(--blue-dark); }
.tag.fb { background:#E6F9F0; color:var(--green); }
.tag.rev { background:var(--red-bg); color:var(--red); }

/* stage widget (시그니처) */
.stage { background:var(--g50); border-radius:18px; padding:18px 16px 14px; }
.stage-h { font-size:13px; color:var(--g600); text-align:center; margin-bottom:6px; }
.stage svg { width:100%; display:block; }
.spot { cursor:pointer; }
.stage-cap { text-align:center; font-size:14px; font-weight:700; color:var(--blue-dark); margin-top:4px; }
.seg { display:flex; background:var(--g100); border-radius:12px; padding:4px; gap:4px; margin-top:14px;}
.seg button { flex:1; border:0; background:none; padding:10px 0; border-radius:9px; font-size:14px; font-weight:600;
  color:var(--g600); font-family:inherit; cursor:pointer; }
.seg button.on { background:#fff; color:var(--g900); box-shadow:0 1px 3px rgba(0,0,0,.08); }

/* repeatable */
.beat { background:var(--g50); border-radius:16px; padding:16px; margin-bottom:10px; }
.beat-n { font-size:12px; font-weight:700; color:var(--blue); margin-bottom:10px; display:flex; justify-content:space-between;}
.beat .f-in { background:#fff; margin-bottom:8px; padding:13px 14px; font-size:15px;}
.linkbtn { border:0; background:none; color:var(--g500); font-size:13px; font-weight:600; font-family:inherit; cursor:pointer; padding:4px;}
.addbtn { width:100%; border:1.5px dashed var(--g300); background:none; color:var(--g600); border-radius:14px;
  padding:15px; font-size:15px; font-weight:600; font-family:inherit; cursor:pointer; }

/* review summary */
.rv { background:var(--g50); border-radius:16px; padding:18px; margin-bottom:10px; }
.rv-l { font-size:12px; font-weight:700; color:var(--g500); margin-bottom:6px;}
.rv-v { font-size:15px; line-height:1.6; color:var(--g800); white-space:pre-wrap; }
.rv-v.empty { color:var(--g400); }
.gauge { height:8px; background:var(--g200); border-radius:99px; overflow:hidden; margin:10px 0 6px;}
.gauge i { display:block; height:100%; background:var(--blue); transition:width .4s;}
.gauge i.warn { background:var(--red); }

/* instructor */
.ins-f { border-bottom:1px solid var(--g100); padding:18px 24px; }
.ins-l { font-size:12px; font-weight:700; color:var(--g500); margin-bottom:6px;}
.ins-v { font-size:16px; line-height:1.6; color:var(--g900); white-space:pre-wrap;}
.ins-v.empty { color:var(--g400); font-size:15px;}
.cmt { margin-top:12px; background:var(--blue-bg); border-radius:12px; padding:13px 14px; font-size:14px;
  color:var(--blue-dark); line-height:1.55; font-weight:500;}
.cmtbtn { margin-top:10px; border:1.5px solid var(--g200); background:#fff; border-radius:10px; padding:9px 12px;
  font-size:13px; font-weight:600; color:var(--g600); font-family:inherit; cursor:pointer; display:flex; align-items:center; gap:5px;}
.scale { display:flex; gap:6px; }
.scale button { flex:1; border:1.5px solid var(--g200); background:#fff; border-radius:10px; padding:11px 0;
  font-size:13px; font-weight:600; color:var(--g600); font-family:inherit; cursor:pointer;}
.scale button.on { border-color:var(--blue); background:var(--blue-bg); color:var(--blue-dark); }

/* sheet */
.dim { position:absolute; inset:0; background:rgba(0,0,0,.42); z-index:20; animation:fade .2s; }
.sheet { position:absolute; left:0; right:0; bottom:0; background:#fff; border-radius:24px 24px 0 0;
  padding:10px 24px calc(24px + env(safe-area-inset-bottom)); z-index:21; max-height:82%; overflow-y:auto;
  animation:up .28s cubic-bezier(.2,.9,.25,1); }
.grab { width:40px; height:4px; background:var(--g200); border-radius:99px; margin:0 auto 18px; }
@keyframes up { from { transform:translateY(100%);} to { transform:translateY(0);} }
@keyframes fade { from{opacity:0} to{opacity:1} }
.pal { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;}
.pal button { border:1.5px solid var(--g200); background:#fff; border-radius:10px; padding:9px 12px;
  font-size:13px; font-weight:600; color:var(--g700); font-family:inherit; cursor:pointer; text-align:left;}
.pal button:active { background:var(--g100); }

/* toast / misc */
.toast { position:absolute; left:24px; right:24px; bottom:96px; background:rgba(25,31,40,.94); color:#fff;
  border-radius:14px; padding:15px 18px; font-size:14px; font-weight:600; z-index:30; animation:fade .2s; text-align:center;}
.done-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 32px; text-align:center;}
.check { width:76px; height:76px; border-radius:50%; background:var(--blue-bg); display:flex; align-items:center;
  justify-content:center; margin-bottom:24px; animation:pop .4s cubic-bezier(.2,1.3,.4,1);}
@keyframes pop { from{transform:scale(.5); opacity:0} to{transform:scale(1); opacity:1} }
.stack { width:100%; max-width:420px; display:flex; flex-direction:column; align-items:center; gap:10px; }
.roleswap { display:flex; gap:4px; background:rgba(25,31,40,.88); border-radius:99px; padding:4px; flex:0 0 auto; margin-top:10px;}
.roleswap button { border:0; background:none; color:#B0B8C1; font-size:12px; font-weight:700; padding:7px 16px;
  border-radius:99px; font-family:inherit; cursor:pointer;}
.roleswap button.on { background:#fff; color:#191F28; }
.fade { animation:fade .25s; }
@media (prefers-reduced-motion: reduce){ .sol *, .sol *::before { animation:none !important; transition:none !important; } }
`;

/* ---------------------------- icons ---------------------------- */
const I = {
  back: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  close: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  chev: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="#B0B8C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  mic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  check: <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M5 13l4.5 4.5L19 7" stroke="#3182F6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pen: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L20 8l-4-4L4 16v4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>,
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
};

/* ---------------------------- 데이터 정의 ---------------------------- */
const TYPES = [
  { id: "MONOLOGUE", t: "독백 대사분석", d: "입시 지정·자유 독백 한 편을 파고듭니다", tag: "가장 많이 씀" },
  { id: "PLAY", t: "희곡 작품 전체분석", d: "한예종 지정희곡 등 작품 하나를 통째로", tag: "구술 대비" },
  { id: "MUSICAL", t: "뮤지컬 넘버 분석", d: "넘버의 극적 기능과 음악·심리 변화", tag: "" },
];

const STEP_LABEL = ["작품", "핵심", "구조", "배경", "검토"];

// 전술 추천 동사
const TACTIC_SUGGEST = ["설득한다", "압박한다", "도발한다", "애원한다", "위협한다", "회유한다", "비웃는다", "고백한다", "떠본다", "다그친다"];
const PITFALLS = ["감정부터 쓰기", "혼잣말로 처리", "발음·발성에만 집중", "상대 없이 허공 보기", "결말을 미리 알고 연기"];
const SONG_TYPES = ["I want 송", "오프닝", "차밍 송", "프로덕션 넘버", "11 o'clock 넘버", "듀엣", "액트 피날레"];

const SEED = {
  MONOLOGUE: {
    title: "안티고네", author: "소포클레스", character: "안티고네", scene: "1막, 매장을 결심하는 장면",
    oneLine: "국법을 어기고 오라비를 묻겠다고 언니에게 선언한다",
    goal: "", other: "", obstacle: "", tactics: [], expectation: "",
    beats: [{ range: "", shift: "", tactic: "" }],
    partnerWho: "", partnerPos: 2, partnerHeight: 1, partnerDo: "", catchPoint: "",
    momentBefore: "", opposites: "",
    given: "", subtext: "", question: "", pitfalls: [],
  },
  PLAY: {
    title: "", author: "", character: "", scene: "",
    oneLine: "", goal: "", other: "", obstacle: "", tactics: [], expectation: "",
    theme: "", structure: "", relations: [{ name: "", relation: "", desire: "" }],
    period: "", intent: "", qa: [{ q: "", a: "" }],
    given: "", subtext: "", question: "", pitfalls: [],
  },
  MUSICAL: {
    title: "", author: "", character: "", scene: "",
    oneLine: "", goal: "", other: "", obstacle: "", tactics: [], expectation: "",
    songType: "", why: "", trigger: "", musicMap: [{ sec: "", psych: "" }],
    change: "", vocal: "",
    given: "", subtext: "", question: "", pitfalls: [],
  },
};

const SAMPLE_LIST = [
  { id: 1, type: "MONOLOGUE", title: "겨울 이야기", ch: "헤르미오네", status: "fb", date: "7월 22일", school: "한예종" },
  { id: 2, type: "PLAY", title: "산불", ch: "점례", status: "sub", date: "7월 19일", school: "한예종" },
  { id: 3, type: "MUSICAL", title: "위키드 · Defying Gravity", ch: "엘파바", status: "draft", date: "7월 15일", school: "" },
];

const RUBRIC = [
  { k: "goalClear", label: "목표가 동사로 분명한가" },
  { k: "obstacleReal", label: "장애물이 구체적인가" },
  { k: "evidence", label: "대사에 근거가 있는가" },
  { k: "subtext", label: "서브텍스트의 깊이" },
  { k: "oral", label: "구술로 말할 수 있는가" },
];
const SCALE = ["더 필요", "보통", "좋음", "훌륭"];

const PALETTE = [
  "목표가 형용사예요. '~하고 싶다' 동사로 바꿔봅시다.",
  "장애물이 추상적입니다. 이 장면 안에서 실제로 막는 것을 찾으세요.",
  "근거 대사를 한 줄 인용해 주세요.",
  "상대가 비어 있어요. 없는 상대를 먼저 세워야 합니다.",
  "비트 전환점이 한 곳뿐입니다. 최소 세 곳은 찾아봅시다.",
  "감정 단어 대신 행동 동사로 적으면 연기가 잡힙니다.",
  "여기 해석 좋습니다. 실기에서도 그대로 가져가세요.",
];

/* ---------------------------- 공용 컴포넌트 ---------------------------- */
function Field({ label, required, value, onChange, placeholder, example, long, max, voice }) {
  const over = max && value.length > max;
  return (
    <div className="f">
      <div className="f-l">
        {label}{required && <span className="dot" />}
        {voice && (
          <button className="linkbtn" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}
            onClick={() => voice()}>{I.mic} 말로 적기</button>
        )}
      </div>
      {long ? (
        <textarea className="f-ta" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : (
        <input className="f-in" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {example && <div className="f-ex"><b>예)</b> {example}</div>}
      {max && <div className={"f-cnt" + (over ? " over" : "")}>{value.length} / {max}자</div>}
    </div>
  );
}

function Chips({ label, required, options, value, onToggle, example, allowFree, onFree }) {
  return (
    <div className="f">
      <div className="f-l">{label}{required && <span className="dot" />}</div>
      <div className="chips">
        {options.map((o) => (
          <button key={o} className={"chip" + (value.includes(o) ? " on" : "")} onClick={() => onToggle(o)}>{o}</button>
        ))}
        {allowFree && <button className="chip add" onClick={onFree}>+ 직접 입력</button>}
      </div>
      {example && <div className="f-ex"><b>예)</b> {example}</div>}
    </div>
  );
}

/* 시그니처: 보이지 않는 상대 배치 무대 */
function StageMap({ pos, height, onPos, onHeight }) {
  const spots = [
    { x: 40, y: 78, l: "왼쪽 뒤" }, { x: 66, y: 52, l: "왼쪽" }, { x: 110, y: 38, l: "왼쪽 앞" },
    { x: 160, y: 32, l: "정면" },
    { x: 210, y: 38, l: "오른쪽 앞" }, { x: 254, y: 52, l: "오른쪽" }, { x: 280, y: 78, l: "오른쪽 뒤" },
  ];
  const cur = spots[pos] || spots[3];
  return (
    <div className="stage">
      <div className="stage-h">상대가 서 있는 자리를 찍어보세요</div>
      <svg viewBox="0 0 320 150" role="img" aria-label="무대 위 상대 위치 선택">
        <path d="M20 130 Q160 -10 300 130" fill="none" stroke="#E5E8EB" strokeWidth="1.5" strokeDasharray="4 5" />
        <line x1={160} y1={118} x2={cur.x} y2={cur.y} stroke="#3182F6" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />
        <circle cx="160" cy="122" r="9" fill="#191F28" />
        <text x="160" y="145" textAnchor="middle" fontSize="11" fill="#8B95A1" fontWeight="600">나</text>
        {spots.map((s, i) => (
          <g key={i} className="spot" onClick={() => onPos(i)}>
            <circle cx={s.x} cy={s.y} r="16" fill="transparent" />
            <circle cx={s.x} cy={s.y} r={i === pos ? 9 : 5.5}
              fill={i === pos ? "#3182F6" : "#D1D6DB"} style={{ transition: "all .2s" }} />
          </g>
        ))}
      </svg>
      <div className="stage-cap">{cur.l}</div>
      <div className="seg">
        {["눈높이 아래", "같은 눈높이", "눈높이 위"].map((h, i) => (
          <button key={h} className={height === i ? "on" : ""} onClick={() => onHeight(i)}>{h}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- 메인 ---------------------------- */
export default function SolAnalysisPrototype() {
  const [role, setRole] = useState("student");
  const [screen, setScreen] = useState("home");   // home | pick | wizard | done | review | feedback
  const [type, setType] = useState("MONOLOGUE");
  const [step, setStep] = useState(0);
  const [d, setD] = useState(SEED.MONOLOGUE);
  const [saved, setSaved] = useState(null);
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState(null);       // {field, label}
  const [comments, setComments] = useState({});
  const [scores, setScores] = useState({});
  const [summary, setSummary] = useState({ good: "", fix: "", next: "" });
  const [draftCmt, setDraftCmt] = useState("");
  const bodyRef = useRef(null);

  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const toggle = (k, v) => setD((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  // 자동 저장
  useEffect(() => {
    if (screen !== "wizard") return;
    const t = setTimeout(() => setSaved(new Date()), 700);
    return () => clearTimeout(t);
  }, [d, screen]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [step, screen]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 1900); };

  const startNew = (t) => { setType(t); setD(SEED[t]); setStep(0); setSaved(null); setScreen("wizard"); };

  // 단계별 필수 충족 여부
  const canNext = useMemo(() => {
    if (step === 0) return d.title.trim() && d.character.trim();
    if (step === 1) return d.oneLine.trim() && d.goal.trim() && d.other.trim() && d.obstacle.trim() && d.tactics.length > 0;
    if (step === 2) {
      if (type === "MONOLOGUE") return d.partnerWho.trim();
      if (type === "PLAY") return d.theme.trim();
      return d.songType && d.why.trim();
    }
    return true;
  }, [step, d, type]);

  const totalChars = useMemo(() => {
    const keys = ["oneLine", "goal", "other", "obstacle", "expectation", "given", "subtext", "theme", "structure", "intent", "why", "trigger", "change", "vocal", "momentBefore", "opposites"];
    let n = keys.reduce((a, k) => a + (d[k] ? d[k].length : 0), 0);
    if (d.beats) n += d.beats.reduce((a, b) => a + b.range.length + b.shift.length + b.tactic.length, 0);
    if (d.musicMap) n += d.musicMap.reduce((a, m) => a + m.sec.length + m.psych.length, 0);
    if (d.qa) n += d.qa.reduce((a, q) => a + q.q.length + q.a.length, 0);
    if (d.relations) n += d.relations.reduce((a, r) => a + r.name.length + r.relation.length + r.desire.length, 0);
    return n;
  }, [d]);

  const typeName = TYPES.find((t) => t.id === type)?.t || "";

  /* ---------------------- 화면들 ---------------------- */

  const Home = () => (
    <>
      <div className="hd"><div style={{ paddingLeft: 16, fontSize: 20, fontWeight: 700 }}>작품분석</div>
        <div className="hd-r">쏠 · 김서연</div></div>
      <div className="body" ref={bodyRef} style={{ background: "#F2F4F6" }}>
        <div style={{ padding: "16px 0 8px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7684", marginBottom: 10 }}>이번 주 첨삭</div>
          <div className="card" onClick={() => { setType("MONOLOGUE"); setD({ ...SEED.MONOLOGUE, ...FILLED }); setScreen("feedback"); }}
            style={{ borderColor: "#3182F6", borderWidth: 1.5 }}>
            <div className="row">
              <div>
                <span className="tag fb">첨삭 완료</span>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>겨울 이야기 · 헤르미오네</div>
                <div style={{ fontSize: 13, color: "#6B7684", marginTop: 4 }}>박지훈 선생님 · 고칠 점 2개</div>
              </div>{I.chev}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7684", margin: "22px 0 10px" }}>내 분석</div>
        {SAMPLE_LIST.map((s) => (
          <div key={s.id} className="card" onClick={() => showToast("시제품에서는 새 분석만 열립니다")}>
            <div className="row">
              <div style={{ minWidth: 0 }}>
                <span className={"tag " + s.status}>
                  {s.status === "draft" ? "작성 중" : s.status === "sub" ? "첨삭 대기" : "첨삭 완료"}
                </span>
                {s.school && <span className="badge" style={{ marginLeft: 6 }}>{s.school}</span>}
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>{s.title} · {s.ch}</div>
                <div style={{ fontSize: 13, color: "#8B95A1", marginTop: 4 }}>
                  {TYPES.find((t) => t.id === s.type).t} · {s.date}
                </div>
              </div>{I.chev}
            </div>
          </div>
        ))}
        <div style={{ height: 20 }} />
      </div>
      <div className="cta-wrap" style={{ background: "linear-gradient(to top,#F2F4F6 62%,rgba(242,244,246,0))" }}>
        <button className="cta" onClick={() => setScreen("pick")}>새 분석 쓰기</button>
      </div>
    </>
  );

  const Pick = () => (
    <>
      <div className="hd"><button className="icobtn" onClick={() => setScreen("home")}>{I.back}</button></div>
      <div className="body" ref={bodyRef}>
        <div className="title">{"무엇을\n분석할까요?"}</div>
        <div className="sub">고른 종류에 따라 질문이 달라집니다.</div>
        {TYPES.map((t) => (
          <button key={t.id} className="pick" onClick={() => startNew(t.id)}>
            <div style={{ flex: 1 }}>
              <div className="pick-t">{t.t}{t.tag && <span className="badge">{t.tag}</span>}</div>
              <div className="pick-d">{t.d}</div>
            </div>{I.chev}
          </button>
        ))}
      </div>
    </>
  );

  /* --- 위저드 단계별 본문 --- */
  const StepWork = () => (
    <>
      <div className="title">{"어떤 작품인가요?"}</div>
      <div className="sub">{typeName} · 나중에 목록에서 이 이름으로 찾습니다.</div>
      <Field label="작품명" required value={d.title} onChange={(v) => set("title", v)} placeholder="작품 제목" example="안티고네" />
      <Field label="작가" value={d.author} onChange={(v) => set("author", v)} placeholder="작가 이름" example="소포클레스" />
      <Field label={type === "MUSICAL" ? "넘버명 · 배역" : "배역"} required value={d.character}
        onChange={(v) => set("character", v)} placeholder={type === "MUSICAL" ? "넘버 / 배역" : "내가 맡은 인물"}
        example={type === "MUSICAL" ? "Defying Gravity / 엘파바" : "안티고네"} />
      <Field label="장면 위치" value={d.scene} onChange={(v) => set("scene", v)} placeholder="몇 막 몇 장, 어떤 장면"
        example="1막, 매장을 결심하는 장면" />
    </>
  );

  const StepGote = () => (
    <>
      <div className="title">{"이 장면에서\n나는 무엇을 원하나요?"}</div>
      <div className="sub">여기 다섯 칸이 분석의 뼈대입니다. 짧고 분명하게.</div>
      <Field label="한 줄 상황" required value={d.oneLine} onChange={(v) => set("oneLine", v)} max={100}
        placeholder="무슨 일이 일어나는지 한 문장" example="국법을 어기고 오라비를 묻겠다고 언니에게 선언한다" />
      <Field label="목표" required value={d.goal} onChange={(v) => set("goal", v)} max={80}
        placeholder="'~하고 싶다'로 끝나게" example="언니가 나와 함께 오라비를 묻도록 만들고 싶다" />
      <Field label="상대" required value={d.other} onChange={(v) => set("other", v)} max={60}
        placeholder="누구에게 원하나요" example="언니 이스메네, 그리고 나를 지켜보는 신들" />
      <Field label="장애물" required value={d.obstacle} onChange={(v) => set("obstacle", v)} max={80}
        placeholder="무엇이 막고 있나요" example="크레온의 국법과 언니의 두려움" />
      <Chips label="전술" required options={TACTIC_SUGGEST} value={d.tactics} onToggle={(v) => toggle("tactics", v)}
        allowFree onFree={() => showToast("시제품에서는 추천 동사만 고를 수 있어요")}
        example="원하는 걸 얻으려고 하는 행동을 동사로 2~4개" />
      <Field label="기대" value={d.expectation} onChange={(v) => set("expectation", v)} max={80}
        placeholder="나는 이길 거라 믿나요?" example="옳은 일이니 언니도 결국 따라올 것이다" />
    </>
  );

  const StepStructureMono = () => (
    <>
      <div className="title">{"없는 상대를\n세워봅시다"}</div>
      <div className="sub">독백 실기에서 가장 크게 갈리는 지점입니다.</div>
      <div className="sec">보이지 않는 상대</div>
      <Field label="상대는 누구인가요" required value={d.partnerWho} onChange={(v) => set("partnerWho", v)}
        placeholder="이름과 관계" example="언니 이스메네 · 하나 남은 혈육" />
      <StageMap pos={d.partnerPos} height={d.partnerHeight}
        onPos={(v) => set("partnerPos", v)} onHeight={(v) => set("partnerHeight", v)} />
      <div style={{ height: 24 }} />
      <Field label="독백 동안 상대는 무엇을 하나요" long value={d.partnerDo} onChange={(v) => set("partnerDo", v)}
        placeholder="말없이 듣기만 하는 게 아닙니다" example="처음엔 말리려 다가오다가, 중반에 고개를 돌리고, 끝에는 뒷걸음질친다" />
      <Field label="받기 포인트" value={d.catchPoint} onChange={(v) => set("catchPoint", v)}
        placeholder="상대 반응이 나를 바꾸는 순간" example="'너도 알잖아' 뒤에 언니가 눈을 피할 때" />

      <div className="sec">비트 나누기</div>
      {d.beats.map((b, i) => (
        <div className="beat" key={i}>
          <div className="beat-n"><span>비트 {i + 1}</span>
            {d.beats.length > 1 && <button className="linkbtn" onClick={() => set("beats", d.beats.filter((_, j) => j !== i))}>삭제</button>}
          </div>
          <input className="f-in" placeholder="대사 구간 (예: 첫 줄 ~ '들으려 하지 않는구나')" value={b.range}
            onChange={(e) => set("beats", d.beats.map((x, j) => j === i ? { ...x, range: e.target.value } : x))} />
          <input className="f-in" placeholder="여기서 목표가 어떻게 바뀌나" value={b.shift}
            onChange={(e) => set("beats", d.beats.map((x, j) => j === i ? { ...x, shift: e.target.value } : x))} />
          <input className="f-in" style={{ marginBottom: 0 }} placeholder="쓰는 전술 (동사)" value={b.tactic}
            onChange={(e) => set("beats", d.beats.map((x, j) => j === i ? { ...x, tactic: e.target.value } : x))} />
        </div>
      ))}
      <button className="addbtn" onClick={() => set("beats", [...d.beats, { range: "", shift: "", tactic: "" }])}>+ 비트 추가</button>

      <div className="sec">더 파고들기 (선택)</div>
      <Field label="직전의 순간" value={d.momentBefore} onChange={(v) => set("momentBefore", v)}
        placeholder="첫 대사 0.5초 전에 무슨 일이 있었나" example="파수병의 북소리를 듣고 몸을 돌린 직후" />
      <Field label="대극" value={d.opposites} onChange={(v) => set("opposites", v)}
        placeholder="톤이 뒤집히는 지점" example="설득하다가 갑자기 언니를 놓아버리는 순간" />
      <Chips label="내가 자주 빠지는 함정" options={PITFALLS} value={d.pitfalls} onToggle={(v) => toggle("pitfalls", v)}
        example="선생님이 여기를 먼저 봐줍니다" />
    </>
  );

  const StepStructurePlay = () => (
    <>
      <div className="title">{"작품 전체를\n꿰어봅시다"}</div>
      <div className="sub">구술 면접에서 그대로 나오는 항목들입니다.</div>
      <Field label="주제" required value={d.theme} onChange={(v) => set("theme", v)} max={100}
        placeholder="한 문장으로" example="국가의 법과 인간의 도리가 부딪칠 때 무엇을 택할 것인가" />
      <Field label="구조" long value={d.structure} onChange={(v) => set("structure", v)}
        placeholder="발단-전개-위기-절정-결말, 발견과 급전이 어디인지" example="크레온이 아들의 시신을 안고 돌아오는 지점이 급전" />
      <div className="sec">인물 관계</div>
      {d.relations.map((r, i) => (
        <div className="beat" key={i}>
          <div className="beat-n"><span>인물 {i + 1}</span>
            {d.relations.length > 1 && <button className="linkbtn" onClick={() => set("relations", d.relations.filter((_, j) => j !== i))}>삭제</button>}
          </div>
          <input className="f-in" placeholder="이름" value={r.name}
            onChange={(e) => set("relations", d.relations.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
          <input className="f-in" placeholder="나와의 관계" value={r.relation}
            onChange={(e) => set("relations", d.relations.map((x, j) => j === i ? { ...x, relation: e.target.value } : x))} />
          <input className="f-in" style={{ marginBottom: 0 }} placeholder="그 인물이 원하는 것" value={r.desire}
            onChange={(e) => set("relations", d.relations.map((x, j) => j === i ? { ...x, desire: e.target.value } : x))} />
        </div>
      ))}
      <button className="addbtn" onClick={() => set("relations", [...d.relations, { name: "", relation: "", desire: "" }])}>+ 인물 추가</button>
      <div className="sec">배경과 의도</div>
      <Field label="시대·사회 배경" value={d.period} onChange={(v) => set("period", v)}
        placeholder="언제, 어떤 세계인가" example="테베, 내전 직후 계엄 상태" />
      <Field label="작가의 의도" long value={d.intent} onChange={(v) => set("intent", v)}
        placeholder="작가는 왜 이 이야기를 썼을까" />
      <div className="sec">구술 예상 질문</div>
      {d.qa.map((q, i) => (
        <div className="beat" key={i}>
          <div className="beat-n"><span>질문 {i + 1}</span>
            {d.qa.length > 1 && <button className="linkbtn" onClick={() => set("qa", d.qa.filter((_, j) => j !== i))}>삭제</button>}
          </div>
          <input className="f-in" placeholder="예상 질문" value={q.q}
            onChange={(e) => set("qa", d.qa.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} />
          <input className="f-in" style={{ marginBottom: 0 }} placeholder="내 대답 (30초 분량)" value={q.a}
            onChange={(e) => set("qa", d.qa.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
        </div>
      ))}
      <button className="addbtn" onClick={() => set("qa", [...d.qa, { q: "", a: "" }])}>+ 질문 추가</button>
    </>
  );

  const StepStructureMusical = () => (
    <>
      <div className="title">{"왜 지금\n말이 아니라 노래인가요?"}</div>
      <div className="sub">넘버 분석은 이 질문 하나로 시작합니다.</div>
      <div className="f">
        <div className="f-l">넘버 유형<span className="dot" /></div>
        <div className="chips">
          {SONG_TYPES.map((s) => (
            <button key={s} className={"chip" + (d.songType === s ? " on" : "")} onClick={() => set("songType", s)}>{s}</button>
          ))}
        </div>
        <div className="f-ex"><b>예)</b> 주인공이 욕망을 처음 선언하면 I want 송, 종반 자각이면 11 o'clock 넘버</div>
      </div>
      <Field label="이 넘버의 극적 기능" required long value={d.why} onChange={(v) => set("why", v)}
        placeholder="말로는 안 되고 노래여야 하는 이유" example="억눌러온 것이 한계를 넘어 말의 그릇을 깨고 나온다" />
      <Field label="직전 사건" value={d.trigger} onChange={(v) => set("trigger", v)}
        placeholder="무엇이 이 노래를 터뜨렸나" />
      <div className="sec">음악과 심리 매핑</div>
      {d.musicMap.map((m, i) => (
        <div className="beat" key={i}>
          <div className="beat-n"><span>구간 {i + 1}</span>
            {d.musicMap.length > 1 && <button className="linkbtn" onClick={() => set("musicMap", d.musicMap.filter((_, j) => j !== i))}>삭제</button>}
          </div>
          <input className="f-in" placeholder="음악 구간 (verse / 조성 전환 / 버튼 등)" value={m.sec}
            onChange={(e) => set("musicMap", d.musicMap.map((x, j) => j === i ? { ...x, sec: e.target.value } : x))} />
          <input className="f-in" style={{ marginBottom: 0 }} placeholder="그때 내 마음이 어떻게 움직이나" value={m.psych}
            onChange={(e) => set("musicMap", d.musicMap.map((x, j) => j === i ? { ...x, psych: e.target.value } : x))} />
        </div>
      ))}
      <button className="addbtn" onClick={() => set("musicMap", [...d.musicMap, { sec: "", psych: "" }])}>+ 구간 추가</button>
      <div className="sec">노래가 끝났을 때</div>
      <Field label="시작과 끝의 변화" long value={d.change} onChange={(v) => set("change", v)}
        placeholder="이 넘버 전과 후의 나는 어떻게 다른가" />
      <Field label="창법을 그렇게 고른 이유" value={d.vocal} onChange={(v) => set("vocal", v)}
        placeholder="벨팅 / 레가토 / 스피치싱잉" example="후렴만 벨팅으로 올려 결심의 순간을 표시한다" />
    </>
  );

  const StepContext = () => (
    <>
      <div className="title">{"배경과 속마음을\n채워주세요"}</div>
      <div className="sub">여기부터는 선택이지만, 첨삭의 깊이가 달라집니다.</div>
      <Field label="주어진 상황" long value={d.given} onChange={(v) => set("given", v)} max={400}
        placeholder="시대, 장소, 직전 사건, 내 처지" example="전쟁이 끝난 다음 날 새벽. 오라비의 시신은 아직 성 밖에 있다." voice={() => showToast("녹음해서 초안을 받아쓰게 됩니다")} />
      <Field label="서브텍스트" long value={d.subtext} onChange={(v) => set("subtext", v)} max={300}
        placeholder="말과 다른 진심" example="말로는 언니를 설득하지만, 속으로는 이미 혼자 갈 것을 알고 작별하고 있다" voice={() => showToast("녹음해서 초안을 받아쓰게 됩니다")} />
      <Field label="선생님께 묻고 싶은 것" value={d.question} onChange={(v) => set("question", v)} max={120}
        placeholder="확신이 안 서는 부분" example="마지막을 분노로 갈지 체념으로 갈지 모르겠어요" />
    </>
  );

  const RvRow = ({ l, v }) => (
    <div className="rv"><div className="rv-l">{l}</div>
      <div className={"rv-v" + (v ? "" : " empty")}>{v || "아직 비어 있어요"}</div></div>
  );

  const StepReview = () => {
    const pct = Math.min(100, (totalChars / 2000) * 100);
    return (
      <>
        <div className="title">{"내고 나면\n선생님께 바로 갑니다"}</div>
        <div className="sub">낸 뒤에도 고칠 수 있어요. 고치면 새 버전으로 저장됩니다.</div>
        <div className="rv" style={{ background: "#E8F3FF" }}>
          <div className="rv-l" style={{ color: "#1B64DA" }}>한예종 2차 글쓰기 기준</div>
          <div className="gauge"><i className={pct > 100 ? "warn" : ""} style={{ width: pct + "%" }} /></div>
          <div style={{ fontSize: 13, color: "#4E5968" }}>
            지금 <b>{totalChars}자</b> · 시험은 원고지 2,000자 이내로 씁니다
          </div>
        </div>
        <div style={{ height: 10 }} />
        {RvRow({ l: "작품", v: [d.title, d.character].filter(Boolean).join(" · ") })}
        {RvRow({ l: "한 줄 상황", v: d.oneLine })}
        {RvRow({ l: "목표", v: d.goal })}
        {RvRow({ l: "상대", v: d.other })}
        {RvRow({ l: "장애물", v: d.obstacle })}
        {RvRow({ l: "전술", v: d.tactics.join(" · ") })}
        {type === "MONOLOGUE" && RvRow({ l: "보이지 않는 상대", v: d.partnerWho })}
        {type === "PLAY" && RvRow({ l: "주제", v: d.theme })}
        {type === "MUSICAL" && RvRow({ l: "넘버 유형", v: d.songType })}
        {RvRow({ l: "선생님께 묻고 싶은 것", v: d.question })}
      </>
    );
  };

  const Wizard = () => {
    const stepBody =
      step === 0 ? StepWork() :
      step === 1 ? StepGote() :
      step === 2 ? (type === "MONOLOGUE" ? StepStructureMono() : type === "PLAY" ? StepStructurePlay() : StepStructureMusical()) :
      step === 3 ? StepContext() : StepReview();
    return (
      <>
        <div className="hd">
          <button className="icobtn" onClick={() => step === 0 ? setScreen("pick") : setStep(step - 1)}>{I.back}</button>
          <span className="hd-t">{STEP_LABEL[step]}</span>
          <div className="hd-r">
            {saved ? <span style={{ color: "#00B25E" }}>저장됨</span> : "작성 중"}
            <button className="linkbtn" onClick={() => { showToast("임시 저장했어요"); setScreen("home"); }}>나가기</button>
          </div>
        </div>
        <div className="prog"><i style={{ width: ((step + 1) / 5) * 100 + "%" }} /></div>
        <div className="body fade" ref={bodyRef} key={step}>{stepBody}</div>
        <div className="cta-wrap">
          <button className="cta" disabled={!canNext}
            onClick={() => step < 4 ? setStep(step + 1) : setScreen("done")}>
            {step < 4 ? (canNext ? "다음" : "표시된 칸을 채워주세요") : "선생님께 내기"}
          </button>
        </div>
      </>
    );
  };

  const Done = () => (
    <>
      <div className="hd" />
      <div className="done-wrap">
        <div className="check">{I.check}</div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.45 }}>{"냈습니다\n박지훈 선생님께 갔어요"}</div>
        <div style={{ fontSize: 15, color: "#6B7684", marginTop: 12, lineHeight: 1.55 }}>
          보통 하루 안에 첨삭이 옵니다.<br />오면 알림으로 알려드릴게요.
        </div>
      </div>
      <div className="cta-wrap">
        <button className="cta ghost" style={{ marginBottom: 8 }} onClick={() => { setRole("instructor"); setScreen("review"); }}>
          강사 화면으로 보기
        </button>
        <button className="cta" onClick={() => setScreen("home")}>목록으로</button>
      </div>
    </>
  );

  /* --- 강사 첨삭 --- */
  const InsField = ({ k, label, value }) => (
    <div className="ins-f">
      <div className="ins-l">{label}</div>
      <div className={"ins-v" + (value ? "" : " empty")}>{value || "비어 있음"}</div>
      {comments[k] ? (
        <div className="cmt" onClick={() => { setDraftCmt(comments[k]); setSheet({ k, label }); }}>{comments[k]}</div>
      ) : (
        <button className="cmtbtn" onClick={() => { setDraftCmt(""); setSheet({ k, label }); }}>{I.pen} 코멘트</button>
      )}
    </div>
  );

  const Review = () => {
    const cnt = Object.keys(comments).length;
    return (
      <>
        <div className="hd">
          <button className="icobtn" onClick={() => { setRole("student"); setScreen("home"); }}>{I.back}</button>
          <span className="hd-t">첨삭 · 김서연</span>
          <div className="hd-r">코멘트 {cnt}</div>
        </div>
        <div className="body pad0" ref={bodyRef}>
          <div style={{ padding: "10px 24px 18px" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{d.title || "제목 없음"} · {d.character || "-"}</div>
            <div style={{ fontSize: 13, color: "#8B95A1", marginTop: 5 }}>{typeName} · v1 · 방금 제출</div>
            {d.question && (
              <div className="cmt" style={{ background: "#FFF7E0", color: "#8A6100" }}>
                학생 질문 — {d.question}
              </div>
            )}
          </div>
          {InsField({ k: "oneLine", label: "한 줄 상황", value: d.oneLine })}
          {InsField({ k: "goal", label: "목표", value: d.goal })}
          {InsField({ k: "other", label: "상대", value: d.other })}
          {InsField({ k: "obstacle", label: "장애물", value: d.obstacle })}
          {InsField({ k: "tactics", label: "전술", value: d.tactics.join(" · ") })}
          {type === "MONOLOGUE" && <>
            {InsField({ k: "partnerWho", label: "보이지 않는 상대", value: d.partnerWho })}
            {InsField({ k: "partnerDo", label: "독백 동안 상대의 행동", value: d.partnerDo })}
            {InsField({ k: "beats", label: "비트",
              value: d.beats.filter((b) => b.range || b.shift).map((b, i) => `${i + 1}. ${b.range} → ${b.shift}${b.tactic ? ` (${b.tactic})` : ""}`).join("\n") })}
          </>}
          {type === "PLAY" && InsField({ k: "theme", label: "주제", value: d.theme })}
          {type === "MUSICAL" && InsField({ k: "why", label: "넘버의 극적 기능", value: d.why })}
          {InsField({ k: "given", label: "주어진 상황", value: d.given })}
          {InsField({ k: "subtext", label: "서브텍스트", value: d.subtext })}

          <div style={{ padding: "26px 24px 0" }}>
            <div className="sec" style={{ margin: "0 0 14px" }}>루브릭</div>
            {RUBRIC.map((r) => (
              <div key={r.k} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 8 }}>{r.label}</div>
                <div className="scale">
                  {SCALE.map((s, i) => (
                    <button key={s} className={scores[r.k] === i ? "on" : ""}
                      onClick={() => setScores({ ...scores, [r.k]: i })}>{s}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="sec">마무리 한마디</div>
            <Field label="잘한 점" value={summary.good} onChange={(v) => setSummary({ ...summary, good: v })} placeholder="지켜야 할 것" />
            <Field label="고칠 점" value={summary.fix} onChange={(v) => setSummary({ ...summary, fix: v })} placeholder="가장 중요한 하나만" />
            <Field label="다음에 할 일" value={summary.next} onChange={(v) => setSummary({ ...summary, next: v })} placeholder="수업 전까지 해올 것" />
          </div>
        </div>
        <div className="cta-wrap">
          <button className="cta" onClick={() => { setRole("student"); setScreen("feedback"); }}>첨삭 보내기</button>
        </div>
      </>
    );
  };

  const Feedback = () => (
    <>
      <div className="hd">
        <button className="icobtn" onClick={() => setScreen("home")}>{I.close}</button>
        <span className="hd-t">받은 첨삭</span>
      </div>
      <div className="body" ref={bodyRef} style={{ background: "#F2F4F6" }}>
        <div style={{ padding: "14px 0 4px" }}>
          <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.45 }}>{d.title || "겨울 이야기"} · {d.character || "헤르미오네"}</div>
          <div style={{ fontSize: 13, color: "#6B7684", marginTop: 6 }}>박지훈 선생님 · v1 첨삭</div>
        </div>
        <div className="card" style={{ marginTop: 16, cursor: "default" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#00B25E", marginBottom: 8 }}>잘한 점</div>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: "#333D4B" }}>
            {summary.good || "장애물을 '언니의 두려움'까지 내려간 게 좋습니다. 실기에서 그대로 가져가세요."}
          </div>
        </div>
        <div className="card" style={{ cursor: "default" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#F04452", marginBottom: 8 }}>고칠 점</div>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: "#333D4B" }}>
            {summary.fix || "목표가 아직 상태에 가깝습니다. '설득하고 싶다'가 아니라 상대가 무엇을 하게 만들고 싶은지로 바꾸세요."}
          </div>
        </div>
        <div className="card" style={{ cursor: "default" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#3182F6", marginBottom: 8 }}>다음에 할 일</div>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: "#333D4B" }}>
            {summary.next || "비트를 세 개로 다시 나눠 오세요. 수요일 수업 때 첫 비트만 세워봅니다."}
          </div>
        </div>
        {Object.keys(comments).length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7684", margin: "22px 0 10px" }}>칸별 코멘트</div>
            {Object.entries(comments).map(([k, v]) => (
              <div className="card" key={k} style={{ cursor: "default" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#8B95A1", marginBottom: 6 }}>{k}</div>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>{v}</div>
              </div>
            ))}
          </>
        )}
        <div style={{ height: 20 }} />
      </div>
      <div className="cta-wrap" style={{ background: "linear-gradient(to top,#F2F4F6 62%,rgba(242,244,246,0))" }}>
        <button className="cta" onClick={() => { setStep(1); setScreen("wizard"); showToast("v2로 고쳐서 다시 낼 수 있어요"); }}>
          고쳐서 다시 내기
        </button>
      </div>
    </>
  );

  /* ---------------------- 렌더 ---------------------- */
  return (
    <div className="sol">
      <style>{CSS}</style>
      <div className="stack">
      <div className="roleswap">
        <button className={role === "student" ? "on" : ""}
          onClick={() => { setRole("student"); setScreen("home"); }}>학생 화면</button>
        <button className={role === "instructor" ? "on" : ""}
          onClick={() => { setRole("instructor"); setScreen("review"); }}>강사 화면</button>
      </div>
      <div className="phone">
        {screen === "home" && Home()}
        {screen === "pick" && Pick()}
        {screen === "wizard" && Wizard()}
        {screen === "done" && Done()}
        {screen === "review" && Review()}
        {screen === "feedback" && Feedback()}

        {sheet && (
          <>
            <div className="dim" onClick={() => setSheet(null)} />
            <div className="sheet">
              <div className="grab" />
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{sheet.label}</div>
              <div style={{ fontSize: 13, color: "#8B95A1", marginBottom: 18 }}>자주 쓰는 문구를 눌러 넣으세요</div>
              <div className="pal">
                {PALETTE.map((p) => (
                  <button key={p} onClick={() => setDraftCmt(draftCmt ? draftCmt + " " + p : p)}>{p}</button>
                ))}
              </div>
              <textarea className="f-ta" value={draftCmt} onChange={(e) => setDraftCmt(e.target.value)}
                placeholder="코멘트를 적어주세요" />
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="cta ghost" style={{ flex: 1 }}
                  onClick={() => { const c = { ...comments }; delete c[sheet.k]; setComments(c); setSheet(null); }}>지우기</button>
                <button className="cta" style={{ flex: 2 }} disabled={!draftCmt.trim()}
                  onClick={() => { setComments({ ...comments, [sheet.k]: draftCmt.trim() }); setSheet(null); }}>넣기</button>
              </div>
            </div>
          </>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
      </div>
    </div>
  );
}

/* 첨삭 예시용 미리 채워진 데이터 */
const FILLED = {
  title: "겨울 이야기", author: "셰익스피어", character: "헤르미오네", scene: "3막 2장, 재판정",
  oneLine: "누명을 쓴 채 왕 앞에서 스스로를 변호한다",
  goal: "레온테스가 내 결백을 인정하게 만들고 싶다",
  other: "남편이자 재판관인 레온테스",
  obstacle: "이미 판결을 정해놓은 왕의 확신",
  tactics: ["설득한다", "다그친다", "고백한다"],
  expectation: "진실은 결국 드러난다",
  partnerWho: "레온테스 · 남편이자 나를 심판하는 왕",
  partnerDo: "처음엔 눈을 마주치다가, 중반부터 시선을 피하고, 끝에는 손을 떨며 판결문을 쥔다",
  given: "출산 직후, 감옥에서 끌려나온 새벽. 아이는 이미 버려졌다.",
  subtext: "결백을 주장하지만 실은 이 사람을 잃었다는 것을 확인하는 중이다",
  question: "마지막을 분노로 갈지 체념으로 갈지 모르겠어요",
};
