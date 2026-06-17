import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, Plan as PlanT, PlanItem } from '../types';
import { planApi } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS } from '../services/category';
import { MiniCalendar } from './toss/Calendar';
import { PushNudge } from './PushNudge';
import {
  Screen, Scroll, BigTitle, BackHeader, SectionLabel, FilterChips,
  Cta, Empty, ListSkeleton, Tag, Avatar, ListRow, InfoBox,
} from './toss/kit';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmt(new Date());
/** YYYY-MM-DD → 그 주 월요일 */
function weekStartStr(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return fmt(dt);
}
/** 월요일 → 그 주 월~일 7일 */
function weekDates(monday: string): string[] {
  const [y, m, d] = monday.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(base); x.setDate(base.getDate() + i); return fmt(x); });
}
function fmtKDate(ds: string): string { const [, m, d] = ds.split('-').map(Number); return `${m}월 ${d}일`; }
const toUp = (items: PlanItem[]) => items.map((i) => ({ id: i.id, content: i.content, done: i.done, sortOrder: i.sortOrder }));

/** 하루계획 연속 완료일수(오늘 미완료면 어제부터 카운트) */
function computeStreak(dailyPlans: PlanT[]): number {
  const done = new Set(dailyPlans.filter((p) => p.totalCount > 0 && p.progress >= 100).map((p) => p.planDate));
  const d = new Date();
  if (!done.has(fmt(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (done.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// 진행률 바 (100%면 초록 + 펄스)
const Progress: React.FC<{ value: number; done: number; total: number }> = ({ value, done, total }) => {
  const full = value >= 100;
  return (
    <div style={{ padding: '0 20px 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: TOSS.sub }}>진행률{full ? ' · 완료 🎉' : ''}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: full ? TOSS.success : TOSS.blue }}>{done}/{total} · {Math.round(value)}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: TOSS.surf, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: full ? TOSS.success : TOSS.blue, transition: 'width .25s', animation: full ? 'planPulse 1.2s ease-in-out 2' : undefined }} />
      </div>
      <style>{`@keyframes planPulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
    </div>
  );
};

// ── 학생: 캘린더 + 체크리스트 작성 ──
const StudentPlan: React.FC<{ user: User }> = ({ user }) => {
  const [planType, setPlanType] = useState<'daily' | 'weekly'>('daily');
  const [plans, setPlans] = useState<PlanT[]>([]);
  const [loading, setLoading] = useState(true);
  const [selDate, setSelDate] = useState<string>(todayStr());
  const [calOpen, setCalOpen] = useState(false); // 기본 접힘 — 체크리스트를 fold 위로
  const [calMonth, setCalMonth] = useState(new Date());
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 모든 계획을 한 번에 받아 타입 전환 시 재호출·스켈레톤 깜빡임 방지
  const load = useCallback(() => {
    planApi.list({}).then(setPlans).catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useDataRefresh(['plans'], load);

  const typePlans = useMemo(() => plans.filter((p) => p.planType === planType), [plans, planType]);
  const dailyPlans = useMemo(() => plans.filter((p) => p.planType === 'daily'), [plans]);
  const streak = useMemo(() => computeStreak(dailyPlans), [dailyPlans]);

  const matchDate = planType === 'weekly' ? weekStartStr(selDate) : selDate;
  const current = typePlans.find((p) => p.planDate === matchDate) || null;
  const marked = useMemo(() => {
    const s = new Set<string>();
    typePlans.forEach((p) => { if (planType === 'weekly') weekDates(p.planDate).forEach((x) => s.add(x)); else s.add(p.planDate); });
    return s;
  }, [typePlans, planType]);

  const periodLabel = planType === 'weekly' ? `${fmtKDate(weekStartStr(selDate))}~ 주간` : fmtKDate(selDate);

  const upsert = (u: PlanT) => setPlans((prev) => prev.some((p) => p.id === u.id) ? prev.map((p) => p.id === u.id ? u : p) : [u, ...prev]);

  const saveItems = async (items: PlanItem[]) => {
    if (!current) return;
    try { upsert(await planApi.update(current.id, { items: toUp(items) })); }
    catch (e: any) { toast.error(e.message || '저장하지 못했어요'); load(); }
  };

  const addItem = async (raw: string) => {
    const content = raw.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      if (current) {
        upsert(await planApi.update(current.id, { items: [...toUp(current.items), { content, sortOrder: current.items.length }] }));
      } else {
        upsert(await planApi.create({ studentId: user.id, planType, planDate: matchDate, items: [{ content }] }));
      }
      setNewItem('');
      inputRef.current?.focus();
    } catch (e: any) { toast.error(e.message || '추가하지 못했어요'); }
    finally { setBusy(false); }
  };

  const toggle = async (item: PlanItem) => {
    if (!current) return;
    const items = current.items.map((i) => i.id === item.id ? { ...i, done: !i.done } : i);
    const dc = items.filter((i) => i.done).length;
    const prog = items.length ? (dc / items.length) * 100 : 0;
    const wasFull = current.progress >= 100;
    upsert({ ...current, items, doneCount: dc, progress: prog });
    if (!wasFull && prog >= 100 && items.length > 0) toast.success(planType === 'weekly' ? '🎉 이번 주 계획을 모두 끝냈어요!' : '🎉 오늘 계획을 모두 끝냈어요!');
    try { upsert(await planApi.toggleItem(item.id, !item.done)); }
    catch (e: any) { toast.error(e.message || '저장하지 못했어요'); load(); }
  };

  const removeItem = async (item: PlanItem) => {
    if (!current) return;
    const planId = current.id;
    const remaining = current.items.filter((i) => i.id !== item.id); // 삭제 후 목록(복구 기준)
    await saveItems(remaining);
    toast((t) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        할 일을 삭제했어요
        <button onClick={() => { toast.dismiss(t.id); restore(planId, item, remaining); }}
          style={{ background: 'transparent', border: 'none', color: '#7CC0FF', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>실행취소</button>
      </span>
    ), { duration: 5000 });
  };
  // 삭제 시점의 '남은 목록'에 복구 항목 1개만 다시 추가(중복 생성 방지)
  const restore = async (planId: string, item: PlanItem, remaining: PlanItem[]) => {
    try { upsert(await planApi.update(planId, { items: [...toUp(remaining), { content: item.content, done: item.done, sortOrder: remaining.length }] })); }
    catch { toast.error('복구하지 못했어요'); }
  };

  const displayItems = useMemo(() => [...(current?.items || [])].sort((a, b) => (Number(a.done) - Number(b.done)) || (a.sortOrder - b.sortOrder)), [current]);

  const move = async (item: PlanItem, dir: 'up' | 'down') => {
    if (busy) return; // 진행 중인 다른 변경과의 경합으로 전체 목록을 덮어쓰지 않도록
    const disp = [...displayItems];
    const idx = disp.findIndex((i) => i.id === item.id);
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= disp.length || disp[j].done !== item.done) return;
    [disp[idx], disp[j]] = [disp[j], disp[idx]];
    setBusy(true);
    try { await saveItems(disp.map((i, k) => ({ ...i, sortOrder: k }))); }
    finally { setBusy(false); }
  };

  const saveEdit = async () => {
    const id = editingId; const text = editingText.trim();
    setEditingId(null);
    if (!id || !current || !text) return;
    const items = current.items.map((i) => i.id === id ? { ...i, content: text } : i);
    await saveItems(items);
  };

  const examples = planType === 'weekly'
    ? ['자유연기 2편 완성', '뮤지컬 넘버 1곡', '무용 기본기 매일']
    : ['발성·호흡 30분', '독백 대사 암기', '자유연기 촬영'];

  const activeCount = displayItems.filter((i) => !i.done).length;

  return (
    <Screen>
      <BigTitle
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>학습 계획{streak >= 2 && <span style={{ fontSize: 13, fontWeight: 700, color: TOSS.warn, background: TOSS.warnBg, borderRadius: 8, padding: '2px 8px' }}>🔥 {streak}일 연속</span>}</span>}
        sub="할 일을 세우고 체크해요 · 담당 선생님도 함께 봐요"
      />
      <PushNudge reason="알림을 켜면 선생님 피드백과 '오늘 계획' 리마인더를 받을 수 있어요." />
      <FilterChips
        options={[{ value: 'daily', label: '하루계획' }, { value: 'weekly', label: '주간계획' }]}
        value={planType}
        onChange={(v) => setPlanType(v as 'daily' | 'weekly')}
      />
      <MiniCalendar
        marked={marked} selected={selDate} onSelect={(d) => setSelDate(d || todayStr())}
        open={calOpen} onToggle={() => setCalOpen((o) => !o)} month={calMonth} onMonth={setCalMonth}
        toggleLabel="계획" hideClear
      />
      <Scroll>
        <SectionLabel>{periodLabel} · {planType === 'weekly' ? '주간' : '하루'} 할 일</SectionLabel>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : (
          <>
            {current && current.totalCount > 0 && <Progress value={current.progress} done={current.doneCount} total={current.totalCount} />}

            {displayItems.length > 0 ? displayItems.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 7px 8px' }}>
                <button onClick={() => toggle(item)} aria-label={`${item.content} 완료 토글`}
                  style={{ padding: 10, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${item.done ? TOSS.blue : TOSS.sub}`, background: item.done ? TOSS.blue : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.done && <i className="ti ti-check" style={{ fontSize: 15, color: '#fff' }} />}
                  </span>
                </button>
                {editingId === item.id ? (
                  <input autoFocus value={editingText} onChange={(e) => setEditingText(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => { if ((e.nativeEvent as any).isComposing) return; if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, minWidth: 0, border: `1px solid ${TOSS.blue}`, borderRadius: 8, padding: '7px 9px', fontSize: 15, color: TOSS.ink, outline: 'none' }} />
                ) : (
                  <span onClick={() => { setEditingId(item.id); setEditingText(item.content); }}
                    style={{ flex: 1, fontSize: 15, color: item.done ? TOSS.sub : TOSS.ink, textDecoration: item.done ? 'line-through' : 'none', cursor: 'text', padding: '4px 0' }}>{item.content}</span>
                )}
                {!item.done && activeCount > 1 && editingId !== item.id && (
                  <span style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <button onClick={() => move(item, 'up')} aria-label="위로" style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', lineHeight: 0.8 }}><i className="ti ti-chevron-up" style={{ fontSize: 15, color: TOSS.faint }} /></button>
                    <button onClick={() => move(item, 'down')} aria-label="아래로" style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', lineHeight: 0.8 }}><i className="ti ti-chevron-down" style={{ fontSize: 15, color: TOSS.faint }} /></button>
                  </span>
                )}
                <button onClick={() => removeItem(item)} aria-label={`${item.content} 삭제`}
                  style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                  <i className="ti ti-x" style={{ fontSize: 17, color: TOSS.faint }} />
                </button>
              </div>
            )) : (
              <div style={{ padding: '4px 20px 8px' }}>
                <InfoBox>이 {planType === 'weekly' ? '주' : '날'}의 목표를 적어 체크해보세요. 체크하면 진행률이 쌓이고 선생님도 함께 봐요.</InfoBox>
                <div className="no-scrollbar" style={{ display: 'flex', gap: 7, marginTop: 10, overflowX: 'auto' }}>
                  {examples.map((ex) => (
                    <button key={ex} onClick={() => addItem(ex)} style={{ flexShrink: 0, background: '#fff', border: `1px solid ${TOSS.inputLine}`, borderRadius: 999, padding: '7px 12px', fontSize: 13, color: TOSS.sub, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ {ex}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 할 일 추가 */}
            <div style={{ display: 'flex', gap: 8, padding: '8px 20px 4px' }}>
              <input ref={inputRef} value={newItem} onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if ((e.nativeEvent as any).isComposing) return; if (e.key === 'Enter') addItem(newItem); }}
                enterKeyHint="done" placeholder="할 일을 입력하고 추가"
                style={{ flex: 1, minWidth: 0, border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: '11px 13px', fontSize: 14, color: TOSS.ink, outline: 'none' }} />
              <button onClick={() => addItem(newItem)} disabled={!newItem.trim() || busy}
                style={{ background: newItem.trim() ? TOSS.blue : TOSS.surf, color: newItem.trim() ? '#fff' : TOSS.sub, border: 'none', borderRadius: 12, padding: '0 16px', fontSize: 14, fontWeight: 600, cursor: newItem.trim() ? 'pointer' : 'default', flexShrink: 0 }}>추가</button>
            </div>

            {/* 선생님 피드백 (코멘트 전에도 노출 — 공유 사실 + 기대) */}
            {current && (
              <div style={{ margin: '14px 20px 28px', background: current.teacherComment ? TOSS.blueBg : TOSS.surf, borderRadius: 12, padding: '12px 13px', borderLeft: `3px solid ${current.teacherComment ? TOSS.blue : TOSS.inputLine}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: current.teacherComment ? 5 : 0 }}>
                  <i className="ti ti-message" style={{ fontSize: 15, color: current.teacherComment ? TOSS.blue : TOSS.sub }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: current.teacherComment ? TOSS.blue : TOSS.sub }}>선생님 피드백</span>
                </div>
                {current.teacherComment
                  ? <div style={{ fontSize: 14, color: TOSS.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{current.teacherComment}</div>
                  : <div style={{ fontSize: 13, color: TOSS.sub }}>선생님 피드백을 기다리고 있어요.</div>}
              </div>
            )}
          </>
        )}
      </Scroll>
    </Screen>
  );
};

// ── 선생님·원장: 학생 계획 열람 + 피드백 ──
const StaffPlan: React.FC<{ user: User }> = ({ user }) => {
  const [plans, setPlans] = useState<PlanT[]>([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<'todo' | 'all'>('todo'); // 미피드백 우선
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    planApi.list({ limit: 300 }).then(setPlans).catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useDataRefresh(['plans'], load);

  const students = useMemo(() => {
    const seen = new Map<string, string>();
    plans.forEach((p) => { if (!seen.has(p.studentId)) seen.set(p.studentId, p.studentName); });
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [plans]);

  const needsFeedback = (p: PlanT) => !p.teacherComment || !p.teacherComment.trim();
  const filtered = plans
    .filter((p) => (review === 'todo' ? needsFeedback(p) : true))
    .filter((p) => (studentFilter === 'all' ? true : p.studentId === studentFilter));

  // 전체 학생 보기일 때 학생별로 그룹
  const grouped = useMemo(() => {
    if (studentFilter !== 'all') return null;
    const m = new Map<string, PlanT[]>();
    filtered.forEach((p) => {
      const arr = m.get(p.studentId);
      if (arr) arr.push(p); else m.set(p.studentId, [p]);
    });
    return Array.from(m, ([sid, items]) => ({ sid, name: items[0].studentName, items }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [filtered, studentFilter]);

  const todoCount = plans.filter(needsFeedback).length;
  const open = openId ? plans.find((p) => p.id === openId) || null : null;
  const openStudentPlans = open ? plans.filter((p) => p.studentId === open.studentId) : [];

  if (open) {
    return <StaffPlanDetail plan={open} studentPlans={openStudentPlans} onBack={() => setOpenId(null)}
      onSaved={(u) => setPlans((prev) => prev.map((p) => p.id === u.id ? u : p))} />;
  }

  const Row: React.FC<{ p: PlanT; showName?: boolean }> = ({ p, showName }) => (
    <ListRow
      left={showName ? <Avatar name={p.studentName} /> : <div style={{ width: 8 }} />}
      title={`${showName ? p.studentName + ' · ' : ''}${p.planType === 'weekly' ? '주간' : '하루'} · ${fmtKDate(p.planDate)}${p.planType === 'weekly' ? '~' : ''}`}
      sub={`${p.doneCount}/${p.totalCount} 완료`}
      right={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {needsFeedback(p)
          ? <Tag bg={TOSS.warnBg} fg={TOSS.warn}>피드백 대기</Tag>
          : <Tag bg={TOSS.successBg} fg={TOSS.success}>완료 💬</Tag>}
        <Tag bg={p.progress >= 100 ? TOSS.successBg : TOSS.blueBg} fg={p.progress >= 100 ? TOSS.success : TOSS.blue}>{Math.round(p.progress)}%</Tag>
      </span>}
      onClick={() => setOpenId(p.id)}
    />
  );

  return (
    <Screen>
      <BigTitle title="학생 학습 계획" sub={todoCount > 0 ? `피드백 대기 ${todoCount}건` : '담당 학생들의 계획을 확인하고 피드백해요'} />
      <FilterChips options={[{ value: 'todo', label: `피드백 대기${todoCount ? ` ${todoCount}` : ''}` }, { value: 'all', label: '전체' }]} value={review} onChange={(v) => setReview(v as 'todo' | 'all')} />
      {students.length > 0 && (
        <FilterChips options={[{ value: 'all', label: '학생 전체' }, ...students.map((s) => ({ value: s.id, label: s.name }))]} value={studentFilter} onChange={setStudentFilter} />
      )}
      <Scroll>
        {loading ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <Empty>{review === 'todo' ? '피드백 대기 중인 계획이 없어요. 모두 확인했어요 👍' : '아직 작성된 계획이 없어요.'}</Empty>
        ) : grouped ? (
          grouped.map((g) => (
            <div key={g.sid}>
              <SectionLabel>{g.name} · {g.items.length}건{g.items.some(needsFeedback) ? ` · 대기 ${g.items.filter(needsFeedback).length}` : ''}</SectionLabel>
              {g.items.map((p) => <Row key={p.id} p={p} />)}
            </div>
          ))
        ) : (
          filtered.map((p) => <Row key={p.id} p={p} showName />)
        )}
      </Scroll>
    </Screen>
  );
};

const StaffPlanDetail: React.FC<{ plan: PlanT; studentPlans: PlanT[]; onBack: () => void; onSaved: (p: PlanT) => void }> = ({ plan, studentPlans, onBack, onSaved }) => {
  const [comment, setComment] = useState(plan.teacherComment || '');
  const [saving, setSaving] = useState(false);

  // 최근 7일 하루계획 요약
  const summary = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return fmt(d); });
    const daily = studentPlans.filter((p) => p.planType === 'daily');
    const byDate = new Map(daily.map((p) => [p.planDate, p]));
    const written = days.map((d) => byDate.get(d)).filter(Boolean) as PlanT[];
    const wrote = written.length;
    // 평균 진행률은 '작성한 날' 기준(미작성일을 0%로 섞어 성실한 학생을 과소평가하지 않도록)
    const avg = wrote ? Math.round(written.reduce((a, p) => a + p.progress, 0) / wrote) : 0;
    return { wrote, avg, streak: computeStreak(daily) };
  }, [studentPlans]);

  const doSave = async (text: string) => {
    setSaving(true);
    try { onSaved(await planApi.update(plan.id, { teacherComment: text })); toast.success('피드백을 저장했어요'); onBack(); }
    catch (e: any) { toast.error(e.message || '저장하지 못했어요'); }
    finally { setSaving(false); }
  };

  return (
    <Screen>
      <BackHeader title={`${plan.studentName} · ${plan.planType === 'weekly' ? '주간계획' : '하루계획'}`} onBack={onBack} />
      <Scroll>
        {/* 학생 최근 7일 요약 */}
        <div style={{ display: 'flex', gap: 8, padding: '6px 20px 4px' }}>
          {[{ k: '작성', v: `${summary.wrote}/7일` }, { k: '평균 진행률', v: `${summary.avg}%` }, { k: '연속', v: `${summary.streak}일` }].map((s) => (
            <div key={s.k} style={{ flex: 1, background: TOSS.surf, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: TOSS.sub }}>{s.k}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: TOSS.ink, marginTop: 2 }}>{s.v}</div>
            </div>
          ))}
        </div>
        <SectionLabel>{fmtKDate(plan.planDate)}{plan.planType === 'weekly' ? '~ 주간' : ''} 할 일</SectionLabel>
        {plan.totalCount > 0 && <Progress value={plan.progress} done={plan.doneCount} total={plan.totalCount} />}
        {plan.items.length === 0 ? <Empty>작성된 할 일이 없어요.</Empty> : plan.items.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${item.done ? TOSS.success : TOSS.inputLine}`, background: item.done ? TOSS.success : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.done && <i className="ti ti-check" style={{ fontSize: 14, color: '#fff' }} />}
            </div>
            <span style={{ flex: 1, fontSize: 15, color: item.done ? TOSS.sub : TOSS.ink, textDecoration: item.done ? 'line-through' : 'none' }}>{item.content}</span>
          </div>
        ))}
        <SectionLabel>피드백 코멘트{plan.teacherComment ? ` · ${plan.updatedAt?.slice(5, 10).replace('-', '/')} 작성` : ''}</SectionLabel>
        <div style={{ padding: '0 20px 16px' }}>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="학생에게 남길 피드백을 입력하세요" rows={4}
            style={{ width: '100%', border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: '12px 13px', fontSize: 14, color: TOSS.ink, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          {/* 최초 피드백(기존 코멘트 없음)일 때만 '확인 완료' 단축 버튼 노출 */}
          {!plan.teacherComment && !comment.trim() && (
            <button onClick={() => doSave('확인했어요 👍')} disabled={saving}
              style={{ marginTop: 8, width: '100%', background: '#fff', border: `1.5px solid ${TOSS.blue}`, color: TOSS.blue, borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              코멘트 없이 '확인 완료'
            </button>
          )}
        </div>
      </Scroll>
      {/* 변경분이 있을 때만 저장 활성(기존 코멘트를 비워 저장하면 삭제도 가능) */}
      <Cta onClick={() => doSave(comment.trim())} loading={saving} disabled={saving || comment.trim() === (plan.teacherComment || '').trim()}>
        {!comment.trim() && plan.teacherComment ? '피드백 삭제' : '피드백 저장'}
      </Cta>
    </Screen>
  );
};

export const Plan: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  return isStaff ? <StaffPlan user={user} /> : <StudentPlan user={user} />;
};
