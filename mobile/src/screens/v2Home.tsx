import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../components/kit';
import { Hero, FeedbackBanner, Section, Card, ClapCheckRow, V2Row, PageHeader } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { useAuth } from '../AuthContext';
import { gamificationApi, routinesApi, examsApi, sessionsApi, submissionsApi, achievementsApi, contentApi, noticeApi } from '../services/api';
import { fmtDday } from '../lib/date';
import { useDataRefresh } from '../services/ws';

const comma = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// 초 → "N시간 M분" (히어로 값). H/분 라벨은 작은 폰트로 감싼다.
const hourMinNode = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return (
    <Text>{h}<Text style={{ fontFamily: font.b, fontSize: 19 }}>시간</Text> {m}<Text style={{ fontFamily: font.b, fontSize: 19 }}>분</Text></Text>
  );
};
// 초 차이 → "N시간 M분"(양수만; 지난달 대비 증가분 문구용)
const hourMinStr = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};
// KST(UTC+9) 달력 날짜 "YYYY-M-D" — 기기 타임존과 무관.
const kstDateStr = (ms: number): string => {
  const d = new Date(ms + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
};
// 오늘(KST) 헤더 라벨 "M월 D일 요일"
const kstTodayLabel = (): string => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${days[d.getUTCDay()]}요일`;
};
// 백엔드의 naive-UTC ISO(타임존 표기 없음)는 UTC로 간주. 날짜 전용("2026-10-11")도 처리.
const parseUtcMs = (iso: string): number =>
  Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : (iso.includes('T') ? `${iso}Z` : `${iso}T00:00:00Z`));
// examDate → "M월 D일 (요일)" (KST 기준)
const fmtExamDate = (iso?: string | null): string => {
  if (!iso) return '';
  const t = parseUtcMs(iso);
  if (isNaN(t)) return String(iso);
  const d = new Date(t + 9 * 3600 * 1000);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${days[d.getUTCDay()]})`;
};

// 작은 회색 안내(불러오는 중 / 없음 / 실패) — 카드 안 빈 상태 공용
function NoteRow({ text }: { text: string }) {
  return <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>{text}</Text></View>;
}

// v2 홈 — 실데이터(GET /api/gamification/me 등). 데이터가 없을 땐 "가짜"를 만들지 않고
// 로딩(—)·빈 상태(안내문)로 정직하게 보여준다.
export function HomeScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const nm = (user?.name || '').trim() || '학생';
  const [showFb, setShowFb] = useState(true);
  const [justChecked, setJustChecked] = useState<Set<string>>(() => new Set());

  const g = useQuery({ queryKey: ['gamification'], queryFn: () => gamificationApi.me(), retry: false, staleTime: 30000 });
  const routinesQ = useQuery({ queryKey: ['routines'], queryFn: () => routinesApi.today(), retry: false, staleTime: 30000 });
  const { data: dday } = useQuery({ queryKey: ['exams', 'dday'], queryFn: () => examsApi.dday(), retry: false, staleTime: 30000 });
  const examsQ = useQuery({ queryKey: ['exams', 'list'], queryFn: () => examsApi.list(), retry: false, staleTime: 30000 });
  const summaryQ = useQuery({ queryKey: ['sessions', 'summary'], queryFn: () => sessionsApi.summary(), retry: false, staleTime: 30000 });
  const { data: mine } = useQuery({ queryKey: ['submissions', 'mine'], queryFn: () => submissionsApi.mine(), retry: false, staleTime: 30000 });
  const { data: badgeSet } = useQuery({ queryKey: ['achievements'], queryFn: () => achievementsApi.me(), retry: false, staleTime: 30000 });
  const { data: quiz } = useQuery({ queryKey: ['content', 'quiz'], queryFn: () => contentApi.quizToday(), retry: false, staleTime: 30000 });
  const { data: notices } = useQuery({ queryKey: ['notices'], queryFn: () => noticeApi.list(), retry: false, staleTime: 60000 });

  // 실시간(WS): 서버에서 공지/피드백/제출/뱃지 변경 시 홈 관련 쿼리 재조회 → 요약화면도 라이브 갱신.
  useDataRefresh(['notices', 'portfolios', 'feedback', 'submission', 'badge'], () => {
    qc.invalidateQueries({ queryKey: ['notices'] });
    qc.invalidateQueries({ queryKey: ['submissions', 'mine'] });
    qc.invalidateQueries({ queryKey: ['gamification'] });
    qc.invalidateQueries({ queryKey: ['achievements'] });
  });

  // 서버/네트워크 장애 감지 — 이 앱은 로컬 서버+ngrok이라 꺼지면 전 섹션이 '빈 데이터'처럼 보인다.
  // 빈 상태와 장애를 구별해 배너로 명시하고, 당겨서 새로고침으로 복구 수단을 제공.
  const anyError = g.isError || routinesQ.isError || summaryQ.isError || examsQ.isError;
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await qc.invalidateQueries(); } finally { setRefreshing(false); }
  };

  const gData = g.data;
  const clapsStr = gData ? comma(gData.clapsBalance) : (g.isLoading ? '—' : '0');
  const streakStr = gData ? `${gData.streakDays}일째` : (g.isLoading ? '—' : '0일째');
  const badgeStr = badgeSet ? `${badgeSet.ownedCount} / ${badgeSet.total}` : '—';

  // 완료 행동 → 서버에 박수 지급 → 히어로 갱신.
  const doRoutineCheck = (id: string) => {
    setJustChecked((prev) => new Set(prev).add(id));
    routinesApi.check(id)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['routines'] });
        qc.invalidateQueries({ queryKey: ['gamification'] });
      })
      .catch(() => {});
  };

  // D-day 칩: 실데이터가 있을 때만. 없으면(미설정/백엔드다운) 아예 표시하지 않는다(가짜 학교명 금지).
  const ddayExam = dday?.exam ?? null;
  const ddayChip = ddayExam ? (
    <View style={{ backgroundColor: color.dangerBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
      <Text style={{ fontFamily: font.b, fontSize: 12, color: color.danger }}>{ddayExam.title}{ddayExam.dday != null ? ` ${fmtDday(ddayExam.dday)}` : ''}</Text>
    </View>
  ) : undefined;

  // 히어로 이번 달 연습 시간 — "0시간 0분"으로 보이는 구간(1분 미만)까지 격려 문구로 대체(거대한 0 방지).
  const summary = summaryQ.data;
  const monthSecs = summary?.monthSeconds ?? 0;
  const monthDiffSecs = summary ? Math.max(0, summary.monthSeconds - summary.lastMonthSeconds) : 0;
  const heroValue = summary
    ? (monthSecs < 60
        ? <Text style={{ fontFamily: font.b, fontSize: 18, lineHeight: 26, color: color.sub }}>이번 달 연습을 시작해볼까요?</Text>
        : hourMinNode(monthSecs))
    : <Text style={{ fontFamily: font.b, fontSize: 22, color: color.faint }}>—</Text>;
  // 증가분도 1분 미만이면 "0분"이 되어 무의미 → 표시하지 않음.
  const heroDiff = summary && monthSecs >= 60 && monthDiffSecs >= 60
    ? `지난달보다 ${hourMinStr(monthDiffSecs)}`
    : undefined;

  // 피드백 배너: 실제로 피드백이 도착한 내 제출이 있을 때만(가짜 "김쏠 선생님…니나 독백" 제거).
  const fbSub = (mine ?? []).find((s) => s.status === 'done' && !!s.feedback) ?? null;

  // 다가오는 일정
  const examList = examsQ.data;
  const upcoming = (examList ?? []).slice(0, 4);

  // 루틴 완료수
  const realItems = routinesQ.data?.items ?? [];
  const realDone = realItems.filter((it) => it.done || justChecked.has(it.id)).length;

  // 오늘의 미션 완료 신호(실데이터): 오늘 영상/일지 제출 여부 + 퀴즈 응답 여부
  const isToday = (iso?: string) => {
    if (!iso) return false;
    const t = parseUtcMs(iso);
    return !isNaN(t) && kstDateStr(t) === kstDateStr(Date.now());
  };
  const vidDone = (mine ?? []).some((s) => s.kind === 'video' && isToday(s.createdAt));
  const jrnDone = (mine ?? []).some((s) => s.kind === 'journal' && isToday(s.createdAt));
  const quizDone = !!quiz?.answered;
  const doneTag = <Text style={{ fontFamily: font.b, fontSize: 13, color: color.success }}>완료 ✓</Text>;

  const rewardTxt = { fontFamily: font.b, fontSize: 13.5, color: color.amber } as const;

  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow={kstTodayLabel()} title={`${nm}님,\n오늘 연습 시작해볼까요?`} right={ddayChip} bell />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.blue} />}>
        {anyError && (
          <Pressable onPress={onRefresh} style={{ marginHorizontal: space.screenX, marginTop: 12, backgroundColor: color.dangerBg, borderRadius: radius.card, paddingVertical: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={{ fontFamily: font.sb, fontSize: 13, color: color.danger }}>연결에 문제가 있어요 · 탭하여 다시 시도</Text>
          </Pressable>
        )}
        {fbSub && showFb && (
          <FeedbackBanner
            title="선생님의 피드백이 도착했어요"
            sub={`${fbSub.title}${fbSub.feedbackAgo ? ` · ${fbSub.feedbackAgo}` : ''}`}
            onPress={() => { setShowFb(false); nav.navigate('videos'); }}
          />
        )}

        {notices && notices.length > 0 && (
          <Section title="학원 공지" right={<Pressable onPress={() => nav.navigate('notices')} hitSlop={8}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.blue }}>전체 ›</Text></Pressable>}>
            <Card>
              {notices.slice(0, 3).map((n, i) => (
                <V2Row
                  key={n.id}
                  first={i === 0}
                  icon="speakerphone"
                  iconBg={n.important ? color.dangerBg : color.blueBg}
                  iconColor={n.important ? color.danger : color.blue}
                  title={n.title}
                  sub={(n.date || '').slice(0, 10)}
                  right={n.important ? <Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.danger }}>중요</Text> : undefined}
                  onPress={() => nav.navigate('notices', { focusId: n.id })}
                />
              ))}
            </Card>
          </Section>
        )}

        <Hero
          label="이번 달 연습 시간"
          value={heroValue}
          diff={heroDiff}
          stats={[{ label: '내 박수 👏', value: clapsStr }, { label: '커튼콜 🎭', value: streakStr }, { label: '받은 갈채 🏆', value: badgeStr }]}
        />

        {/* 일일 박수 상한 도달 안내 — 상한에 걸려 +0이 되는 걸 조용히 두지 않고 명확히 알린다. */}
        {gData && gData.dailyCap > 0 && gData.clapsToday >= gData.dailyCap && (
          <View style={{ marginHorizontal: space.screenX, marginTop: 10, backgroundColor: color.amberBg, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14 }}>
            <Text style={{ fontFamily: font.sb, fontSize: 13, color: color.amber, textAlign: 'center' }}>오늘 박수 {gData.dailyCap}개를 다 모았어요 🎉 · 내일 또 모아요</Text>
          </View>
        )}

        <Section
          title="오늘의 루틴"
          right={routinesQ.data ? `${realDone} / ${routinesQ.data.total} 완료` : undefined}
        >
          <Card>
            {realItems.length > 0 ? (
              realItems.map((it, i) => (
                <ClapCheckRow
                  key={it.id}
                  first={i === 0}
                  title={it.title}
                  sub={it.sub ?? undefined}
                  reward={it.reward}
                  done={it.done || justChecked.has(it.id)}
                  onDone={it.done || justChecked.has(it.id) ? undefined : () => doRoutineCheck(it.id)}
                />
              ))
            ) : (
              <NoteRow text={routinesQ.isLoading ? '루틴을 불러오는 중…' : '오늘 배정된 루틴이 없어요'} />
            )}
          </Card>
        </Section>

        <Section title="오늘의 미션">
          <Card>
            <V2Row first icon="video" iconBg={color.dangerBg} iconColor={color.danger} title="연기 영상 1개 제출" sub="오늘 연습을 영상으로 남겨요" right={vidDone ? doneTag : <Text style={rewardTxt}>+15 👏</Text>} onPress={() => nav.navigate('submit', { preset: 'video' })} />
            <V2Row icon="book" iconBg={color.blueBg} iconColor={color.blue} title="오늘의 상식 퀴즈" sub="연극사 · 1문제" right={quizDone ? doneTag : <Text style={rewardTxt}>+5 👏</Text>} onPress={() => nav.navigate('learn')} />
            <V2Row icon="notebook" iconBg={color.successBg} iconColor={color.success} title="연습 일지 쓰기" sub="오늘 잘된 점 한 줄이면 충분해요" right={jrnDone ? doneTag : <Text style={rewardTxt}>+5 👏</Text>} onPress={() => nav.navigate('submit', { preset: 'journal' })} />
          </Card>
        </Section>

        <Section title="다가오는 일정">
          <Card>
            {upcoming.length > 0 ? (
              upcoming.map((ex, i) => {
                const urgent = ex.dday != null && ex.dday <= 30;
                return (
                  <V2Row
                    key={ex.id}
                    first={i === 0}
                    icon="calendar"
                    iconBg={urgent ? color.dangerBg : color.amberBg}
                    iconColor={urgent ? color.danger : color.amber}
                    title={ex.title}
                    sub={fmtExamDate(ex.examDate)}
                    right={ex.dday != null ? <Text style={{ fontFamily: font.b, fontSize: 13.5, color: urgent ? color.danger : color.sub }}>{fmtDday(ex.dday)}</Text> : undefined}
                  />
                );
              })
            ) : (
              <NoteRow text={examsQ.isLoading ? '일정을 불러오는 중…' : '예정된 일정이 없어요'} />
            )}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
