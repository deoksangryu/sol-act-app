import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Modal, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { color, font, radius, space } from '../theme/tokens';
import { workAnalysisApi, AnalysisVersionView, AnalysisDetail } from '../services/api';

// 강사·원장: 작품분석 첨삭 — 칸별 코멘트(팔레트) + 루브릭 + 3분할 요약.
const RUBRIC = [
  { k: 'goalClear', label: '목표가 동사로 분명한가' },
  { k: 'obstacleReal', label: '장애물이 구체적인가' },
  { k: 'evidence', label: '대사에 근거가 있는가' },
  { k: 'subtext', label: '서브텍스트의 깊이' },
  { k: 'oral', label: '구술로 말할 수 있는가' },
];
const SCALE = ['더 필요', '보통', '좋음', '훌륭'];
const PALETTE = [
  '목표가 형용사예요. \'~하고 싶다\' 동사로 바꿔봅시다.',
  '장애물이 추상적입니다. 이 장면 안에서 실제로 막는 것을 찾으세요.',
  '근거 대사를 한 줄 인용해 주세요.',
  '상대가 비어 있어요. 없는 상대를 먼저 세워야 합니다.',
  '비트 전환점이 한 곳뿐입니다. 최소 세 곳은 찾아봅시다.',
  '감정 단어 대신 행동 동사로 적으면 연기가 잡힙니다.',
  '여기 해석 좋습니다. 실기에서도 그대로 가져가세요.',
];

const input = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: color.ink, fontFamily: font.m, backgroundColor: color.white } as const;

// 타입별 표시 필드
function fieldsFor(d: AnalysisDetail, pl: Record<string, any>): { key: string; label: string; value: string }[] {
  const j = (a?: any[]) => (a || []).join(' · ');
  const base = [
    { key: 'oneLine', label: '한 줄 상황', value: pl.oneLine },
    { key: 'goal', label: '목표', value: pl.goal },
    { key: 'other', label: '상대', value: pl.other },
    { key: 'obstacle', label: '장애물', value: pl.obstacle },
    { key: 'tactics', label: '전술', value: j(pl.tactics) },
    { key: 'expectation', label: '기대', value: pl.expectation },
  ];
  const extra: { key: string; label: string; value: string }[] = [];
  if (d.type === 'monologue') {
    extra.push({ key: 'partnerWho', label: '보이지 않는 상대', value: pl.partnerWho });
    extra.push({ key: 'partnerDo', label: '독백 동안 상대의 행동', value: pl.partnerDo });
    extra.push({ key: 'beats', label: '비트', value: (pl.beats || []).filter((b: any) => b.range || b.shift).map((b: any, i: number) => `${i + 1}. ${b.range || ''}${b.shift ? ` → ${b.shift}` : ''}${b.tactic ? ` (${b.tactic})` : ''}`).join('\n') });
  } else if (d.type === 'play') {
    extra.push({ key: 'theme', label: '주제', value: pl.theme });
    extra.push({ key: 'structure', label: '구조', value: pl.structure });
  } else {
    extra.push({ key: 'songType', label: '넘버 유형', value: pl.songType });
    extra.push({ key: 'why', label: '넘버의 극적 기능', value: pl.why });
  }
  extra.push({ key: 'given', label: '주어진 상황', value: pl.given });
  extra.push({ key: 'subtext', label: '서브텍스트', value: pl.subtext });
  return [...base, ...extra];
}

export function WorkAnalysisReviewScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const id: string = route.params?.analysisId ?? route.params?.id;
  const { data, isLoading, refetch } = useQuery({ queryKey: ['analysisReview', id], queryFn: () => workAnalysisApi.detail(id), staleTime: 3000 });

  const [scores, setScores] = useState<Record<string, number>>({});
  const [good, setGood] = useState('');
  const [fix, setFix] = useState('');
  const [next, setNext] = useState('');
  const [sheet, setSheet] = useState<{ key: string; label: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // 리뷰 대상 = 최신 제출/첨삭 버전
  const ver: AnalysisVersionView | undefined = data
    ? [...data.versions].reverse().find((v) => v.status === 'submitted' || v.status === 'reviewed') ?? data.versions[data.versions.length - 1]
    : undefined;
  const commentByKey: Record<string, { id: string; content: string }> = {};
  (ver?.comments || []).forEach((c) => { commentByKey[c.fieldKey] = { id: c.id, content: c.content }; });

  const openSheet = (key: string, label: string) => { setDraft(commentByKey[key]?.content || ''); setSheet({ key, label }); };
  const saveComment = async () => {
    if (!ver || !sheet) return;
    try {
      await workAnalysisApi.addComment(ver.id, sheet.key, draft.trim());
      setSheet(null); setDraft(''); refetch();
    } catch (e: any) { Alert.alert('실패', e?.message || '코멘트를 저장하지 못했어요.'); }
  };
  const removeComment = async () => {
    if (!ver || !sheet) return;
    const c = commentByKey[sheet.key];
    if (c) { try { await workAnalysisApi.deleteComment(c.id); } catch {} }
    setSheet(null); setDraft(''); refetch();
  };

  const send = async () => {
    if (!ver) return;
    if (!fix.trim() && !good.trim() && !next.trim()) { Alert.alert('첨삭 내용을 적어주세요', '잘한 점·고칠 점·다음 할 일 중 하나 이상 채워주세요.'); return; }
    setSending(true);
    try {
      await workAnalysisApi.feedback(ver.id, { rubric: scores, good: good.trim(), fix: fix.trim(), next: next.trim() });
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['workAnalyses'] });
      nav.goBack();
    } catch (e: any) { Alert.alert('전송 실패', e?.message || '첨삭을 보내지 못했어요.'); }
    finally { setSending(false); }
  };

  if (isLoading || !data || !ver) {
    return (
      <Screen edges={['top']} bg={color.bg}>
        <BackHeader title="첨삭" onBack={() => nav.goBack()} />
        <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
      </Screen>
    );
  }
  const pl = ver.payload || {};
  const rows = fieldsFor(data, pl);

  return (
    <Screen edges={['top']} bg={color.bg}>
      <BackHeader title="작품분석 첨삭" onBack={() => nav.goBack()} />
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        <View style={{ padding: space.screenX, paddingBottom: 8 }}>
          <Text style={{ fontFamily: font.xb, fontSize: 20, color: color.ink }}>{data.title}{data.character ? ` · ${data.character}` : ''}</Text>
          <Text style={{ fontFamily: font.r, fontSize: 13, color: color.sub2, marginTop: 5 }}>{data.typeLabel} · v{ver.versionNo}</Text>
          {!!pl.question && (
            <View style={{ backgroundColor: color.amberBg, borderRadius: radius.card, padding: 13, marginTop: 12 }}>
              <Text style={{ fontFamily: font.m, fontSize: 13.5, color: color.warn, lineHeight: 20 }}>학생 질문 — {pl.question}</Text>
            </View>
          )}
        </View>

        {rows.map((f) => {
          const c = commentByKey[f.key];
          return (
            <View key={f.key} style={{ paddingHorizontal: space.screenX, paddingVertical: 14, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: color.white }}>
              <Text style={{ fontFamily: font.b, fontSize: 12, color: color.sub2, marginBottom: 6 }}>{f.label}</Text>
              <Text style={{ fontFamily: font.r, fontSize: 15.5, lineHeight: 24, color: f.value ? color.ink : color.faint }}>{f.value || '비어 있음'}</Text>
              {c ? (
                <Pressable onPress={() => openSheet(f.key, f.label)} style={{ marginTop: 12, backgroundColor: color.blueBg, borderRadius: 12, padding: 13 }}>
                  <Text style={{ fontFamily: font.m, fontSize: 14, color: color.infoInk, lineHeight: 21 }}>{c.content}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => openSheet(f.key, f.label)} style={{ marginTop: 10, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: color.inputLine, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ fontFamily: font.sb, fontSize: 13, color: color.sub }}>＋ 코멘트</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <View style={{ padding: space.screenX, paddingTop: 24 }}>
          <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 14 }}>루브릭</Text>
          {RUBRIC.map((r) => (
            <View key={r.k} style={{ marginBottom: 18 }}>
              <Text style={{ fontFamily: font.sb, fontSize: 14, color: color.sub, marginBottom: 8 }}>{r.label}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {SCALE.map((s, i) => {
                  const on = scores[r.k] === i;
                  return (
                    <Pressable key={s} onPress={() => setScores((sc) => ({ ...sc, [r.k]: i }))} style={{ flex: 1, borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
                      <Text style={{ fontFamily: font.sb, fontSize: 12.5, color: on ? color.blue : color.sub }}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginTop: 8, marginBottom: 12 }}>마무리 한마디</Text>
          <Lbl>잘한 점</Lbl>
          <TextInput value={good} onChangeText={setGood} placeholder="지켜야 할 것" placeholderTextColor={color.faint} style={[input, { marginBottom: 12 }]} multiline />
          <Lbl>고칠 점</Lbl>
          <TextInput value={fix} onChangeText={setFix} placeholder="가장 중요한 하나만" placeholderTextColor={color.faint} style={[input, { marginBottom: 12 }]} multiline />
          <Lbl>다음에 할 일</Lbl>
          <TextInput value={next} onChangeText={setNext} placeholder="수업 전까지 해올 것" placeholderTextColor={color.faint} style={[input, { marginBottom: 4 }]} multiline />
        </View>

        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 12 }}>
          <Pressable onPress={send} disabled={sending} style={{ height: 54, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: color.blue }}>
            {sending ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 16, color: color.white }}>첨삭 보내기</Text>}
          </Pressable>
        </View>
      </Scroll>

      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable onPress={() => setSheet(null)} style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: color.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '82%' }}>
            <Text style={{ fontFamily: font.xb, fontSize: 18, color: color.ink }}>{sheet?.label}</Text>
            <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 4, marginBottom: 14 }}>자주 쓰는 문구를 눌러 넣으세요</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {PALETTE.map((pp) => (
                <Pressable key={pp} onPress={() => setDraft((d) => (d ? d + ' ' + pp : pp))} style={{ borderWidth: 1.5, borderColor: color.inputLine, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, maxWidth: '100%' }}>
                  <Text style={{ fontFamily: font.sb, fontSize: 12.5, color: color.sub }}>{pp}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={draft} onChangeText={setDraft} placeholder="코멘트를 적어주세요" placeholderTextColor={color.faint} style={[input, { minHeight: 90, textAlignVertical: 'top' }]} multiline />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable onPress={removeComment} style={{ flex: 1, height: 50, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surf }}>
                <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.sub }}>지우기</Text>
              </Pressable>
              <Pressable onPress={saveComment} disabled={!draft.trim()} style={{ flex: 2, height: 50, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: draft.trim() ? color.blue : color.surf }}>
                <Text style={{ fontFamily: font.b, fontSize: 15, color: draft.trim() ? color.white : color.sub2 }}>넣기</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: font.sb, fontSize: 13, color: color.sub, marginBottom: 7 }}>{children}</Text>;
}
