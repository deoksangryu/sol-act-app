import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { aiApi, SceneTurn, API_URL, sceneApi, SavedSceneSummary, voicesApi, SceneVoice } from '../services/api';

// AI 상대역 연습 — 학생이 자기 대사 + '상대 등장' 자리 표시 → AI가 상대 대사 생성 + 성별×나이 맞춤 TTS.
// 연습(타이머식): 내 대사마다 정해둔 시간이 지나면 상대 대사 자동 재생 → 상대 대사 끝나면 다음 내 대사 타이머 시작.
type EditTurn = { key: string; speaker: '나' | '상대'; text: string; hint: string; sec?: number };
let _seq = 0;
const mk = (speaker: '나' | '상대', text = '', hint = ''): EditTurn => ({ key: `t${_seq++}`, speaker, text, hint });
const STARTER: EditTurn[] = [mk('나', '아무 일도 아닙니다.'), mk('상대'), mk('나', '그가 제게 말했죠. 다 끝났다고.')];
const absUrl = (u?: string) => (u && u.startsWith('/') ? `${API_URL}${u}` : u || '');
// 대사 길이로 기본 시간(초) 추정 — 연기 호흡 고려해 넉넉히
const autoSec = (t?: string) => Math.max(3, Math.min(40, Math.round((t || '').trim().length / 3)));
const clampSec = (n: number) => Math.max(1, Math.min(60, n));

export function ScenePartnerScreen() {
  const nav = useNavigation<any>();
  const [mode, setMode] = useState<'edit' | 'practice'>('edit');
  const [turns, setTurns] = useState<EditTurn[]>(STARTER);
  const [partner, setPartner] = useState('');
  const [situation, setSituation] = useState('');
  const [voices, setVoices] = useState<SceneVoice[]>([]);
  const [selVoice, setSelVoice] = useState('');          // '' = AI 자동/랜덤
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<AudioPlayer | null>(null);
  const [step, setStep] = useState(1);          // 작성 위저드 1·2·3
  const [libOpen, setLibOpen] = useState(false); // 저장 장면 다이얼로그
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SceneTurn[] | null>(null);
  const [reveal, setReveal] = useState(false);
  const [savedScenes, setSavedScenes] = useState<SavedSceneSummary[]>([]);
  const [quota, setQuota] = useState<{ limit: number; remaining: number } | null>(null);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'mine' | 'partner' | 'done'>('idle');
  const [cursor, setCursor] = useState(-1);
  const [remain, setRemain] = useState(0);   // 내 대사 남은 시간(초)
  const [total, setTotal] = useState(0);      // 내 대사 총 시간(초)

  const idxRef = useRef(0);
  const runRef = useRef(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secListRef = useRef<number[]>([]);    // result index별 내 대사 시간(상대=0)

  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }, []);
  useEffect(() => () => { stopAll(); }, []);

  const refreshLib = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([sceneApi.quota(), sceneApi.list()]);
      setQuota({ limit: q.limit, remaining: q.remaining }); setSavedScenes(s);
    } catch { /* 목록 없어도 화면은 동작 */ }
  }, []);
  useEffect(() => { refreshLib(); }, [refreshLib]);

  const loadScene = async (id: string) => {
    stopAll(); setErr(null); setLibOpen(false);
    try {
      const sc = await sceneApi.get(id);
      secListRef.current = sc.turns.map((t) => (t.speaker === '나' ? clampSec(t.sec ?? autoSec(t.text)) : 0));
      setResult(sc.turns); setReveal(false); setPhase('idle'); setCursor(-1); setRunning(false); setPartner(sc.partnerHint || ''); setMode('practice');
    } catch (e: any) { setErr(e?.message || '장면을 불러오지 못했어요.'); }
  };
  const deleteScene = async (id: string) => { try { await sceneApi.remove(id); refreshLib(); } catch {} };

  useEffect(() => { voicesApi.list().then(setVoices).catch(() => {}); }, []);
  const stopPreview = () => { if (previewRef.current) { try { previewRef.current.remove(); } catch {} previewRef.current = null; } setPreviewId(null); };
  const playPreview = (v: SceneVoice) => {
    stopPreview();
    if (previewId === v.id) return;
    try {
      const p = createAudioPlayer({ uri: absUrl(v.sampleUrl), headers: { 'ngrok-skip-browser-warning': 'true' } });
      previewRef.current = p; setPreviewId(v.id);
      const sub = p.addListener('playbackStatusUpdate', (s: any) => { if (s?.didJustFinish) { try { sub.remove(); } catch {} stopPreview(); } });
      p.play();
    } catch { stopPreview(); }
  };

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  const stopAll = () => {
    runRef.current = false; clearTick();
    try { Speech.stop(); } catch {}
    if (playerRef.current) { try { playerRef.current.remove(); } catch {} playerRef.current = null; }
    if (previewRef.current) { try { previewRef.current.remove(); } catch {} previewRef.current = null; }
    setPreviewId(null);
  };

  const startMyTimer = (sec: number) => {
    const t = Math.max(1, sec); setTotal(t); setRemain(t);
    const startedAt = Date.now();
    clearTick();
    tickRef.current = setInterval(() => {
      const rem = Math.max(0, t - (Date.now() - startedAt) / 1000);
      setRemain(rem);
      if (rem <= 0) advance();
    }, 100);
  };

  const playPartner = (t: SceneTurn) => {
    const url = absUrl(t.audioUrl);
    if (url) {
      try {
        const player = createAudioPlayer({ uri: url, headers: { 'ngrok-skip-browser-warning': 'true' } });
        playerRef.current = player;
        const sub = player.addListener('playbackStatusUpdate', (s: any) => { if (s?.didJustFinish) { try { sub.remove(); } catch {} advance(); } });
        player.play();
        return;
      } catch { /* 폴백 */ }
    }
    Speech.speak(t.text || '', { language: 'ko-KR', onDone: () => advance(), onError: () => advance() });
  };

  const runStep = () => {
    if (!runRef.current) return;
    const i = idxRef.current;
    const list = result || [];
    if (i >= list.length) { runRef.current = false; setRunning(false); setPhase('done'); setCursor(-1); setRemain(0); setTotal(0); return; }
    setCursor(i);
    const t = list[i];
    if (t.speaker === '나') { setPhase('mine'); startMyTimer(secListRef.current[i] || autoSec(t.text)); }
    else { setPhase('partner'); setRemain(0); setTotal(0); playPartner(t); }
  };

  const advance = () => {
    clearTick();
    try { Speech.stop(); } catch {}
    if (playerRef.current) { try { playerRef.current.remove(); } catch {} playerRef.current = null; }
    idxRef.current += 1; runStep();
  };

  const startPractice = () => { stopAll(); idxRef.current = 0; runRef.current = true; setRunning(true); setReveal(false); runStep(); };
  const stopPractice = () => { stopAll(); setRunning(false); setPhase('idle'); setCursor(-1); setRemain(0); setTotal(0); };

  const setText = (key: string, text: string) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, text } : t)));
  const setHint = (key: string, hint: string) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, hint } : t)));
  const bumpSec = (key: string, d: number) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, sec: clampSec((t.sec ?? autoSec(t.text)) + d) } : t)));
  const removeTurn = (key: string) => setTurns((ts) => ts.filter((t) => t.key !== key));

  const generate = useCallback(async () => {
    stopAll();
    // 하이브리드: 상대 자리에 대사를 쓰면 그대로 사용, 비우면 AI가 채움(느낌 힌트 선택).
    const payload: SceneTurn[] = turns.map((t) => {
      if (t.speaker === '상대') return { speaker: '상대', text: t.text.trim() || undefined, hint: t.hint.trim() || undefined };
      return { speaker: '나', text: t.text.trim() };
    });
    if (payload.filter((t) => t.speaker === '나' && (t.text || '').length).length < 1) { setErr('내 대사를 한 줄 이상 입력해주세요.'); return; }
    if (payload.filter((t) => t.speaker === '상대').length < 1) { setErr('상대가 등장하는 지점을 한 곳 이상 추가해주세요.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await aiApi.scenePartner(payload, partner.trim(), { situation: situation.trim(), voiceId: selVoice });
      if (!r.ok) { setErr(r.message || 'AI 상대역을 만들지 못했어요. 잠시 후 다시 시도해주세요.'); return; }
      // 내 대사 시간(초)을 result 순서에 맞춰 저장 (payload=turns=result 동일 순서)
      secListRef.current = turns.map((t) => (t.speaker === '나' ? clampSec(t.sec ?? autoSec(t.text)) : 0));
      if (typeof r.remaining === 'number' && typeof r.limit === 'number') setQuota({ limit: r.limit, remaining: r.remaining });
      refreshLib();
      setResult(r.turns); setReveal(false); setPhase('idle'); setCursor(-1); setRunning(false); setMode('practice');
    } catch (e: any) {
      setErr(e?.message || 'AI 상대역을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally { setBusy(false); }
  }, [turns, partner, situation, selVoice, refreshLib]);

  const input = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: color.ink, fontFamily: font.m, backgroundColor: color.white } as const;

  const ageK = (a: string) => (a === 'young' ? '젊음' : a === 'old' ? '노년' : '중년');

  const scriptBlock = (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: font.m, fontSize: 12.5, lineHeight: 19, color: color.sub }}>내 대사를 쓰고, 상대가 말하는 지점에 🎭 상대 자리를 넣으세요. 상대 대사를 <Text style={{ fontFamily: font.b, color: color.ink }}>직접 쓰면 그대로</Text>, <Text style={{ fontFamily: font.b, color: color.ink }}>비우면 AI가</Text> 장면 맥락에 맞게 채워줘요. 각 내 대사엔 연기 시간(초)을.</Text>
      {turns.map((t) => {
        const filled = t.speaker === '상대' && !!(t.text || '').trim();
        return (
        <View key={t.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          {t.speaker === '나' ? (
            <>
              <View style={{ width: 34, paddingTop: 12 }}><Text style={{ fontFamily: font.b, fontSize: 13, color: color.ink }}>나</Text></View>
              <View style={{ flex: 1, gap: 6 }}>
                <TextInput value={t.text} onChangeText={(v) => setText(t.key, v)} placeholder="내 대사" placeholderTextColor={color.faint} style={input} multiline />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: font.m, fontSize: 12.5, color: color.sub2 }}>⏱ 연기 시간</Text>
                  <Pressable onPress={() => bumpSec(t.key, -1)} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: color.inputLine, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.ink }}>–</Text></Pressable>
                  <Text style={{ fontFamily: font.b, fontSize: 14, color: color.blue, minWidth: 42, textAlign: 'center' }}>{t.sec ?? autoSec(t.text)}초</Text>
                  <Pressable onPress={() => bumpSec(t.key, 1)} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: color.inputLine, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.ink }}>+</Text></Pressable>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={{ width: 34, paddingTop: 12 }}><Text style={{ fontFamily: font.b, fontSize: 15 }}>🎭</Text></View>
              <View style={{ flex: 1, borderWidth: 1, borderColor: color.requestLine, borderRadius: radius.card, backgroundColor: color.amberBg, paddingHorizontal: 12, paddingVertical: 10, gap: 7 }}>
                <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.warn }}>상대 대사 · {filled ? '직접 씀 ✍️' : '비움 → AI가 채워요 🤖'}</Text>
                <TextInput value={t.text} onChangeText={(v) => setText(t.key, v)} placeholder="상대 대사를 직접 쓰거나, 비워두면 AI가 채워요" placeholderTextColor={color.faint} style={{ fontFamily: font.m, fontSize: 14, color: color.ink, padding: 0 }} multiline />
                {!filled && (
                  <TextInput value={t.hint} onChangeText={(v) => setHint(t.key, v)} placeholder="AI 힌트(선택) 예: 다그치듯, 애원하며" placeholderTextColor={color.faint} style={{ fontFamily: font.m, fontSize: 12.5, color: color.sub, padding: 0, borderTopWidth: 1, borderTopColor: color.requestLine, paddingTop: 7 }} />
                )}
              </View>
            </>
          )}
          <Pressable onPress={() => removeTurn(t.key)} hitSlop={8} style={{ paddingTop: 12 }}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.faint }}>✕</Text></Pressable>
        </View>
      );
      })}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
        <Pressable onPress={() => setTurns((ts) => [...ts, mk('나')])} style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.ink }}>+ 내 대사</Text></Pressable>
        <Pressable onPress={() => setTurns((ts) => [...ts, mk('상대')])} style={{ flex: 1, borderWidth: 1, borderColor: color.requestLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center', backgroundColor: color.amberBg }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.warn }}>+ 🎭 상대 등장</Text></Pressable>
      </View>
    </View>
  );

  const setupBlock = (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 6 }}>상대는 누구인가요? (구체적일수록 좋아요)</Text>
        <TextInput value={partner} onChangeText={setPartner} placeholder="예: 병들어 힘없지만 위엄 있는 노년의 왕" placeholderTextColor={color.faint} style={input} maxLength={80} />
      </View>
      <View>
        <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 6 }}>이 장면은 어떤 상황인가요? ⭐</Text>
        <Text style={{ fontFamily: font.r, fontSize: 12, lineHeight: 18, color: color.sub2, marginBottom: 6 }}>관계·무슨 일이 벌어지는지·감정의 흐름을 적을수록 대사가 정확해져요.</Text>
        <TextInput value={situation} onChangeText={setSituation} placeholder="예: 유학을 반대하던 병든 엄마가 끝내 딸을 위해 보내주기로 하는 장면" placeholderTextColor={color.faint} style={[input, { minHeight: 100, textAlignVertical: 'top' }]} multiline maxLength={500} />
      </View>
    </View>
  );

  const voiceBlock = (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: font.m, fontSize: 12.5, lineHeight: 19, color: color.sub }}>AI가 상대 인물에 맞게 목소리를 골라줘요. 마음에 안 들면 ▶로 들어보고 직접 고르세요 (미리듣기 무료).</Text>
      <View style={{ gap: 5 }}>
        <Pressable onPress={() => setSelVoice('')} style={{ borderWidth: 1, borderColor: selVoice === '' ? color.blue : color.inputLine, backgroundColor: selVoice === '' ? color.blueBg : color.white, borderRadius: radius.card, paddingVertical: 11, paddingHorizontal: 12 }}>
          <Text style={{ fontFamily: font.b, fontSize: 13, color: selVoice === '' ? color.blue : color.ink }}>🤖 AI 자동 추천{selVoice === '' ? ' · 선택됨 ✓' : ''}</Text>
        </Pressable>
        {voices.map((v) => {
          const on = selVoice === v.id;
          return (
            <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: radius.card, paddingVertical: 8, paddingLeft: 8, paddingRight: 12 }}>
              <Pressable onPress={() => playPreview(v)} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: previewId === v.id ? color.blue : color.surf, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14, color: previewId === v.id ? color.white : color.ink }}>{previewId === v.id ? '■' : '▶'}</Text></Pressable>
              <Pressable onPress={() => setSelVoice(v.id)} style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.ink }}>{v.traits}</Text>
                <Text style={{ fontFamily: font.r, fontSize: 11.5, color: color.sub2, marginTop: 1 }}>{v.gender} · {ageK(v.age)}</Text>
              </Pressable>
              {on && <Text style={{ fontFamily: font.b, fontSize: 12, color: color.blue }}>선택됨 ✓</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderEdit = () => {
    const steps = ['상대·상황', '장면 대본', '상대 목소리'];
    const key: 'setup' | 'script' | 'voice' = step === 1 ? 'setup' : step === 2 ? 'script' : 'voice';
    const isLast = step >= steps.length;
    const over = !!quota && quota.remaining <= 0;
    const naOk = turns.some((t) => t.speaker === '나' && (t.text || '').trim());
    const slotOk = turns.some((t) => t.speaker === '상대');
    const next = () => { setErr(null); if (key === 'script' && !(naOk && slotOk)) { setErr('내 대사와 상대 등장 지점을 넣어주세요.'); return; } setStep((s) => Math.min(steps.length, s + 1)); };
    const prev = () => { setErr(null); stopPreview(); setStep((s) => Math.max(1, s - 1)); };

    return (
      <View style={{ paddingHorizontal: space.screenX, gap: 12, marginTop: 8 }}>
        {/* 상단: 스텝 인디케이터 + 불러오기 */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, flex: 1, flexWrap: 'wrap' }}>
            {steps.map((label, i) => {
              const n = i + 1; const on = n === step; const done = n < step;
              return (
                <Pressable key={label} onPress={() => done && setStep(n)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: on ? color.blue : done ? color.blueBg : color.inputLine, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 11, color: on ? color.white : done ? color.blue : color.sub2 }}>{done ? '✓' : n}</Text></View>
                  <Text style={{ fontFamily: on ? font.b : font.m, fontSize: 12, color: on ? color.ink : color.sub2 }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={() => { stopPreview(); setLibOpen(true); }} hitSlop={6} style={{ borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingHorizontal: 11, paddingVertical: 7 }}><Text style={{ fontFamily: font.b, fontSize: 12, color: color.ink }}>📂 불러오기{savedScenes.length ? ` ${savedScenes.length}` : ''}</Text></Pressable>
        </View>

        {key === 'setup' && setupBlock}
        {key === 'script' && scriptBlock}
        {key === 'voice' && voiceBlock}

        {err && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.danger, textAlign: 'center' }}>{err}</Text>}

        {/* 네비 / 만들기 */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          {step > 1 && <Pressable onPress={prev} style={{ paddingHorizontal: 20, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.ink }}>← 이전</Text></Pressable>}
          {!isLast ? (
            <Pressable onPress={next} style={{ flex: 1, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>다음 →</Text></Pressable>
          ) : (
            <Pressable onPress={generate} disabled={busy || over} style={{ flex: 1, backgroundColor: (busy || over) ? color.inputLine : color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}>
              {busy ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 15, color: over ? color.sub2 : color.white }}>{over ? '오늘 한도 소진' : '✨ 상대역 만들기'}</Text>}
            </Pressable>
          )}
        </View>
        {isLast && (busy ? (
          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center' }}>상대 대사 생성 + 목소리 합성 중… (몇 초 걸려요)</Text>
        ) : quota ? (
          <Text style={{ fontFamily: font.m, fontSize: 12, color: over ? color.danger : color.sub2, textAlign: 'center' }}>{over ? '저장된 장면을 불러와 연습하거나 내일 다시' : `오늘 새 생성 ${quota.remaining}/${quota.limit}회 남음 · 불러오기는 무제한`}</Text>
        ) : null)}

        {/* 저장 장면 다이얼로그 */}
        <Modal visible={libOpen} transparent animationType="fade" onRequestClose={() => setLibOpen(false)}>
          <Pressable onPress={() => setLibOpen(false)} style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: color.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 16, paddingBottom: 28, maxHeight: '75%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 }}>
                <Text style={{ fontFamily: font.xb, fontSize: 17, color: color.ink }}>저장된 장면</Text>
                <Pressable onPress={() => setLibOpen(false)} hitSlop={8}><Text style={{ fontFamily: font.b, fontSize: 15, color: color.sub }}>닫기</Text></Pressable>
              </View>
              <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, paddingHorizontal: 20, marginBottom: 10 }}>불러오면 다시 만들지 않고 무제한 재연습해요(비용 0).</Text>
              {savedScenes.length === 0 ? (
                <Text style={{ fontFamily: font.m, fontSize: 14, color: color.sub2, textAlign: 'center', paddingVertical: 30 }}>아직 저장된 장면이 없어요.</Text>
              ) : (
                <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                  {savedScenes.map((s) => (
                    <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.surf, borderRadius: radius.card, paddingLeft: 14, paddingRight: 8, paddingVertical: 12 }}>
                      <Pressable onPress={() => loadScene(s.id)} style={{ flex: 1 }}>
                        <Text style={{ fontFamily: font.b, fontSize: 14.5, color: color.ink }} numberOfLines={1}>{s.title}</Text>
                        <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 2 }}>{s.lineCount}줄{s.createdAt ? ` · ${s.createdAt.slice(5, 10)}` : ''}</Text>
                      </Pressable>
                      <Pressable onPress={() => loadScene(s.id)} style={{ backgroundColor: color.blue, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ fontFamily: font.b, fontSize: 13, color: color.white }}>▶ 열기</Text></Pressable>
                      <Pressable onPress={() => deleteScene(s.id)} hitSlop={6} style={{ paddingHorizontal: 6 }}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.faint }}>✕</Text></Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  };

  const renderPractice = () => (
    <View style={{ paddingHorizontal: space.screenX, gap: 10, marginTop: 8 }}>
      <Card style={{ padding: 14, backgroundColor: color.blueBg }}>
        <Text style={{ fontFamily: font.m, fontSize: 13, lineHeight: 20, color: color.infoInk }}>
          <Text style={{ fontFamily: font.b }}>▶ 연습 시작</Text>을 누르면 내 대사 차례에 <Text style={{ fontFamily: font.b }}>정해둔 시간만큼</Text> 연기할 시간이 주어지고, 시간이 지나면 <Text style={{ fontFamily: font.b }}>상대가 자동으로 응답</Text>해요. 일찍 끝냈으면 <Text style={{ fontFamily: font.b }}>다음 ▶</Text>으로 바로 넘겨도 돼요.
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.b, fontSize: 13, color: phase === 'done' ? color.success : phase === 'partner' ? color.warn : phase === 'mine' ? color.blue : color.sub2 }}>
          {phase === 'done' ? '장면 끝! 수고했어요 👏' : phase === 'partner' ? '🎭 상대가 말하는 중…' : phase === 'mine' ? `🎤 내 대사 · ${remain.toFixed(1)}초` : '준비됨'}
        </Text>
        <Pressable onPress={() => setReveal((v) => !v)} hitSlop={6}><Text style={{ fontFamily: font.b, fontSize: 13, color: color.blue }}>{reveal ? '상대 대사 숨기기' : '상대 대사 보기'}</Text></Pressable>
      </View>

      {(result || []).map((t, i) => {
        const active = i === cursor;
        if (t.speaker === '나') return (
          <View key={i} style={{ backgroundColor: color.white, borderWidth: active ? 2 : 1, borderColor: active ? color.blue : color.line, borderRadius: radius.card, padding: 14, overflow: 'hidden' }}>
            <Text style={{ fontFamily: font.b, fontSize: 11.5, color: active ? color.blue : color.sub2, marginBottom: 4 }}>나 {active && phase === 'mine' ? `· ${remain.toFixed(1)}초 남음` : ''}</Text>
            <Text style={{ fontFamily: font.m, fontSize: 15.5, lineHeight: 24, color: color.ink }}>{t.text}</Text>
            {active && phase === 'mine' && total > 0 && (
              <View style={{ height: 4, backgroundColor: color.inputLine, borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                <View style={{ height: 4, width: `${Math.max(0, Math.min(100, (remain / total) * 100))}%`, backgroundColor: color.blue }} />
              </View>
            )}
          </View>
        );
        return (
          <View key={i} style={{ backgroundColor: color.amberBg, borderWidth: active ? 2 : 1, borderColor: active ? color.amber : color.requestLine, borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color.amber, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 15, color: color.white }}>🎭</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.warn, marginBottom: 2 }}>상대 {active && phase === 'partner' ? '· 말하는 중…' : ''}</Text>
              <Text style={{ fontFamily: font.m, fontSize: reveal ? 15 : 13, lineHeight: 22, color: reveal ? color.ink : color.faint }}>{reveal ? t.text : '(듣고 반응하세요)'}</Text>
            </View>
          </View>
        );
      })}

      {running ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable onPress={stopPractice} style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 14, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.ink }}>■ 멈춤</Text></Pressable>
          <Pressable onPress={advance} style={{ flex: 1, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 14, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.white }}>다음 ▶</Text></Pressable>
        </View>
      ) : (
        <Pressable onPress={startPractice} style={{ backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center', marginTop: 8 }}><Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>▶ 연습 시작</Text></Pressable>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Pressable onPress={() => { stopAll(); setStep(1); setMode('edit'); }} style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.ink }}>✏️ 다시 쓰기</Text></Pressable>
        <Pressable onPress={generate} disabled={busy} style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' }}>{busy ? <ActivityIndicator color={color.blue} /> : <Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.blue }}>🔄 다르게 다시</Text>}</Pressable>
      </View>
      <Text style={{ fontFamily: font.r, fontSize: 12, lineHeight: 18, color: color.sub2, textAlign: 'center', marginTop: 2 }}>실전 입시장엔 상대가 없어요. 익숙해지면 상대 없이 혼자 해보는 것도 잊지 마세요.</Text>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <BackHeader title="AI 상대역 연습" onBack={() => { stopAll(); nav.goBack(); }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <Scroll contentStyle={{ paddingBottom: 48 }}>{mode === 'edit' ? renderEdit() : renderPractice()}</Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
