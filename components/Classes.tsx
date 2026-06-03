import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, Lesson, LessonJournal, AttendanceRecord } from '../types';
import { lessonApi, journalApi, attendanceApi } from '../services/api';
import { useAppData } from '../services/AppContext';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS, CategoryIcon } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, Tag, Avatar,
  Cta, Empty, InfoBox, ChipSelect, Chevron,
} from './toss/kit';

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const md = (iso: string) => (iso || '').slice(5, 10).replace('-', '/');

const CONDITIONS = [
  { value: 'present', label: '좋아요' },
  { value: 'present_ok', label: '보통이에요' },
  { value: 'late', label: '지쳤어요' },
];

type View =
  | { name: 'home' }
  | { name: 'attend'; lessonId: string }
  | { name: 'journalWrite'; lessonId: string; type: 'student' | 'teacher'; journalId?: string }
  | { name: 'journalView'; journalId: string }
  | { name: 'teacherLesson'; lessonId: string };

export const Classes: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const { allUsers, classes } = useAppData();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [journals, setJournals] = useState<LessonJournal[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: 'home' });

  const load = async () => {
    try {
      const [ls, js, at] = await Promise.all([
        lessonApi.list(),
        journalApi.list(),
        isStaff ? attendanceApi.list() : attendanceApi.list({ studentId: user.id }),
      ]);
      setLessons(ls);
      setJournals(js);
      setAttendance(at);
    } catch (e: any) {
      toast.error(e.message || '수업을 불러오지 못했어요');
    }
  };
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  useDataRefresh(['lessons', 'journals', 'attendance'], load);

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

  if (loading) return <Empty>불러오는 중…</Empty>;

  // ── sub-screens ──
  if (view.name === 'attend') {
    const l = lessonOf(view.lessonId);
    if (l) return <AttendScreen lesson={l} userId={user.id} onBack={() => setView({ name: 'home' })} onDone={async () => { setView({ name: 'home' }); await load(); }} />;
  }
  if (view.name === 'journalWrite') {
    const l = lessonOf(view.lessonId);
    const editJournal = view.journalId ? journals.find(x => x.id === view.journalId) : undefined;
    if (l) return <JournalWrite lesson={l} type={view.type} journal={editJournal} onBack={() => setView({ name: 'home' })} onDone={async () => { setView({ name: 'home' }); await load(); }} />;
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

  // ── home ──
  const upcoming = lessons.filter(l => l.status === 'scheduled');
  const past = lessons.filter(l => l.status === 'completed');
  const todays = upcoming.filter(l => l.date === todayStr());
  const future = upcoming.filter(l => l.date !== todayStr());

  if (!isStaff) {
    return (
      <Screen>
        <BigTitle title={<>수업을<br />준비하고 돌아봐요</>} />
        <Scroll className="px-1">
          <SectionLabel>오늘 · 예정 수업</SectionLabel>
          {todays.length + future.length === 0 && <Empty>예정된 수업이 없어요</Empty>}
          {todays.map(l => {
            const att = myAttendance(l.id);
            return (
              <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={l.className}
                sub={`${l.startTime}${att ? ' · 출석 완료' : ' · ' + l.teacherName}`}
                right={att ? <Tag bg={TOSS.successBg} fg={TOSS.success}>출석함</Tag> : <Tag bg={TOSS.blueBg} fg={TOSS.blue}>출석하기</Tag>}
                onClick={att ? undefined : () => setView({ name: 'attend', lessonId: l.id })} />
            );
          })}
          {future.map(l => (
            <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={l.className}
              sub={`${md(l.date)} · ${l.startTime}`} right={<Tag>예정</Tag>} />
          ))}

          <SectionLabel>지난 수업 · 일지</SectionLabel>
          {past.length === 0 && <Empty>지난 수업이 없어요</Empty>}
          {past.map(l => {
            const j = myStudentJournal(l.id);
            return (
              <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={l.className} sub={md(l.date)}
                right={j ? <Tag bg={TOSS.successBg} fg={TOSS.success}>일지 작성됨</Tag> : <Tag bg={TOSS.warnBg} fg={TOSS.warn}>일지 쓰기</Tag>}
                onClick={j ? () => setView({ name: 'journalView', journalId: j.id }) : () => setView({ name: 'journalWrite', lessonId: l.id, type: 'student' })} />
            );
          })}
        </Scroll>
      </Screen>
    );
  }

  // teacher home
  return (
    <Screen>
      <BigTitle title={<>수업을<br />운영하고 기록해요</>} />
      <Scroll className="px-1">
        <SectionLabel>오늘 · 예정 수업</SectionLabel>
        {todays.length + future.length === 0 && <Empty>예정된 수업이 없어요</Empty>}
        {todays.map(l => {
          const present = attendance.filter(a => a.lessonId === l.id).length;
          return (
            <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={l.className} sub={`${l.startTime} · 진행 중`}
              right={<Tag>출석 {present}/{classStudents(l.classId).length}</Tag>}
              onClick={() => setView({ name: 'teacherLesson', lessonId: l.id })} />
          );
        })}
        {future.map(l => (
          <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={l.className} sub={`${md(l.date)} · ${l.startTime}`} right={<Tag>예정</Tag>}
            onClick={() => setView({ name: 'teacherLesson', lessonId: l.id })} />
        ))}

        <SectionLabel>지난 수업 · 수업일지</SectionLabel>
        {past.length === 0 && <Empty>지난 수업이 없어요</Empty>}
        {past.map(l => {
          const tj = teacherJournal(l.id);
          return (
            <ListRow key={l.id} left={<CategoryIcon cat={l.subject} />} title={l.className} sub={md(l.date)}
              right={tj ? <Tag bg={TOSS.successBg} fg={TOSS.success}>일지 작성됨</Tag> : <Tag bg={TOSS.warnBg} fg={TOSS.warn}>일지 쓰기</Tag>}
              onClick={() => setView({ name: 'teacherLesson', lessonId: l.id })} />
          );
        })}
      </Scroll>
    </Screen>
  );
};

// 학생 출석 체크
const AttendScreen: React.FC<{ lesson: Lesson; userId: string; onBack: () => void; onDone: () => Promise<void> }> = ({ lesson, userId, onBack, onDone }) => {
  const [cond, setCond] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!cond) return;
    setBusy(true);
    try {
      const status = cond === 'late' ? 'late' : 'present';
      await attendanceApi.create({ lessonId: lesson.id, studentId: userId, status } as any);
      toast.success('출석을 마쳤어요');
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '출석하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <BackHeader title="출석 체크" onBack={onBack} />
      <Scroll className="px-1">
        <div className="text-[21px] font-bold leading-[1.4] text-toss-ink mt-2">출석하고<br />컨디션을 알려줘요</div>
        <div className="rounded-2xl p-3.5 mt-4 flex items-center gap-3" style={{ background: TOSS.surf }}>
          <CategoryIcon cat={lesson.subject} />
          <div>
            <div className="text-[15px] font-semibold text-toss-ink">{lesson.className}</div>
            <div className="text-[13px] mt-0.5" style={{ color: TOSS.success }}>{lesson.startTime} · {lesson.teacherName}</div>
          </div>
        </div>
        <div className="text-[13px] font-medium text-toss-sub mt-[18px] mb-2.5">오늘 컨디션은 어때요?</div>
        <ChipSelect options={CONDITIONS} value={cond} onChange={setCond} />
      </Scroll>
      <Cta onClick={submit} disabled={!cond} loading={busy}>출석 완료하기</Cta>
    </Screen>
  );
};

// 일지 작성/수정 (학생/선생님)
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
      toast.success(editing ? '일지를 수정했어요' : '일지를 저장했어요');
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
      <Scroll className="px-1">
        <div className="text-[21px] font-bold leading-[1.4] text-toss-ink mt-2">
          {isTeacher ? <>이 수업,<br />어떻게 진행됐나요?</> : <>이 수업,<br />어땠어요?</>}
        </div>
        <div className="text-sm text-toss-sub mt-1.5">{lesson.className} · {md(lesson.date)}</div>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder={isTeacher ? '수업 진행, 진도, 운영 메모를 적어요' : '잘된 점, 보완할 점을 편하게 적어요'}
          className="w-full min-h-[120px] mt-4 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-toss-blue resize-none" />
        {isTeacher && <div className="mt-4"><InfoBox tone="purple">이 일지는 선생님과 관리자만 볼 수 있어요</InfoBox></div>}
      </Scroll>
      <Cta onClick={submit} disabled={!content.trim()} loading={busy}>{editing ? '일지 수정하기' : isTeacher ? '수업일지 저장하기' : '일지 저장하기'}</Cta>
    </Screen>
  );
};

// 일지 보기 + 선생님 댓글
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
  return (
    <Screen>
      <BackHeader title="수업 일지" onBack={onBack} right={canEdit ? (
        <button onClick={onEdit} className="text-[13px] font-semibold text-toss-blue px-1">다시 쓰기</button>
      ) : undefined} />
      <Scroll className="px-1">
        <div className="text-[20px] font-bold text-toss-ink mt-2">{lesson?.className || '수업'}</div>
        <div className="text-[13px] text-toss-sub mt-1.5">{journal.authorName} · {md(journal.date)}</div>
        <div className="text-[15px] leading-[1.8] mt-3.5 text-toss-ink whitespace-pre-wrap">{journal.content}</div>
        <div className="h-px my-4" style={{ background: TOSS.line }} />
        <div className="text-[13px] font-medium text-toss-sub">선생님 댓글 {comments.length}개</div>
        {comments.map(c => (
          <div key={c.id} className="flex gap-2.5 mt-3.5">
            <Avatar name={c.authorName} size={34} bg={TOSS.purpleBg} fg={TOSS.purple} />
            <div className="flex-1 rounded-[4px_13px_13px_13px] p-3" style={{ background: TOSS.surf }}>
              <div className="text-xs font-semibold text-toss-ink">{c.authorName}</div>
              <div className="text-sm leading-relaxed mt-0.5 text-toss-ink">{c.content}</div>
            </div>
          </div>
        ))}
        {canComment && (
          <div className="flex gap-2 mt-4">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="코칭 댓글을 남겨요" className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-toss-blue" />
            <button onClick={add} disabled={busy || !text.trim()} className="rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TOSS.blue }}>등록</button>
          </div>
        )}
      </Scroll>
    </Screen>
  );
};

// 선생님 수업 상세: 출결 + 수업일지 + 학생 일지
const TeacherLessonDetail: React.FC<{
  lesson: Lesson; students: User[]; teacherJournal?: LessonJournal; studentJournals: LessonJournal[];
  onBack: () => void; onWriteJournal: () => void; onOpenStudentJournal: (id: string) => void; onReload: () => Promise<void>;
}> = ({ lesson, students, teacherJournal, studentJournals, onBack, onWriteJournal, onOpenStudentJournal, onReload }) => {
  const isToday = lesson.status === 'scheduled' && lesson.date === todayStr();
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [att, setAtt] = useState<AttendanceRecord[]>([]);
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

  return (
    <Screen>
      <BackHeader title="수업" onBack={onBack} />
      <Scroll className="px-1">
        <div className="flex items-center gap-3 mt-2">
          <CategoryIcon cat={lesson.subject} />
          <div>
            <div className="text-[19px] font-bold text-toss-ink">{lesson.className}</div>
            <div className="text-[13px] text-toss-sub mt-0.5">{md(lesson.date)} · {lesson.startTime}</div>
          </div>
        </div>

        {isToday ? (
          <>
            <SectionLabel>학생 출결</SectionLabel>
            {students.length === 0 ? <Empty>등록된 학생이 없어요</Empty> : students.map(s => (
              <ListRow key={s.id} left={<Avatar name={s.name} bg={marks[s.id] ? TOSS.successBg : TOSS.surf} fg={marks[s.id] ? TOSS.success : TOSS.sub} />}
                title={s.name} sub={marks[s.id] ? '출석' : '미출석'}
                right={<button onClick={() => setMarks(m => ({ ...m, [s.id]: !m[s.id] }))} className="text-xs font-semibold px-3 py-1.5 rounded-md"
                  style={{ background: marks[s.id] ? TOSS.successBg : TOSS.surf, color: marks[s.id] ? TOSS.success : TOSS.sub }}>
                  {marks[s.id] ? '출석' : '미출석'}
                </button>} />
            ))}
          </>
        ) : (
          <>
            <SectionLabel>수업일지</SectionLabel>
            <div className="mb-2"><InfoBox tone="purple">선생님과 관리자만 볼 수 있어요</InfoBox></div>
            {teacherJournal
              ? <div className="rounded-xl border p-3.5 text-sm leading-relaxed text-toss-ink whitespace-pre-wrap" style={{ borderColor: TOSS.line }}>{teacherJournal.content}</div>
              : <InfoBox tone="warn">이 수업의 수업일지를 아직 안 썼어요</InfoBox>}

            <SectionLabel>학생 일지 {studentJournals.length}개</SectionLabel>
            {studentJournals.length === 0 ? <Empty>아직 학생 일지가 없어요</Empty> : studentJournals.map(j => (
              <ListRow key={j.id} left={<Avatar name={j.authorName} bg={TOSS.blueBg} fg={TOSS.blue} />} title={j.authorName} sub={j.content}
                right={(j.comments?.length ?? 0) > 0 ? <Tag bg={TOSS.blueBg} fg={TOSS.blue}>댓글 {j.comments!.length}</Tag> : <Chevron />}
                onClick={() => onOpenStudentJournal(j.id)} />
            ))}
          </>
        )}
      </Scroll>
      {isToday
        ? <Cta onClick={saveAttendance} loading={busy}>출결 저장하기</Cta>
        : <Cta onClick={onWriteJournal}>{teacherJournal ? '수업일지 다시 쓰기' : '이 수업의 수업일지 쓰기'}</Cta>}
    </Screen>
  );
};
