import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { color, font, radius, space } from '../theme/tokens';
import { workAnalysisApi, AnalysisType, AnalysisMeta } from '../services/api';

// 작품분석 5단계 위저드 — 작품→핵심(GOTE)→구조(타입별)→배경→검토→제출. 자동저장 + 한예종 2000자 게이지.
const STEP_LABEL = ['작품', '핵심', '구조', '배경', '검토'];
const TACTICS = ['설득한다', '압박한다', '도발한다', '애원한다', '위협한다', '회유한다', '비웃는다', '고백한다', '떠본다', '다그친다'];
const PITFALLS = ['감정부터 쓰기', '혼잣말로 처리', '발음·발성에만 집중', '상대 없이 허공 보기', '결말을 미리 알고 연기'];
const SONG_TYPES = ['I want 송', '오프닝', '차밍 송', '프로덕션 넘버', '11 o\'clock 넘버', '듀엣', '액트 피날레'];
const SPOTS = ['왼쪽 뒤', '왼쪽', '왼쪽 앞', '정면', '오른쪽 앞', '오른쪽', '오른쪽 뒤'];
const SPOT_XY = [[40, 78], [66, 52], [110, 38], [160, 32], [210, 38], [254, 52], [280, 78]];

const input = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: color.ink, fontFamily: font.m, backgroundColor: color.white } as const;
const META_KEYS = ['title', 'author', 'character', 'scene', 'targetSchool'];
let _rs = 0;
const rk = () => `r${_rs++}`;

type Any = Record<string, any>;

function Field({ label, required, value, onChange, placeholder, example, multiline, max }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void;
  placeholder?: string; example?: string; multiline?: boolean; max?: number;
}) {
  const over = !!max && (value || '').length > max;
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <Text style={{ fontFamily: font.sb, fontSize: 14, color: color.sub }}>{label}</Text>
        {required && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color.blue }} />}
      </View>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={color.faint}
        style={[input, multiline ? { minHeight: 96, textAlignVertical: 'top' } : null]} multiline={multiline}
      />
      {!!example && <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, lineHeight: 18, marginTop: 6 }}><Text style={{ fontFamily: font.b }}>예) </Text>{example}</Text>}
      {!!max && <Text style={{ fontFamily: font.r, fontSize: 11.5, color: over ? color.danger : color.faint, textAlign: 'right', marginTop: 4 }}>{(value || '').length} / {max}자</Text>}
    </View>
  );
}

function MultiChips({ label, required, options, value, onToggle, example }: {
  label: string; required?: boolean; options: string[]; value: string[]; onToggle: (v: string) => void; example?: string;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <Text style={{ fontFamily: font.sb, fontSize: 14, color: color.sub }}>{label}</Text>
        {required && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color.blue }} />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <Pressable key={o} onPress={() => onToggle(o)} style={{ borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}>
              <Text style={{ fontFamily: font.sb, fontSize: 14, color: on ? color.blue : color.sub }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!example && <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 6 }}><Text style={{ fontFamily: font.b }}>예) </Text>{example}</Text>}
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginTop: 8, marginBottom: 12 }}>{children}</Text>;
}

// 반복행(비트/인물/구간/질문)
function RowList({ rows, onChange, fields, addLabel }: {
  rows: Any[]; onChange: (r: Any[]) => void; fields: { key: string; ph: string }[]; addLabel: string;
}) {
  const set = (i: number, k: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = () => onChange([...rows, { _k: rk(), ...Object.fromEntries(fields.map((f) => [f.key, ''])) }]);
  const del = (i: number) => onChange(rows.filter((_, j) => j !== i));
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r._k ?? i} style={{ backgroundColor: color.surf, borderRadius: radius.card, padding: 14, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontFamily: font.b, fontSize: 12, color: color.blue }}>{i + 1}</Text>
            {rows.length > 1 && <Pressable onPress={() => del(i)} hitSlop={6}><Text style={{ fontFamily: font.b, fontSize: 12, color: color.sub2 }}>삭제</Text></Pressable>}
          </View>
          {fields.map((f) => (
            <TextInput key={f.key} value={r[f.key] || ''} onChangeText={(v) => set(i, f.key, v)} placeholder={f.ph} placeholderTextColor={color.faint} style={[input, { backgroundColor: color.white, marginBottom: 8 }]} />
          ))}
        </View>
      ))}
      <Pressable onPress={add} style={{ borderWidth: 1.5, borderColor: color.dashLine, borderRadius: radius.card, paddingVertical: 15, alignItems: 'center' }}>
        <Text style={{ fontFamily: font.sb, fontSize: 14.5, color: color.sub }}>+ {addLabel}</Text>
      </Pressable>
    </View>
  );
}

// 보이지 않는 상대 무대맵 — 탭으로 위치 배치 + 눈높이
function StageMap({ pos, height, onPos, onHeight }: { pos: number; height: number; onPos: (i: number) => void; onHeight: (i: number) => void }) {
  const cur = SPOT_XY[pos] ?? SPOT_XY[3];
  return (
    <View style={{ backgroundColor: color.surf, borderRadius: radius.card, padding: 16, marginBottom: 18 }}>
      <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, textAlign: 'center', marginBottom: 6 }}>상대가 서 있는 자리를 찍어보세요</Text>
      <Svg viewBox="0 0 320 150" width="100%" height={150}>
        <Path d="M20 130 Q160 -10 300 130" fill="none" stroke={color.inputLine} strokeWidth={1.5} strokeDasharray="4 5" />
        <Line x1={160} y1={118} x2={cur[0]} y2={cur[1]} stroke={color.blue} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.7} />
        <Circle cx={160} cy={122} r={9} fill={color.ink} />
        <SvgText x={160} y={145} textAnchor="middle" fontSize={11} fill={color.sub2}>나</SvgText>
        {SPOT_XY.map(([x, y], i) => (
          <React.Fragment key={i}>
            <Circle cx={x} cy={y} r={18} fill="transparent" onPress={() => onPos(i)} />
            <Circle cx={x} cy={y} r={i === pos ? 9 : 5.5} fill={i === pos ? color.blue : color.dashLine} onPress={() => onPos(i)} />
          </React.Fragment>
        ))}
      </Svg>
      <Text style={{ fontFamily: font.b, fontSize: 14, color: color.blue, textAlign: 'center', marginTop: 4 }}>{SPOTS[pos] ?? '정면'}</Text>
      <View style={{ flexDirection: 'row', backgroundColor: color.white, borderRadius: 12, padding: 4, gap: 4, marginTop: 14 }}>
        {['눈높이 아래', '같은 눈높이', '눈높이 위'].map((h, i) => (
          <Pressable key={h} onPress={() => onHeight(i)} style={{ flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center', backgroundColor: height === i ? color.blueBg : 'transparent' }}>
            <Text style={{ fontFamily: font.sb, fontSize: 13, color: height === i ? color.blue : color.sub }}>{h}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function WorkAnalysisWizardScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const paramId: string | undefined = route.params?.id;
  const paramType: AnalysisType = route.params?.type ?? 'monologue';

  const [type, setType] = useState<AnalysisType>(paramType);
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState<AnalysisMeta>({ title: '', author: '', character: '', scene: '', targetSchool: '' });
  const [p, setP] = useState<Any>({ tactics: [], pitfalls: [], partnerPos: 3, partnerHeight: 1, beats: [{ _k: rk() }], relations: [{ _k: rk() }], qa: [{ _k: rk() }], musicMap: [{ _k: rk() }] });
  const [analysisId, setAnalysisId] = useState<string | undefined>(paramId);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loading, setLoading] = useState(!!paramId);
  const [submitting, setSubmitting] = useState(false);
  const idRef = useRef<string | undefined>(paramId);
  const dirtyRef = useRef(false);

  const setM = (k: keyof AnalysisMeta, v: string) => { setMeta((m) => ({ ...m, [k]: v })); dirtyRef.current = true; };
  const set = (k: string, v: any) => { setP((s) => ({ ...s, [k]: v })); dirtyRef.current = true; };
  const toggle = (k: string, v: string) => setP((s) => { const arr: string[] = s[k] || []; return { ...s, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] }; });

  // 기존 초안 불러오기
  useEffect(() => {
    if (!paramId) return;
    (async () => {
      try {
        const d = await workAnalysisApi.detail(paramId);
        setType(d.type);
        setMeta({ title: d.title || '', author: d.author || '', character: d.character || '', scene: d.scene || '', targetSchool: d.targetSchool || '' });
        const draft = [...d.versions].reverse().find((v) => v.status === 'draft') || d.versions[d.versions.length - 1];
        if (draft?.payload) setP((base) => ({ ...base, ...draft.payload }));
      } catch (e: any) { Alert.alert('불러오기 실패', e?.message || '분석을 불러오지 못했어요.'); }
      finally { setLoading(false); }
    })();
  }, [paramId]);

  // 서술 글자수(한예종 2000자 게이지)
  const TEXT_KEYS = ['oneLine', 'goal', 'other', 'obstacle', 'expectation', 'given', 'subtext', 'theme', 'structure', 'intent', 'why', 'trigger', 'change', 'vocal', 'momentBefore', 'opposites', 'partnerWho', 'partnerDo', 'catchPoint'];
  const totalChars = (() => {
    let n = 0;
    TEXT_KEYS.forEach((k) => { if (typeof p[k] === 'string') n += p[k].length; });
    (['beats', 'musicMap', 'relations', 'qa'] as const).forEach((rowKey) => {
      (p[rowKey] || []).forEach((r: Any) => Object.entries(r).forEach(([k, v]) => { if (k !== '_k' && typeof v === 'string') n += (v as string).length; }));
    });
    return n;
  })();

  const cleanPayload = useCallback(() => {
    // _k(로컬 키) 제거해 서버로
    const out: Any = {};
    Object.entries(p).forEach(([k, v]) => {
      if (Array.isArray(v)) out[k] = v.map((r) => (r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).filter(([kk]) => kk !== '_k')) : r));
      else out[k] = v;
    });
    return out;
  }, [p]);

  // 자동저장(디바운스)
  useEffect(() => {
    if (loading) return;
    if (!dirtyRef.current) return;
    if (!(meta.title || '').trim()) return;   // 제목 없으면 생성 보류(백엔드 필수)
    const t = setTimeout(async () => {
      setSaved('saving');
      try {
        if (!idRef.current) {
          const r = await workAnalysisApi.create({ type, title: (meta.title || '').trim(), author: meta.author, character: meta.character, scene: meta.scene, targetSchool: meta.targetSchool, payload: cleanPayload() });
          idRef.current = r.id; setAnalysisId(r.id);
        } else {
          await workAnalysisApi.saveVersion(idRef.current, cleanPayload(), meta);
        }
        dirtyRef.current = false;
        setSaved('saved');
      } catch { setSaved('idle'); }
    }, 800);
    return () => clearTimeout(t);
  }, [p, meta, loading, type, cleanPayload]);

  const canNext = (() => {
    if (step === 0) return !!(meta.title || '').trim();
    if (step === 1) return !!(p.oneLine && p.goal && p.other && p.obstacle && (p.tactics || []).length);
    if (step === 2) {
      if (type === 'monologue') return !!p.partnerWho;
      if (type === 'play') return !!p.theme;
      return !!(p.songType && p.why);
    }
    return true;
  })();

  const flushSave = async () => {
    if (!(meta.title || '').trim()) return;
    if (!idRef.current) {
      const r = await workAnalysisApi.create({ type, title: (meta.title || '').trim(), author: meta.author, character: meta.character, scene: meta.scene, targetSchool: meta.targetSchool, payload: cleanPayload() });
      idRef.current = r.id; setAnalysisId(r.id);
    } else {
      await workAnalysisApi.saveVersion(idRef.current, cleanPayload(), meta);
    }
    dirtyRef.current = false;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await flushSave();
      if (!idRef.current) throw new Error('먼저 내용을 채워주세요.');
      await workAnalysisApi.submit(idRef.current);
      qc.invalidateQueries({ queryKey: ['workAnalyses'] });
      qc.invalidateQueries({ queryKey: ['inbox'] });
      nav.replace('workAnalysisFeedback', { id: idRef.current });
    } catch (e: any) { Alert.alert('제출 실패', e?.message || '제출하지 못했어요.'); }
    finally { setSubmitting(false); }
  };

  // ── 단계 본문 ──
  const stepWork = (
    <>
      <Text style={styles.title}>어떤 작품인가요?</Text>
      <Text style={styles.sub}>나중에 목록에서 이 이름으로 찾습니다.</Text>
      <Field label="작품명" required value={meta.title || ''} onChange={(v) => setM('title', v)} placeholder="작품 제목" example="안티고네" />
      <Field label="작가" value={meta.author || ''} onChange={(v) => setM('author', v)} placeholder="작가 이름" example="소포클레스" />
      <Field label={type === 'musical' ? '넘버명 · 배역' : '배역'} required={type !== 'musical'} value={meta.character || ''} onChange={(v) => setM('character', v)} placeholder={type === 'musical' ? '넘버 / 배역' : '내가 맡은 인물'} example={type === 'musical' ? 'Defying Gravity / 엘파바' : '안티고네'} />
      <Field label="장면 위치" value={meta.scene || ''} onChange={(v) => setM('scene', v)} placeholder="몇 막 몇 장, 어떤 장면" example="1막, 매장을 결심하는 장면" />
      <Field label="대비 대학(선택)" value={meta.targetSchool || ''} onChange={(v) => setM('targetSchool', v)} placeholder="예: 한예종" />
    </>
  );

  const stepGote = (
    <>
      <Text style={styles.title}>이 장면에서{'\n'}나는 무엇을 원하나요?</Text>
      <Text style={styles.sub}>여기 다섯 칸이 분석의 뼈대입니다. 짧고 분명하게.</Text>
      <Field label="한 줄 상황" required value={p.oneLine || ''} onChange={(v) => set('oneLine', v)} max={100} placeholder="무슨 일이 일어나는지 한 문장" example="국법을 어기고 오라비를 묻겠다고 언니에게 선언한다" />
      <Field label="목표" required value={p.goal || ''} onChange={(v) => set('goal', v)} max={80} placeholder="'~하고 싶다'로 끝나게" example="언니가 나와 함께 오라비를 묻도록 만들고 싶다" />
      <Field label="상대" required value={p.other || ''} onChange={(v) => set('other', v)} max={60} placeholder="누구에게 원하나요" example="언니 이스메네, 그리고 나를 지켜보는 신들" />
      <Field label="장애물" required value={p.obstacle || ''} onChange={(v) => set('obstacle', v)} max={80} placeholder="무엇이 막고 있나요" example="크레온의 국법과 언니의 두려움" />
      <MultiChips label="전술" required options={TACTICS} value={p.tactics || []} onToggle={(v) => toggle('tactics', v)} example="원하는 걸 얻으려는 행동을 동사로 2~4개" />
      <Field label="기대" value={p.expectation || ''} onChange={(v) => set('expectation', v)} max={80} placeholder="나는 이길 거라 믿나요?" example="옳은 일이니 언니도 결국 따라올 것이다" />
    </>
  );

  const stepMono = (
    <>
      <Text style={styles.title}>없는 상대를{'\n'}세워봅시다</Text>
      <Text style={styles.sub}>독백 실기에서 가장 크게 갈리는 지점입니다.</Text>
      <SectionLabel>보이지 않는 상대</SectionLabel>
      <Field label="상대는 누구인가요" required value={p.partnerWho || ''} onChange={(v) => set('partnerWho', v)} placeholder="이름과 관계" example="언니 이스메네 · 하나 남은 혈육" />
      <StageMap pos={p.partnerPos ?? 3} height={p.partnerHeight ?? 1} onPos={(i) => set('partnerPos', i)} onHeight={(i) => set('partnerHeight', i)} />
      <Field label="독백 동안 상대는 무엇을 하나요" multiline value={p.partnerDo || ''} onChange={(v) => set('partnerDo', v)} placeholder="말없이 듣기만 하는 게 아닙니다" example="처음엔 말리려 다가오다가, 중반에 고개를 돌리고, 끝에는 뒷걸음질친다" />
      <Field label="받기 포인트" value={p.catchPoint || ''} onChange={(v) => set('catchPoint', v)} placeholder="상대 반응이 나를 바꾸는 순간" example="'너도 알잖아' 뒤에 언니가 눈을 피할 때" />
      <SectionLabel>비트 나누기</SectionLabel>
      <RowList rows={p.beats || []} onChange={(r) => set('beats', r)} addLabel="비트 추가" fields={[{ key: 'range', ph: '대사 구간 (예: 첫 줄 ~ "들으려 하지 않는구나")' }, { key: 'shift', ph: '여기서 목표가 어떻게 바뀌나' }, { key: 'tactic', ph: '쓰는 전술 (동사)' }]} />
      <SectionLabel>더 파고들기 (선택)</SectionLabel>
      <Field label="직전의 순간" value={p.momentBefore || ''} onChange={(v) => set('momentBefore', v)} placeholder="첫 대사 0.5초 전에 무슨 일이" example="파수병의 북소리를 듣고 몸을 돌린 직후" />
      <Field label="대극" value={p.opposites || ''} onChange={(v) => set('opposites', v)} placeholder="톤이 뒤집히는 지점" example="설득하다 갑자기 언니를 놓아버리는 순간" />
      <MultiChips label="내가 자주 빠지는 함정" options={PITFALLS} value={p.pitfalls || []} onToggle={(v) => toggle('pitfalls', v)} example="선생님이 여기를 먼저 봐줍니다" />
    </>
  );

  const stepPlay = (
    <>
      <Text style={styles.title}>작품 전체를{'\n'}꿰어봅시다</Text>
      <Text style={styles.sub}>구술 면접에서 그대로 나오는 항목들입니다.</Text>
      <Field label="주제" required value={p.theme || ''} onChange={(v) => set('theme', v)} max={100} placeholder="한 문장으로" example="국가의 법과 인간의 도리가 부딪칠 때 무엇을 택할 것인가" />
      <Field label="구조" multiline value={p.structure || ''} onChange={(v) => set('structure', v)} placeholder="발단-전개-위기-절정-결말, 발견과 급전이 어디인지" example="크레온이 아들의 시신을 안고 돌아오는 지점이 급전" />
      <SectionLabel>인물 관계</SectionLabel>
      <RowList rows={p.relations || []} onChange={(r) => set('relations', r)} addLabel="인물 추가" fields={[{ key: 'name', ph: '이름' }, { key: 'relation', ph: '나와의 관계' }, { key: 'desire', ph: '그 인물이 원하는 것' }]} />
      <SectionLabel>배경과 의도</SectionLabel>
      <Field label="시대·사회 배경" value={p.period || ''} onChange={(v) => set('period', v)} placeholder="언제, 어떤 세계인가" example="테베, 내전 직후 계엄 상태" />
      <Field label="작가의 의도" multiline value={p.intent || ''} onChange={(v) => set('intent', v)} placeholder="작가는 왜 이 이야기를 썼을까" />
      <SectionLabel>구술 예상 질문</SectionLabel>
      <RowList rows={p.qa || []} onChange={(r) => set('qa', r)} addLabel="질문 추가" fields={[{ key: 'q', ph: '예상 질문' }, { key: 'a', ph: '내 대답 (30초 분량)' }]} />
    </>
  );

  const stepMusical = (
    <>
      <Text style={styles.title}>왜 지금{'\n'}말이 아니라 노래인가요?</Text>
      <Text style={styles.sub}>넘버 분석은 이 질문 하나로 시작합니다.</Text>
      <MultiChips label="넘버 유형" required options={SONG_TYPES} value={p.songType ? [p.songType] : []} onToggle={(v) => set('songType', p.songType === v ? '' : v)} example="주인공이 욕망을 처음 선언하면 I want 송, 종반 자각이면 11 o'clock 넘버" />
      <Field label="이 넘버의 극적 기능" required multiline value={p.why || ''} onChange={(v) => set('why', v)} placeholder="말로는 안 되고 노래여야 하는 이유" example="억눌러온 것이 한계를 넘어 말의 그릇을 깨고 나온다" />
      <Field label="직전 사건" value={p.trigger || ''} onChange={(v) => set('trigger', v)} placeholder="무엇이 이 노래를 터뜨렸나" />
      <SectionLabel>음악과 심리 매핑</SectionLabel>
      <RowList rows={p.musicMap || []} onChange={(r) => set('musicMap', r)} addLabel="구간 추가" fields={[{ key: 'sec', ph: '음악 구간 (verse / 조성 전환 / 버튼 등)' }, { key: 'psych', ph: '그때 내 마음이 어떻게 움직이나' }]} />
      <SectionLabel>노래가 끝났을 때</SectionLabel>
      <Field label="시작과 끝의 변화" multiline value={p.change || ''} onChange={(v) => set('change', v)} placeholder="이 넘버 전과 후의 나는 어떻게 다른가" />
      <Field label="창법을 그렇게 고른 이유" value={p.vocal || ''} onChange={(v) => set('vocal', v)} placeholder="벨팅 / 레가토 / 스피치싱잉" example="후렴만 벨팅으로 올려 결심의 순간을 표시한다" />
    </>
  );

  const stepContext = (
    <>
      <Text style={styles.title}>배경과 속마음을{'\n'}채워주세요</Text>
      <Text style={styles.sub}>여기부터는 선택이지만, 첨삭의 깊이가 달라집니다.</Text>
      <Field label="주어진 상황" multiline value={p.given || ''} onChange={(v) => set('given', v)} max={400} placeholder="시대, 장소, 직전 사건, 내 처지" example="전쟁이 끝난 다음 날 새벽. 오라비의 시신은 아직 성 밖에 있다." />
      <Field label="서브텍스트" multiline value={p.subtext || ''} onChange={(v) => set('subtext', v)} max={300} placeholder="말과 다른 진심" example="말로는 언니를 설득하지만, 속으로는 이미 혼자 갈 것을 알고 작별하고 있다" />
      <Field label="선생님께 묻고 싶은 것" value={p.question || ''} onChange={(v) => set('question', v)} max={120} placeholder="확신이 안 서는 부분" example="마지막을 분노로 갈지 체념으로 갈지 모르겠어요" />
    </>
  );

  const RvRow = ({ l, v }: { l: string; v?: string }) => (
    <View style={{ backgroundColor: color.surf, borderRadius: radius.card, padding: 16, marginBottom: 10 }}>
      <Text style={{ fontFamily: font.b, fontSize: 12, color: color.sub, marginBottom: 6 }}>{l}</Text>
      <Text style={{ fontFamily: font.r, fontSize: 15, lineHeight: 24, color: v ? color.ink : color.faint }}>{v || '아직 비어 있어요'}</Text>
    </View>
  );

  const pct = Math.min(100, (totalChars / 2000) * 100);
  const stepReview = (
    <>
      <Text style={styles.title}>내고 나면{'\n'}선생님께 바로 갑니다</Text>
      <Text style={styles.sub}>낸 뒤에도 고칠 수 있어요. 고치면 새 버전으로 저장됩니다.</Text>
      <View style={{ backgroundColor: color.blueBg, borderRadius: radius.card, padding: 16, marginBottom: 12 }}>
        <Text style={{ fontFamily: font.b, fontSize: 12, color: color.blue, marginBottom: 8 }}>한예종 2차 글쓰기 기준</Text>
        <View style={{ height: 8, backgroundColor: color.white, borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
          <View style={{ height: 8, width: `${pct}%`, backgroundColor: pct > 100 ? color.danger : color.blue }} />
        </View>
        <Text style={{ fontFamily: font.r, fontSize: 13, color: color.sub }}>지금 <Text style={{ fontFamily: font.b, color: color.ink }}>{totalChars}자</Text> · 시험은 원고지 2,000자 이내</Text>
      </View>
      <RvRow l="작품" v={[meta.title, meta.character].filter(Boolean).join(' · ')} />
      <RvRow l="한 줄 상황" v={p.oneLine} />
      <RvRow l="목표" v={p.goal} />
      <RvRow l="상대" v={p.other} />
      <RvRow l="장애물" v={p.obstacle} />
      <RvRow l="전술" v={(p.tactics || []).join(' · ')} />
      {type === 'monologue' && <RvRow l="보이지 않는 상대" v={p.partnerWho} />}
      {type === 'play' && <RvRow l="주제" v={p.theme} />}
      {type === 'musical' && <RvRow l="넘버 유형" v={p.songType} />}
      {!!p.question && <RvRow l="선생님께 묻고 싶은 것" v={p.question} />}
    </>
  );

  const body = loading ? (
    <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
  ) : step === 0 ? stepWork
    : step === 1 ? stepGote
    : step === 2 ? (type === 'monologue' ? stepMono : type === 'play' ? stepPlay : stepMusical)
    : step === 3 ? stepContext
    : stepReview;

  return (
    <Screen edges={['top']}>
      <BackHeader
        title={STEP_LABEL[step]}
        onBack={() => (step === 0 ? nav.goBack() : setStep((s) => s - 1))}
        right={<Text style={{ fontFamily: font.sb, fontSize: 13, color: saved === 'saved' ? color.success : color.sub2, paddingRight: 8 }}>{saved === 'saving' ? '저장 중…' : saved === 'saved' ? '저장됨' : ''}</Text>}
      />
      <View style={{ height: 3, backgroundColor: color.inputLine }}>
        <View style={{ height: 3, width: `${((step + 1) / 5) * 100}%`, backgroundColor: color.blue }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <Scroll contentStyle={{ paddingHorizontal: space.screenX, paddingTop: 12, paddingBottom: 40 }}>{body}</Scroll>
        <View style={{ padding: space.screenX, paddingBottom: 24 }}>
          <Pressable
            onPress={() => (step < 4 ? (canNext && setStep((s) => s + 1)) : (!submitting && submit()))}
            disabled={(step < 4 && !canNext) || submitting}
            style={{ height: 54, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: (step < 4 && !canNext) || submitting ? color.surf : color.blue }}
          >
            {submitting ? <ActivityIndicator color={color.sub} /> : (
              <Text style={{ fontFamily: font.b, fontSize: 16, color: (step < 4 && !canNext) ? color.sub2 : color.white }}>
                {step < 4 ? (canNext ? '다음' : '표시된 칸을 채워주세요') : '선생님께 내기'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = {
  title: { fontFamily: font.xb, fontSize: 22, lineHeight: 30, color: color.ink, marginTop: 8, marginBottom: 8 } as const,
  sub: { fontFamily: font.r, fontSize: 14, lineHeight: 21, color: color.sub, marginBottom: 20 } as const,
};
