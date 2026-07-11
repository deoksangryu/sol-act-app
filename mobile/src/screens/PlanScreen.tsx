import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BigTitle, BackHeader, SectionLabel, FilterChips, Cta, ListRow, Tag, Avatar, InfoBox, Divider } from '../components/kit';
import { TopBar } from '../components/TopBar';
import { MiniCalendar } from '../components/MiniCalendar';
import { Icon } from '../components/Icon';
import { color, text, radius, space } from '../theme/tokens';
import { planApi } from '../services/api';
import { useDataRefresh } from '../services/ws';
import { fmt, todayStr, weekStartStr, weekDates, fmtKDate } from '../lib/date';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';
import type { Plan, PlanItem } from '../types';

const toUp = (items: PlanItem[]) => items.map((i) => ({ id: i.id, content: i.content, done: i.done, sortOrder: i.sortOrder }));

/** 하루계획 연속 완료일수(오늘 미완료면 어제부터 카운트) */
function computeStreak(dailyPlans: Plan[]): number {
  const done = new Set(dailyPlans.filter((p) => p.totalCount > 0 && p.progress >= 100).map((p) => p.planDate));
  const d = new Date();
  if (!done.has(fmt(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (done.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// 진행률 바
function Progress({ value, done, total }: { value: number; done: number; total: number }) {
  const full = value >= 100;
  return (
    <View style={{ paddingHorizontal: space.screenX, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, color: color.sub }}>{`진행률${full ? ' · 완료 🎉' : ''}`}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: full ? color.success : color.blue }}>{done}/{total} · {Math.round(value)}%</Text>
      </View>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: color.surf, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, value)}%`, height: '100%', borderRadius: radius.pill, backgroundColor: full ? color.success : color.blue }} />
      </View>
    </View>
  );
}

// 하단 스낵바(실행취소/알림)
function Snackbar({ snack, onDismiss }: { snack: { msg: string; action?: { label: string; onPress: () => void } } | null; onDismiss: () => void }) {
  if (!snack) return null;
  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: color.ink, borderRadius: radius.button, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: color.white, fontSize: 14, flex: 1 }}>{snack.msg}</Text>
      {snack.action && (
        <Pressable onPress={() => { snack.action!.onPress(); onDismiss(); }} hitSlop={8}>
          <Text style={{ color: '#7CC0FF', fontWeight: '700', fontSize: 14, marginLeft: 12 }}>{snack.action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── 학생: 캘린더 + 체크리스트 작성 ──
function StudentPlan({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: plans = [], isLoading } = useQuery({ queryKey: ['plans'], queryFn: () => planApi.list({}) });
  useDataRefresh(['plans'], () => { qc.invalidateQueries({ queryKey: ['plans'] }); });

  const setPlans = useCallback((updater: (prev: Plan[]) => Plan[]) => {
    qc.setQueryData<Plan[]>(['plans'], (prev = []) => updater(prev));
  }, [qc]);
  const upsert = useCallback((u: Plan) => {
    setPlans((prev) => (prev.some((p) => p.id === u.id) ? prev.map((p) => (p.id === u.id ? u : p)) : [u, ...prev]));
  }, [setPlans]);

  const [planType, setPlanType] = useState<'daily' | 'weekly'>('daily');
  const [selDate, setSelDate] = useState<string>(todayStr());
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [snack, setSnack] = useState<{ msg: string; action?: { label: string; onPress: () => void } } | null>(null);
  const showSnack = (msg: string, action?: { label: string; onPress: () => void }) => setSnack({ msg, action });

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

  const saveItems = async (items: PlanItem[]) => {
    if (!current) return;
    try { upsert(await planApi.update(current.id, { items: toUp(items) })); }
    catch (e: any) { showSnack(e?.message || '저장하지 못했어요'); qc.invalidateQueries({ queryKey: ['plans'] }); }
  };

  const addItem = async (raw: string) => {
    const content = raw.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      if (current) {
        upsert(await planApi.update(current.id, { items: [...toUp(current.items), { content, sortOrder: current.items.length }] }));
      } else {
        upsert(await planApi.create({ studentId: userId, planType, planDate: matchDate, items: [{ content }] }));
      }
      setNewItem('');
    } catch (e: any) { showSnack(e?.message || '추가하지 못했어요'); }
    finally { setBusy(false); }
  };

  const toggle = async (item: PlanItem) => {
    if (!current) return;
    const items = current.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i));
    const dc = items.filter((i) => i.done).length;
    const prog = items.length ? (dc / items.length) * 100 : 0;
    const wasFull = current.progress >= 100;
    upsert({ ...current, items, doneCount: dc, progress: prog });
    if (!wasFull && prog >= 100 && items.length > 0) showSnack(planType === 'weekly' ? '🎉 이번 주 계획을 모두 끝냈어요!' : '🎉 오늘 계획을 모두 끝냈어요!');
    try { upsert(await planApi.toggleItem(item.id, !item.done)); }
    catch (e: any) { showSnack(e?.message || '저장하지 못했어요'); qc.invalidateQueries({ queryKey: ['plans'] }); }
  };

  const removeItem = async (item: PlanItem) => {
    if (!current) return;
    const planId = current.id;
    const remaining = current.items.filter((i) => i.id !== item.id);
    await saveItems(remaining);
    showSnack('할 일을 삭제했어요', {
      label: '실행취소',
      onPress: async () => {
        try { upsert(await planApi.update(planId, { items: [...toUp(remaining), { content: item.content, done: item.done, sortOrder: remaining.length }] })); }
        catch { showSnack('복구하지 못했어요'); }
      },
    });
  };

  const displayItems = useMemo(
    () => [...(current?.items || [])].sort((a, b) => (Number(a.done) - Number(b.done)) || (a.sortOrder - b.sortOrder)),
    [current],
  );
  const activeCount = displayItems.filter((i) => !i.done).length;

  const move = async (item: PlanItem, dir: 'up' | 'down') => {
    if (busy) return;
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
    const id = editingId; const t = editingText.trim();
    setEditingId(null);
    if (!id || !current || !t) return;
    await saveItems(current.items.map((i) => (i.id === id ? { ...i, content: t } : i)));
  };

  const examples = planType === 'weekly'
    ? ['자유연기 2편 완성', '뮤지컬 넘버 1곡', '무용 기본기 매일']
    : ['발성·호흡 30분', '독백 대사 암기', '자유연기 촬영'];

  return (
    <Screen edges={['top']}>
      <TopBar />
      <BigTitle>학습 계획</BigTitle>
      {streak >= 2 && (
        <View style={{ paddingHorizontal: space.screenX, marginTop: -6, marginBottom: 4 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: color.warnBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: color.warn }}>🔥 {streak}일 연속</Text>
          </View>
        </View>
      )}

      <FilterChips
        items={[{ key: 'daily', label: '하루계획' }, { key: 'weekly', label: '주간계획' }]}
        value={planType}
        onChange={(v) => setPlanType(v)}
      />

      <MiniCalendar
        marked={marked} selected={selDate} onSelect={(d) => setSelDate(d || todayStr())}
        open={calOpen} onToggle={() => setCalOpen((o) => !o)} month={calMonth} onMonth={setCalMonth}
        toggleLabel="계획"
      />

      <Scroll contentStyle={{ paddingBottom: 40 }}>
        <SectionLabel>{periodLabel} · {planType === 'weekly' ? '주간' : '하루'} 할 일</SectionLabel>

        {isLoading ? (
          <Text style={[text.caption, { paddingHorizontal: space.screenX }]}>불러오는 중…</Text>
        ) : (
          <>
            {current && current.totalCount > 0 && <Progress value={current.progress} done={current.doneCount} total={current.totalCount} />}

            {displayItems.length > 0 ? displayItems.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 14, paddingVertical: 5 }}>
                <Pressable onPress={() => toggle(item)} style={{ padding: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: radius.tag, borderWidth: 2, borderColor: item.done ? color.blue : color.sub, backgroundColor: item.done ? color.blue : color.white, alignItems: 'center', justifyContent: 'center' }}>
                    {item.done && <Icon name="check" size={15} color={color.white} />}
                  </View>
                </Pressable>

                {editingId === item.id ? (
                  <TextInput
                    autoFocus value={editingText} onChangeText={setEditingText}
                    onBlur={saveEdit} onSubmitEditing={saveEdit} returnKeyType="done"
                    style={{ flex: 1, borderWidth: 1, borderColor: color.blue, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontSize: 15, color: color.ink }}
                  />
                ) : (
                  <Pressable style={{ flex: 1, paddingVertical: 4 }} onPress={() => { setEditingId(item.id); setEditingText(item.content); }}>
                    <Text style={{ fontSize: 15, color: item.done ? color.sub : color.ink, textDecorationLine: item.done ? 'line-through' : 'none' }}>{item.content}</Text>
                  </Pressable>
                )}

                {!item.done && activeCount > 1 && editingId !== item.id && (
                  <View>
                    <Pressable onPress={() => move(item, 'up')} hitSlop={4} style={{ paddingHorizontal: 4 }}><Icon name="chevron-up" size={15} color={color.faint} /></Pressable>
                    <Pressable onPress={() => move(item, 'down')} hitSlop={4} style={{ paddingHorizontal: 4 }}><Icon name="chevron-down" size={15} color={color.faint} /></Pressable>
                  </View>
                )}
                <Pressable onPress={() => removeItem(item)} hitSlop={4} style={{ padding: 8 }}>
                  <Icon name="x" size={17} color={color.faint} />
                </Pressable>
              </View>
            )) : (
              <View style={{ paddingHorizontal: space.screenX, paddingTop: 4, paddingBottom: 8 }}>
                <InfoBox>이 {planType === 'weekly' ? '주' : '날'}의 목표를 적어 체크해보세요. 체크하면 진행률이 쌓이고 선생님도 함께 봐요.</InfoBox>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                  {examples.map((ex) => (
                    <Pressable key={ex} onPress={() => addItem(ex)} style={{ borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ fontSize: 13, color: color.sub }}>+ {ex}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* 할 일 추가 */}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space.screenX, paddingTop: 8, paddingBottom: 4 }}>
              <TextInput
                value={newItem} onChangeText={setNewItem}
                onSubmitEditing={() => addItem(newItem)} returnKeyType="done"
                placeholder="할 일을 입력하고 추가" placeholderTextColor={color.faint}
                style={{ flex: 1, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: color.ink }}
              />
              <Pressable onPress={() => addItem(newItem)} disabled={!newItem.trim() || busy} style={{ backgroundColor: newItem.trim() ? color.blue : color.surf, borderRadius: radius.card, paddingHorizontal: 16, justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: newItem.trim() ? color.white : color.sub }}>추가</Text>
              </Pressable>
            </View>

            {/* 선생님 피드백 */}
            {current && (
              <View style={{ marginHorizontal: space.screenX, marginTop: 14, marginBottom: 28, backgroundColor: current.teacherComment ? color.blueBg : color.surf, borderRadius: radius.card, padding: 13, borderLeftWidth: 3, borderLeftColor: current.teacherComment ? color.blue : color.inputLine }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: current.teacherComment ? 5 : 0 }}>
                  <Icon name="message" size={15} color={current.teacherComment ? color.blue : color.sub} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: current.teacherComment ? color.blue : color.sub }}>선생님 피드백</Text>
                </View>
                <Text style={{ fontSize: current.teacherComment ? 14 : 13, color: current.teacherComment ? color.ink : color.sub, lineHeight: 22 }}>
                  {current.teacherComment || '선생님 피드백을 기다리고 있어요.'}
                </Text>
              </View>
            )}
          </>
        )}
      </Scroll>

      <Snackbar snack={snack} onDismiss={() => setSnack(null)} />
    </Screen>
  );
}

// ── 선생님·원장: 학생 계획 열람 + 피드백 ──
function StaffPlan() {
  const qc = useQueryClient();
  const { data: plans = [], isLoading } = useQuery({ queryKey: ['plans', 'staff'], queryFn: () => planApi.list({ limit: 300 }) });
  useDataRefresh(['plans'], () => { qc.invalidateQueries({ queryKey: ['plans'] }); });

  const [review, setReview] = useState<'todo' | 'all'>('todo');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const needsFeedback = (p: Plan) => !p.teacherComment || !p.teacherComment.trim();

  const students = useMemo(() => {
    const seen = new Map<string, string>();
    plans.forEach((p) => { if (!seen.has(p.studentId)) seen.set(p.studentId, p.studentName); });
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [plans]);

  const filtered = plans
    .filter((p) => (review === 'todo' ? needsFeedback(p) : true))
    .filter((p) => (studentFilter === 'all' ? true : p.studentId === studentFilter));

  const grouped = useMemo(() => {
    if (studentFilter !== 'all') return null;
    const m = new Map<string, Plan[]>();
    filtered.forEach((p) => { const arr = m.get(p.studentId); if (arr) arr.push(p); else m.set(p.studentId, [p]); });
    return Array.from(m, ([sid, items]) => ({ sid, name: items[0].studentName, items })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [filtered, studentFilter]);

  const todoCount = plans.filter(needsFeedback).length;
  const open = openId ? plans.find((p) => p.id === openId) || null : null;
  const openStudentPlans = open ? plans.filter((p) => p.studentId === open.studentId) : [];

  const onSaved = (u: Plan) => qc.setQueryData<Plan[]>(['plans', 'staff'], (prev = []) => prev.map((p) => (p.id === u.id ? u : p)));

  if (open) {
    return <StaffPlanDetail plan={open} studentPlans={openStudentPlans} onBack={() => setOpenId(null)} onSaved={onSaved} />;
  }

  const Row = ({ p, showName }: { p: Plan; showName?: boolean }) => (
    <ListRow
      left={showName ? <Avatar name={p.studentName} /> : <View style={{ width: 8 }} />}
      title={`${showName ? p.studentName + ' · ' : ''}${p.planType === 'weekly' ? '주간' : '하루'} · ${fmtKDate(p.planDate)}${p.planType === 'weekly' ? '~' : ''}`}
      sub={`${p.doneCount}/${p.totalCount} 완료`}
      showChevron={false}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {needsFeedback(p) ? <Tag label="피드백 대기" tone="pending" /> : <Tag label="완료 💬" tone="done" />}
          <Tag label={`${Math.round(p.progress)}%`} tone={p.progress >= 100 ? 'done' : 'todo'} />
        </View>
      }
      onPress={() => setOpenId(p.id)}
    />
  );

  return (
    <Screen edges={['top']}>
      <TopBar />
      <BigTitle>학생 학습 계획</BigTitle>
      <FilterChips
        items={[{ key: 'todo', label: `피드백 대기${todoCount ? ` ${todoCount}` : ''}` }, { key: 'all', label: '전체' }]}
        value={review} onChange={setReview}
      />
      {students.length > 0 && (
        <FilterChips
          items={[{ key: 'all', label: '학생 전체' }, ...students.map((s) => ({ key: s.id, label: s.name }))]}
          value={studentFilter} onChange={setStudentFilter}
        />
      )}
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        {isLoading ? (
          <Text style={[text.caption, { paddingHorizontal: space.screenX }]}>불러오는 중…</Text>
        ) : filtered.length === 0 ? (
          <Text style={{ paddingHorizontal: space.screenX, paddingVertical: 24, color: color.sub, fontSize: 14 }}>
            {review === 'todo' ? '피드백 대기 중인 계획이 없어요. 모두 확인했어요 👍' : '아직 작성된 계획이 없어요.'}
          </Text>
        ) : grouped ? (
          grouped.map((g) => (
            <View key={g.sid}>
              <SectionLabel>{g.name} · {g.items.length}건{g.items.some(needsFeedback) ? ` · 대기 ${g.items.filter(needsFeedback).length}` : ''}</SectionLabel>
              {g.items.map((p) => <Row key={p.id} p={p} />)}
              <Divider />
            </View>
          ))
        ) : (
          filtered.map((p) => <Row key={p.id} p={p} showName />)
        )}
      </Scroll>
    </Screen>
  );
}

function StaffPlanDetail({ plan, studentPlans, onBack, onSaved }: { plan: Plan; studentPlans: Plan[]; onBack: () => void; onSaved: (p: Plan) => void }) {
  const [comment, setComment] = useState(plan.teacherComment || '');
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return fmt(d); });
    const daily = studentPlans.filter((p) => p.planType === 'daily');
    const byDate = new Map(daily.map((p) => [p.planDate, p]));
    const written = days.map((d) => byDate.get(d)).filter(Boolean) as Plan[];
    const wrote = written.length;
    const avg = wrote ? Math.round(written.reduce((a, p) => a + p.progress, 0) / wrote) : 0;
    return { wrote, avg, streak: computeStreak(daily) };
  }, [studentPlans]);

  const doSave = async (t: string) => {
    setSaving(true);
    try { onSaved(await planApi.update(plan.id, { teacherComment: t })); onBack(); }
    catch { /* keep screen open on error */ }
    finally { setSaving(false); }
  };

  const dirty = comment.trim() !== (plan.teacherComment || '').trim();

  return (
    <Screen edges={['top']}>
      <BackHeader title={`${plan.studentName} · ${plan.planType === 'weekly' ? '주간계획' : '하루계획'}`} onBack={onBack} />
      <Scroll contentStyle={{ paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space.screenX, paddingTop: 6, paddingBottom: 4 }}>
          {[{ k: '작성', v: `${summary.wrote}/7일` }, { k: '평균 진행률', v: `${summary.avg}%` }, { k: '연속', v: `${summary.streak}일` }].map((s) => (
            <View key={s.k} style={{ flex: 1, backgroundColor: color.surf, borderRadius: radius.card, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: color.sub }}>{s.k}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: color.ink, marginTop: 2 }}>{s.v}</Text>
            </View>
          ))}
        </View>

        <SectionLabel>{fmtKDate(plan.planDate)}{plan.planType === 'weekly' ? '~ 주간' : ''} 할 일</SectionLabel>
        {plan.totalCount > 0 && <Progress value={plan.progress} done={plan.doneCount} total={plan.totalCount} />}
        {plan.items.length === 0 ? (
          <Text style={{ paddingHorizontal: space.screenX, paddingVertical: 12, color: color.sub }}>작성된 할 일이 없어요.</Text>
        ) : plan.items.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.screenX, paddingVertical: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: radius.tag, borderWidth: 2, borderColor: item.done ? color.success : color.inputLine, backgroundColor: item.done ? color.success : color.white, alignItems: 'center', justifyContent: 'center' }}>
              {item.done && <Icon name="check" size={14} color={color.white} />}
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: item.done ? color.sub : color.ink, textDecorationLine: item.done ? 'line-through' : 'none' }}>{item.content}</Text>
          </View>
        ))}

        <SectionLabel>피드백 코멘트</SectionLabel>
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
          <TextInput
            value={comment} onChangeText={setComment} multiline
            placeholder="학생에게 남길 피드백을 입력하세요" placeholderTextColor={color.faint}
            style={{ minHeight: 96, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, padding: 13, fontSize: 14, color: color.ink, textAlignVertical: 'top' }}
          />
          {!plan.teacherComment && !comment.trim() && (
            <View style={{ marginTop: 8 }}>
              <Pressable onPress={() => doSave('확인했어요 👍')} disabled={saving} style={{ borderWidth: 1.5, borderColor: color.blue, borderRadius: radius.card, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: color.blue, fontSize: 14, fontWeight: '600' }}>코멘트 없이 '확인 완료'</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Scroll>

      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16, paddingTop: 4 }}>
        <Cta
          label={!comment.trim() && plan.teacherComment ? '피드백 삭제' : '피드백 저장'}
          onPress={() => doSave(comment.trim())}
          loading={saving}
          disabled={saving || !dirty}
        />
      </View>
    </Screen>
  );
}

export function PlanScreen() {
  const { user } = useAuth();
  if (!user) return null;
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  return isStaff ? <StaffPlan /> : <StudentPlan userId={user.id} />;
}
