import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { aiApi, AiReviseResult, SavedRevision } from '../services/api';

// 면접 질의응답 AI 첨삭 — 질문 + 내 답변을 입력하면 더 나은 답변·개선점·총평을 받는다.
// (백엔드가 GEMINI_API_KEY 없으면 ok=false 안내를 반환 → 화면은 친절히 표시)
export function AIReviseScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const initialQ: string = route.params?.question || '';
  const [question, setQuestion] = useState(initialQ);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiReviseResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedRevision[]>([]);
  const [libOpen, setLibOpen] = useState(false);

  const canSubmit = answer.trim().length >= 5 && !busy;

  // 지난 첨삭 목록(서버 저장) — 화면 이탈 후에도 재열람
  const refreshSaved = useCallback(async () => {
    try { setSaved(await aiApi.interviewRevisions()); } catch { /* 목록 없어도 첨삭은 동작 */ }
  }, []);
  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await aiApi.interviewRevise(question.trim() || '자유 주제', answer.trim());
      setResult(r);
      if (r.ok) refreshSaved();
    } catch (e: any) {
      setErr(e?.message || '첨삭을 받지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const openSaved = (r: SavedRevision) => {
    setLibOpen(false); setErr(null);
    setQuestion(r.question || '');
    setAnswer(r.answer || '');
    setResult({ ok: true, revised: r.revised || '', feedback: r.feedback || [], summary: r.summary || '' });
  };
  const removeSaved = async (id: string) => { try { await aiApi.deleteInterviewRevision(id); refreshSaved(); } catch {} };

  const input = {
    borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card,
    paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: color.ink,
    fontFamily: font.m, backgroundColor: color.white,
  } as const;

  return (
    <Screen edges={['top']}>
      <BackHeader title="AI 답변 첨삭" onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: space.screenX, gap: 12, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable onPress={() => { refreshSaved(); setLibOpen(true); }} hitSlop={6} style={{ borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.ink }}>📂 지난 첨삭{saved.length ? ` ${saved.length}` : ''}</Text>
            </Pressable>
          </View>
          <View>
            <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 6 }}>면접 질문</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="예: 10년 뒤 당신은 어떤 배우가 되어 있을까요?"
              placeholderTextColor={color.faint}
              style={input}
              multiline
            />
          </View>

          <View>
            <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 6 }}>내 답변</Text>
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              placeholder="자유롭게 답변을 적어보세요 (5자 이상)"
              placeholderTextColor={color.faint}
              style={[input, { minHeight: 140, textAlignVertical: 'top' }]}
              multiline
              maxLength={2000}
            />
            <Text style={{ fontFamily: font.m, fontSize: 11, color: color.faint, alignSelf: 'flex-end', marginTop: 4 }}>{answer.length}/2000</Text>
          </View>

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={{ backgroundColor: canSubmit ? color.blue : color.inputLine, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}
          >
            {busy ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>✨ 첨삭받기</Text>}
          </Pressable>

          {err && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.danger, textAlign: 'center' }}>{err}</Text>}

          {result && !result.ok && (
            <Card style={{ padding: 18 }}>
              <Text style={{ fontFamily: font.m, fontSize: 14, lineHeight: 22, color: color.sub }}>
                {result.feedback?.[0] || 'AI 첨삭 기능이 아직 준비 중이에요.'}
              </Text>
            </Card>
          )}

          {result && result.ok && (
            <View style={{ gap: 12, marginTop: 4 }}>
              {!!result.summary && (
                <View style={{ backgroundColor: color.blueBg, borderRadius: radius.card, padding: 14 }}>
                  <Text style={{ fontFamily: font.b, fontSize: 14, lineHeight: 21, color: color.blue }}>💡 {result.summary}</Text>
                </View>
              )}
              <Card style={{ padding: 18 }}>
                <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 8 }}>더 좋은 답변 예시</Text>
                <Text style={{ fontFamily: font.m, fontSize: 15, lineHeight: 24, color: color.ink }}>{result.revised}</Text>
              </Card>
              {result.feedback?.length > 0 && (
                <Card style={{ padding: 18 }}>
                  <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 10 }}>이렇게 고쳐보세요</Text>
                  {result.feedback.map((f, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <Text style={{ fontFamily: font.b, fontSize: 14, color: color.blue }}>{i + 1}</Text>
                      <Text style={{ flex: 1, fontFamily: font.m, fontSize: 14, lineHeight: 22, color: color.ink }}>{f}</Text>
                    </View>
                  ))}
                </Card>
              )}
            </View>
          )}

          <Modal visible={libOpen} transparent animationType="fade" onRequestClose={() => setLibOpen(false)}>
            <Pressable onPress={() => setLibOpen(false)} style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => {}} style={{ backgroundColor: color.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 16, paddingBottom: 28, maxHeight: '75%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 }}>
                  <Text style={{ fontFamily: font.xb, fontSize: 17, color: color.ink }}>지난 첨삭</Text>
                  <Pressable onPress={() => setLibOpen(false)} hitSlop={8}><Text style={{ fontFamily: font.b, fontSize: 15, color: color.sub }}>닫기</Text></Pressable>
                </View>
                {saved.length === 0 ? (
                  <Text style={{ fontFamily: font.m, fontSize: 14, color: color.sub2, textAlign: 'center', paddingVertical: 30 }}>아직 저장된 첨삭이 없어요.</Text>
                ) : (
                  <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                    {saved.map((s) => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.surf, borderRadius: radius.card, paddingLeft: 14, paddingRight: 8, paddingVertical: 12 }}>
                        <Pressable onPress={() => openSaved(s)} style={{ flex: 1 }}>
                          <Text style={{ fontFamily: font.b, fontSize: 14, color: color.ink }} numberOfLines={1}>{s.question || '자유 주제'}</Text>
                          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 2 }} numberOfLines={1}>{s.answer}{s.createdAt ? ` · ${s.createdAt.slice(5, 10)}` : ''}</Text>
                        </Pressable>
                        <Pressable onPress={() => openSaved(s)} style={{ backgroundColor: color.blue, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ fontFamily: font.b, fontSize: 13, color: color.white }}>열기</Text></Pressable>
                        <Pressable onPress={() => removeSaved(s.id)} hitSlop={6} style={{ paddingHorizontal: 6 }}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.faint }}>✕</Text></Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
