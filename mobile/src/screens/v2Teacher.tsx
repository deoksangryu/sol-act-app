import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Avatar } from '../components/kit';
import { Card, PageHeader } from '../components/gamify';
import { Icon } from '../components/Icon';
import { MiniCalendar } from '../components/MiniCalendar';
import { color, font, radius, space } from '../theme/tokens';
import { dashboardApi, achievementsApi, lessonApi, journalApi, type RosterRow } from '../services/api';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../AuthContext';
import { todayStr, dayOffset } from '../lib/date';

const md = (s?: string) => (s || '').slice(5, 10).replace('-', '/');

// ── 수업일지 — 캘린더로 날짜를 고르고, 그 날 수업을 선택해 일지를 저장. ──
export function TeacherLogScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selDate, setSelDate] = useState<string>(todayStr());
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: 14, padding: 12, fontFamily: font.r, fontSize: 14, color: color.ink, textAlignVertical: 'top' as const };

  const { data: lessons = [] } = useQuery({ queryKey: ['t-lessons'], queryFn: () => lessonApi.list({ dateFrom: dayOffset(-90), dateTo: dayOffset(30) }), retry: false, staleTime: 30000 });
  const dayLessons = lessons.filter((l) => l.date === selDate).slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const effLessonId = lessonId && dayLessons.some((l) => l.id === lessonId) ? lessonId : (dayLessons[0]?.id ?? null);

  const pickDate = (d: string) => { setSelDate(d); setLessonId(null); setCalOpen(false); };

  const dupLast = async () => {
    try {
      const js = await journalApi.list({ authorId: user?.id });
      if (js.length && js[0].content) { setContent(js[0].content); Alert.alert('복제', '가장 최근 수업일지 내용을 불러왔어요'); }
      else Alert.alert('복제', '불러올 지난 일지가 없어요');
    } catch { Alert.alert('복제', '불러올 지난 일지가 없어요'); }
  };

  const save = async () => {
    if (!effLessonId) { Alert.alert('수업 선택', '먼저 어떤 수업의 일지인지 골라주세요 (그 날 수업이 없으면 수업 관리에서 생성).'); return; }
    if (!content.trim()) { Alert.alert('내용 필요', '수업 내용을 적어주세요.'); return; }
    setBusy(true);
    try {
      await journalApi.create({ lessonId: effLessonId, journalType: 'teacher', content: content.trim() } as any);
      qc.invalidateQueries({ queryKey: ['t-lessons'] });
      setContent('');
      Alert.alert('저장 완료', '수업일지를 저장했어요');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message || '저장하지 못했어요');
    } finally { setBusy(false); }
  };

  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader
        eyebrow="수업일지"
        bell
        title={`${md(selDate)} 수업일지`}
        onSettings={() => nav.navigate('profile')}
        right={(
          <Pressable onPress={dupLast} style={({ pressed }) => [{ backgroundColor: color.surf, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 }, pressed && { opacity: 0.7 }]}>
            <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub }}>지난 일지 복제</Text>
          </Pressable>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <MiniCalendar
            marked={new Set(lessons.map((l) => l.date))}
            selected={selDate}
            onSelect={pickDate}
            open={calOpen}
            onToggle={() => setCalOpen((o) => !o)}
            month={calMonth}
            onMonth={setCalMonth}
            toggleLabel="수업 날짜"
          />
          <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
            <Card style={{ padding: 20 }}>
              <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginBottom: 7 }}>{md(selDate)}의 수업</Text>
              {dayLessons.length === 0 ? (
                <Pressable onPress={() => nav.navigate('classes')} style={{ backgroundColor: color.surf, borderRadius: 12, padding: 13 }}>
                  <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub }}>이 날은 수업이 없어요 — 수업 관리에서 만들거나 캘린더에서 다른 날을 골라주세요 ›</Text>
                </Pressable>
              ) : (
                <View style={{ gap: 8 }}>
                  {dayLessons.map((l) => {
                    const on = effLessonId === l.id;
                    return (
                      <Pressable key={l.id} onPress={() => setLessonId(l.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: on ? color.blueBg : color.surf, borderWidth: 1.5, borderColor: on ? color.blue : 'transparent', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? color.blue : color.faint, backgroundColor: on ? color.blue : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {on && <Icon name="check" size={12} color={color.white} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: font.sb, fontSize: 14, color: color.ink }}>{l.className || l.memo || '수업'}</Text>
                          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 1 }}>{[l.startTime, l.teacherName, l.location].filter(Boolean).join(' · ')}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginTop: 14, marginBottom: 7 }}>수업 내용</Text>
              <TextInput value={content} onChangeText={setContent} multiline style={[inp, { minHeight: 100 }]} placeholder="오늘 수업 내용 — 이것만 써도 저장돼요" placeholderTextColor={color.faint} />

              <Pressable onPress={save} disabled={busy} style={{ marginTop: 16, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>{busy ? '저장 중…' : '수업일지 저장'}</Text>
              </Pressable>
              <Pressable onPress={() => nav.navigate('classes')} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ fontFamily: font.m, fontSize: 12.5, color: color.sub2 }}>출결·학생 일지·지난 일지 관리는 수업 관리에서 ›</Text>
              </Pressable>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ── 학생 ──
// 실데이터: GET /api/dashboard/roster (교사/원장). 없으면 가짜 학생을 만들지 않고 로딩/빈 상태로.

// 수동 수여 가능한 갈채(백엔드 MANUAL_CODES와 일치)
const MANUAL_BADGES = [
  { code: 'growth', emoji: '🌟', title: '성장상', sub: '눈에 띄게 성장했어요' },
  { code: 'seagull_master', emoji: '🕊️', title: '갈매기 마스터', sub: '독백을 완성했어요' },
  { code: 'karts_prep', emoji: '🏛️', title: '한예종 준비생', sub: '지정희곡을 익혔어요' },
];

export function TeacherStudentsScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['roster'], queryFn: () => dashboardApi.roster(), retry: false, staleTime: 30000 });

  const rows = data ?? [];

  const [grantFor, setGrantFor] = useState<RosterRow | null>(null);
  const doGrant = (code: string, label: string) => {
    const s = grantFor;
    setGrantFor(null);
    if (!s) return;
    achievementsApi.grant(s.id, code)
      .then(() => { qc.invalidateQueries({ queryKey: ['roster'] }); Alert.alert('수여 완료', `${s.name}님에게 ${label}를 수여했어요`); })
      .catch((e: any) => Alert.alert('수여 실패', e?.message || '수여하지 못했어요'));
  };

  return (
    <Screen bg={color.bg} edges={['top']}>
      <PageHeader eyebrow={rows.length ? `담당 학생 ${rows.length}명` : '담당 학생'} title="학생" bell onSettings={() => nav.navigate('profile')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <Card>
            {rows.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ fontFamily: font.m, fontSize: 13.5, color: color.sub2, textAlign: 'center' }}>{isLoading ? '학생을 불러오는 중…' : '아직 배정된 학생이 없어요'}</Text>
              </View>
            ) : rows.map((s, i) => {
              const tileBg = s.slump ? color.dangerBg : i % 2 === 0 ? color.blueBg : color.successBg;
              const tileColor = s.slump ? color.danger : i % 2 === 0 ? color.blue : color.success;
              return (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, ...(i > 0 ? { borderTopWidth: 1, borderTopColor: color.line } : null) }}>
                  <Avatar name={s.name} size={40} bg={tileBg} fg={tileColor} />
                  <View style={{ flex: 1 }}>
                    {s.slump ? (
                      <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{s.name} <Text style={{ fontFamily: font.b, fontSize: 11, color: color.danger }}>슬럼프 감지</Text></Text>
                    ) : (
                      <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{s.name} <Text style={{ fontFamily: font.b, fontSize: 11, color: color.amber }}>🔥{s.streak}</Text></Text>
                    )}
                    <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>{s.slump ? '가벼운 미션 제안됨' : `이번 주 제출 ${s.weekSubmissions}건`}</Text>
                  </View>
                  <Pressable onPress={() => setGrantFor(s)} style={({ pressed }) => [{ backgroundColor: color.surf, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}><Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub }}>🏅 수여</Text></Pressable>
                </View>
              );
            })}
          </Card>
        </View>
      </ScrollView>

      <Modal visible={!!grantFor} transparent animationType="fade" onRequestClose={() => setGrantFor(null)}>
        <Pressable onPress={() => setGrantFor(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: color.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 }}>
            <Text style={{ fontFamily: font.b, fontSize: 16, color: color.ink }}>{grantFor?.name}님에게 갈채 수여</Text>
            <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 4 }}>수여할 갈채를 선택하세요</Text>
            {MANUAL_BADGES.map((b) => (
              <Pressable key={b.code} onPress={() => doGrant(b.code, `${b.emoji} ${b.title}`)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, marginTop: 6, borderTopWidth: 1, borderTopColor: color.line }, pressed && { opacity: 0.6 }]}>
                <Text style={{ fontSize: 24 }}>{b.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{b.title}</Text>
                  <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 1 }}>{b.sub}</Text>
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
