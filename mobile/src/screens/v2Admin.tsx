import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { Screen } from '../components/kit';
import { Section, Card, V2Row } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';

function Head({ sub, title }: { sub?: string; title: string }) {
  return (
    <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6 }}>
      {!!sub && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginBottom: 3 }}>{sub}</Text>}
      <Text style={{ fontFamily: font.xb, fontSize: 21, letterSpacing: -0.4, color: color.ink }}>{title}</Text>
    </View>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'warn' | 'flat' }) {
  const c = tone === 'up' ? color.success : tone === 'warn' ? color.danger : color.sub2;
  return (
    <View style={{ flex: 1, backgroundColor: color.white, borderRadius: 20, padding: 16 }}>
      <Text style={{ fontFamily: font.m, fontSize: 12, color: color.sub2, marginBottom: 5 }}>{label}</Text>
      <Text style={{ fontFamily: font.xb, fontSize: 22, letterSpacing: -0.4, color: color.ink }}>{value}</Text>
      {!!sub && <Text style={{ fontFamily: font.b, fontSize: 11.5, color: c, marginTop: 3 }}>{sub}</Text>}
    </View>
  );
}

// ── 현황 ──
export function AdminDashScreen() {
  return (
    <Screen bg={color.bg} edges={['top']}>
      <Head sub="쏠연기뮤지컬학원" title="오늘의 현황" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="오늘 커튼콜(출석)" value="41 / 48" sub="↑ 지난주 대비 +4" tone="up" />
            <Stat label="미처리 피드백" value="5건" sub="선생님 3명" tone="flat" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="피드백 리드타임" value="6.2시간" sub="목표 24h 이내 ✓" tone="up" />
            <Stat label="수업일지 작성률" value="92%" sub="뮤지컬반 1건 누락" tone="warn" />
          </View>
        </View>

        <Section title="클래스별" right="이번 주">
          <Card>
            <V2Row first icon="account-group" iconBg={color.blueBg} iconColor={color.blue} title="입시반 A · 김쏠" sub="평균 연습 5.1h · 제출 34건 · 리드타임 4.8h" right={<Icon name="chevron-right" size={18} color={color.faint} />} />
            <V2Row icon="account-group" iconBg={color.purpleBg} iconColor={color.purple} title="뮤지컬반 · 박무대" sub="평균 연습 4.2h · 제출 21건 · 리드타임 9.1h" right={<Icon name="chevron-right" size={18} color={color.faint} />} />
            <V2Row icon="account-group" iconBg={color.successBg} iconColor={color.success} title="무용반 · 이몸짓" sub="평균 연습 6.0h · 제출 18건 · 리드타임 5.5h" right={<Icon name="chevron-right" size={18} color={color.faint} />} />
          </Card>
        </Section>

        <Section title="확인이 필요해요">
          <Card>
            <V2Row first icon="alert-triangle" iconBg={color.dangerBg} iconColor={color.danger} title="이도현 — 3일 미접속" sub="입시반 A · 담당 선생님에게 알림 전송됨" right={<Icon name="chevron-right" size={18} color={color.faint} />} />
            <V2Row icon="notebook" iconBg={color.amberBg} iconColor={color.amber} title="뮤지컬반 수업일지 미작성" sub="7월 13일자" right={<Icon name="chevron-right" size={18} color={color.faint} />} />
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

// ── 일정 ──
interface Exam { school: string; date: string; note: string }
export function AdminScheduleScreen() {
  const [school, setSchool] = useState('');
  const [date, setDate] = useState('');
  const [list, setList] = useState<Exam[]>([
    { school: '한예종 연기과 실기', date: '2026-10-11', note: '지망생 12명 알림 · D-89' },
    { school: '중앙대 원서 접수 시작', date: '2026-09-09', note: '지망생 9명 알림 · D-57' },
  ]);
  const add = () => {
    if (!school.trim()) return;
    setList((p) => [{ school: school.trim(), date: date.trim() || '날짜 미정', note: '지망생에게 알림 예약' }, ...p]);
    setSchool(''); setDate('');
  };
  const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontFamily: font.r, fontSize: 15, color: color.ink } as const;
  return (
    <Screen bg={color.bg} edges={['top']}>
      <Head sub="시험 일정 관리" title="2027학년도" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <Card style={{ padding: 20 }}>
            <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginBottom: 7 }}>학교 · 전형</Text>
            <TextInput value={school} onChangeText={setSchool} placeholder="예: 한예종 연기과 실기" placeholderTextColor={color.faint} style={inp} />
            <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginTop: 14, marginBottom: 7 }}>날짜 (YYYY-MM-DD)</Text>
            <TextInput value={date} onChangeText={setDate} placeholder="2026-10-11" placeholderTextColor={color.faint} style={inp} />
            <Pressable onPress={add} style={{ marginTop: 14, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>일정 추가 — 학생 앱에 즉시 반영</Text></Pressable>
          </Card>
        </View>
        <Section title="등록된 일정">
          <Card>
            {list.map((e, i) => (
              <V2Row key={i} first={i === 0} icon="calendar" iconBg={color.dangerBg} iconColor={color.danger} title={e.school} sub={`${e.date} · ${e.note}`} />
            ))}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

// ── 학생 데이터 ──
export function AdminStudentsScreen() {
  const [q, setQ] = useState('');
  const students = [
    { name: '한지우 · 입시반 A', info: '연습 14.5h/월 · 스트릭 7일 · 뱃지 3 · 한예종 지망', tone: color.blue },
    { name: '박서연 · 입시반 A', info: '연습 22.1h/월 · 스트릭 21일 · 뱃지 7 · 중앙대 지망', tone: color.success },
    { name: '이도현 · 입시반 A', info: '3일 미접속 ⚠️ · 상담 필요', tone: color.danger },
  ].filter((s) => !q || s.name.includes(q));
  return (
    <Screen bg={color.bg} edges={['top']}>
      <Head sub="전체 48명" title="학생 데이터" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.white, borderRadius: 14, paddingHorizontal: 13, height: 46, marginBottom: 12 }}>
            <Icon name="search" size={18} color={color.faint} />
            <TextInput value={q} onChangeText={setQ} placeholder="학생 이름 검색" placeholderTextColor={color.faint} style={{ flex: 1, fontFamily: font.r, fontSize: 15, color: color.ink, padding: 0 }} />
          </View>
          <Card>
            {students.map((s, i) => (
              <V2Row key={s.name} first={i === 0} icon="account" iconBg={s.tone + '22'} iconColor={s.tone} title={s.name} sub={s.info} right={<Icon name="chevron-right" size={18} color={color.faint} />} />
            ))}
          </Card>
          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 12, paddingHorizontal: 4, lineHeight: 19 }}>학생을 누르면 제출·피드백 이력, 연습 추이, 체중/식단을 한 화면에서 볼 수 있어요 — 상담 자료로 바로 사용.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
