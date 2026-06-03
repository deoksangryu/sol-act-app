import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, Assignment } from '../types';
import { assignmentApi, uploadApi, resolveFileUrl } from '../services/api';
import { useAppData } from '../services/AppContext';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, IconChip, Tag,
  Cta, Empty, InfoBox, ChipSelect, Avatar, Chevron,
} from './toss/kit';

const BookIcon: React.FC<{ color?: string }> = ({ color = TOSS.blue }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.247m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.247" />
  </svg>
);

function dueLabel(iso: string): string {
  return (iso || '').slice(5, 10).replace('-', '/');
}

function upcomingDates(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const p = (n: number) => String(n).padStart(2, '0');
  for (const add of [2, 4, 7]) {
    const d = new Date();
    d.setDate(d.getDate() + add);
    const v = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    out.push({ value: v, label: `${d.getMonth() + 1}/${d.getDate()}` });
  }
  return out;
}

export const Assignments: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);   // 학생: 과제 상세
  const [groupKey, setGroupKey] = useState<string | null>(null); // 선생님: 과제 그룹 상세
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await assignmentApi.list(isStaff ? undefined : { studentId: user.id });
      setItems(data);
    } catch (e: any) {
      toast.error(e.message || '과제를 불러오지 못했어요');
    }
  };
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  useDataRefresh(['assignments'], load);

  if (loading) return <Empty>불러오는 중…</Empty>;
  if (creating) return <CreateAssignment onBack={() => setCreating(false)} onDone={async () => { setCreating(false); await load(); }} />;

  // ── 학생 ──
  if (!isStaff) {
    const open = openId ? items.find(a => a.id === openId) : null;
    if (open) return <StudentDetail a={open} onBack={() => setOpenId(null)} onReload={load} />;
    const todo = items.filter(a => a.status === 'pending');
    const done = items.filter(a => a.status !== 'pending');
    return (
      <Screen>
        <BigTitle title={todo.length ? <>과제 {todo.length}개가<br />남아 있어요</> : <>과제를 모두<br />끝냈어요</>} />
        <Scroll className="px-1">
          <SectionLabel>해야 할 과제 {todo.length}개</SectionLabel>
          {todo.length === 0 ? <Empty>남은 과제가 없어요</Empty> : todo.map(a => (
            <ListRow key={a.id} left={<IconChip bg={TOSS.blueBg}><BookIcon /></IconChip>} title={a.title}
              sub="제출하면 24시간 안에 피드백" right={<Tag bg={TOSS.warnBg} fg={TOSS.warn}>{dueLabel(a.dueDate)}까지</Tag>}
              onClick={() => setOpenId(a.id)} />
          ))}
          <SectionLabel>제출한 과제 {done.length}개</SectionLabel>
          {done.map(a => (
            <ListRow key={a.id} left={<IconChip bg={TOSS.successBg}><BookIcon color={TOSS.success} /></IconChip>} title={a.title}
              sub={a.status === 'graded' ? '채점 완료' : '제출 완료'}
              right={a.grade ? <Tag bg={TOSS.successBg} fg={TOSS.success}>{a.grade}</Tag> : <Chevron />}
              onClick={() => setOpenId(a.id)} />
          ))}
        </Scroll>
      </Screen>
    );
  }

  // ── 선생님: 과제를 제목+마감 기준으로 그룹화 ──
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; dueDate: string; rows: Assignment[] }>();
    for (const a of items) {
      const k = `${a.title}|${a.dueDate}`;
      if (!map.has(k)) map.set(k, { key: k, title: a.title, dueDate: a.dueDate, rows: [] });
      map.get(k)!.rows.push(a);
    }
    return Array.from(map.values()).sort((x, y) => (y.dueDate > x.dueDate ? 1 : -1));
  }, [items]);

  if (groupKey) {
    const g = groups.find(x => x.key === groupKey);
    if (g) return <TeacherGroupDetail group={g} onBack={() => setGroupKey(null)} onReload={load} />;
  }

  return (
    <Screen>
      <BigTitle title={<>과제를<br />관리해요</>} />
      <Scroll className="px-1">
        <SectionLabel>내가 낸 과제 {groups.length}개</SectionLabel>
        {groups.length === 0 ? <Empty>아직 낸 과제가 없어요</Empty> : groups.map(g => {
          const submitted = g.rows.filter(r => r.status !== 'pending').length;
          const all = g.rows.length;
          const done = submitted === all;
          return (
            <ListRow key={g.key} left={<IconChip bg={TOSS.purpleBg}><BookIcon color={TOSS.purple} /></IconChip>} title={g.title}
              sub={`${dueLabel(g.dueDate)}까지`}
              right={<Tag bg={done ? TOSS.successBg : TOSS.surf} fg={done ? TOSS.success : TOSS.sub}>{submitted}/{all} 제출</Tag>}
              onClick={() => setGroupKey(g.key)} />
          );
        })}
      </Scroll>
      <Cta onClick={() => setCreating(true)}>새 과제 내기</Cta>
    </Screen>
  );
};

// 학생 과제 상세 + 제출
const StudentDetail: React.FC<{ a: Assignment; onBack: () => void; onReload: () => Promise<void> }> = ({ a, onBack, onReload }) => {
  const [text, setText] = useState(a.submissionText || '');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const submitted = a.status !== 'pending';
  const submit = async () => {
    if (!text.trim() && !file) return;
    setBusy(true);
    try {
      let submissionFileUrl: string | undefined;
      if (file) {
        const { url } = await uploadApi.upload(file, p => setProgress(p), 'assignments', undefined, undefined,
          (ph, p) => { setProgress(p); });
        submissionFileUrl = url;
      }
      await assignmentApi.submit(a.id, { submissionText: text.trim(), ...(submissionFileUrl ? { submissionFileUrl } : {}) });
      toast.success('과제를 제출했어요');
      await onReload();
      onBack();
    } catch (e: any) {
      toast.error(e.message || '제출하지 못했어요');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };
  return (
    <Screen>
      <BackHeader title="과제" onBack={onBack} />
      <Scroll className="px-1">
        <div className="mt-2">
          {submitted ? <Tag bg={TOSS.successBg} fg={TOSS.success}>제출 완료</Tag> : <Tag bg={TOSS.warnBg} fg={TOSS.warn}>{dueLabel(a.dueDate)}까지 제출</Tag>}
        </div>
        <div className="text-[21px] font-bold leading-[1.4] text-toss-ink mt-3">{a.title}</div>
        <div className="text-[15px] text-toss-sub leading-relaxed mt-3.5 whitespace-pre-wrap">{a.description}</div>

        {a.submissionText && (
          <div className="mt-5">
            <div className="text-[13px] font-medium text-toss-sub mb-2">내가 제출한 내용</div>
            <InfoBox>{a.submissionText}</InfoBox>
          </div>
        )}
        {submitted && a.submissionFileUrl && (
          <a href={resolveFileUrl(a.submissionFileUrl)} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-[13px] text-toss-blue font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            제출한 파일 보기
          </a>
        )}
        {a.feedback && (
          <div className="mt-4">
            <div className="text-[13px] font-medium text-toss-sub mb-2">선생님 피드백 {a.grade ? `· ${a.grade}` : ''}</div>
            <InfoBox tone="success">{a.feedback}</InfoBox>
          </div>
        )}
        {!submitted && (
          <div className="mt-5">
            <div className="text-[13px] font-medium text-toss-sub mb-2">제출 내용</div>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="과제를 어떻게 했는지 적어요" className="w-full min-h-[120px] rounded-xl border border-slate-200 p-3 text-base outline-none focus:border-toss-blue resize-none" />
            <input ref={fileRef} type="file" accept="video/*,image/*,audio/*,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-xl border border-dashed border-slate-300 py-3 text-[13px] flex items-center justify-center gap-2" style={{ color: file ? TOSS.success : TOSS.sub }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={file ? 'M5 13l4 4L19 7' : 'M12 4v16m8-8H4'} /></svg>
              {file ? file.name : '영상·사진·파일 첨부 (선택)'}
            </button>
            {progress != null && (
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: TOSS.surf }}>
                <div className="h-full" style={{ width: `${progress}%`, background: TOSS.blue }} />
              </div>
            )}
          </div>
        )}
      </Scroll>
      {!submitted && <Cta onClick={submit} disabled={!text.trim() && !file} loading={busy}>지금 제출하기</Cta>}
    </Screen>
  );
};

// 선생님 과제 그룹 상세 (학생별 제출 현황 + 채점)
const TeacherGroupDetail: React.FC<{ group: { title: string; dueDate: string; rows: Assignment[] }; onBack: () => void; onReload: () => Promise<void> }> = ({ group, onBack, onReload }) => {
  const [gradeId, setGradeId] = useState<string | null>(null);
  const submitted = group.rows.filter(r => r.status !== 'pending').length;
  const grading = gradeId ? group.rows.find(r => r.id === gradeId) : null;
  if (grading) return <GradeScreen a={grading} onBack={() => setGradeId(null)} onReload={onReload} />;
  return (
    <Screen>
      <BackHeader title="과제 관리" onBack={onBack} />
      <Scroll className="px-1">
        <div className="text-[20px] font-bold text-toss-ink mt-2">{group.title}</div>
        <div className="text-[13px] text-toss-sub mt-1.5">{dueLabel(group.dueDate)}까지</div>
        <div className="rounded-2xl p-3.5 mt-3.5 flex items-center justify-between" style={{ background: TOSS.surf }}>
          <span className="text-toss-sub">제출 현황</span>
          <span className="text-[17px] font-bold text-toss-ink">{submitted} <span className="text-[13px] font-medium text-toss-sub">/ {group.rows.length}명</span></span>
        </div>
        <SectionLabel>학생별 제출</SectionLabel>
        {group.rows.map(r => (
          <ListRow key={r.id} left={<Avatar name={r.studentName} bg={r.status !== 'pending' ? TOSS.successBg : TOSS.surf} fg={r.status !== 'pending' ? TOSS.success : TOSS.sub} />}
            title={r.studentName} sub={r.status === 'graded' ? '채점 완료' : r.status === 'submitted' ? '제출함 · 채점 대기' : '아직 제출 전'}
            right={r.status === 'pending' ? <Tag>대기</Tag> : r.status === 'graded' ? <Tag bg={TOSS.successBg} fg={TOSS.success}>{r.grade || '완료'}</Tag> : <Tag bg={TOSS.blueBg} fg={TOSS.blue}>채점하기</Tag>}
            onClick={r.status === 'submitted' || r.status === 'graded' ? () => setGradeId(r.id) : undefined} />
        ))}
      </Scroll>
    </Screen>
  );
};

const GRADES = ['S', 'A', 'B', 'C', 'D'];
const GradeScreen: React.FC<{ a: Assignment; onBack: () => void; onReload: () => Promise<void> }> = ({ a, onBack, onReload }) => {
  const [grade, setGrade] = useState<string | null>(a.grade || null);
  const [fb, setFb] = useState(a.feedback || '');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!grade) return;
    setBusy(true);
    try {
      await assignmentApi.grade(a.id, { grade, feedback: fb.trim() });
      toast.success('채점을 마쳤어요');
      await onReload();
      onBack();
    } catch (e: any) {
      toast.error(e.message || '채점하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <BackHeader title="채점" onBack={onBack} />
      <Scroll className="px-1">
        <div className="text-[20px] font-bold text-toss-ink mt-2">{a.studentName}님의 과제</div>
        <div className="text-[13px] text-toss-sub mt-1.5">{a.title}</div>
        {a.submissionText && <div className="mt-4"><InfoBox>{a.submissionText}</InfoBox></div>}
        {a.submissionFileUrl && (
          <a href={resolveFileUrl(a.submissionFileUrl)} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-[13px] text-toss-blue font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            제출한 파일 보기
          </a>
        )}
        <div className="text-[13px] font-medium text-toss-sub mt-5 mb-2">등급</div>
        <ChipSelect options={GRADES.map(g => ({ value: g, label: g }))} value={grade} onChange={setGrade} />
        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">피드백</div>
        <textarea value={fb} onChange={e => setFb(e.target.value)} placeholder="구체적으로 알려주세요" className="w-full min-h-[100px] rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-toss-blue resize-none" />
      </Scroll>
      <Cta onClick={submit} disabled={!grade} loading={busy}>채점 완료하기</Cta>
    </Screen>
  );
};

// 새 과제 내기
const CreateAssignment: React.FC<{ onBack: () => void; onDone: () => Promise<void> }> = ({ onBack, onDone }) => {
  const { classes } = useAppData();
  const dates = upcomingDates();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [classId, setClassId] = useState<string | null>(classes[0]?.id || null);
  const [due, setDue] = useState(dates[0].value);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!title.trim() || !classId) return;
    setBusy(true);
    try {
      await assignmentApi.create({ title: title.trim(), description: desc.trim(), dueDate: `${due}T23:59:00`, classId } as any);
      toast.success('과제를 냈어요');
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '과제를 내지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <BackHeader title="새 과제" onBack={onBack} />
      <Scroll className="px-1">
        <div className="text-[21px] font-bold leading-[1.4] text-toss-ink mt-2">어떤 과제를<br />낼까요?</div>
        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">과제 이름</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 자유연기 독백 외우기" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-toss-blue" />
        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">설명</div>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="예: 지정 대본 3분 분량" className="w-full min-h-[80px] rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-toss-blue resize-none" />
        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">반 선택</div>
        {classes.length === 0 ? <InfoBox tone="warn">담당 반이 없어요</InfoBox> : (
          <ChipSelect options={classes.map(c => ({ value: c.id, label: c.name }))} value={classId} onChange={setClassId} wrap />
        )}
        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">제출 기한</div>
        <ChipSelect options={dates} value={due} onChange={setDue} />
      </Scroll>
      <Cta onClick={submit} disabled={!title.trim() || !classId} loading={busy}>과제 내기</Cta>
    </Screen>
  );
};
