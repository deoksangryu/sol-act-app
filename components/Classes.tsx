import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, Lesson, LessonJournal, AttendanceRecord } from '../types';
import { lessonApi, journalApi, attendanceApi } from '../services/api';
import { useAppData } from '../services/AppContext';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS, catColor, CategoryIcon } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, Tag, Avatar,
  Cta, Empty, Chevron, DoneScreen, ListSkeleton, FlowTitle, toneColors,
} from './toss/kit';
import { MiniCalendar } from './toss/Calendar';

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// 오늘 기준 N일 후/전 날짜 (YYYY-MM-DD)
function dayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const md = (iso: string) => (iso || '').slice(5, 10).replace('-', '/');

// 끝난 수업(완료 처리됐거나, 취소가 아닌데 날짜가 지난 경우) — 일지 작성/조회 대상
const isPast = (l: Lesson) => l.status === 'completed' || (l.status !== 'cancelled' && l.date < todayStr());

// 출석 컨디션 — 프로토타입 sAt: 좋아요/보통이에요/지쳤어요 (mood, 출결 상태와 무관)
const CONDITIONS = [
  { value: 'good', label: '좋아요', icon: 'ti-mood-smile' },
  { value: 'ok', label: '보통이에요', icon: 'ti-mood-neutral' },
  { value: 'tired', label: '지쳤어요', icon: 'ti-mood-sad' },
];

type View =
  | { name: 'home' }
  | { name: 'attend'; lessonId: string }
  | { name: 'journalWrite'; lessonId: string; type: 'student' | 'teacher'; journalId?: string }
  | { name: 'journalView'; journalId: string }
  | { name: 'teacherLesson'; lessonId: string }
  | { name: 'done'; title: string; sub?: string };

export const Classes: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const { allUsers, classes } = useAppData();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [journals, setJournals] = useState<LessonJournal[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: 'home' });
  // 캘린더 (접기/펴기 + 날짜 선택 필터)
  const [calOpen, setCalOpen] = useState(true);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  // 수업은 최근 60일 ~ 향후 30일(캘린더 점·목록용)
  const loadLessons = async () => {
    try { setLessons(await lessonApi.list({ dateFrom: dayOffset(-60), dateTo: dayOffset(30) })); }
    catch (e: any) { toast.error(e.message || '수업을 불러오지 못했어요'); }
  };
  // 일지·출결은 "보이는 범위"만 — 홈=어제~내일, 캘린더 선택 시 그 날짜 (대형 풀페치 방지)
  const loadJA = async () => {
    const f = selDate || dayOffset(-1), t = selDate || dayOffset(1);
    try {
      const [js, at] = await Promise.all([
        journalApi.list({ dateFrom: f, dateTo: t }),
        isStaff ? attendanceApi.list({ dateFrom: f, dateTo: t }) : attendanceApi.list({ studentId: user.id, dateFrom: f, dateTo: t }),
      ]);
      setJournals(js);
      setAttendance(at);
    } catch (e: any) {
      toast.error(e.message || '수업 정보를 불러오지 못했어요');
    }
  };
  const load = async () => { await Promise.all([loadLessons(), loadJA()]); };
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  // 엔티티별로 분리 갱신(바뀐 것만 다시 받음)
  useDataRefresh(['lessons'], loadLessons);
  useDataRefresh(['journals', 'attendance'], loadJA);
  // 캘린더 날짜 선택 변경 시 해당 날짜 일지/출결만 추가 로드
  useEffect(() => { if (!loading) loadJA(); /* eslint-disable-next-line */ }, [selDate]);

  const classStudents = (classId?: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return [];
    return allUsers.filter(u => cls.studentIds.includes(u.id));
  };
  const lessonOf = (id: string) => lessons.find(l => l.id === id);
  const myStudentJournal = (lessonId: string) => journals.find(j => j.lessonId === lessonId && j.journalType === 'student' && j.authorId === user.id);
  const teacherJournal = (lessonId: string) => journals.find(j => j.lessonId === lessonId && j.journalType === 'teacher');
  const studentJournalsFor = (lessonId: string) => journals.filter(j => j.lessonId === lessonId && j.journalType === 'student');
  const myAttendance = (lessonId: string) => attendance.find(a => a.lessonId === lessonId && a.studentId === user.id);

  // 수업 한 줄 (역할·상태별) — 기본 섹션과 캘린더 날짜뷰에서 공용
  const lessonRow = (l: Lesson) => {
    const cc = catColor(l.subject);
    const cancelled = l.status === 'cancelled';
    // 수업 타이틀에 지점(부평/산곡) 표시 — 세션마다 지점이 달라서 수업 단위로 붙임
    const lt = l.location ? `${l.className} · ${l.location}` : l.className;
    if (!isStaff) {
      if (cancelled) {
        return <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt}
          sub={`${md(l.date)} · ${l.startTime}`} right={<Tag bg={TOSS.surf} fg={TOSS.sub}>취소됨</Tag>} />;
      }
      if (isPast(l)) {
        const j = myStudentJournal(l.id);
        return (
          <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={md(l.date)}
            right={j ? <Tag bg={TOSS.successBg} fg={TOSS.success}>일지 작성됨</Tag> : <Tag {...toneColors('todo')}>일지 쓰기</Tag>}
            onClick={j ? () => setView({ name: 'journalView', journalId: j.id }) : () => setView({ name: 'journalWrite', lessonId: l.id, type: 'student' })} />
        );
      }
      if (l.date === todayStr()) {
        const att = myAttendance(l.id);
        return (
          <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt}
            sub={`${l.startTime}${att ? ' · 출석 완료' : ' · ' + l.teacherName}`}
            right={att ? <Tag bg={TOSS.successBg} fg={TOSS.success}>출석함</Tag> : <Tag bg={cc.bg} fg={cc.fg}>출석하기</Tag>}
            onClick={att ? undefined : () => setView({ name: 'attend', lessonId: l.id })} />
        );
      }
      return (
        <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt}
          sub={`${md(l.date)} · ${l.startTime}`} right={<Tag>예정</Tag>} />
      );
    }
    // teacher / director
    if (cancelled) {
      return <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${md(l.date)} · ${l.startTime}`}
        right={<Tag bg={TOSS.surf} fg={TOSS.sub}>취소됨</Tag>} onClick={() => setView({ name: 'teacherLesson', lessonId: l.id })} />;
    }
    if (isPast(l)) {
      const tj = teacherJournal(l.id);
      return (
        <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={md(l.date)}
          right={tj ? <Tag bg={TOSS.successBg} fg={TOSS.success}>일지 작성됨</Tag> : <Tag {...toneColors('todo')}>일지 쓰기</Tag>}
          onClick={() => setView({ name: 'teacherLesson', lessonId: l.id })} />
      );
    }
    if (l.date === todayStr()) {
      const present = attendance.filter(a => a.lessonId === l.id && (a.status === 'present' || a.status === 'late')).length;
      return (
        <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${l.startTime} · 진행 중`}
          right={<Tag>출석 {present}/{classStudents(l.classId).length}</Tag>}
          onClick={() => setView({ name: 'teacherLesson', lessonId: l.id })} />
      );
    }
    return (
      <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={lt} sub={`${md(l.date)} · ${l.startTime}`} right={<Tag>예정</Tag>}
        onClick={() => setView({ name: 'teacherLesson', lessonId: l.id })} />
    );
  };

  if (loading) return <ListSkeleton />;

  // ── sub-screens ──
  if (view.name === 'done') {
    return <DoneScreen title={view.title} sub={view.sub} onConfirm={() => setView({ name: 'home' })} />;
  }
  if (view.name === 'attend') {
    const l = lessonOf(view.lessonId);
    if (l) return <AttendScreen lesson={l} userId={user.id} onBack={() => setView({ name: 'home' })}
      onDone={async () => { await load(); setView({ name: 'done', title: '출석을 마쳤어요', sub: '오늘도 와줘서 좋아요' }); }} />;
  }
  if (view.name === 'journalWrite') {
    const l = lessonOf(view.lessonId);
    const editJournal = view.journalId ? journals.find(x => x.id === view.journalId) : undefined;
    const isTeacher = view.type === 'teacher';
    const doneInfo = editJournal
      ? { title: '일지를 수정했어요', sub: undefined as string | undefined }
      : isTeacher
        ? { title: '수업일지를 저장했어요', sub: '선생님과 관리자만 볼 수 있어요' }
        : { title: '일지를 저장했어요', sub: '선생님께 알림이 갔어요' };
    if (l) return <JournalWrite lesson={l} type={view.type} journal={editJournal} onBack={() => setView({ name: 'home' })}
      onDone={async () => { await load(); setView({ name: 'done', title: doneInfo.title, sub: doneInfo.sub }); }} />;
  }
  if (view.name === 'journalView') {
    const j = journals.find(x => x.id === view.journalId);
    if (j) return (
      <JournalView
        journal={j}
        lesson={lessonOf(j.lessonId)}
        canComment={isStaff}
        canEdit={!isStaff && j.journalType === 'student' && j.authorId === user.id}
        onEdit={() => setView({ name: 'journalWrite', lessonId: j.lessonId, type: 'student', journalId: j.id })}
        onBack={() => setView({ name: 'home' })}
        onReload={load}
      />
    );
  }
  if (view.name === 'teacherLesson') {
    const l = lessonOf(view.lessonId);
    if (l) return (
      <TeacherLessonDetail
        lesson={l}
        students={classStudents(l.classId)}
        teacherJournal={teacherJournal(l.id)}
        studentJournals={studentJournalsFor(l.id)}
        onBack={() => setView({ name: 'home' })}
        onWriteJournal={() => setView({ name: 'journalWrite', lessonId: l.id, type: 'teacher' })}
        onOpenStudentJournal={(jid) => setView({ name: 'journalView', journalId: jid })}
        onReload={load}
      />
    );
  }

  // ── home ── 목록은 오늘/내일/어제로 분할(나머지는 캘린더로 조회 → 렌더 가볍게)
  const yest = dayOffset(-1), tod = todayStr(), tom = dayOffset(1);

  // 캘린더에서 선택한 날짜의 수업 (시간순)
  const dayLessons = selDate
    ? lessons.filter(l => l.date === selDate).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    : [];

  // 날짜별 섹션 — 같은 날 수업을 시간순으로(없으면 한 줄 안내)
  const daySection = (label: string, date: string) => {
    const ls = lessons.filter(l => l.date === date).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    return (
      <React.Fragment key={date}>
        <SectionLabel>{label}{ls.length ? ` · ${ls.length}개` : ''}</SectionLabel>
        {ls.length === 0
          ? <div style={{ padding: '6px 20px 8px', fontSize: 13, color: TOSS.sub }}>수업이 없어요</div>
          : ls.map(lessonRow)}
      </React.Fragment>
    );
  };

  return (
    <Screen>
      <BigTitle title={isStaff ? <>수업을<br />운영하고 기록해요</> : <>수업을<br />준비하고 돌아봐요</>} />
      <Scroll>
        <MiniCalendar
          marked={new Set(lessons.map(l => l.date))} selected={selDate} onSelect={setSelDate}
          open={calOpen} onToggle={() => setCalOpen(o => !o)} month={calMonth} onMonth={setCalMonth}
        />
        {selDate ? (
          <>
            <SectionLabel>{selDate.slice(5).replace('-', '/')} 수업 {dayLessons.length}개</SectionLabel>
            {dayLessons.length === 0 ? <Empty>이 날은 수업이 없어요</Empty> : dayLessons.map(lessonRow)}
          </>
        ) : (
          <>
            {daySection('오늘', tod)}
            {daySection('내일', tom)}
            {daySection('어제', yest)}
            <div style={{ fontSize: 12, color: TOSS.sub, textAlign: 'center', padding: '12px 0 4px' }}>다른 날짜는 위 달력에서 선택하세요</div>
          </>
        )}
      </Scroll>
    </Screen>
  );
};

// 학생 출석 체크 — 프로토타입 sAt: "출석하고 컨디션을 알려줘요"
const AttendScreen: React.FC<{ lesson: Lesson; userId: string; onBack: () => void; onDone: () => Promise<void> }> = ({ lesson, userId, onBack, onDone }) => {
  const [cond, setCond] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!cond) return;
    setBusy(true);
    try {
      // 본인 체크인은 항상 '출석'. 선택한 컨디션(좋아요/보통/지쳤어요)은 mood로 note에만 기록
      const note = CONDITIONS.find(c => c.value === cond)?.label;
      await attendanceApi.create({ lessonId: lesson.id, studentId: userId, status: 'present', note } as any);
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '출석하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  const cc = catColor(lesson.subject);
  return (
    <Screen>
      <BackHeader title="출석 체크" onBack={onBack} />
      <Scroll>
        <div style={{ padding: '8px 20px' }}>
          <FlowTitle pad="0">출석하고<br />컨디션을 알려줘요</FlowTitle>
          <div style={{ background: TOSS.surf, borderRadius: 14, padding: 14, marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <CategoryIcon cat={lesson.subject} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOSS.ink }}>{lesson.className}</div>
              <div style={{ fontSize: 13, color: TOSS.success, marginTop: 2 }}>학원 위치 확인됨</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '18px 0 10px' }}>오늘 컨디션은 어때요?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {CONDITIONS.map(o => {
              const on = cond === o.value;
              return (
                <button key={o.value} onClick={() => setCond(o.value)}
                  style={{ flex: 1, background: on ? TOSS.blueBg : '#fff', border: `1.5px solid ${on ? TOSS.blue : TOSS.inputLine}`, borderRadius: 14, padding: '13px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <i className={`ti ${o.icon}`} style={{ fontSize: 23, color: on ? TOSS.blue : TOSS.sub }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: on ? TOSS.blue : TOSS.sub }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Scroll>
      <Cta onClick={submit} disabled={!cond} loading={busy}>출석 완료하기</Cta>
    </Screen>
  );
};

// 일지 작성/수정 — 프로토타입 sSw(학생) / sCw(교사)
const JournalWrite: React.FC<{ lesson: Lesson; type: 'student' | 'teacher'; journal?: LessonJournal; onBack: () => void; onDone: () => Promise<void> }> = ({ lesson, type, journal, onBack, onDone }) => {
  const [content, setContent] = useState(journal?.content || '');
  const [busy, setBusy] = useState(false);
  const editing = !!journal;
  const submit = async () => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      if (editing) await journalApi.update(journal!.id, { content: content.trim() } as any);
      else await journalApi.create({ lessonId: lesson.id, journalType: type, content: content.trim() } as any);
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '저장하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  const isTeacher = type === 'teacher';
  return (
    <Screen>
      <BackHeader title={isTeacher ? '수업일지' : '수업 일지'} onBack={onBack} />
      <Scroll>
        <div style={{ padding: '8px 20px' }}>
          <FlowTitle pad="0">
            {isTeacher ? <>이 수업,<br />어떻게 진행됐나요?</> : <>이 수업,<br />어땠어요?</>}
          </FlowTitle>
          <div style={{ fontSize: 14, color: TOSS.sub, marginTop: 6 }}>{lesson.className} · {md(lesson.date)}</div>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={isTeacher ? '수업 진행, 진도, 운영 메모를 적어요' : '잘된 점, 보완할 점을 편하게 적어요'}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 16, minHeight: 120, border: `1px solid ${TOSS.inputLine}`, borderRadius: 13, padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'none', color: TOSS.ink, outline: 'none' }} />
          {isTeacher && (
            <div style={{ marginTop: 16, background: TOSS.purpleBg, borderRadius: 12, padding: '11px 13px', fontSize: 13, color: TOSS.purpleInk, lineHeight: 1.6 }}>
              이 일지는 선생님과 관리자만 볼 수 있어요
            </div>
          )}
        </div>
      </Scroll>
      <Cta onClick={submit} disabled={!content.trim()} loading={busy}>{editing ? '일지 수정하기' : isTeacher ? '수업일지 저장하기' : '일지 저장하기'}</Cta>
    </Screen>
  );
};

// 일지 보기 + 선생님 댓글 — 프로토타입 sSv
const JournalView: React.FC<{ journal: LessonJournal; lesson?: Lesson; canComment: boolean; canEdit?: boolean; onEdit?: () => void; onBack: () => void; onReload: () => Promise<void> }> = ({ journal, lesson, canComment, canEdit, onEdit, onBack, onReload }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const comments = journal.comments || [];
  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await journalApi.addComment(journal.id, text.trim());
      toast.success('댓글을 남겼어요');
      setText('');
      await onReload();
    } catch (e: any) {
      toast.error(e.message || '남기지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  const removeComment = async (commentId: string) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    try {
      await journalApi.deleteComment(journal.id, commentId);
      await onReload();
    } catch (e: any) {
      toast.error(e.message || '삭제하지 못했어요');
    }
  };
  return (
    <Screen>
      <BackHeader title="수업 일지" onBack={onBack} right={canEdit ? (
        <button onClick={onEdit} style={{ fontSize: 13, fontWeight: 600, color: TOSS.blue, background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer' }}>다시 쓰기</button>
      ) : undefined} />
      <Scroll>
        <div style={{ padding: '8px 20px 4px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10, color: TOSS.ink }}>{lesson?.className || '수업'}</div>
          <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 6 }}>{journal.authorName} · {md(journal.date)}</div>
          <div style={{ fontSize: 15, lineHeight: 1.8, marginTop: 14, color: TOSS.ink, whiteSpace: 'pre-wrap' }}>{journal.content}</div>
          <div style={{ height: 1, background: TOSS.line, margin: '18px 0 2px' }} />
          <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub }}>선생님 댓글 {comments.length}개</div>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Avatar name={c.authorName} size={34} bg={TOSS.purpleBg} fg={TOSS.purple} />
              <div style={{ flex: 1, background: TOSS.surf, borderRadius: '4px 13px 13px 13px', padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TOSS.ink }}>{c.authorName}</div>
                  {canComment && (
                    <button onClick={() => removeComment(c.id)} style={{ background: 'none', border: 'none', padding: 2, fontSize: 12, color: TOSS.faint, cursor: 'pointer' }}>삭제</button>
                  )}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 3, color: TOSS.ink }}>{c.content}</div>
              </div>
            </div>
          ))}
          {canComment && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="코칭 댓글을 남겨요"
                style={{ flex: 1, border: `1px solid ${TOSS.inputLine}`, borderRadius: 11, padding: 11, fontSize: 13, fontFamily: 'inherit', color: TOSS.ink, outline: 'none' }} />
              <button onClick={add} disabled={busy || !text.trim()}
                style={{ background: TOSS.blue, color: '#fff', border: 'none', borderRadius: 11, padding: '0 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>등록</button>
            </div>
          )}
          <div style={{ height: 14 }} />
        </div>
      </Scroll>
    </Screen>
  );
};

// 선생님 수업 상세 — 프로토타입 sCd(teacher): 출결 / 수업일지 + 학생 일지
const TeacherLessonDetail: React.FC<{
  lesson: Lesson; students: User[]; teacherJournal?: LessonJournal; studentJournals: LessonJournal[];
  onBack: () => void; onWriteJournal: () => void; onOpenStudentJournal: (id: string) => void; onReload: () => Promise<void>;
}> = ({ lesson, students, teacherJournal, studentJournals, onBack, onWriteJournal, onOpenStudentJournal, onReload }) => {
  const isToday = lesson.status === 'scheduled' && lesson.date === todayStr();
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [, setAtt] = useState<AttendanceRecord[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    attendanceApi.list({ lessonId: lesson.id }).then(a => {
      setAtt(a);
      const m: Record<string, boolean> = {};
      a.forEach(r => { m[r.studentId] = r.status === 'present' || r.status === 'late'; });
      setMarks(m);
    }).catch(() => {});
  }, [lesson.id]);

  const saveAttendance = async () => {
    setBusy(true);
    try {
      await attendanceApi.bulkCreate(lesson.id, students.map(s => ({ studentId: s.id, status: marks[s.id] ? 'present' : 'absent' })));
      toast.success('출결을 저장했어요');
      await onReload();
    } catch (e: any) {
      toast.error(e.message || '저장하지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const completeLesson = async () => {
    if (!window.confirm('출결을 저장하고 수업을 종료할까요? 종료하면 수업일지·학생일지를 쓸 수 있어요.')) return;
    setBusy(true);
    try {
      await attendanceApi.bulkCreate(lesson.id, students.map(s => ({ studentId: s.id, status: marks[s.id] ? 'present' : 'absent' })));
      await lessonApi.complete(lesson.id);
      toast.success('수업을 종료했어요');
      await onReload();
      onWriteJournal();
    } catch (e: any) {
      toast.error(e.message || '처리하지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="수업" onBack={onBack} />
      <Scroll>
        <div style={{ padding: '8px 20px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CategoryIcon cat={lesson.subject} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color: TOSS.ink }}>{lesson.className}</div>
              <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 3 }}>{md(lesson.date)} · {lesson.startTime}</div>
            </div>
          </div>
        </div>

        {isToday ? (
          <>
            <SectionLabel>학생 출결</SectionLabel>
            {students.length === 0 ? <Empty>등록된 학생이 없어요</Empty> : students.map(s => (
              <ListRow key={s.id}
                left={<Avatar name={s.name} size={40} bg={marks[s.id] ? TOSS.successBg : TOSS.surf} fg={marks[s.id] ? TOSS.success : TOSS.sub} />}
                title={s.name} sub={marks[s.id] ? '출석함' : '아직 출석 전'}
                right={
                  <button onClick={() => setMarks(m => ({ ...m, [s.id]: !m[s.id] }))}
                    style={{ fontSize: 12, fontWeight: 500, padding: '4px 9px', borderRadius: 7, background: marks[s.id] ? TOSS.successBg : TOSS.surf, color: marks[s.id] ? TOSS.success : TOSS.sub, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {marks[s.id] ? '출석' : '미출석'}
                  </button>
                } />
            ))}
          </>
        ) : (
          <>
            <SectionLabel>수업일지</SectionLabel>
            <div style={{ margin: '0 20px 8px', background: TOSS.purpleBg, borderRadius: 11, padding: '9px 12px', display: 'flex', gap: 7, alignItems: 'center' }}>
              <i className="ti ti-lock" style={{ fontSize: 14, color: TOSS.purple }} />
              <span style={{ fontSize: 12, color: TOSS.purpleInk }}>선생님과 관리자만 볼 수 있어요</span>
            </div>
            {teacherJournal ? (
              <div style={{ margin: '0 20px', padding: '13px 15px', border: `0.5px solid ${TOSS.line}`, borderRadius: 13, fontSize: 14, lineHeight: 1.6, color: TOSS.ink, whiteSpace: 'pre-wrap' }}>
                {teacherJournal.content}
              </div>
            ) : (
              <div style={{ margin: '0 20px', background: TOSS.surf, borderRadius: 13, padding: 13, fontSize: 13, color: TOSS.sub }}>
                이 수업의 수업일지를 아직 안 썼어요
              </div>
            )}

            <SectionLabel>학생 일지 {studentJournals.length}개</SectionLabel>
            {studentJournals.length === 0 ? <Empty>아직 학생 일지가 없어요</Empty> : studentJournals.map(j => (
              <ListRow key={j.id} left={<Avatar name={j.authorName} size={40} bg={TOSS.blueBg} fg={TOSS.blue} />} title={j.authorName} sub={j.content}
                right={(j.comments?.length ?? 0) > 0 ? <Tag bg={TOSS.blueBg} fg={TOSS.blue}>댓글 {j.comments!.length}</Tag> : <Chevron />}
                onClick={() => onOpenStudentJournal(j.id)} />
            ))}
          </>
        )}
      </Scroll>
      {isToday
        ? <div style={{ flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* 주행동: 출결 저장(공용 Cta) · 보조: 수업 종료(약한 텍스트 버튼)로 위계 분리 */}
            <Cta onClick={saveAttendance} loading={busy}>출결 저장하기</Cta>
            <button onClick={completeLesson} disabled={busy}
              style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '0 20px 16px', fontSize: 14, fontWeight: 600, color: TOSS.sub, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>수업 종료하고 일지 쓰기</button>
          </div>
        : <Cta onClick={onWriteJournal}>{teacherJournal ? '수업일지 다시 쓰기' : '이 수업의 수업일지 쓰기'}</Cta>}
    </Screen>
  );
};

