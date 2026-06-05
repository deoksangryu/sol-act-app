import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, Assignment } from '../types';
import { assignmentApi, uploadApi, resolveFileUrl, API_URL, getToken } from '../services/api';
import { nativeBackgroundUpload } from '../services/nativeUpload';
import { useAppData } from '../services/AppContext';
import { useDataRefresh } from '../services/useWebSocket';
import { useDebouncedValue } from '../services/useDebounce';
import { TOSS } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, IconChip, Tag,
  Cta, Empty, InfoBox, ChipSelect, Avatar, Chevron, ListSkeleton, FlowTitle, toneColors, SearchBar, FilterChips,
} from './toss/kit';
import { MiniCalendar } from './toss/Calendar';

function dueLabel(iso: string): string {
  return (iso || '').slice(5, 10).replace('-', '/');
}
// 마감이 지났거나 36시간 내로 임박했는지 — 임박/지남일 때만 경고색(주황), 그 외엔 중립 회색
function dueUrgent(iso: string): boolean {
  const t = new Date(iso).getTime();
  return !isNaN(t) && t < Date.now() + 36 * 3600 * 1000;
}
// 마감 태그 색: 임박/지남=주황(overdue), 여유=중립 회색
const dueTone = (iso: string) => (dueUrgent(iso) ? toneColors('overdue') : { bg: TOSS.surf, fg: TOSS.sub });

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
  const [hasMore, setHasMore] = useState(false);
  const [more, setMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);   // 학생: 과제 상세
  const [groupKey, setGroupKey] = useState<string | null>(null); // 선생님: 과제 그룹 상세
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('all');  // 학생=서버 status / 교사=그룹 완료여부(클라)
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), 300);
  const [selDate, setSelDate] = useState<string | null>(null);  // 캘린더에서 고른 마감일
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const PAGE = 40;

  // 서버사이드 파라미터 — 상태(학생만)·검색·마감일
  const listParams = (skip: number) => ({
    ...(isStaff ? {} : { studentId: user.id }),
    ...(!isStaff && status !== 'all' ? { status } : {}),
    ...(search ? { search } : {}),
    ...(selDate ? { dueFrom: selDate, dueTo: selDate } : {}),
    skip, limit: PAGE,
  });
  const load = async () => {
    try {
      const data = await assignmentApi.list(listParams(0));
      setItems(data); setHasMore(data.length >= PAGE);
    } catch (e: any) {
      toast.error(e.message || '과제를 불러오지 못했어요');
    }
  };
  const loadMore = async () => {
    setMore(true);
    try {
      const data = await assignmentApi.list(listParams(items.length));
      setItems(prev => [...prev, ...data]); setHasMore(data.length >= PAGE);
    } catch (e: any) { toast.error(e.message || '더 불러오지 못했어요'); }
    finally { setMore(false); }
  };
  const renderMore = () => hasMore ? (
    <button onClick={loadMore} disabled={more} style={{ display: 'block', margin: '12px auto 20px', background: TOSS.surf, color: TOSS.sub, border: 'none', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{more ? '불러오는 중…' : '더 보기'}</button>
  ) : null;
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  // 상태(학생)/검색/마감일 변경 시 page 0부터 재조회(첫 진입만 스켈레톤)
  useEffect(() => { if (!loading) load(); /* eslint-disable-next-line */ }, [status, search, selDate]);
  useDataRefresh(['assignments'], load);

  // 캘린더 마감일 점(로드된 항목 기준) + 상태 칩 옵션(학생=제출상태 / 교사=그룹 완료여부)
  const marked = new Set(items.map(a => (a.dueDate || '').slice(0, 10)));
  const STATUS_OPTS = isStaff
    ? [{ value: 'all', label: '전체' }, { value: 'incomplete', label: '미완료' }, { value: 'complete', label: '완료' }]
    : [{ value: 'all', label: '전체' }, { value: 'pending', label: '미제출' }, { value: 'submitted', label: '제출' }, { value: 'graded', label: '채점' }];
  const filterHeader = (
    <>
      <SearchBar value={query} onChange={setQuery} placeholder="과제 제목 검색" />
      <FilterChips options={STATUS_OPTS} value={status} onChange={setStatus} />
      <MiniCalendar marked={marked} selected={selDate} onSelect={setSelDate} open={calOpen} onToggle={() => setCalOpen(o => !o)} month={calMonth} onMonth={setCalMonth} toggleLabel="마감일" />
    </>
  );

  if (loading) return <ListSkeleton />;
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
        {filterHeader}
        <Scroll>
          <SectionLabel>해야 할 과제 {todo.length}개</SectionLabel>
          {todo.length === 0 ? <Empty>남은 과제가 없어요</Empty> : todo.map(a => (
            <ListRow key={a.id}
              left={<IconChip bg={TOSS.blueBg}><i className="ti ti-book-2" style={{ fontSize: 21, color: TOSS.blue }} /></IconChip>}
              title={a.title} sub="24시간 안에 피드백"
              right={<Tag {...dueTone(a.dueDate)}>{dueLabel(a.dueDate)}까지</Tag>}
              onClick={() => setOpenId(a.id)} />
          ))}
          <SectionLabel>제출한 과제 {done.length}개</SectionLabel>
          {done.map(a => (
            <ListRow key={a.id}
              left={<IconChip bg={TOSS.successBg}><i className="ti ti-check" style={{ fontSize: 21, color: TOSS.success }} /></IconChip>}
              title={a.title} sub={a.status === 'graded' ? '채점 완료' : '제출 완료'}
              right={a.grade ? <Tag bg={TOSS.successBg} fg={TOSS.success}>{a.grade}</Tag> : <Chevron />}
              onClick={() => setOpenId(a.id)} />
          ))}
          {renderMore()}
        </Scroll>
      </Screen>
    );
  }

  // ── 선생님: 과제를 제목+마감 기준으로 그룹화 ──
  // (훅이 아닌 일반 계산 — early-return 뒤라 useMemo를 쓰면 훅 규칙 위반/크래시)
  const groups = (() => {
    const map = new Map<string, { key: string; title: string; dueDate: string; rows: Assignment[] }>();
    for (const a of items) {
      // 출제자까지 키에 포함 — 다른 교사/다른 반의 동명·동마감 과제가 합쳐지지 않도록
      const k = `${a.assignedBy || ''}|${a.title}|${a.dueDate}`;
      if (!map.has(k)) map.set(k, { key: k, title: a.title, dueDate: a.dueDate, rows: [] });
      map.get(k)!.rows.push(a);
    }
    return Array.from(map.values()).sort((x, y) => (x.dueDate < y.dueDate ? 1 : x.dueDate > y.dueDate ? -1 : 0));
  })();

  if (groupKey) {
    const g = groups.find(x => x.key === groupKey);
    if (g) return <TeacherGroupDetail group={g} onBack={() => setGroupKey(null)} onReload={load} />;
  }

  // 상태 칩(교사)은 그룹 완료여부로 클라이언트 필터 — 서버 status는 행 단위라 그룹 카운트와 충돌
  const visibleGroups = groups.filter(g => {
    if (status === 'all') return true;
    const complete = g.rows.filter(r => r.status !== 'pending').length === g.rows.length;
    return status === 'complete' ? complete : !complete;
  });

  return (
    <Screen>
      <BigTitle title={<>과제를<br />관리해요</>} />
      {filterHeader}
      <Scroll>
        <SectionLabel>내가 낸 과제 {visibleGroups.length}개</SectionLabel>
        {visibleGroups.length === 0 ? <Empty>{groups.length === 0 ? '아직 낸 과제가 없어요' : '조건에 맞는 과제가 없어요'}</Empty> : visibleGroups.map(g => {
          const submitted = g.rows.filter(r => r.status !== 'pending').length;
          const all = g.rows.length;
          const done = submitted === all;
          return (
            <ListRow key={g.key}
              left={<IconChip bg={TOSS.purpleBg}><i className="ti ti-clipboard-list" style={{ fontSize: 21, color: TOSS.purple }} /></IconChip>}
              title={g.title} sub={`${dueLabel(g.dueDate)}까지`}
              right={<Tag bg={done ? TOSS.successBg : TOSS.surf} fg={done ? TOSS.success : TOSS.sub}>{submitted}/{all} 제출</Tag>}
              onClick={() => setGroupKey(g.key)} />
          );
        })}
        {renderMore()}
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
    // 1) 텍스트 제출 — 실패하면 화면 유지하고 중단(이미 제출됐다고 오인 방지)
    try {
      await assignmentApi.submit(a.id, { submissionText: text.trim() });
    } catch (e: any) {
      toast.error(e.message || '제출하지 못했어요');
      setBusy(false);
      return;
    }
    // 2) 제출은 확정됨 → 첨부 업로드는 별도. 실패해도 제출은 유지되고 화면은 넘어감
    let bg = false, attachFailed = false;
    if (file) {
      const isVideo = /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(file.name);
      try {
        // 영상만 네이티브 백그라운드(앱 닫혀도 계속). 음성·PDF·이미지는 원본 그대로 웹 업로드(확장자 보존)
        if (isVideo) {
          bg = await nativeBackgroundUpload(file, API_URL, getToken() || '', {
            subfolder: 'assignments', targetType: 'assignment', targetId: a.id, displayName: a.title,
          });
        }
        if (!bg) {
          await uploadApi.upload(file, p => setProgress(p), 'assignments', 'assignment', a.id, (_ph, p) => setProgress(p));
        }
      } catch {
        attachFailed = true;
      }
    }
    setBusy(false);
    setProgress(null);
    if (attachFailed) toast.error('제출은 됐지만 첨부 업로드에 실패했어요. 상세에서 다시 첨부해주세요');
    else if (bg) toast.success('제출했어요. 첨부는 백그라운드로 올라가요(앱을 닫아도 계속)');
    else toast.success('과제를 제출했어요');
    await onReload();
    onBack();
  };
  return (
    <Screen>
      <BackHeader title="과제" onBack={onBack} />
      <Scroll>
        <div style={{ padding: '8px 20px' }}>
          <div>
            {submitted
              ? <Tag bg={TOSS.successBg} fg={TOSS.success}>제출 완료</Tag>
              : <Tag {...dueTone(a.dueDate)}>{dueLabel(a.dueDate)}까지 제출</Tag>}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4, color: TOSS.ink, marginTop: 12 }}>{a.title}</div>
          <div style={{ fontSize: 15, color: TOSS.sub, lineHeight: 1.7, marginTop: 14, whiteSpace: 'pre-wrap' }}>{a.description}</div>

          {a.submissionText && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 8 }}>내가 제출한 내용</div>
              <InfoBox>{a.submissionText}</InfoBox>
            </div>
          )}
          {submitted && a.submissionFileUrl && (
            <a href={resolveFileUrl(a.submissionFileUrl)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, fontWeight: 500, color: TOSS.blue }}>
              <i className="ti ti-paperclip" style={{ fontSize: 16 }} />
              제출한 파일 보기
            </a>
          )}
          {a.feedback && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 8 }}>선생님 피드백 {a.grade ? `· ${a.grade}` : ''}</div>
              <InfoBox tone="success">{a.feedback}</InfoBox>
            </div>
          )}
          {!submitted && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 8 }}>제출 내용</div>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="과제를 어떻게 했는지 적어요"
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 120, border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: 'inherit', color: TOSS.ink, outline: 'none', resize: 'none' }} />
              <input ref={fileRef} type="file" accept="video/*,image/*,audio/*,.pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()}
                style={{ marginTop: 8, width: '100%', background: '#fff', border: `1px dashed ${TOSS.dashLine}`, borderRadius: 12, padding: '12px 6px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: file ? TOSS.success : TOSS.sub, cursor: 'pointer' }}>
                <i className={`ti ${file ? 'ti-check' : 'ti-paperclip'}`} style={{ fontSize: 16 }} />
                {file ? file.name : '손글씨 사진·PDF·영상 첨부 (선택)'}
              </button>
              {progress != null && (
                <div style={{ marginTop: 8, height: 6, borderRadius: 999, overflow: 'hidden', background: TOSS.surf }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: TOSS.blue }} />
                </div>
              )}
            </div>
          )}
        </div>
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
      <Scroll>
        <div style={{ padding: '8px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: TOSS.ink }}>{group.title}</div>
          <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 6 }}>{dueLabel(group.dueDate)}까지</div>
          <div style={{ background: TOSS.surf, borderRadius: 14, padding: '14px 16px', marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: TOSS.sub }}>제출 현황</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: TOSS.ink }}>{submitted} <span style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub }}>/ {group.rows.length}명</span></span>
          </div>
        </div>
        <SectionLabel>학생별 제출</SectionLabel>
        <div style={{ borderTop: `0.5px solid ${TOSS.line}` }}>
          {group.rows.map(r => {
            const sb = r.status !== 'pending';
            return (
              <ListRow key={r.id}
                left={<Avatar name={r.studentName} size={40} bg={sb ? TOSS.successBg : TOSS.surf} fg={sb ? TOSS.success : TOSS.sub} />}
                title={r.studentName}
                sub={r.status === 'graded' ? '채점 완료' : r.status === 'submitted' ? '제출함 · 채점 대기' : '아직 제출 전'}
                right={r.status === 'pending'
                  ? <Tag bg={TOSS.surf} fg={TOSS.sub}>대기</Tag>
                  : r.status === 'graded'
                    ? <Tag bg={TOSS.successBg} fg={TOSS.success}>{r.grade || '완료'}</Tag>
                    : <Tag bg={TOSS.blueBg} fg={TOSS.blue}>채점하기</Tag>}
                onClick={r.status === 'submitted' || r.status === 'graded' ? () => setGradeId(r.id) : undefined} />
            );
          })}
        </div>
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
      <Scroll>
        <div style={{ padding: '8px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: TOSS.ink }}>{a.studentName}님의 과제</div>
          <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 6 }}>{a.title}</div>
          {a.submissionText && <div style={{ marginTop: 16 }}><InfoBox>{a.submissionText}</InfoBox></div>}
          {a.submissionFileUrl && (
            <a href={resolveFileUrl(a.submissionFileUrl)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, fontWeight: 500, color: TOSS.blue }}>
              <i className="ti ti-paperclip" style={{ fontSize: 16 }} />
              제출한 파일 보기
            </a>
          )}
          <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginTop: 20, marginBottom: 8 }}>등급</div>
          <ChipSelect options={GRADES.map(g => ({ value: g, label: g }))} value={grade} onChange={setGrade} />
          <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginTop: 16, marginBottom: 8 }}>피드백</div>
          <textarea value={fb} onChange={e => setFb(e.target.value)} placeholder="구체적으로 알려주세요"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 100, border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: 'inherit', color: TOSS.ink, outline: 'none', resize: 'none' }} />
        </div>
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
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '16px 0 8px' };
  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: 'inherit', color: TOSS.ink, outline: 'none' };
  return (
    <Screen>
      <BackHeader title="새 과제" onBack={onBack} />
      <Scroll>
        <div style={{ padding: '8px 20px' }}>
          <FlowTitle pad="0">어떤 과제를<br />낼까요?</FlowTitle>
          <div style={labelStyle}>과제 이름</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 자유연기 독백 외우기" style={inputStyle} />
          <div style={labelStyle}>설명</div>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="예: 지정 대본 3분 분량"
            style={{ ...inputStyle, minHeight: 80, resize: 'none' }} />
          <div style={labelStyle}>반 선택</div>
          {classes.length === 0 ? <InfoBox tone="warn">담당 반이 없어요</InfoBox> : (
            <ChipSelect options={classes.map(c => ({ value: c.id, label: c.name }))} value={classId} onChange={setClassId} wrap />
          )}
          <div style={labelStyle}>제출 기한</div>
          <ChipSelect options={dates} value={due} onChange={setDue} />
          <div style={{ background: TOSS.purpleBg, borderRadius: 12, padding: 12, marginTop: 16, fontSize: 13, color: TOSS.purpleInk, lineHeight: 1.6 }}>
            학생들에게 알림이 가요
          </div>
        </div>
      </Scroll>
      <Cta onClick={submit} disabled={!title.trim() || !classId} loading={busy}>과제 내기</Cta>
    </Screen>
  );
};
