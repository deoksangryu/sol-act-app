import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { aiApi, SceneTurn, API_URL } from '../services/api';

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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SceneTurn[] | null>(null);
  const [reveal, setReveal] = useState(false);

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

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  const stopAll = () => {
    runRef.current = false; clearTick();
    try { Speech.stop(); } catch {}
    if (playerRef.current) { try { playerRef.current.remove(); } catch {} playerRef.current = null; }
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

  const step = () => {
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
    idxRef.current += 1; step();
  };

  const startPractice = () => { stopAll(); idxRef.current = 0; runRef.current = true; setRunning(true); setReveal(false); step(); };
  const stopPractice = () => { stopAll(); setRunning(false); setPhase('idle'); setCursor(-1); setRemain(0); setTotal(0); };

  const setText = (key: string, text: string) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, text } : t)));
  const setHint = (key: string, hint: string) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, hint } : t)));
  const bumpSec = (key: string, d: number) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, sec: clampSec((t.sec ?? autoSec(t.text)) + d) } : t)));
  const removeTurn = (key: string) => setTurns((ts) => ts.filter((t) => t.key !== key));

  const generate = useCallback(async () => {
    stopAll();
    const payload: SceneTurn[] = turns.map((t) => (t.speaker === '상대' ? { speaker: '상대', hint: t.hint.trim() || undefined } : { speaker: '나', text: t.text.trim() }));
    if (payload.filter((t) => t.speaker === '나' && (t.text || '').length).length < 1) { setErr('내 대사를 한 줄 이상 입력해주세요.'); return; }
    if (payload.filter((t) => t.speaker === '상대').length < 1) { setErr('상대가 등장하는 지점을 한 곳 이상 추가해주세요.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await aiApi.scenePartner(payload, partner.trim());
      if (!r.ok) { setErr(r.message || 'AI 상대역을 만들지 못했어요. 잠시 후 다시 시도해주세요.'); return; }
      // 내 대사 시간(초)을 result 순서에 맞춰 저장 (payload=turns=result 동일 순서)
      secListRef.current = turns.map((t) => (t.speaker === '나' ? clampSec(t.sec ?? autoSec(t.text)) : 0));
      setResult(r.turns); setReveal(false); setPhase('idle'); setCursor(-1); setRunning(false); setMode('practice');
    } catch (e: any) {
      setErr(e?.message || 'AI 상대역을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally { setBusy(false); }
  }, [turns, partner]);

  const input = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: color.ink, fontFamily: font.m, backgroundColor: color.white } as const;

  const renderEdit = () => (
    <View style={{ paddingHorizontal: space.screenX, gap: 12, marginTop: 8 }}>
      <Card style={{ padding: 14, backgroundColor: color.blueBg }}>
        <Text style={{ fontFamily: font.m, fontSize: 13, lineHeight: 20, color: color.infoInk }}>
          내 대사를 쓰고 상대가 말하는 지점에 <Text style={{ fontFamily: font.b }}>🎭 상대 등장</Text>을 넣으면 AI가 상대 대사를 채워 <Text style={{ fontFamily: font.b }}>목소리로</Text> 만들어줘요. 각 내 대사에 <Text style={{ fontFamily: font.b }}>연기할 시간(초)</Text>을 정해두면, 그 시간이 지날 때 상대가 자동으로 응답해요.
        </Text>
      </Card>
      <View>
        <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 6 }}>상대는 누구인가요? (선택 — 성별·나이에 맞는 보이스가 나와요)</Text>
        <TextInput value={partner} onChangeText={setPartner} placeholder="예: 늙고 병든 왕 / 어린 딸 / 헤어진 연인" placeholderTextColor={color.faint} style={input} maxLength={60} />
      </View>
      <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginTop: 2 }}>장면 대본</Text>
      {turns.map((t) => (
        <View key={t.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          {t.speaker === '나' ? (
            <>
              <View style={{ width: 40, paddingTop: 12 }}><Text style={{ fontFamily: font.b, fontSize: 13, color: color.ink }}>나</Text></View>
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
              <View style={{ width: 40, paddingTop: 12 }}><Text style={{ fontFamily: font.b, fontSize: 15 }}>🎭</Text></View>
              <View style={{ flex: 1, borderWidth: 1, borderColor: color.requestLine, borderRadius: radius.card, backgroundColor: color.amberBg, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ fontFamily: font.b, fontSize: 13, color: color.warn, marginBottom: 6 }}>상대 등장 (AI가 채움)</Text>
                <TextInput value={t.hint} onChangeText={(v) => setHint(t.key, v)} placeholder="느낌 힌트(선택) 예: 다그치듯" placeholderTextColor={color.faint} style={{ fontFamily: font.m, fontSize: 13.5, color: color.ink, padding: 0 }} />
              </View>
            </>
          )}
          <Pressable onPress={() => removeTurn(t.key)} hitSlop={8} style={{ paddingTop: 12 }}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.faint }}>✕</Text></Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
        <Pressable onPress={() => setTurns((ts) => [...ts, mk('나')])} style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.ink }}>+ 내 대사</Text></Pressable>
        <Pressable onPress={() => setTurns((ts) => [...ts, mk('상대')])} style={{ flex: 1, borderWidth: 1, borderColor: color.requestLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center', backgroundColor: color.amberBg }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.warn }}>+ 🎭 상대 등장</Text></Pressable>
      </View>
      {err && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.danger, textAlign: 'center' }}>{err}</Text>}
      <Pressable onPress={generate} disabled={busy} style={{ backgroundColor: busy ? color.inputLine : color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center', marginTop: 4 }}>
        {busy ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>✨ AI 상대역 만들기</Text>}
      </Pressable>
      {busy && <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center' }}>상대 대사 생성 + 목소리 합성 중… (몇 초 걸려요)</Text>}
    </View>
  );

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
        <Pressable onPress={() => { stopAll(); setMode('edit'); }} style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.ink }}>✏️ 다시 쓰기</Text></Pressable>
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
