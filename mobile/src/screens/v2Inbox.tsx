import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { Screen, FilterChips } from '../components/kit';
import { Section, Card } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';

type SubType = '녹음' | '일지' | '면접' | '식단' | '영상';
const TYPE_TONE: Record<SubType, { bg: string; fg: string }> = {
  녹음: { bg: color.purpleBg, fg: color.purple },
  영상: { bg: color.dangerBg, fg: color.danger },
  일지: { bg: color.successBg, fg: color.success },
  면접: { bg: color.blueBg, fg: color.blue },
  식단: { bg: color.amberBg, fg: color.amber },
};
function TypeTag({ t }: { t: SubType }) {
  const c = TYPE_TONE[t];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: font.b, fontSize: 11, color: c.fg }}>{t}</Text>
    </View>
  );
}

interface InboxItem { id: number; student: string; work: string; klass: string; ago: string; type: SubType }
interface DoneItem { student: string; work: string; type: SubType; lead: string }

const INITIAL_INBOX: InboxItem[] = [
  { id: 1, student: '한지우', work: '발성 루틴 녹음', klass: '입시반 A', ago: '34분 전', type: '녹음' },
  { id: 2, student: '박서연', work: '연습 일지', klass: '입시반 A', ago: '1시간 전', type: '일지' },
  { id: 3, student: '이도현', work: '자유연기 영상', klass: '입시반 A', ago: '2시간 전', type: '영상' },
];
const INITIAL_DONE: DoneItem[] = [
  { student: '이도현', work: '면접 답변', type: '면접', lead: '2시간' },
  { student: '박서연', work: '식단 기록', type: '식단', lead: '40분' },
];

// v2 선생님 통합 인박스 — "비우는 화면". (목데이터, ③ 백엔드 후 실 제출 집계)
export function InboxScreen() {
  const [inbox, setInbox] = useState<InboxItem[]>(INITIAL_INBOX);
  const [done, setDone] = useState<DoneItem[]>(INITIAL_DONE);
  const [filter, setFilter] = useState('todo');

  const process = (item: InboxItem) => {
    Alert.alert(`${item.student} — ${item.work}`, '빠른 코멘트로 피드백을 보낼까요? (프로토타입)', [
      { text: '취소', style: 'cancel' },
      { text: '피드백 보내기', onPress: () => { setInbox((p) => p.filter((x) => x.id !== item.id)); setDone((p) => [{ student: item.student, work: item.work, type: item.type, lead: '방금' }, ...p]); } },
    ]);
  };

  return (
    <Screen bg={color.bg} edges={['top']}>
      <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginBottom: 3 }}>김쏠 선생님</Text>
          <Text style={{ fontFamily: font.xb, fontSize: 21, letterSpacing: -0.4, color: color.ink }}>피드백 인박스</Text>
        </View>
        <View style={{ backgroundColor: color.blueBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, marginTop: 4 }}>
          <Text style={{ fontFamily: font.b, fontSize: 12, color: color.blue }}>미처리 {inbox.length}건</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginTop: 10 }}>
          <FilterChips items={[{ key: 'todo', label: '미처리' }, { key: 'a', label: '입시반 A' }, { key: 'm', label: '뮤지컬반' }, { key: 'all', label: '전체' }]} value={filter} onChange={setFilter} />
        </View>

        <Section title={`미처리 ${inbox.length}건`}>
          {inbox.length === 0 ? (
            <Card><View style={{ padding: 22, alignItems: 'center' }}><Icon name="circle-check" size={26} color={color.success} /><Text style={{ fontFamily: font.sb, fontSize: 14, color: color.sub, marginTop: 8 }}>다 비웠어요 👍 오늘도 리드타임 지켰습니다</Text></View></Card>
          ) : (
            <Card>
              {inbox.map((it, i) => (
                <Pressable key={it.id} onPress={() => process(it)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
                  <TypeTag t={it.type} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{it.student} — {it.work}</Text>
                    <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>{it.klass} · {it.ago}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={color.faint} />
                </Pressable>
              ))}
            </Card>
          )}
        </Section>

        <Section title="오늘 처리 완료" right={`${done.length}건`}>
          <Card style={{ opacity: 0.7 }}>
            {done.map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
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
      </ScrollView>
    </Screen>
  );
}
