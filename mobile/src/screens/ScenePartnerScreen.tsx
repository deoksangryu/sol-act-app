import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { aiApi, SceneTurn, API_URL } from '../services/api';

// AI 상대역 연습 — 학생이 자기 대사 + '상대 등장' 자리 표시 → AI가 상대 대사 생성 + 성별×나이 맞춤 TTS.
// 연습: 시작 → 내 대사 말함(마이크 소리 레벨 표시) → 멈추면(침묵 감지) 상대 자동 응답 → 다음. 수동 '다음' 폴백.
type EditTurn = { key: string; speaker: '나' | '상대'; text: string; hint: string };
let _seq = 0;
const mk = (speaker: '나' | '상대', text = '', hint = ''): EditTurn => ({ key: `t${_seq++}`, speaker, text, hint });
const STARTER: EditTurn[] = [mk('나', '아무 일도 아닙니다.'), mk('상대'), mk('나', '그가 제게 말했죠. 다 끝났다고.')];
const absUrl = (u?: string) => (u && u.startsWith('/') ? `${API_URL}${u}` : u || '');
const SR_OPTS = { lang: 'ko-KR', interimResults: true, continuous: true, volumeChangeEventOptions: { enabled: true, intervalMillis: 100 } } as const;

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
  const [phase, setPhase] = useState<'idle' | 'listening' | 'partner' | 'done'>('idle');
  const [cursor, setCursor] = useState(-1);
  const [micLevel, setMicLevel] = useState(0);
  const [micWarn, setMicWarn] = useState(false);

  const idxRef = useRef(0);
  const runRef = useRef(false);
  const listenRef = useRef(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const grantedRef = useRef(false);
  const heardRef = useRef(false);
  const lastLoudRef = useRef(0);
  const startedAtRef = useRef(0);
  const warnRef = useRef(false);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }, []);
  useEffect(() => () => { stopAll(); }, []);

  const clearMonitor = () => { if (monitorRef.current) { clearInterval(monitorRef.current); monitorRef.current = null; } };
  const stopAll = () => {
    runRef.current = false; listenRef.current = false; clearMonitor();
    try { ExpoSpeechRecognitionModule.abort(); } catch {}
    try { Speech.stop(); } catch {}
    if (playerRef.current) { try { playerRef.current.remove(); } catch {} playerRef.current = null; }
  };

  // 마이크 볼륨(-2~10): 레벨 표시 + '말하다가 멈춤' 감지
  useSpeechRecognitionEvent('volumechange', (e) => {
    if (!listenRef.current) return;
    const v = typeof e.value === 'number' ? e.value : -2;
    setMicLevel(Math.max(0, Math.min(1, v / 7)));
    if (v > 0.5) { heardRef.current = true; lastLoudRef.current = Date.now(); if (warnRef.current) { warnRef.current = false; setMicWarn(false); } }
  });
  useSpeechRecognitionEvent('end', () => { if (runRef.current && listenRef.current && heardRef.current) advance(); });

  const startMonitor = () => {
    clearMonitor();
    monitorRef.current = setInterval(() => {
      if (!listenRef.current) { clearMonitor(); return; }
      const now = Date.now();
      if (heardRef.current && now - lastLoudRef.current > 1300) advance();               // 말 끝나고 침묵 → 진행
      else if (!heardRef.current && now - startedAtRef.current > 2800 && !warnRef.current) { warnRef.current = true; setMicWarn(true); } // 소리 안 잡힘 경고
    }, 200);
  };

  const startListen = async () => {
    listenRef.current = true; heardRef.current = false; lastLoudRef.current = 0; startedAtRef.current = Date.now();
    warnRef.current = false; setMicWarn(false); setMicLevel(0);
    try {
      if (!grantedRef.current) { const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync(); grantedRef.current = !!p.granted; }
      if (grantedRef.current) ExpoSpeechRecognitionModule.start(SR_OPTS);
    } catch { /* 미지원/거부 → 수동 '다음'으로 */ }
    startMonitor();
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
    if (i >= list.length) { runRef.current = false; setRunning(false); setPhase('done'); setCursor(-1); setMicLevel(0); return; }
    setCursor(i);
    const t = list[i];
    if (t.speaker === '나') { setPhase('listening'); startListen(); }
    else { setPhase('partner'); playPartner(t); }
  };

  const advance = () => {
    clearMonitor(); listenRef.current = false; setMicLevel(0); setMicWarn(false); warnRef.current = false;
    try { ExpoSpeechRecognitionModule.abort(); } catch {}
    try { Speech.stop(); } catch {}
    if (playerRef.current) { try { playerRef.current.remove(); } catch {} playerRef.current = null; }
    idxRef.current += 1; step();
  };

  const startPractice = () => { stopAll(); idxRef.current = 0; runRef.current = true; setRunning(true); setReveal(false); step(); };
  const stopPractice = () => { stopAll(); setRunning(false); setPhase('idle'); setCursor(-1); setMicLevel(0); setMicWarn(false); };

  const setText = (key: string, text: string) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, text } : t)));
  const setHint = (key: string, hint: string) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, hint } : t)));
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
          독백은 원래 상대가 있던 장면이에요. 내 대사를 쓰고 상대가 말하는 지점에 <Text style={{ fontFamily: font.b }}>🎭 상대 등장</Text>을 넣으면 AI가 상대 대사를 채워 <Text style={{ fontFamily: font.b }}>목소리로</Text> 만들어줘요. 연습 땐 내가 대사를 하면 <Text style={{ fontFamily: font.b }}>끝나는 걸 감지해 상대가 자동으로 응답</Text>해요.
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
              <TextInput value={t.text} onChangeText={(v) => setText(t.key, v)} placeholder="내 대사" placeholderTextColor={color.faint} style={[input, { flex: 1 }]} multiline />
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

  const MicMeter = () => (
    <Card style={{ padding: 14, backgroundColor: micWarn ? color.dangerBg : color.blueBg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 18 }}>{micWarn ? '🔇' : '🎙️'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22, flex: 1 }}>
          {Array.from({ length: 14 }).map((_, i) => {
            const on = micLevel * 14 > i;
            return <View key={i} style={{ width: 5, borderRadius: 2, height: 6 + i * 1.1, backgroundColor: on ? (micWarn ? color.danger : color.blue) : color.inputLine }} />;
          })}
        </View>
      </View>
      <Text style={{ fontFamily: font.b, fontSize: 12.5, color: micWarn ? color.danger : color.infoInk, marginTop: 8 }}>
        {micWarn ? '소리가 잘 안 잡혀요 — 더 크게 말하거나 마이크를 확인하고, 안 넘어가면 다음 ▶' : micLevel > 0.08 ? '잘 들리고 있어요 — 대사를 마치면 상대가 응답해요' : '내 대사를 소리 내어 말해보세요…'}
      </Text>
    </Card>
  );

  const renderPractice = () => (
    <View style={{ paddingHorizontal: space.screenX, gap: 10, marginTop: 8 }}>
      <Card style={{ padding: 14, backgroundColor: color.blueBg }}>
        <Text style={{ fontFamily: font.m, fontSize: 13, lineHeight: 20, color: color.infoInk }}>
          <Text style={{ fontFamily: font.b }}>▶ 연습 시작</Text>을 누르고 내 대사를 소리 내어 하세요. 말이 끝나면 <Text style={{ fontFamily: font.b }}>상대가 자동으로 응답</Text>해요. 잘 안 넘어가면 <Text style={{ fontFamily: font.b }}>다음 ▶</Text>을 누르면 돼요.
        </Text>
      </Card>

      {running && phase === 'listening' && <MicMeter />}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.b, fontSize: 13, color: phase === 'done' ? color.success : phase === 'partner' ? color.warn : color.sub2 }}>
          {phase === 'done' ? '장면 끝! 수고했어요 👏' : phase === 'partner' ? '🎭 상대가 말하는 중…' : phase === 'listening' ? '🎤 내 차례' : '준비됨'}
        </Text>
        <Pressable onPress={() => setReveal((v) => !v)} hitSlop={6}><Text style={{ fontFamily: font.b, fontSize: 13, color: color.blue }}>{reveal ? '상대 대사 숨기기' : '상대 대사 보기'}</Text></Pressable>
      </View>

      {(result || []).map((t, i) => {
        const active = i === cursor;
        if (t.speaker === '나') return (
          <View key={i} style={{ backgroundColor: color.white, borderWidth: active ? 2 : 1, borderColor: active ? color.blue : color.line, borderRadius: radius.card, padding: 14 }}>
            <Text style={{ fontFamily: font.b, fontSize: 11.5, color: active ? color.blue : color.sub2, marginBottom: 4 }}>나 {active && phase === 'listening' ? '· 🎤 말하는 중' : ''}</Text>
            <Text style={{ fontFamily: font.m, fontSize: 15.5, lineHeight: 24, color: color.ink }}>{t.text}</Text>
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
