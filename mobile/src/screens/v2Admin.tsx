import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Screen, Avatar } from '../components/kit';
import { Section, Card, V2Row, PageHeader } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space, shadow } from '../theme/tokens';
import { dashboardApi, examsApi } from '../services/api';
import { fmtDday } from '../lib/date';
import { useDataRefresh } from '../services/ws';

// 클래스별 행 아이콘 팔레트(순환)
const classPalette = [
  { iconBg: color.blueBg, iconColor: color.blue },
  { iconBg: color.purpleBg, iconColor: color.purple },
  { iconBg: color.successBg, iconColor: color.success },
] as const;

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'warn' | 'flat' }) {
  const c = tone === 'up' ? color.success : tone === 'warn' ? color.danger : color.sub2;
  return (
    <View style={[{ flex: 1, backgroundColor: color.white, borderRadius: 20, padding: 16 }, shadow.card]}>
      <Text style={{ fontFamily: font.m, fontSize: 12, color: color.sub2, marginBottom: 5 }}>{label}</Text>
      <Text style={{ fontFamily: font.xb, fontSize: 22, letterSpacing: -0.4, color: color.ink }}>{value}</Text>
      {!!sub && <Text style={{ fontFamily: font.b, fontSize: 11.5, color: c, marginTop: 3 }}>{sub}</Text>}
    </View>
  );
}

function NoteRow({ text }: { text: string }) {
  return <View style={{ padding: 22, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>{text}</Text></View>;
}

// ── 현황 ──
export function AdminDashScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  // 실데이터: 없으면 가짜 KPI를 만들지 않고 '—'/빈 상태로 정직하게 보여준다.
  const { data: stats, isLoading } = useQuery({ queryKey: ['dashStats'], queryFn: () => dashboardApi.stats(), retry: false, staleTime: 30000 });
  // 실시간(WS): 제출·출결·피드백 변경 시 대시보드 지표를 켜둔 채로도 갱신(요약화면 라이브).
  useDataRefresh(['submission', 'attendance', 'portfolios', 'feedback', 'journals'], () => qc.invalidateQueries({ queryKey: ['dashStats'] }));

  const curtaincallVal = stats ? `${stats.curtaincallToday} / ${stats.studentsTotal}` : '—';
  const pendingVal = stats ? `${stats.pendingFeedback}건` : '—';
  const leadtimeVal = stats ? (stats.leadtimeMedianHours != null ? `${stats.leadtimeMedianHours}시간` : '—') : '—';
  const leadtimeSub = stats && stats.leadtimeMedianHours != null && stats.leadtimeMedianHours <= 24 ? '목표 24h 이내 ✓' : undefined;
  const journalVal = stats ? `${stats.journalRate}%` : '—';

  const classRows = stats?.classes;
  const attentionRows = stats?.attention;
  const loadingNote = isLoading ? '불러오는 중…' : '데이터가 없어요';

  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow="쏠연기뮤지컬학원" title="오늘의 현황" bell onSettings={() => nav.navigate('profile')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="오늘 커튼콜(출석)" value={curtaincallVal} tone="up" />
            <Stat label="미처리 피드백" value={pendingVal} tone="flat" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="피드백 리드타임" value={leadtimeVal} sub={leadtimeSub} tone="up" />
            <Stat label="수업일지 작성률" value={journalVal} tone="warn" />
          </View>
        </View>

        <Section title="관리">
          <Card>
            <V2Row first icon="notebook" iconBg={color.purpleBg} iconColor={color.purple} title="수업일지·출결 열람" sub="선생님 수업일지 확인·코멘트, 학생 일지 열람" right={<Icon name="chevron-right" size={18} color={color.faint} />} onPress={() => nav.navigate('classes')} />
            <V2Row icon="video" iconBg={color.dangerBg} iconColor={color.danger} title="학생 영상 리뷰" sub="전체 학생 영상 재생·피드백" right={<Icon name="chevron-right" size={18} color={color.faint} />} onPress={() => nav.navigate('videos')} />
            <V2Row icon="speakerphone" iconBg={color.blueBg} iconColor={color.blue} title="공지 관리" sub="학원 공지 작성·수정" right={<Icon name="chevron-right" size={18} color={color.faint} />} onPress={() => nav.navigate('notices')} />
          </Card>
        </Section>

        <Section title="클래스별" right="이번 주">
          <Card>
            {classRows && classRows.length > 0 ? (
              classRows.map((c, i) => {
                const p = classPalette[i % classPalette.length];
                return (
                  <V2Row key={c.id} first={i === 0} icon="account-group" iconBg={p.iconBg} iconColor={p.iconColor} title={c.name} sub={`${c.members}명 · 미처리 ${c.open} · 주간 ${c.submissionsWeek}건`} />
                );
              })
            ) : (
              <NoteRow text={loadingNote} />
            )}
          </Card>
        </Section>

        <Section title="확인이 필요해요">
          <Card>
            {attentionRows && attentionRows.length > 0 ? (
              attentionRows.map((a, i) => (
                <V2Row key={`${a.name}-${i}`} first={i === 0} icon="alert-triangle" iconBg={color.dangerBg} iconColor={color.danger} title={`${a.name} — ${a.reason}`} sub="담당 선생님에게 알림 전송됨" />
              ))
            ) : (
              <NoteRow text={isLoading ? '불러오는 중…' : '지금은 확인할 항목이 없어요 👍'} />
            )}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

// ── 일정 ──
interface Exam { school: string; date: string; note: string }
export function AdminScheduleScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const [school, setSchool] = useState('');
  const [date, setDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00') : new Date();
  const onPickDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) {
      const y = selected.getFullYear(), m = String(selected.getMonth() + 1).padStart(2, '0'), d = String(selected.getDate()).padStart(2, '0');
      setDate(`${y}-${m}-${d}`);
    }
  };
  // 로컬 낙관 반영용(백엔드 미기동 시 방금 추가한 것만 임시로 보임) — 가짜 초기 목록 없음.
  const [localAdded, setLocalAdded] = useState<Exam[]>([]);

  const { data: exams, isLoading } = useQuery({ queryKey: ['exams'], queryFn: () => examsApi.list(), retry: false, staleTime: 30000 });
  const serverRows: Exam[] = (exams ?? []).map((e) => ({
    school: e.title,
    date: e.examDate || '날짜 미정',
    note: e.dday != null ? fmtDday(e.dday) : '지망생에게 알림 예약',
  }));
  const rows = exams ? serverRows : localAdded;

  const add = () => {
    if (!school.trim()) return;
    const s = school.trim();
    const dstr = date.trim();
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dstr);
    setLocalAdded((p) => [{ school: s, date: dateOk ? dstr : '날짜 미정', note: '지망생에게 알림 예약' }, ...p]);
    if (dateOk) {
      examsApi.create(s, dstr).then(() => qc.invalidateQueries({ queryKey: ['exams'] })).catch(() => {});
    }
    setSchool(''); setDate('');
  };
  const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontFamily: font.r, fontSize: 15, color: color.ink } as const;
  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow="시험 일정 관리" title="2027학년도" bell onSettings={() => nav.navigate('profile')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
            <Card style={{ padding: 20 }}>
              <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginBottom: 7 }}>학교 · 전형</Text>
              <TextInput value={school} onChangeText={setSchool} placeholder="예: 한예종 연기과 실기" placeholderTextColor={color.faint} style={inp} />
              <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginTop: 14, marginBottom: 7 }}>날짜</Text>
              <Pressable onPress={() => setShowPicker((s) => !s)} style={[inp, { justifyContent: 'center' }]}>
                <Text style={{ fontFamily: font.r, fontSize: 15, color: date ? color.ink : color.faint }}>{date || '날짜 선택'}</Text>
              </Pressable>
              {showPicker && (
                <DateTimePicker value={dateValue} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onPickDate} />
              )}
              <Pressable onPress={add} style={{ marginTop: 14, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>일정 추가 — 학생 앱에 즉시 반영</Text></Pressable>
            </Card>
          </View>
          <Section title="등록된 일정">
            <Card>
              {rows.length > 0 ? rows.map((e, i) => (
                <V2Row key={`${e.school}-${e.date}-${i}`} first={i === 0} icon="calendar" iconBg={color.dangerBg} iconColor={color.danger} title={e.school} sub={`${e.date} · ${e.note}`} />
              )) : (
                <NoteRow text={isLoading ? '불러오는 중…' : '등록된 일정이 없어요 — 위에서 추가하세요'} />
              )}
            </Card>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ── 학생 데이터 ──
export function AdminStudentsScreen() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState('');

  const { data: roster, isLoading } = useQuery({ queryKey: ['roster'], queryFn: () => dashboardApi.roster(), retry: false, staleTime: 30000 });

  const realStudents = (roster ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    info: `스트릭 ${r.streak}일 · 제출주간 ${r.weekSubmissions}건`,
    tone: r.slump ? color.danger : color.blue,
  }));
  const students = realStudents.filter((s) => !q || s.name.includes(q));
  const totalCount = roster ? roster.length : 0;
  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow={roster ? `전체 ${totalCount}명` : '학생 데이터'} title="학생 데이터" bell onSettings={() => nav.navigate('profile')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.white, borderRadius: 14, paddingHorizontal: 13, height: 46, marginBottom: 12 }}>
            <Icon name="search" size={18} color={color.faint} />
            <TextInput value={q} onChangeText={setQ} placeholder="학생 이름 검색" placeholderTextColor={color.faint} style={{ flex: 1, fontFamily: font.r, fontSize: 15, color: color.ink, padding: 0 }} />
          </View>
          <Pressable onPress={() => nav.navigate('videos')} style={({ pressed }) => [{ backgroundColor: color.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 }, pressed && { backgroundColor: color.surf }]}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: color.dangerBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="video" size={18} color={color.danger} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.sb, fontSize: 14.5, color: color.ink }}>학생 영상 리뷰</Text>
              <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 1 }}>전체 학생 영상 재생·피드백</Text>
            </View>
            <Icon name="chevron-right" size={18} color={color.faint} />
          </Pressable>
          <Card>
            {students.length > 0 ? students.map((s, i) => (
              <V2Row key={s.id} first={i === 0} left={<Avatar name={s.name} size={40} bg={s.tone + '22'} fg={s.tone} />} title={s.name} sub={s.info} onPress={() => nav.navigate('studentDetail', { studentId: s.id, name: s.name })} right={<Icon name="chevron-right" size={18} color={color.faint} />} />
            )) : (
              <NoteRow text={isLoading ? '학생을 불러오는 중…' : q ? '검색 결과가 없어요' : '아직 학생 데이터가 없어요'} />
            )}
          </Card>
          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 12, paddingHorizontal: 4, lineHeight: 19 }}>학생을 누르면 제출·피드백 이력, 연습 추이, 체중/식단을 한 화면에서 볼 수 있어요 — 상담 자료로 바로 사용.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
