import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, Tag, Avatar,
  Cta, Empty, FlowTitle, DoneScreen,
} from '../components/kit';
import { CategoryIcon, catColor } from '../components/CategoryIcon';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { MiniCalendar } from '../components/MiniCalendar';
import { color, radius, space } from '../theme/tokens';
import { lessonApi, attendanceApi, journalApi } from '../services/api';
import { useDataRefresh } from '../services/ws';
import { useAppData } from '../services/appData';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';
import type { User, Lesson, LessonJournal, AttendanceRecord } from '../types';
import { todayStr, dayOffset, md } from '../lib/date';

const isPast = (l: Lesson) => l.status === 'completed' || (l.status !== 'cancelled' && l.date < todayStr());

const CONDITIONS = [
  { value: 'good', label: '좋아요', icon: 'mood-smile' },
  { value: 'ok', label: '보통이에요', icon: 'mood-neutral' },
  { value: 'tired', label: '지쳤어요', icon: 'mood-sad' },
];

type SubView =
  | { name: 'home' }
  | { name: 'attend'; lessonId: string }
  | { name: 'journalWrite'; lessonId: string; type: 'student' | 'teacher'; journalId?: string }
  | { name: 'journalView'; journalId: string }
  | { name: 'teacherLesson'; lessonId: string }
  | { name: 'done'; title: string; sub?: string };

export function ClassesScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { allUsers, classes } = useAppData();
  const isStaff = user!.role === UserRole.TEACHER || user!.role === UserRole.DIRECTOR;
  const userId = user!.id;

  const [view, setView] = useState<SubView>({ name: 'home' });
  const [calOpen, setCalOpen] = useState(true);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const f = selDate || dayOffset(-1);
  const t = selDate || dayOffset(1);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: () => lessonApi.list({ dateFrom: dayOffset(-60), dateTo: dayOffset(30) }),
  });
  const { data: journals = [] } = useQuery({
    queryKey: ['journals', f, t],
    queryFn: () => journalApi.list({ dateFrom: f, dateTo: t }),
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', f, t, isStaff ? 'all' : userId],
    queryFn: () => (isStaff ? attendanceApi.list({ dateFrom: f, dateTo: t }) : attendanceApi.list({ studentId: userId, dateFrom: f, dateTo: t })),
  });

  useDataRefresh(['lessons'], () => qc.invalidateQueries({ queryKey: ['lessons'] }));
  useDataRefresh(['journals', 'attendance'], () => {
    qc.invalidateQueries({ queryKey: ['journals'] });
    qc.invalidateQueries({ queryKey: ['attendance'] });
  });
  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['lessons'] });
    qc.invalidateQueries({ queryKey: ['journals'] });
    qc.invalidateQueries({ queryKey: ['attendance'] });
  }, [qc]);

  const classStudents = (classId?: string): User[] => {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return [];
    return allUsers.filter((u) => cls.studentIds.includes(u.id));
  };
  const lessonOf = (id: string) => lessons.find((l) => l.id === id);
  const myStudentJournal = (lessonId: string) => journals.find((j) => j.lessonId === lessonId && j.journalType === 'student' && j.authorId === userId);
  const teacherJournal = (lessonId: string) => journals.find((j) => j.lessonId === lessonId && j.journalType === 'teacher');
  const studentJournalsFor = (lessonId: string) => journals.filter((j) => j.lessonId === lessonId && j.journalType === 'student');
  const myAttendance = (lessonId: string) => attendance.find((a) => a.lessonId === lessonId && a.studentId === userId);

  const lessonRow = (l: Lesson) => {
    const cc = catColor(l.subject);
    const cancelled = l.status === 'cancelled';
    const ltBase = l.className || l.memo || (l.isPrivate ? '개인레슨' : '수업');
    const lt = l.location ? `${ltBase} · ${l.location}` : ltBase;

    if (!isStaff) {
      if (cancelled) {
        return <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${md(l.date)} · ${l.startTime}`} showChevron={false} right={<Tag label="취소됨" tone="neutral" />} />;
      }
      if (isPast(l)) {
        const j = myStudentJournal(l.id);
        return (
          <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={md(l.date)} showChevron={false}
            right={j ? <Tag label="일지 작성됨" tone="done" /> : <Tag label="일지 쓰기" tone="todo" />}
            onPress={j ? () => setView({ name: 'journalView', journalId: j.id }) : () => setView({ name: 'journalWrite', lessonId: l.id, type: 'student' })} />
        );
      }
      if (l.date === todayStr()) {
        const att = myAttendance(l.id);
        return (
          <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${l.startTime}${att ? ' · 출석 완료' : ' · ' + l.teacherName}`} showChevron={false}
            right={att ? <Tag label="출석함" tone="done" /> : <Tag label="출석하기" bg={cc.bg} fg={cc.fg} />}
            onPress={att ? undefined : () => setView({ name: 'attend', lessonId: l.id })} />
        );
      }
      return <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${md(l.date)} · ${l.startTime}`} showChevron={false} right={<Tag label="예정" tone="neutral" />} />;
    }

    // teacher / director
    const teach = l.teacherName ? ` · ${l.teacherName}` : '';
    if (cancelled) {
      return <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${md(l.date)} · ${l.startTime}${teach}`} showChevron={false} right={<Tag label="취소됨" tone="neutral" />} onPress={() => setView({ name: 'teacherLesson', lessonId: l.id })} />;
    }
    if (isPast(l)) {
      const tj = teacherJournal(l.id);
      return (
        <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${md(l.date)}${teach}`} showChevron={false}
          right={tj ? <Tag label="일지 작성됨" tone="done" /> : <Tag label="일지 쓰기" tone="todo" />}
          onPress={() => setView({ name: 'teacherLesson', lessonId: l.id })} />
      );
    }
    if (l.date === todayStr()) {
      const present = attendance.filter((a) => a.lessonId === l.id && (a.status === 'present' || a.status === 'late')).length;
      return (
        <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${l.startTime}${teach} · 진행 중`} showChevron={false}
          right={<Tag label={`출석 ${present}/${classStudents(l.classId).length}`} tone="neutral" />}
          onPress={() => setView({ name: 'teacherLesson', lessonId: l.id })} />
      );
    }
    return <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${md(l.date)} · ${l.startTime}${teach}`} showChevron={false} right={<Tag label="예정" tone="neutral" />} onPress={() => setView({ name: 'teacherLesson', lessonId: l.id })} />;
  };

  // ── sub-screens ──
  if (view.name === 'done') {
    return <DoneScreen title={view.title} sub={view.sub} onConfirm={() => setView({ name: 'home' })} />;
  }
  if (view.name === 'attend') {
    const l = lessonOf(view.lessonId);
    if (l) return <AttendScreen lesson={l} userId={userId} onBack={() => setView({ name: 'home' })} onDone={() => { reload(); setView({ name: 'done', title: '출석을 마쳤어요', sub: '오늘도 와줘서 좋아요' }); }} />;
  }
  if (view.name === 'journalWrite') {
    const l = lessonOf(view.lessonId);
    const editJournal = view.journalId ? journals.find((x) => x.id === view.journalId) : undefined;
    const isTeacher = view.type === 'teacher';
    const doneInfo = editJournal
      ? { title: '일지를 수정했어요', sub: undefined as string | undefined }
      : isTeacher
        ? { title: '수업일지를 저장했어요', sub: '선생님과 관리자만 볼 수 있어요' }
        : { title: '일지를 저장했어요', sub: '선생님께 알림이 갔어요' };
    if (l) return <JournalWrite lesson={l} type={view.type} journal={editJournal} onBack={() => setView({ name: 'home' })} onDone={() => { reload(); setView({ name: 'done', title: doneInfo.title, sub: doneInfo.sub }); }} />;
  }
  if (view.name === 'journalView') {
    const j = journals.find((x) => x.id === view.journalId);
    if (j) return (
      <JournalView journal={j} lesson={lessonOf(j.lessonId)} canComment={isStaff}
        canEdit={!isStaff && j.journalType === 'student' && j.authorId === userId}
        onEdit={() => setView({ name: 'journalWrite', lessonId: j.lessonId, type: 'student', journalId: j.id })}
        onBack={() => setView({ name: 'home' })} onReload={reload} />
    );
  }
  if (view.name === 'teacherLesson') {
    const l = lessonOf(view.lessonId);
    if (l) return (
      <TeacherLessonDetail lesson={l} students={classStudents(l.classId)} teacherJournal={teacherJournal(l.id)} studentJournals={studentJournalsFor(l.id)}
        onBack={() => setView({ name: 'home' })} onWriteJournal={() => setView({ name: 'journalWrite', lessonId: l.id, type: 'teacher' })}
        onOpenStudentJournal={(jid) => setView({ name: 'journalView', journalId: jid })} reload={reload} />
    );
  }

  // ── home ──
  const yest = dayOffset(-1), tod = todayStr(), tom = dayOffset(1);
  const dayLessons = selDate ? lessons.filter((l) => l.date === selDate).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')) : [];

  const daySection = (label: string, date: string) => {
    const ls = lessons.filter((l) => l.date === date).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    return (
      <React.Fragment key={date}>
        <SectionLabel>{label}{ls.length ? ` · ${ls.length}개` : ''}</SectionLabel>
        {ls.length === 0 ? <Text style={{ paddingHorizontal: space.screenX, paddingVertical: 6, fontSize: 13, color: color.sub }}>수업이 없어요</Text> : ls.map(lessonRow)}
      </React.Fragment>
    );
  };

  return (
    <Screen edges={['top']}>
      <TopBar />
      <BigTitle>{isStaff ? '수업을\n운영하고 기록해요' : '수업을\n준비하고 돌아봐요'}</BigTitle>
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        <MiniCalendar
          marked={new Set(lessons.map((l) => l.date))} selected={selDate || todayStr()} onSelect={(d) => setSelDate(d)}
          open={calOpen} onToggle={() => setCalOpen((o) => !o)} month={calMonth} onMonth={setCalMonth} toggleLabel="수업"
        />
        {isLoading ? (
          <Empty>불러오는 중…</Empty>
        ) : selDate ? (
          <>
            <SectionLabel>{selDate.slice(5).replace('-', '/')} 수업 {dayLessons.length}개</SectionLabel>
            {dayLessons.length === 0 ? <Empty>이 날은 수업이 없어요</Empty> : dayLessons.map(lessonRow)}
          </>
        ) : (
          <>
            {daySection('오늘', tod)}
            {daySection('내일', tom)}
            {daySection('어제', yest)}
            <Text style={{ fontSize: 12, color: color.sub, textAlign: 'center', paddingTop: 12 }}>다른 날짜는 위 달력에서 선택하세요</Text>
          </>
        )}
      </Scroll>
    </Screen>
  );
}

// 학생 출석 체크
function AttendScreen({ lesson, userId, onBack, onDone }: { lesson: Lesson; userId: string; onBack: () => void; onDone: () => void }) {
  const [cond, setCond] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!cond) return;
    setBusy(true);
    try {
      const note = CONDITIONS.find((c) => c.value === cond)?.label;
      await attendanceApi.create({ lessonId: lesson.id, studentId: userId, status: 'present', note });
      onDone();
    } catch (e: any) {
      Alert.alert('출석 실패', e?.message || '출석하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['top']}>
      <BackHeader title="출석 체크" onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX }}>
        <FlowTitle>출석하고{'\n'}컨디션을 알려줘요</FlowTitle>
        <View style={{ backgroundColor: color.surf, borderRadius: radius.button, padding: 14, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CategoryIcon cat={lesson.subject} />
          <View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: color.ink }}>{lesson.className}</Text>
            <Text style={{ fontSize: 13, color: color.success, marginTop: 2 }}>학원 위치 확인됨</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '500', color: color.sub, marginTop: 18, marginBottom: 10 }}>오늘 컨디션은 어때요?</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {CONDITIONS.map((o) => {
            const on = cond === o.value;
            return (
              <Pressable key={o.value} onPress={() => setCond(o.value)} style={{ flex: 1, backgroundColor: on ? color.blueBg : color.white, borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center', gap: 6 }}>
                <Icon name={o.icon} size={23} color={on ? color.blue : color.sub} />
                <Text style={{ fontSize: 12, fontWeight: '500', color: on ? color.blue : color.sub }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Scroll>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
        <Cta label="출석 완료하기" onPress={submit} disabled={!cond} loading={busy} />
      </View>
    </Screen>
  );
}

// 일지 작성/수정
function JournalWrite({ lesson, type, journal, onBack, onDone }: { lesson: Lesson; type: 'student' | 'teacher'; journal?: LessonJournal; onBack: () => void; onDone: () => void }) {
  const [content, setContent] = useState(journal?.content || '');
  const [busy, setBusy] = useState(false);
  const editing = !!journal;
  const isTeacher = type === 'teacher';
  const submit = async () => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      if (editing) await journalApi.update(journal!.id, { content: content.trim() });
      else await journalApi.create({ lessonId: lesson.id, journalType: type, content: content.trim() });
      onDone();
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message || '저장하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['top']}>
      <BackHeader title={isTeacher ? '수업일지' : '수업 일지'} onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX }}>
        <FlowTitle>{isTeacher ? '이 수업,\n어떻게 진행됐나요?' : '이 수업,\n어땠어요?'}</FlowTitle>
        <Text style={{ fontSize: 14, color: color.sub, marginTop: 6 }}>{lesson.className} · {md(lesson.date)}</Text>
        <TextInput
          value={content} onChangeText={setContent} multiline
          placeholder={isTeacher ? '수업 진행, 진도, 운영 메모를 적어요' : '잘된 점, 보완할 점을 편하게 적어요'} placeholderTextColor={color.faint}
          style={{ marginTop: 16, minHeight: 120, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.chip, padding: 12, fontSize: 14, color: color.ink, textAlignVertical: 'top' }}
        />
        {isTeacher && (
          <View style={{ marginTop: 16, backgroundColor: color.purpleBg, borderRadius: radius.card, padding: 13 }}>
            <Text style={{ fontSize: 13, color: color.purpleInk, lineHeight: 21 }}>이 일지는 선생님과 관리자만 볼 수 있어요</Text>
          </View>
        )}
      </Scroll>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
        <Cta label={editing ? '일지 수정하기' : isTeacher ? '수업일지 저장하기' : '일지 저장하기'} onPress={submit} disabled={!content.trim()} loading={busy} />
      </View>
    </Screen>
  );
}

// 일지 보기 + 선생님 댓글
function JournalView({ journal, lesson, canComment, canEdit, onEdit, onBack, onReload }: { journal: LessonJournal; lesson?: Lesson; canComment: boolean; canEdit?: boolean; onEdit?: () => void; onBack: () => void; onReload: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const comments = journal.comments || [];
  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await journalApi.addComment(journal.id, text.trim()); setText(''); onReload(); }
    catch (e: any) { Alert.alert('실패', e?.message || '남기지 못했어요'); }
    finally { setBusy(false); }
  };
  const removeComment = (commentId: string) => {
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { try { await journalApi.deleteComment(journal.id, commentId); onReload(); } catch (e: any) { Alert.alert('실패', e?.message || '삭제하지 못했어요'); } } },
    ]);
  };
  return (
    <Screen edges={['top']}>
      <BackHeader title="수업 일지" onBack={onBack} right={canEdit ? <Pressable onPress={onEdit} hitSlop={6}><Text style={{ fontSize: 13, fontWeight: '600', color: color.blue }}>다시 쓰기</Text></Pressable> : undefined} />
      <Scroll contentStyle={{ paddingHorizontal: space.screenX, paddingBottom: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 10, color: color.ink }}>{lesson?.className || '수업'}</Text>
        <Text style={{ fontSize: 13, color: color.sub, marginTop: 6 }}>{journal.authorName} · {md(journal.date)}</Text>
        <Text style={{ fontSize: 15, lineHeight: 27, marginTop: 14, color: color.ink }}>{journal.content}</Text>
        <View style={{ height: 1, backgroundColor: color.line, marginVertical: 18 }} />
        <Text style={{ fontSize: 13, fontWeight: '500', color: color.sub }}>선생님 댓글 {comments.length}개</Text>
        {comments.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Avatar name={c.authorName} size={34} bg={color.purpleBg} fg={color.purple} />
            <View style={{ flex: 1, backgroundColor: color.surf, borderRadius: radius.chip, borderTopLeftRadius: 4, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: color.ink }}>{c.authorName}</Text>
                {canComment && <Pressable onPress={() => removeComment(c.id)} hitSlop={6}><Text style={{ fontSize: 12, color: color.faint }}>삭제</Text></Pressable>}
              </View>
              <Text style={{ fontSize: 14, lineHeight: 22, marginTop: 3, color: color.ink }}>{c.content}</Text>
            </View>
          </View>
        ))}
        {canComment && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <TextInput value={text} onChangeText={setText} placeholder="코칭 댓글을 남겨요" placeholderTextColor={color.faint}
              style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: 11, padding: 11, fontSize: 13, color: color.ink }} />
            <Pressable onPress={add} disabled={busy || !text.trim()} style={{ backgroundColor: text.trim() ? color.blue : color.surf, borderRadius: 11, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ color: text.trim() ? color.white : color.sub, fontSize: 14, fontWeight: '600' }}>등록</Text>
            </Pressable>
          </View>
        )}
      </Scroll>
    </Screen>
  );
}

// 선생님 수업 상세 — 출결 / 수업일지 + 학생 일지
function TeacherLessonDetail({ lesson, students, teacherJournal, studentJournals, onBack, onWriteJournal, onOpenStudentJournal, reload }: {
  lesson: Lesson; students: User[]; teacherJournal?: LessonJournal; studentJournals: LessonJournal[];
  onBack: () => void; onWriteJournal: () => void; onOpenStudentJournal: (id: string) => void; reload: () => void;
}) {
  const isToday = lesson.status === 'scheduled' && lesson.date === todayStr();
  const { data: att = [] } = useQuery({ queryKey: ['attendance', 'lesson', lesson.id], queryFn: () => attendanceApi.list({ lessonId: lesson.id }) });
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const m: Record<string, boolean> = {};
    att.forEach((r) => { m[r.studentId] = r.status === 'present' || r.status === 'late'; });
    setMarks(m);
  }, [att]);

  const saveAttendance = async () => {
    setBusy(true);
    try { await attendanceApi.bulkCreate(lesson.id, students.map((s) => ({ studentId: s.id, status: marks[s.id] ? 'present' : 'absent' }))); reload(); }
    catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };

  const completeLesson = () => {
    Alert.alert('수업 종료', '출결을 저장하고 수업을 종료할까요? 종료하면 수업일지·학생일지를 쓸 수 있어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료', onPress: async () => {
          setBusy(true);
          try {
            await attendanceApi.bulkCreate(lesson.id, students.map((s) => ({ studentId: s.id, status: marks[s.id] ? 'present' : 'absent' })));
            await lessonApi.complete(lesson.id);
            reload();
            onWriteJournal();
          } catch (e: any) { Alert.alert('실패', e?.message || '처리하지 못했어요'); }
          finally { setBusy(false); }
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <BackHeader title="수업" onBack={onBack} />
      <Scroll contentStyle={{ paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.screenX, paddingTop: 8, paddingBottom: 4 }}>
          <CategoryIcon cat={lesson.subject} />
          <View>
            <Text style={{ fontSize: 19, fontWeight: '700', letterSpacing: -0.38, color: color.ink }}>{lesson.className}</Text>
            <Text style={{ fontSize: 13, color: color.sub, marginTop: 3 }}>{md(lesson.date)} · {lesson.startTime}</Text>
          </View>
        </View>

        {isToday ? (
          <>
            <SectionLabel>학생 출결</SectionLabel>
            {students.length === 0 ? <Empty>등록된 학생이 없어요</Empty> : students.map((s) => (
              <ListRow key={s.id} showChevron={false}
                left={<Avatar name={s.name} size={40} bg={marks[s.id] ? color.successBg : color.surf} fg={marks[s.id] ? color.success : color.sub} />}
                title={s.name} sub={marks[s.id] ? '출석함' : '아직 출석 전'}
                right={
                  <Pressable onPress={() => setMarks((m) => ({ ...m, [s.id]: !m[s.id] }))} style={{ backgroundColor: marks[s.id] ? color.successBg : color.surf, borderRadius: radius.tag, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: marks[s.id] ? color.success : color.sub }}>{marks[s.id] ? '출석' : '미출석'}</Text>
                  </Pressable>
                } />
            ))}
          </>
        ) : (
          <>
            <SectionLabel>수업일지</SectionLabel>
            <View style={{ marginHorizontal: space.screenX, marginBottom: 8, backgroundColor: color.purpleBg, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', gap: 7, alignItems: 'center' }}>
              <Icon name="lock" size={14} color={color.purple} />
              <Text style={{ fontSize: 12, color: color.purpleInk }}>선생님과 관리자만 볼 수 있어요</Text>
            </View>
            {teacherJournal ? (
              <View style={{ marginHorizontal: space.screenX, padding: 14, borderWidth: 0.5, borderColor: color.line, borderRadius: radius.chip }}>
                <Text style={{ fontSize: 14, lineHeight: 22, color: color.ink }}>{teacherJournal.content}</Text>
              </View>
            ) : (
              <View style={{ marginHorizontal: space.screenX, backgroundColor: color.surf, borderRadius: radius.chip, padding: 13 }}>
                <Text style={{ fontSize: 13, color: color.sub }}>이 수업의 수업일지를 아직 안 썼어요</Text>
              </View>
            )}

            <SectionLabel>학생 일지 {studentJournals.length}개</SectionLabel>
            {studentJournals.length === 0 ? <Empty>아직 학생 일지가 없어요</Empty> : studentJournals.map((j) => (
              <ListRow key={j.id} left={<Avatar name={j.authorName} size={40} />} title={j.authorName} sub={j.content}
                right={(j.comments?.length ?? 0) > 0 ? <Tag label={`댓글 ${j.comments!.length}`} tone="todo" /> : undefined}
                onPress={() => onOpenStudentJournal(j.id)} />
            ))}
          </>
        )}
      </Scroll>

      {isToday ? (
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16, gap: 4 }}>
          <Cta label="출결 저장하기" onPress={saveAttendance} loading={busy} />
          <Pressable onPress={completeLesson} disabled={busy} style={{ paddingVertical: 12, alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: color.sub }}>수업 종료하고 일지 쓰기</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
          <Cta label={teacherJournal ? '수업일지 다시 쓰기' : '이 수업의 수업일지 쓰기'} onPress={onWriteJournal} />
        </View>
      )}
    </Screen>
  );
}
