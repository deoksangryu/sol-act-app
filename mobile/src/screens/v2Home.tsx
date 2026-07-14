import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/kit';
import { Hero, FeedbackBanner, Section, Card, ClapCheckRow, V2Row } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { useAuth } from '../AuthContext';

// v2 홈 — 프로토타입 s-home. (지금은 목데이터, ③ 백엔드 후 실데이터 배선)
export function HomeScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const nm = (user?.name || '').trim() || '학생';
  const [showFb, setShowFb] = useState(true);
  const [routineDone, setRoutineDone] = useState(1);

  const rewardTxt = { fontFamily: font.b, fontSize: 13.5, color: color.amber } as const;

  return (
    <Screen bg={color.bg} edges={['top']}>
      <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginBottom: 3 }}>7월 14일 화요일</Text>
          <Text style={{ fontFamily: font.xb, fontSize: 21, lineHeight: 28, letterSpacing: -0.4, color: color.ink }}>{nm}님,{'\n'}오늘 연습 시작해볼까요?</Text>
        </View>
        <View style={{ backgroundColor: color.dangerBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, marginTop: 4 }}>
          <Text style={{ fontFamily: font.b, fontSize: 12, color: color.danger }}>한예종 D-89</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {showFb && (
          <FeedbackBanner title="김쏠 선생님의 피드백이 도착했어요" sub="니나 독백 녹음 · 방금 전" onPress={() => setShowFb(false)} />
        )}

        <Hero
          label="이번 달 연습 시간"
          value={<Text>14<Text style={{ fontFamily: font.b, fontSize: 19 }}>시간</Text> 32<Text style={{ fontFamily: font.b, fontSize: 19 }}>분</Text></Text>}
          diff="지난달보다 2시간 10분"
          stats={[{ label: '내 박수 👏', value: '1,240' }, { label: '커튼콜 🎭', value: '7일째' }, { label: '받은 갈채 🏆', value: '3 / 24' }]}
        />

        <Section title="오늘의 루틴" right={`${routineDone} / 3 완료`}>
          <Card>
            <ClapCheckRow first title="발성 루틴 10분" sub="오전 8:12 완료" reward={10} done />
            <ClapCheckRow title="전신 스트레칭" sub="무용 전 부상 방지" reward={5} onDone={() => setRoutineDone((n) => n + 1)} />
            <ClapCheckRow title="복식호흡 5분" sub="타이머와 함께" reward={5} onDone={() => setRoutineDone((n) => n + 1)} />
          </Card>
        </Section>

        <Section title="오늘의 미션">
          <Card>
            <V2Row first icon="microphone" iconBg={color.purpleBg} iconColor={color.purple} title="니나 독백 1회 녹음 제출" sub="『갈매기』 4막 · 챕터 미션" right={<Text style={rewardTxt}>+15 👏</Text>} onPress={() => nav.navigate('submit')} />
            <V2Row icon="book" iconBg={color.blueBg} iconColor={color.blue} title="오늘의 상식 퀴즈" sub="연극사 · 1문제" right={<Text style={rewardTxt}>+5 👏</Text>} onPress={() => nav.navigate('learn')} />
            <V2Row icon="notebook" iconBg={color.successBg} iconColor={color.success} title="연습 일지 쓰기" sub="오늘 잘된 점 한 줄이면 충분해요" right={<Text style={rewardTxt}>+5 👏</Text>} onPress={() => nav.navigate('submit')} />
          </Card>
        </Section>

        <Section title="다가오는 일정" right="전체 ›">
          <Card>
            <V2Row first icon="calendar" iconBg={color.dangerBg} iconColor={color.danger} title="한예종 연기과 실기" sub="10월 11일 (일)" right={<Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.danger }}>D-89</Text>} />
            <V2Row icon="calendar" iconBg={color.amberBg} iconColor={color.amber} title="중앙대 원서 접수 시작" sub="9월 9일 (수)" right={<Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.sub }}>D-57</Text>} />
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
