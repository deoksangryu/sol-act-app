import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Screen } from '../components/kit';
import { Section, Card, V2Row } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';
import { useAuth } from '../AuthContext';

function Head({ sub, title }: { sub?: string; title: string }) {
  return (
    <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6 }}>
      {!!sub && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginBottom: 3 }}>{sub}</Text>}
      <Text style={{ fontFamily: font.xb, fontSize: 21, letterSpacing: -0.4, color: color.ink }}>{title}</Text>
    </View>
  );
}
const RING_C = 414.7;

// ── 연습 ──
export function PracticeV2Screen() {
  const [sec, setSec] = useState(21 * 60);
  const [running, setRunning] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (!running) return; const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, [running]);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  const off = RING_C * (1 - Math.min(sec / 3600, 1));
  const [speed, setSpeed] = useState('1.0x');
  const [ab, setAb] = useState(false);
  const [ci, setCi] = useState(false);
  const cycleSpeed = () => { const arr = ['1.0x', '0.75x', '0.5x', '1.25x']; setSpeed((s) => arr[(arr.indexOf(s) + 1) % arr.length]); };
  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ backgroundColor: on ? color.purpleBg : color.surf, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8 }}>
      <Text style={{ fontFamily: font.b, fontSize: 12.5, color: on ? color.purple : color.sub }}>{label}</Text>
    </Pressable>
  );
  return (
    <Screen bg={color.bg} edges={['top']}>
      <Head sub="연습" title="오늘 목표 1시간" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 14, backgroundColor: color.white, borderRadius: radius.hero, padding: 24, alignItems: 'center' }}>
          <View style={{ width: 150, height: 150, marginBottom: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={150} height={150} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={75} cy={75} r={66} stroke={color.surf} strokeWidth={11} fill="none" />
              <Circle cx={75} cy={75} r={66} stroke={color.blue} strokeWidth={11} fill="none" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={off} />
            </Svg>
            <Text style={{ fontFamily: font.xb, fontSize: 27, color: color.ink }}>{mm}:{ss}</Text>
            <Text style={{ fontFamily: font.sb, fontSize: 12, color: color.sub2 }}>/ 60분</Text>
          </View>
          <Pressable onPress={() => setRunning((r) => !r)} style={{ alignSelf: 'stretch', backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>{running ? '일시정지' : '연습 시작'}</Text>
          </Pressable>
          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 10, textAlign: 'center' }}>30분마다 +10 👏 · 무용음악 재생 시간도 인정돼요</Text>
        </View>

        <Section title="무용음악" right="보관함 ›">
          <Card style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: color.purpleBg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>💃</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.b, fontSize: 15, color: color.ink }}>2026 실기곡 — 현대무용 A</Text>
                <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>김쏠 선생님 배정 · 1분 32초</Text>
              </View>
            </View>
            <View style={{ height: 6, backgroundColor: color.surf, borderRadius: 99, overflow: 'hidden' }}><View style={{ width: '34%', height: '100%', backgroundColor: color.purple }} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
              <Text style={{ fontFamily: font.m, fontSize: 11, color: color.sub2 }}>0:31</Text>
              <Text style={{ fontFamily: font.m, fontSize: 11, color: color.sub2 }}>1:32</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginTop: 12 }}>
              <Icon name="chevron-left" size={22} color={color.sub} />
              <Pressable onPress={() => setPlaying((p) => !p)} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: color.purple, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={playing ? 'player-pause' : 'player-play'} size={22} color={color.white} />
              </Pressable>
              <Icon name="chevron-right" size={22} color={color.sub} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 }}>
              {chip('A-B 반복', ab, () => setAb((v) => !v))}
              {chip(speed, speed !== '1.0x', cycleSpeed)}
              {chip('카운트인', ci, () => setCi((v) => !v))}
            </View>
          </Card>
        </Section>

        <Section title="오늘의 한 줄" right="『갈매기』">
          <Card style={{ padding: 20 }}>
            <Text style={{ fontFamily: font.b, fontSize: 15.5, lineHeight: 26, color: color.ink }}>"난 갈매기… 아니, 그게 아니야.{'\n'}난 배우야."</Text>
            <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 8, marginBottom: 14 }}>니나 · 4막</Text>
            <Pressable onPress={() => Alert.alert('녹음', '따라 녹음 시작 (프로토타입)')} style={{ backgroundColor: color.surf, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ fontFamily: font.b, fontSize: 14, color: color.sub }}>🎙️ 따라 녹음하기  +5 👏</Text>
            </Pressable>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

// ── 배움 ──
export function LearnScreen() {
  const [ans, setAns] = useState<number | null>(null);
  const options = ['톨스토이', '체호프', '고리키', '스타니슬랍스키'];
  return (
    <Screen bg={color.bg} edges={['top']}>
      <Head sub="배움" title="오늘의 상식 퀴즈" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <Card style={{ padding: 20 }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: color.blueBg, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 10 }}><Text style={{ fontFamily: font.b, fontSize: 11, color: color.blue }}>연극사</Text></View>
            <Text style={{ fontFamily: font.b, fontSize: 15.5, lineHeight: 24, color: color.ink, marginBottom: 16 }}>『갈매기』를 쓴 러시아 극작가는?</Text>
            {options.map((o, i) => {
              const answered = ans !== null;
              const correct = i === 1;
              const bg = answered ? (correct ? color.successBg : i === ans ? color.dangerBg : color.white) : color.white;
              const bd = answered ? (correct ? color.success : i === ans ? color.danger : color.inputLine) : color.inputLine;
              const fg = answered ? (correct ? color.success : i === ans ? color.danger : color.ink) : color.ink;
              return (
                <Pressable key={o} onPress={() => { if (ans === null) setAns(i); }} style={{ borderWidth: 1.5, borderColor: bd, backgroundColor: bg, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                  <Text style={{ fontFamily: font.sb, fontSize: 14, color: fg }}>{o}</Text>
                </Pressable>
              );
            })}
            {ans !== null && <Text style={{ fontFamily: font.m, fontSize: 12.5, color: ans === 1 ? color.success : color.danger, marginTop: 2 }}>{ans === 1 ? '정답! +5 👏' : '아쉬워요 — 정답은 체호프'}</Text>}
          </Card>
        </View>

        <Section title="작품 읽을거리" right="9편 ›">
          <Card>
            <V2Row first icon="book" iconBg={color.blueBg} iconColor={color.blue} title="『갈매기』 딥리딩 3화" sub="니나는 왜 무대로 돌아왔나 · 5분" right={<Icon name="chevron-right" size={18} color={color.faint} />} />
            <V2Row icon="book" iconBg={color.successBg} iconColor={color.success} title="서브텍스트란 무엇인가" sub="대사분석 워크북 · 카드 12장" right={<Icon name="chevron-right" size={18} color={color.faint} />} />
          </Card>
        </Section>

        <Section title="질의응답 준비">
          <Card style={{ padding: 20 }}>
            <Text style={{ fontFamily: font.b, fontSize: 12, color: color.sub2 }}>랜덤 질문</Text>
            <Text style={{ fontFamily: font.b, fontSize: 15.5, lineHeight: 24, color: color.ink, marginTop: 8, marginBottom: 16 }}>"연기를 하면서 가장 크게 실패했던 경험은 무엇인가요?"</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => Alert.alert('녹음', '답변 녹음 시작 (프로토타입)')} style={{ flex: 1, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: color.white }}>🎙️ 답변 녹음</Text></Pressable>
              <Pressable style={{ backgroundColor: color.surf, borderRadius: radius.button, paddingHorizontal: 16, justifyContent: 'center' }}><Icon name="dots" size={18} color={color.sub} /></Pressable>
            </View>
          </Card>
        </Section>

        <Section title="시청각 자료" right="이번 주 배정">
          <Card>
            <V2Row first icon="player-play" iconBg={color.dangerBg} iconColor={color.danger} title="니나 독백 레퍼런스 공연" sub="김쏠 선생님 추천 · 4분 12초" right={<Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.amber }}>+5 👏</Text>} />
            <V2Row icon="check" iconBg={color.successBg} iconColor={color.success} title="복식호흡 발성 시범" sub="시청 완료" right={<Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.success }}>+5 👏</Text>} />
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

// ── 제출 ──
export function SubmitScreen() {
  const [type, setType] = useState<{ label: string; sub: string; icon: string; bg: string; fg: string }>({ label: '연기 녹음', sub: '독백 · 대사 · 발성', icon: 'microphone', bg: color.purpleBg, fg: color.purple });
  const TYPES = [
    { label: '연기 녹음', sub: '독백 · 대사 · 발성', icon: 'microphone', bg: color.purpleBg, fg: color.purple },
    { label: '연기 영상', sub: '자유연기 · 지정연기 · 무용', icon: 'video', bg: color.dangerBg, fg: color.danger },
    { label: '연습 일지', sub: '오늘의 기록', icon: 'notebook', bg: color.successBg, fg: color.success },
    { label: '식단 기록', sub: '사진 + 메모', icon: 'salad', bg: color.amberBg, fg: color.amber },
  ];
  return (
    <Screen bg={color.bg} edges={['top']}>
      <Head sub="제출" title="무엇을 제출할까요?" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <Card>
            {TYPES.map((t, i) => (
              <Pressable key={t.label} onPress={() => setType(t)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.line, backgroundColor: type.label === t.label ? color.surf : color.white }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={t.icon} size={20} color={t.fg} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{t.label}</Text><Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>{t.sub}</Text></View>
                <Icon name="chevron-right" size={18} color={color.faint} />
              </Pressable>
            ))}
          </Card>
        </View>
        <View style={{ marginHorizontal: space.screenX, marginTop: 16 }}>
          <Card style={{ padding: 20 }}>
            <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub2, marginBottom: 10 }}>{type.label}</Text>
            <View style={{ backgroundColor: color.surf, borderRadius: 16, padding: 26, alignItems: 'center', marginBottom: 14 }}>
              <Icon name={type.icon} size={34} color={color.sub} />
              <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginTop: 8 }}>탭하여 준비 (프로토타입)</Text>
            </View>
            <TextInput placeholder="선생님께 한 마디 (선택)" placeholderTextColor={color.faint} multiline style={{ borderWidth: 1, borderColor: color.inputLine, borderRadius: 14, padding: 12, minHeight: 56, fontFamily: font.r, fontSize: 14, color: color.ink, textAlignVertical: 'top' }} />
            <Pressable onPress={() => Alert.alert('제출 완료', '선생님 인박스로 전송됐어요 · +15 👏')} style={{ marginTop: 12, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}>
              <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>김쏠 선생님께 제출하기</Text>
            </Pressable>
            <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center', marginTop: 10 }}>제출 즉시 선생님 인박스에 도착해요 · +15 👏</Text>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ── MY ──
export function MyScreen() {
  const { user } = useAuth();
  const nm = (user?.name || '').trim() || '학생';
  const badges = [
    { icon: '🎙️', title: '첫 녹음', sub: '데뷔 무대', owned: true },
    { icon: '🔥', title: '7일 연속', sub: '커튼콜', owned: true },
    { icon: '🌟', title: '성장상', sub: '선생님 수여', owned: true },
    { icon: '🕊️', title: '갈매기 마스터', sub: '독백 완성', owned: false },
    { icon: '🏛️', title: '한예종 준비생', sub: '지정희곡 3편', owned: false },
    { icon: '💯', title: '100일 커튼콜', sub: '스트릭 100일', owned: false },
  ];
  return (
    <Screen bg={color.bg} edges={['top']}>
      <Head sub="MY" title={`배우 ${nm}`} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Section title="받은 갈채" right="3 / 24">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {badges.map((b) => (
              <View key={b.title} style={{ width: '31.5%', backgroundColor: color.white, borderRadius: 18, paddingVertical: 15, alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: b.owned ? color.amberBg : color.surf, alignItems: 'center', justifyContent: 'center', marginBottom: 8, opacity: b.owned ? 1 : 0.5 }}><Text style={{ fontSize: 20 }}>{b.icon}</Text></View>
                <Text style={{ fontFamily: font.b, fontSize: 11.5, color: b.owned ? color.ink : color.sub2 }}>{b.title}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 10, color: color.sub2, marginTop: 1 }}>{b.sub}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="체중 · 컨디션" right="기록 ›">
          <Card style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: font.xb, fontSize: 21, color: color.ink }}>52.4<Text style={{ fontFamily: font.b, fontSize: 13 }}>kg</Text></Text>
              <View style={{ marginLeft: 8, backgroundColor: color.blueBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontFamily: font.b, fontSize: 11.5, color: color.blue }}>4주째 안정 유지</Text></View>
            </View>
            <Svg width="100%" height={80} viewBox="0 0 300 80" style={{ marginVertical: 4 }}>
              <Polyline points="10,42 55,45 100,40 145,44 190,41 235,43 290,42" fill="none" stroke={color.blue} strokeWidth={2.5} strokeLinecap="round" />
              <Circle cx={290} cy={42} r={4} fill={color.blue} />
            </Svg>
            <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2 }}>컨디션 관리 기록은 담당 선생님과 원장님만 볼 수 있어요</Text>
          </Card>
        </Section>

        <Section title="오늘의 식단">
          <Card>
            <V2Row first icon="bowl" iconBg={color.amberBg} iconColor={color.amber} title="아침 — 계란 2개, 바나나" sub="오전 7:40 기록" />
            <V2Row icon="plus" iconBg={color.surf} iconColor={color.sub} title="점심 기록하기" />
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
