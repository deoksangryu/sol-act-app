import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader, Tag } from '../components/kit';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';
import { workAnalysisApi, AnalysisType, AnalysisSummary } from '../services/api';

// 작품분석 목록 + 새 분석 시작(타입 선택). 학생 배움 탭에서 진입.
const TYPES: { id: AnalysisType; t: string; d: string; tag?: string }[] = [
  { id: 'monologue', t: '독백 대사분석', d: '입시 지정·자유 독백 한 편을 파고듭니다', tag: '가장 많이 씀' },
  { id: 'play', t: '희곡 작품 전체분석', d: '한예종 지정희곡 등 작품 하나를 통째로', tag: '구술 대비' },
  { id: 'musical', t: '뮤지컬 넘버 분석', d: '넘버의 극적 기능과 음악·심리 변화' },
];

const STATUS_TAG: Record<string, { label: string; tone: 'pending' | 'todo' | 'done' | 'neutral' }> = {
  draft: { label: '작성 중', tone: 'neutral' },
  submitted: { label: '첨삭 대기', tone: 'todo' },
  reviewed: { label: '첨삭 완료', tone: 'done' },
};

export function WorkAnalysisScreen() {
  const nav = useNavigation<any>();
  const [pick, setPick] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['workAnalyses', 'mine'], queryFn: () => workAnalysisApi.mine(), staleTime: 10000 });

  const open = (a: AnalysisSummary) => {
    if (a.status === 'draft') nav.navigate('workAnalysisWizard', { id: a.id });
    else nav.navigate('workAnalysisFeedback', { id: a.id });
  };
  const start = (type: AnalysisType) => { setPick(false); nav.navigate('workAnalysisWizard', { type }); };

  const list = data ?? [];
  return (
    <Screen edges={['top']} bg={color.bg}>
      <BackHeader title="작품분석" onBack={() => nav.goBack()} />
      <Scroll contentStyle={{ padding: space.screenX, paddingBottom: 120 }}>
        <View style={{ backgroundColor: color.blueBg, borderRadius: radius.card, padding: 14, marginBottom: 16 }}>
          <Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.infoInk, marginBottom: 4 }}>왜 쓰나요?</Text>
          <Text style={{ fontFamily: font.r, fontSize: 12.5, lineHeight: 19, color: color.infoInk }}>
            목표·상대·장애물을 구조로 정리하면 연기의 근거가 잡히고, 한예종 2차 글쓰기·구술과 면접 대비가 됩니다. 내면 선생님이 첨삭해 드려요.
          </Text>
        </View>

        <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 10 }}>내 분석</Text>
        {isLoading ? (
          <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
        ) : list.length === 0 ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ fontFamily: font.m, fontSize: 13.5, color: color.sub2, textAlign: 'center' }}>아직 분석이 없어요.{'\n'}아래 버튼으로 첫 작품을 분석해보세요.</Text>
          </View>
        ) : (
          list.map((a) => {
            const st = STATUS_TAG[a.status] ?? STATUS_TAG.draft;
            return (
              <Pressable key={a.id} onPress={() => open(a)} style={({ pressed }) => [{ backgroundColor: color.white, borderRadius: radius.card, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: color.line }, pressed && { backgroundColor: color.surf }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Tag label={st.label} tone={st.tone} />
                  {!!a.targetSchool && <Tag label={a.targetSchool} tone="todo" />}
                </View>
                <Text style={{ fontFamily: font.b, fontSize: 16, color: color.ink }} numberOfLines={1}>{a.title}{a.character ? ` · ${a.character}` : ''}</Text>
                <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 3 }}>
                  {a.typeLabel}{a.currentVersion > 1 ? ` · v${a.currentVersion}` : ''}{a.updatedAt ? ` · ${a.updatedAt.slice(5, 10)}` : ''}
                </Text>
              </Pressable>
            );
          })
        )}
      </Scroll>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.screenX, paddingBottom: 28, backgroundColor: color.bg }}>
        <Pressable onPress={() => setPick(true)} style={{ backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.b, fontSize: 16, color: color.white }}>+ 새 분석 쓰기</Text>
        </Pressable>
      </View>

      <Modal visible={pick} transparent animationType="fade" onRequestClose={() => setPick(false)}>
        <Pressable onPress={() => setPick(false)} style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: color.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 }}>
            <Text style={{ fontFamily: font.xb, fontSize: 19, color: color.ink, marginBottom: 4 }}>무엇을 분석할까요?</Text>
            <Text style={{ fontFamily: font.r, fontSize: 13, color: color.sub2, marginBottom: 16 }}>고른 종류에 따라 질문이 달라져요.</Text>
            {TYPES.map((t) => (
              <Pressable key={t.id} onPress={() => start(t.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.surf, borderRadius: radius.card, padding: 16, marginBottom: 10 }, pressed && { backgroundColor: color.blueBg }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: font.b, fontSize: 15.5, color: color.ink }}>{t.t}</Text>
                    {!!t.tag && <View style={{ backgroundColor: color.blueBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontFamily: font.b, fontSize: 11, color: color.blue }}>{t.tag}</Text></View>}
                  </View>
                  <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 3 }}>{t.d}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={color.faint} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
