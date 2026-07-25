import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { aiApi, SceneTurn } from '../services/api';

// AI 상대역 연습 — 입시 독백은 원래 상대 대사가 있던 장면을 혼자 하는 것.
// 학생이 자기 대사를 쓰고 '상대 등장' 자리만 표시하면 AI가 부재하는 상대의 대사를 채운다.
// 연습 중엔 상대 대사를 '숨기고' ▶로 목소리(TTS)만 들려줘 학생이 듣고 반응하게 한다.
type EditTurn = { key: string; speaker: '나' | '상대'; text: string; hint: string };
let _seq = 0;
const mk = (speaker: '나' | '상대', text = '', hint = ''): EditTurn => ({ key: `t${_seq++}`, speaker, text, hint });

const STARTER: EditTurn[] = [
  mk('나', '아무 일도 아닙니다.'),
  mk('상대'),
  mk('나', '그가 제게 말했죠. 다 끝났다고.'),
];

export function ScenePartnerScreen() {
  const nav = useNavigation<any>();
  const [mode, setMode] = useState<'edit' | 'practice'>('edit');
  const [turns, setTurns] = useState<EditTurn[]>(STARTER);
  const [partner, setPartner] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SceneTurn[] | null>(null);
  const [reveal, setReveal] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);

  const setText = (key: string, text: string) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, text } : t)));
  const setHint = (key: string, hint: string) => setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, hint } : t)));
  const remove = (key: string) => setTurns((ts) => ts.filter((t) => t.key !== key));
  const addMine = () => setTurns((ts) => [...ts, mk('나')]);
  const addPartner = () => setTurns((ts) => [...ts, mk('상대')]);

  const generate = useCallback(async () => {
    Speech.stop();
    const payload: SceneTurn[] = turns.map((t) =>
      t.speaker === '상대' ? { speaker: '상대', hint: t.hint.trim() || undefined } : { speaker: '나', text: t.text.trim() },
    );
    const mine = payload.filter((t) => t.speaker === '나' && (t.text || '').length);
    const slots = payload.filter((t) => t.speaker === '상대');
    if (mine.length < 1) { setErr('내 대사를 한 줄 이상 입력해주세요.'); return; }
    if (slots.length < 1) { setErr('상대가 등장하는 지점을 한 곳 이상 추가해주세요.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await aiApi.scenePartner(payload, partner.trim());
      if (!r.ok) { setErr(r.message || 'AI 상대역을 만들지 못했어요. 잠시 후 다시 시도해주세요.'); return; }
      setResult(r.turns); setReveal(false); setMode('practice');
    } catch (e: any) {
      setErr(e?.message || 'AI 상대역을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally { setBusy(false); }
  }, [turns, partner]);

  const speak = (idx: number, text: string) => {
    Speech.stop();
    if (speaking === idx) { setSpeaking(null); return; }
    setSpeaking(idx);
    Speech.speak(text, {
      language: 'ko-KR', rate: 1.0, pitch: 1.0,
      onDone: () => setSpeaking(null), onStopped: () => setSpeaking(null), onError: () => setSpeaking(null),
    });
  };

  const input = {
    borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card,
    paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: color.ink,
    fontFamily: font.m, backgroundColor: color.white,
  } as const;

  // ── 작성 화면 ──
  const renderEdit = () => (
    <View style={{ paddingHorizontal: space.screenX, gap: 12, marginTop: 8 }}>
      <Card style={{ padding: 14, backgroundColor: color.blueBg }}>
        <Text style={{ fontFamily: font.m, fontSize: 13, lineHeight: 20, color: color.infoInk }}>
          독백은 원래 상대가 있던 장면이에요. 내 대사를 쓰고, 상대가 말하는 지점에 <Text style={{ fontFamily: font.b }}>🎭 상대 등장</Text>을 넣으면 AI가 상대 대사를 채워줘요. 연습할 땐 상대 대사가 <Text style={{ fontFamily: font.b }}>숨겨진 채 목소리로만</Text> 나와서, 듣고 반응하는 연습을 할 수 있어요.
        </Text>
      </Card>

      <View>
        <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 6 }}>상대는 누구인가요? (선택)</Text>
        <TextInput value={partner} onChangeText={setPartner} placeholder="예: 엄마 / 오래된 친구 / 헤어진 연인" placeholderTextColor={color.faint} style={input} maxLength={60} />
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
          <Pressable onPress={() => remove(t.key)} hitSlop={8} style={{ paddingTop: 12 }}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.faint }}>✕</Text></Pressable>
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
        <Pressable onPress={addMine} style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.ink }}>+ 내 대사</Text></Pressable>
        <Pressable onPress={addPartner} style={{ flex: 1, borderWidth: 1, borderColor: color.requestLine, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center', backgroundColor: color.amberBg }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.warn }}>+ 🎭 상대 등장</Text></Pressable>
      </View>

      {err && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.danger, textAlign: 'center' }}>{err}</Text>}

      <Pressable onPress={generate} disabled={busy} style={{ backgroundColor: busy ? color.inputLine : color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center', marginTop: 4 }}>
        {busy ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>✨ AI 상대역 만들기</Text>}
      </Pressable>
    </View>
  );

  // ── 연습 화면 ──
  const renderPractice = () => (
    <View style={{ paddingHorizontal: space.screenX, gap: 10, marginTop: 8 }}>
      <Card style={{ padding: 14, backgroundColor: color.blueBg }}>
        <Text style={{ fontFamily: font.m, fontSize: 13, lineHeight: 20, color: color.infoInk }}>
          상대 대사는 <Text style={{ fontFamily: font.b }}>숨겨져 있어요.</Text> 내 대사를 하고 <Text style={{ fontFamily: font.b }}>▶</Text>를 누르면 상대 목소리가 나와요. 무슨 말이 나올지 모른 채 <Text style={{ fontFamily: font.b }}>듣고 반응</Text>해보세요.
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Pressable onPress={() => setReveal((v) => !v)} hitSlop={6}><Text style={{ fontFamily: font.b, fontSize: 13, color: color.blue }}>{reveal ? '상대 대사 숨기기' : '상대 대사 보기'}</Text></Pressable>
      </View>

      {(result || []).map((t, i) => (
        t.speaker === '나' ? (
          <View key={i} style={{ backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: radius.card, padding: 14 }}>
            <Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.sub2, marginBottom: 4 }}>나</Text>
            <Text style={{ fontFamily: font.m, fontSize: 15.5, lineHeight: 24, color: color.ink }}>{t.text}</Text>
          </View>
        ) : (
          <Pressable key={i} onPress={() => speak(i, t.text || '')} style={{ backgroundColor: color.amberBg, borderWidth: 1, borderColor: color.requestLine, borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.amber, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, color: color.white }}>{speaking === i ? '■' : '▶'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.warn, marginBottom: 2 }}>🎭 상대 {speaking === i ? '· 말하는 중…' : '· 듣고 반응'}</Text>
              <Text style={{ fontFamily: reveal ? font.m : font.m, fontSize: reveal ? 15 : 13, lineHeight: 22, color: reveal ? color.ink : color.faint }}>{reveal ? t.text : '(눌러서 듣기)'}</Text>
            </View>
          </Pressable>
        )
      ))}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable onPress={() => { Speech.stop(); setMode('edit'); }} style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.ink }}>✏️ 다시 쓰기</Text></Pressable>
        <Pressable onPress={generate} disabled={busy} style={{ flex: 1, backgroundColor: busy ? color.inputLine : color.blue, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}>
          {busy ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 14, color: color.white }}>🔄 다르게 다시</Text>}
        </Pressable>
      </View>
      <Text style={{ fontFamily: font.r, fontSize: 12, lineHeight: 18, color: color.sub2, textAlign: 'center', marginTop: 2 }}>실전 입시장엔 상대가 없어요. 익숙해지면 상대 없이 혼자 해보는 것도 잊지 마세요.</Text>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <BackHeader title="AI 상대역 연습" onBack={() => { Speech.stop(); nav.goBack(); }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <Scroll contentStyle={{ paddingBottom: 48 }}>
          {mode === 'edit' ? renderEdit() : renderPractice()}
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
