import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../components/kit';
import { Section, Card, V2Row, PageHeader } from '../components/gamify';
import { VideoUploadForm } from '../components/VideoUploadForm';
import { DietUploadForm } from '../components/DietUploadForm';
import { Icon } from '../components/Icon';
import { color, font, radius, space, shadow } from '../theme/tokens';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../AuthContext';
import { sessionsApi, contentApi, achievementsApi, dietApi, practiceJournalApi, gamificationApi, SubmissionKind } from '../services/api';
import { pickMedia } from '../services/upload';
import { useUploads } from '../services/UploadContext';

// 한국 날짜 "M/D"
const kstMD = () => { const d = new Date(Date.now() + 9 * 3600 * 1000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

const RING_C = 414.7;

// 빠른 연습일지 프리셋 — 탭으로 채워 바로 저장(직접 수정 가능).
const JOURNAL_PRESETS = ['복식호흡·발성 집중 연습했어요', '지정 대사 감정선을 다듬었어요', '무용 동작을 반복 연습했어요', '대사 암기를 완성했어요', '오늘은 컨디션이 좋았어요'];

// ── 연습 ──
export function PracticeV2Screen() {
  const qc = useQueryClient();
  const nav = useNavigation<any>();
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const secRef = useRef(0);                    // 최신 sec 미러(이펙트에서 stale 클로저 없이 참조)
  const baseRef = useRef<number | null>(null); // 마지막 로깅 baseline(null=아직 시딩/시작 안 됨)
  const startedRef = useRef(false);            // 한 번이라도 시작했으면 재시딩 금지(레이스 방지)
  useEffect(() => { secRef.current = sec; }, [sec]);
  const { data: todayData } = useQuery({ queryKey: ['sessions', 'today'], queryFn: () => sessionsApi.today(), staleTime: 60000 });
  // 오늘(한국 달력) 실제 누적 연습초로 1회만 초기화 — 사용자가 타이머를 시작한 뒤엔 절대 재시딩 안 함
  // (todayData 지연 도착이 진행/정지 상태를 덮어써 과다·과소집계하던 레이스 제거). running과 무관하게 todayData에만 반응.
  useEffect(() => {
    if (startedRef.current || baseRef.current !== null) return;
    if (todayData?.todaySeconds != null) {
      setSec(todayData.todaySeconds);
      baseRef.current = todayData.todaySeconds;
    }
  }, [todayData]);
  useEffect(() => { if (!running) return; const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, [running]);
  // 실행→정지 전환 시, baseline 이후 늘어난 만큼만 로깅(최신 secRef 참조 → 이중집계/레이스 방지).
  useEffect(() => {
    if (running) {
      startedRef.current = true;
      baseRef.current = secRef.current; // 시작 시점 baseline 확정
      return;
    }
    const base = baseRef.current ?? secRef.current;
    const elapsed = secRef.current - base;
    if (elapsed <= 0) return;
    baseRef.current = secRef.current;
    sessionsApi.log(elapsed, 'timer')
      .then(() => { qc.invalidateQueries({ queryKey: ['sessions'] }); qc.invalidateQueries({ queryKey: ['gamification'] }); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  const off = RING_C * (1 - Math.min(sec / 3600, 1));
  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow="연습" title="오늘 목표 1시간" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[{ marginHorizontal: space.screenX, marginTop: 14, backgroundColor: color.white, borderRadius: radius.hero, padding: 24, alignItems: 'center' }, shadow.card]}>
          <View style={{ width: 150, height: 150, marginBottom: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={150} height={150} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={75} cy={75} r={66} stroke={color.surf} strokeWidth={11} fill="none" />
              <Circle cx={75} cy={75} r={66} stroke={color.blue} strokeWidth={11} fill="none" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={off} />
            </Svg>
            <Text style={{ fontFamily: font.xb, fontSize: 36, letterSpacing: -0.5, color: color.ink }}>{mm}:{ss}</Text>
            <Text style={{ fontFamily: font.sb, fontSize: 12, color: color.sub2 }}>/ 60분</Text>
          </View>
          <Pressable onPress={() => setRunning((r) => !r)} style={{ alignSelf: 'stretch', backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>{running ? '일시정지' : '연습 시작'}</Text>
          </Pressable>
          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 10, textAlign: 'center' }}>30분마다 +10 👏 · 무용음악 재생 시간도 인정돼요</Text>
        </View>

        <Section title="무용음악">
          <Pressable onPress={() => nav.navigate('music')}>
            <View style={[{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.white, borderRadius: radius.card }, shadow.card]}>
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: color.purpleBg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>💃</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.b, fontSize: 15, color: color.ink }}>무용음악 보관함</Text>
                <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>배정곡 재생 · 배속 · 재생 시간도 연습으로 인정돼요</Text>
              </View>
              <Icon name="player-play" size={22} color={color.purple} />
            </View>
          </Pressable>
        </Section>

        <Section title="오늘의 한 줄" right="『갈매기』">
          <Card style={{ padding: 20 }}>
            <Text style={{ fontFamily: font.b, fontSize: 15.5, lineHeight: 26, color: color.ink }}>"난 갈매기… 아니, 그게 아니야.{'\n'}난 배우야."</Text>
            <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 8 }}>니나 · 4막</Text>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

// ── 배움 ──
export function LearnScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const [ans, setAns] = useState<number | null>(null);
  // 정답 인덱스/해설은 서버 채점 결과로만 채운다(로컬 가짜 판정 없음).
  const [answerIdx, setAnswerIdx] = useState<number>(-1);
  const [explain, setExplain] = useState<string | null>(null);

  // 실데이터만 사용 — 없으면 가짜 퀴즈/자료를 만들지 않고 빈/로딩 상태로.
  const { data: quiz, isLoading: quizLoading } = useQuery({ queryKey: ['content', 'quiz'], queryFn: () => contentApi.quizToday(), retry: false, staleTime: 30000 });
  const { data: readingData } = useQuery({ queryKey: ['content', 'reading'], queryFn: () => contentApi.reading(), retry: false, staleTime: 30000 });
  const { data: mediaData } = useQuery({ queryKey: ['content', 'media'], queryFn: () => contentApi.media(), retry: false, staleTime: 30000 });
  const { data: interviewData } = useQuery({ queryKey: ['content', 'interview'], queryFn: () => contentApi.interviewRandom(), retry: false, staleTime: 30000 });

  // 이미 오늘 푼 경우 → answered 상태 반영
  useEffect(() => {
    if (!quiz) return;
    if (quiz.answered) {
      if (typeof quiz.chosenIndex === 'number') setAns(quiz.chosenIndex);
      if (typeof quiz.answerIndex === 'number') setAnswerIdx(quiz.answerIndex);
      if (quiz.explanation != null) setExplain(quiz.explanation);
    }
  }, [quiz]);

  const q = quiz?.question ?? null;
  const options = q?.options ?? [];

  const onPick = (i: number) => {
    if (ans !== null || !q) return;
    setAns(i);
    contentApi.quizAnswer(q.id, i)
      .then((r) => {
        setAnswerIdx(r.answerIndex);
        setExplain(r.explanation ?? null);
        qc.invalidateQueries({ queryKey: ['gamification'] });
      })
      .catch(() => {});
  };

  const answered = ans !== null;
  const isCorrect = answered && ans === answerIdx;

  const reading = readingData ?? [];
  const readingColors = [
    { iconBg: color.blueBg, iconColor: color.blue },
    { iconBg: color.successBg, iconColor: color.success },
  ];

  // 실제 배정된 자료만 표시(가짜 '시청 완료'·'선생님 추천' 금지). 없으면 빈 상태.
  const media = mediaData ?? [];

  // 실제 배정된 면접 질문만. 없으면 특정 질문을 지어내지 않고 자유 주제로 안내.
  const interview = interviewData?.question?.question ?? null;

  const watch = (id: string) => {
    contentApi.watchMedia(id).then(() => qc.invalidateQueries({ queryKey: ['gamification'] })).catch(() => {});
  };

  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow="배움" title="오늘의 상식 퀴즈" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <Card style={{ padding: 20 }}>
            {q ? (
              <>
                <View style={{ alignSelf: 'flex-start', backgroundColor: color.blueBg, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 10 }}><Text style={{ fontFamily: font.b, fontSize: 11, color: color.blue }}>{q.category}</Text></View>
                <Text style={{ fontFamily: font.b, fontSize: 15.5, lineHeight: 24, color: color.ink, marginBottom: 16 }}>{q.question}</Text>
                {options.map((o, i) => {
                  const correct = answered && i === answerIdx;
                  const bg = answered ? (correct ? color.successBg : i === ans ? color.dangerBg : color.white) : color.white;
                  const bd = answered ? (correct ? color.success : i === ans ? color.danger : color.inputLine) : color.inputLine;
                  const fg = answered ? (correct ? color.success : i === ans ? color.danger : color.ink) : color.ink;
                  return (
                    <Pressable key={o} onPress={() => onPick(i)} style={{ borderWidth: 1.5, borderColor: bd, backgroundColor: bg, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                      <Text style={{ fontFamily: font.sb, fontSize: 14, color: fg }}>{o}</Text>
                    </Pressable>
                  );
                })}
                {answered && answerIdx >= 0 && <Text style={{ fontFamily: font.m, fontSize: 12.5, color: isCorrect ? color.success : color.danger, marginTop: 2 }}>{isCorrect ? '정답! +5 👏' : `아쉬워요 — 정답은 ${options[answerIdx] ?? ''}`}{explain ? ` · ${explain}` : ''}</Text>}
              </>
            ) : (
              <View style={{ paddingVertical: 6, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>{quizLoading ? '불러오는 중…' : '오늘의 퀴즈가 아직 없어요'}</Text></View>
            )}
          </Card>
        </View>

        <Section title="작품 읽을거리" right={reading.length ? `${reading.length}편 ›` : undefined}>
          <Card>
            {reading.length > 0 ? reading.map((r, i) => {
              const c = readingColors[i % readingColors.length];
              return (
                <V2Row key={r.id} first={i === 0} icon="book" iconBg={c.iconBg} iconColor={c.iconColor} title={r.title} sub={r.sub ?? `${r.minutes}분`} right={<Icon name="chevron-right" size={18} color={color.faint} />} />
              );
            }) : (
              <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>배정된 읽을거리가 없어요</Text></View>
            )}
          </Card>
        </Section>

        <Section title="질의응답 준비">
          <Card style={{ padding: 20 }}>
            {interview ? (
              <>
                <Text style={{ fontFamily: font.b, fontSize: 12, color: color.sub2 }}>랜덤 질문</Text>
                <Text style={{ fontFamily: font.b, fontSize: 15.5, lineHeight: 24, color: color.ink, marginTop: 8, marginBottom: 16 }}>"{interview}"</Text>
              </>
            ) : (
              <Text style={{ fontFamily: font.m, fontSize: 13.5, lineHeight: 22, color: color.sub, marginBottom: 16 }}>오늘의 면접 질문이 아직 없어요 · 자유 주제로 답변을 녹음해볼 수 있어요</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => nav.navigate('record')} style={{ flex: 1, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.white }}>🎙️ 답변 녹음</Text></Pressable>
              <Pressable onPress={() => nav.navigate('aiRevise', { question: interview ?? '' })} style={{ flex: 1, backgroundColor: color.blueBg, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.blue }}>✨ AI 첨삭</Text></Pressable>
            </View>
          </Card>
        </Section>

        <Section title="시청각 자료" right="이번 주 배정">
          <Card>
            {media.length > 0 ? media.map((m, i) => (
              <V2Row key={m.id} first={i === 0} icon="player-play" iconBg={color.dangerBg} iconColor={color.danger} title={m.title} sub={m.sub ?? m.duration ?? ''} onPress={() => watch(m.id)} right={<Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.amber }}>+5 👏</Text>} />
            )) : (
              <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>이번 주 배정된 자료가 없어요</Text></View>
            )}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

// ── 제출 ──
const SUBMIT_KIND: Record<string, SubmissionKind> = {
  '연기 영상': 'video',
  '연습 일지': 'journal',
  '식단 기록': 'diet',
};

export function SubmitScreen() {
  const qc = useQueryClient();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const { upload } = useUploads();
  const [type, setType] = useState<{ label: string; sub: string; icon: string; bg: string; fg: string }>({ label: '연기 영상', sub: '자유연기 · 지정연기 · 무용', icon: 'video', bg: color.dangerBg, fg: color.danger });
  const [note, setNote] = useState('');
  const [attachUrl, setAttachUrl] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [busy, setBusy] = useState(false);
  const attachPhoto = async () => {
    try { setAttaching(true); const media = await pickMedia('image'); if (media) { const r = await upload('일지 첨부', media, { subfolder: 'journals' }); setAttachUrl(r.url); } }
    catch (e: any) { Alert.alert('첨부 실패', e?.message || '첨부하지 못했어요'); }
    finally { setAttaching(false); }
  };
  const kind = SUBMIT_KIND[type.label] ?? 'video';
  const isVideo = kind === 'video';
  const isDiet = kind === 'diet';
  const TYPES = [
    { label: '연기 영상', sub: '자유연기 · 지정연기 · 무용', icon: 'video', bg: color.dangerBg, fg: color.danger },
    { label: '연습 일지', sub: '기록 작성 · 파일 첨부', icon: 'notebook', bg: color.successBg, fg: color.success },
    { label: '식단 기록', sub: '사진 + 메모', icon: 'salad', bg: color.amberBg, fg: color.amber },
  ];

  // 연습 일지 저장(학생 연습일지 + 선생님 알림). 영상은 인라인 VideoUploadForm, 식단은 식단화면.
  const saveJournal = async () => {
    if (busy) return;  // 이중 탭 방지
    const content = note.trim();
    if (!content) { Alert.alert('한 줄 이상 적어주세요', '오늘 연습에서 잘된 점이나 느낀 점을 적어주세요.'); return; }
    setBusy(true);
    try {
      await practiceJournalApi.create({ title: `연습 일지 ${kstMD()}`, content, attachmentUrl: attachUrl ?? undefined });
      setNote(''); setAttachUrl(null);
      gamificationApi.award('journal', 5).then(() => qc.invalidateQueries({ queryKey: ['gamification'] })).catch(() => {});
      Alert.alert('저장 완료', '연습 일지를 저장했어요 · 선생님께 전달됐어요 · +5 👏');
    } catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };
  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow="제출" title="무엇을 제출할까요?" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <Card>
            {TYPES.map((t, i) => (
              <Pressable key={t.label} onPress={() => setType(t)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.line, backgroundColor: type.label === t.label ? color.surf : (pressed ? '#FAFBFC' : color.white) }]}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={t.icon} size={20} color={t.fg} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{t.label}</Text><Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>{t.sub}</Text></View>
                <Icon name="chevron-right" size={18} color={color.faint} />
              </Pressable>
            ))}
          </Card>
        </View>
        <View style={{ marginHorizontal: space.screenX, marginTop: 16 }}>
          <Card style={{ padding: 20 }}>
            <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub2, marginBottom: 14 }}>{type.label}</Text>

            {isVideo ? (
              // 영상: 이 화면에서 바로 선택/촬영 → 제목·카테고리 → 업로드(별도 화면 이동 없음)
              <VideoUploadForm onUploaded={() => nav.navigate('videos')} />
            ) : isDiet ? (
              // 식단: 이 화면에서 바로 사진 선택/촬영 + 끼니 + 메모 → 저장(별도 화면 이동 없음)
              <DietUploadForm studentId={user?.id ?? ''} onSaved={() => nav.navigate('diet')} />
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
                  {JOURNAL_PRESETS.map((m) => (
                    <Pressable key={m} onPress={() => setNote(m)} style={{ backgroundColor: color.blueBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ fontSize: 12.5, fontFamily: font.m, color: color.blue }}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput value={note} onChangeText={setNote} placeholder="빠른 문구를 고르거나 직접 입력하세요" placeholderTextColor={color.faint} multiline style={{ borderWidth: 1, borderColor: color.inputLine, borderRadius: 14, padding: 12, minHeight: 96, fontFamily: font.r, fontSize: 14, color: color.ink, textAlignVertical: 'top' }} />
                <Pressable onPress={attachPhoto} disabled={attaching} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.surf, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <Icon name="photo" size={18} color={attachUrl ? color.success : color.sub} />
                  <Text style={{ fontFamily: font.m, fontSize: 13.5, color: attachUrl ? color.success : color.sub }}>{attaching ? '첨부 중…' : attachUrl ? '사진 첨부됨 · 다시 선택' : '사진 첨부 (선택)'}</Text>
                </Pressable>
                <Pressable onPress={saveJournal} disabled={busy} style={({ pressed }) => [{ marginTop: 12, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : pressed ? 0.92 : 1 }]}>
                  <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>{busy ? '저장 중…' : '연습 일지 저장'}</Text>
                </Pressable>
                <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center', marginTop: 10 }}>저장하면 선생님께 전달돼요 · +5 👏</Text>
              </>
            )}
          </Card>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ── MY ──
export function MyScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const nm = (user?.name || '').trim() || '학생';
  // 갈채 카탈로그(소유 여부는 실데이터로만 채운다 — 백엔드가 없으면 전부 잠금으로 표시, 가짜 획득 금지)
  const CATALOG = [
    { code: 'm-1', icon: '🎙️', title: '첫 녹음', sub: '데뷔 무대' },
    { code: 'm-2', icon: '🔥', title: '7일 연속', sub: '커튼콜' },
    { code: 'm-3', icon: '🌟', title: '성장상', sub: '선생님 수여' },
    { code: 'm-4', icon: '🕊️', title: '갈매기 마스터', sub: '독백 완성' },
    { code: 'm-5', icon: '🏛️', title: '한예종 준비생', sub: '지정희곡 3편' },
    { code: 'm-6', icon: '💯', title: '100일 커튼콜', sub: '스트릭 100일' },
  ];
  const { data: badgeSet } = useQuery({ queryKey: ['achievements'], queryFn: () => achievementsApi.me(), retry: false, staleTime: 30000 });
  const rawBadges = (badgeSet?.badges && badgeSet.badges.length > 0) ? badgeSet.badges : CATALOG.map((b) => ({ ...b, owned: false }));
  const badges = [...rawBadges].sort((a: any, b: any) => Number(!!b.owned) - Number(!!a.owned)); // 획득한 갈채를 앞으로
  const ownedLabel = badgeSet ? `${badgeSet.ownedCount} / ${badgeSet.total}` : '—';
  const { data: weights } = useQuery({ queryKey: ['myWeight'], queryFn: () => dietApi.listWeight({ studentId: user?.id, days: 180 }), retry: false, staleTime: 60000, enabled: !!user?.id });
  const latestW = (weights ?? []).slice().sort((a, b) => (String(a.date) < String(b.date) ? 1 : -1))[0] ?? null;
  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow="MY" title={`배우 ${nm}`} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Section title="내 활동">
          <Card>
            <V2Row first icon="video" iconBg={color.dangerBg} iconColor={color.danger} title="내가 올린 영상" sub="날짜별로 다시 보고 피드백 확인" right={<Icon name="chevron-right" size={18} color={color.faint} />} onPress={() => nav.navigate('videos')} />
            <V2Row icon="flame" iconBg={color.amberBg} iconColor={color.amber} title="박수 교환소" sub="모은 박수로 피드백권·프리즈 교환" right={<Icon name="chevron-right" size={18} color={color.faint} />} onPress={() => nav.navigate('exchange')} />
            <V2Row icon="settings" iconBg={color.blueBg} iconColor={color.blue} title="프로필·설정" sub="사진·비밀번호 변경 · 로그아웃" right={<Icon name="chevron-right" size={18} color={color.faint} />} onPress={() => nav.navigate('profile')} />
          </Card>
        </Section>

        <Section title="받은 갈채" right={ownedLabel}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {badges.map((b) => (
              <View key={b.code} style={{ width: '31.5%', marginBottom: 9, backgroundColor: color.white, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' }}>
                <View style={{ marginBottom: 7 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: b.owned ? color.amberBg : color.surf, alignItems: 'center', justifyContent: 'center', opacity: b.owned ? 1 : 0.45 }}><Text style={{ fontSize: 18 }}>{b.icon}</Text></View>
                  {!b.owned && (
                    <View style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.line }}><Icon name="lock" size={9} color={color.sub2} /></View>
                  )}
                </View>
                <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 12.5, color: b.owned ? color.ink : color.sub2 }}>{b.title}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 10.5, color: color.sub2, marginTop: 1 }}>{b.sub}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="체중 · 컨디션" right="기록 ›">
          <Pressable onPress={() => nav.navigate('diet')}>
            <Card style={{ padding: 18 }}>
              {latestW ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontFamily: font.xb, fontSize: 24, color: color.ink }}>{latestW.weight}<Text style={{ fontFamily: font.b, fontSize: 13 }}>kg</Text></Text>
                    <View style={{ marginLeft: 8, backgroundColor: color.blueBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.blue }}>최근 기록</Text></View>
                  </View>
                  <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 8 }}>컨디션 기록은 담당 선생님·원장님만 볼 수 있어요 · 탭하여 추이 보기</Text>
                </>
              ) : (
                <>
                  <Text style={{ fontFamily: font.b, fontSize: 15, color: color.sub }}>아직 체중 기록이 없어요</Text>
                  <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 6 }}>탭하여 첫 기록을 시작해보세요 · 담당 선생님·원장님만 볼 수 있어요</Text>
                </>
              )}
            </Card>
          </Pressable>
        </Section>

        <Section title="오늘의 식단">
          <Card>
            <V2Row first icon="bowl" iconBg={color.amberBg} iconColor={color.amber} title="식단 기록·조회" sub="사진과 메모로 남겨요" right={<Icon name="chevron-right" size={18} color={color.faint} />} onPress={() => nav.navigate('diet')} />
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
