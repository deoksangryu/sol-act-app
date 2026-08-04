import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/kit';
import { Section, Card, PageHeader } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';
import { submissionsApi, portfolioApi, type SubmissionKind } from '../services/api';
import { useDataRefresh } from '../services/ws';
import { useAuth } from '../AuthContext';

type SubType = '녹음' | '일지' | '면접' | '식단' | '영상' | '작품분석';
const TYPE_TONE: Record<SubType, { bg: string; fg: string }> = {
  녹음: { bg: color.purpleBg, fg: color.purple },
  영상: { bg: color.dangerBg, fg: color.danger },
  일지: { bg: color.successBg, fg: color.success },
  면접: { bg: color.blueBg, fg: color.blue },
  식단: { bg: color.amberBg, fg: color.amber },
  작품분석: { bg: color.blueBg, fg: color.blue },
};
function TypeTag({ t }: { t: SubType }) {
  const c = TYPE_TONE[t];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: font.b, fontSize: 11, color: c.fg }}>{t}</Text>
    </View>
  );
}

interface InboxItem { id: string; student: string; studentId?: string; work: string; ago: string; type: SubType; ref?: string | null }
interface DoneItem { id?: string; student: string; work: string; type: SubType; lead: string }

// 제출 kind(영문) → 화면 태그(SubType) 매핑
const KIND_TAG: Record<SubmissionKind, SubType> = {
  recording: '녹음',
  video: '영상',
  journal: '일지',
  diet: '식단',
  interview: '면접',
  analysis: '작품분석',
};

// v2 선생님 통합 인박스 — "비우는 화면". 실데이터(GET /api/submissions/inbox).
// 데이터가 없을 땐 가짜 학생을 만들지 않고 로딩/실패/빈 상태로 정직하게 보여준다.
export function InboxScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['inbox'], queryFn: () => submissionsApi.inbox(), retry: false, staleTime: 15000 });
  // 영상 리뷰 대기(포트폴리오 피드)도 미처리에 합산 — 제출 인박스만 보면 대기 영상을 놓친다.
  const { data: feed, refetch: refetchFeed } = useQuery({ queryKey: ['portfolio', 'feed'], queryFn: () => portfolioApi.listFeed(), retry: false, staleTime: 15000 });
  // 리뷰 화면에서 피드백을 보내고 돌아오면 즉시 목록/카운트를 갱신한다.
  useFocusEffect(useCallback(() => { refetch(); refetchFeed(); }, [refetch, refetchFeed]));
  // 실시간(WS): 학생이 새로 제출/업로드하면 인박스를 켜둔 채로도 카운트가 즉시 갱신된다(요약화면 라이브).
  useDataRefresh(['submission', 'portfolios', 'feedback'], () => { refetch(); refetchFeed(); });

  const inbox: InboxItem[] = (data?.open ?? []).map((o) => ({
    id: o.id,
    student: o.student,
    studentId: o.studentId,
    work: o.title,
    ago: o.ago,
    type: KIND_TAG[o.kind] ?? '녹음',
    ref: o.note,
  }));
  const done: DoneItem[] = (data?.doneToday ?? []).map((d) => ({
    id: d.id,
    student: d.student,
    work: d.title,
    type: KIND_TAG[d.kind] ?? '녹음',
    lead: d.lead,
  }));
  const count = inbox.length;
  const feedPending = (feed ?? []).reduce((s, c) => s + (c.pendingFeedback || 0), 0);
  const total = count + feedPending;

  const process = (item: InboxItem) => {
    // 리뷰 화면으로 이동 — student_id가 있으면 그 학생 영상만 필터(백엔드 restart 후 반영),
    // 없으면(구버전 백엔드) 전체 피드로 이동해 날짜별 목록에서 바로 찾는다.
    if (item.type === '작품분석') nav.navigate('workAnalysisReview', { analysisId: item.ref });
    else if (item.type === '식단') nav.navigate('diet');
    else nav.navigate('videos', item.studentId ? { studentId: item.studentId } : {});
  };

  // 이름이 이미 "…선생님"으로 끝나면 중복해서 붙이지 않는다(예: "테스트 선생님").
  const nm = (user?.name || '').trim();
  const eyebrow = !nm ? '선생님' : (nm.endsWith('선생님') ? nm : `${nm} 선생님`);

  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader
        eyebrow={eyebrow}
        title="피드백 인박스"
        bell
        onSettings={() => nav.navigate('profile')}
        right={(
          <View style={{ backgroundColor: color.blueBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ fontFamily: font.b, fontSize: 12, color: color.blue }}>미처리 {total}건</Text>
          </View>
        )}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Pressable onPress={() => nav.navigate('videos')} style={({ pressed }) => [{ marginHorizontal: space.screenX, marginTop: 10, backgroundColor: color.white, borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, pressed && { backgroundColor: color.surf }]}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: color.dangerBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="video" size={18} color={color.danger} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.sb, fontSize: 14.5, color: color.ink }}>학생 영상 리뷰</Text>
            <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 1 }}>재생하고 피드백을 남겨요</Text>
          </View>
          {feedPending > 0 && (
            <View style={{ backgroundColor: color.warnBg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, marginRight: 2 }}>
              <Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.warn }}>피드백 필요 {feedPending}</Text>
            </View>
          )}
          <Icon name="chevron-right" size={18} color={color.faint} />
        </Pressable>

        <Section title={`제출 대기 ${count}건`}>
          <Card>
            {isLoading ? (
              <View style={{ padding: 22, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13.5, color: color.sub2 }}>불러오는 중…</Text></View>
            ) : isError ? (
              <View style={{ padding: 22, alignItems: 'center' }}><Icon name="alert-triangle" size={22} color={color.danger} /><Text style={{ fontFamily: font.sb, fontSize: 13.5, color: color.sub, marginTop: 8, textAlign: 'center' }}>제출함을 불러오지 못했어요{'\n'}잠시 후 다시 시도해주세요</Text></View>
            ) : inbox.length === 0 ? (
              feedPending > 0 ? (
                <View style={{ padding: 22, alignItems: 'center' }}><Icon name="video" size={24} color={color.danger} /><Text style={{ fontFamily: font.sb, fontSize: 14, color: color.sub, marginTop: 8, textAlign: 'center' }}>제출 대기는 없어요{'\n'}위 영상 리뷰 {feedPending}건을 확인해주세요</Text></View>
              ) : (
                <View style={{ padding: 22, alignItems: 'center' }}><Icon name="circle-check" size={26} color={color.success} /><Text style={{ fontFamily: font.sb, fontSize: 14, color: color.sub, marginTop: 8 }}>다 비웠어요 👍 오늘도 리드타임 지켰습니다</Text></View>
              )
            ) : (
              inbox.map((it, i) => (
                <Pressable key={it.id} onPress={() => process(it)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }, pressed && { backgroundColor: color.surf }]}>
                  <TypeTag t={it.type} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{it.student} — {it.work}</Text>
                    <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>{it.ago}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={color.faint} />
                </Pressable>
              ))
            )}
          </Card>
        </Section>

        {done.length > 0 && (
          <Section title="오늘 처리 완료" right={`${done.length}건`}>
            <Card style={{ opacity: 0.7 }}>
              {done.map((it, i) => (
                <View key={it.id ?? `m${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
                  <TypeTag t={it.type} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{it.student} — {it.work}</Text>
                    <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>피드백 완료 · 리드타임 {it.lead}</Text>
                  </View>
                  <Icon name="check" size={16} color={color.success} />
                </View>
              ))}
            </Card>
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}
