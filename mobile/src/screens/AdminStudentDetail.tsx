import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen } from '../components/kit';
import { Section, Card, V2Row, PageHeader } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';
import { achievementsApi, portfolioApi, dietApi, practiceJournalApi } from '../services/api';

const mmdd = (s?: string) => {
  if (!s) return '';
  const t = Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
  if (isNaN(t)) return String(s).slice(5, 10).replace('-', '/');
  const d = new Date(t + 9 * 3600 * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const catLabel = (v: string): string => ({ acting: '자유연기', monologue: '독백', musical: '뮤지컬', dance: '자유무용', basics: '발성', scripted: '제시대사' } as Record<string, string>)[v] || v;

function NoteRow({ text }: { text: string }) {
  return <View style={{ padding: 18, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>{text}</Text></View>;
}

// 원장/교사용 학생 종합 상세 — 갈채·영상·체중추이·식단·연습일지를 한 화면에서(읽기 전용).
export function AdminStudentDetail() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const studentId: string = route.params?.studentId;
  const name: string = route.params?.name || '학생';

  const badges = useQuery({ queryKey: ['stu', studentId, 'badges'], queryFn: () => achievementsApi.student(studentId), retry: false, staleTime: 30000, enabled: !!studentId });
  const videos = useQuery({ queryKey: ['stu', studentId, 'videos'], queryFn: () => portfolioApi.list({ studentId, limit: 100 }), retry: false, staleTime: 30000, enabled: !!studentId });
  const weights = useQuery({ queryKey: ['stu', studentId, 'weight'], queryFn: () => dietApi.listWeight({ studentId, days: 180 }), retry: false, staleTime: 30000, enabled: !!studentId });
  const meals = useQuery({ queryKey: ['stu', studentId, 'meals'], queryFn: () => dietApi.list({ studentId, limit: 8 }), retry: false, staleTime: 30000, enabled: !!studentId });
  const journals = useQuery({ queryKey: ['stu', studentId, 'journals'], queryFn: () => practiceJournalApi.list({ studentId }), retry: false, staleTime: 30000, enabled: !!studentId });

  const badgeSet = badges.data;
  const ownedBadges = (badgeSet?.badges ?? []).filter((b) => b.owned);
  const vids = videos.data ?? [];
  const ws = (weights.data ?? []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latestW = ws.length ? ws[ws.length - 1] : null;
  const firstW = ws.length ? ws[0] : null;
  const wDiff = latestW && firstW ? Number(latestW.weight) - Number(firstW.weight) : 0;
  const mealList = meals.data ?? [];
  const jrnList = journals.data ?? [];

  // 체중 스파크라인 좌표(실데이터만)
  const spark = (() => {
    if (ws.length < 2) return null;
    const vals = ws.map((w) => Number(w.weight));
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const W = 300, H = 60, pad = 6;
    const pts = vals.map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
      const y = pad + (1 - (v - min) / span) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { pts: pts.join(' '), last: pts[pts.length - 1] };
  })();

  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow="학생 데이터" title={name} onBack={() => nav.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* 갈채 */}
        <Section title="받은 갈채" right={badgeSet ? `${badgeSet.ownedCount} / ${badgeSet.total}` : undefined}>
          <Card style={{ padding: 16 }}>
            {ownedBadges.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ownedBadges.map((b) => (
                  <View key={b.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.amberBg, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 }}>
                    <Text style={{ fontSize: 15 }}>{b.icon}</Text>
                    <Text style={{ fontFamily: font.sb, fontSize: 12.5, color: color.ink }}>{b.title}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <NoteRow text={badges.isLoading ? '불러오는 중…' : badges.isError ? '불러오지 못했어요 · 다시 시도해주세요' : '아직 받은 갈채가 없어요'} />
            )}
          </Card>
        </Section>

        {/* 연습 영상 */}
        <Section title="연습 영상" right={vids.length ? `${vids.length}개` : undefined}>
          <Card>
            <Pressable onPress={() => nav.navigate('videos', { studentId })} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }, pressed && { backgroundColor: color.surf }]}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: color.dangerBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="video" size={20} color={color.danger} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.sb, fontSize: 14.5, color: color.ink }}>영상 리뷰·피드백 열기</Text>
                <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 1 }}>재생하고 피드백을 남겨요</Text>
              </View>
              <Icon name="chevron-right" size={18} color={color.faint} />
            </Pressable>
            {videos.isLoading ? <NoteRow text="불러오는 중…" /> : videos.isError ? <NoteRow text="불러오지 못했어요 · 다시 시도해주세요" /> : vids.length === 0 ? <NoteRow text="아직 올린 영상이 없어요" /> : (
              vids.slice(0, 5).map((v) => (
                <V2Row key={v.id} icon="player-play" iconBg={color.surf} iconColor={color.sub} title={v.title} sub={`${catLabel(v.category)} · ${mmdd(v.date)}`} right={(v.comments?.length ?? 0) > 0 ? <Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.success }}>피드백 {v.comments!.length}</Text> : <Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.amber }}>대기</Text>} />
              ))
            )}
          </Card>
        </Section>

        {/* 체중 추이 */}
        <Section title="체중 추이">
          <Card style={{ padding: 18 }}>
            {latestW ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={{ fontFamily: font.xb, fontSize: 24, color: color.ink }}>{latestW.weight}<Text style={{ fontFamily: font.b, fontSize: 13 }}>kg</Text></Text>
                  {ws.length > 1 && (
                    <View style={{ marginLeft: 8, backgroundColor: wDiff <= 0 ? color.successBg : color.warnBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: font.b, fontSize: 11.5, color: wDiff <= 0 ? color.success : color.warn }}>6개월 {Math.abs(wDiff).toFixed(1)}kg {wDiff <= 0 ? '↓' : '↑'}</Text>
                    </View>
                  )}
                </View>
                {spark && (
                  <Svg width="100%" height={64} viewBox="0 0 300 60" style={{ marginTop: 8 }}>
                    <Polyline points={spark.pts} fill="none" stroke={color.blue} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={Number(spark.last.split(',')[0])} cy={Number(spark.last.split(',')[1])} r={4} fill={color.blue} />
                  </Svg>
                )}
                <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 6 }}>{ws.length}회 기록 · 최근 {mmdd(latestW.date)}</Text>
              </>
            ) : (
              <NoteRow text={weights.isLoading ? '불러오는 중…' : weights.isError ? '불러오지 못했어요 · 다시 시도해주세요' : '체중 기록이 없어요'} />
            )}
          </Card>
        </Section>

        {/* 최근 식단 */}
        <Section title="최근 식단">
          <Card>
            {meals.isLoading ? <NoteRow text="불러오는 중…" /> : meals.isError ? <NoteRow text="불러오지 못했어요 · 다시 시도해주세요" /> : mealList.length === 0 ? <NoteRow text="식단 기록이 없어요" /> : (
              mealList.slice(0, 6).map((m, i) => (
                <V2Row key={m.id} first={i === 0} icon="bowl" iconBg={color.amberBg} iconColor={color.amber} title={m.description || '식단'} sub={`${({ breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' } as Record<string, string>)[m.mealType] || m.mealType || ''} · ${mmdd((m as any).date || (m as any).createdAt)}`} right={m.teacherComment ? <Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.success }}>코멘트</Text> : undefined} />
              ))
            )}
          </Card>
        </Section>

        {/* 연습 일지 */}
        <Section title="연습 일지">
          <Card>
            {journals.isLoading ? <NoteRow text="불러오는 중…" /> : journals.isError ? <NoteRow text="불러오지 못했어요 · 다시 시도해주세요" /> : jrnList.length === 0 ? <NoteRow text="연습 일지가 없어요" /> : (
              jrnList.slice(0, 6).map((j: any, i: number) => (
                <V2Row key={j.id || i} first={i === 0} icon="notebook" iconBg={color.successBg} iconColor={color.success} title={j.title || '연습 일지'} sub={`${(j.content || '').slice(0, 28)}${(j.content || '').length > 28 ? '…' : ''} · ${mmdd(j.createdAt || j.date)}`} />
              ))
            )}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
