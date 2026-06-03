import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, DietLog } from '../types';
import { dietApi, uploadApi, resolveFileUrl } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, IconChip, Tag,
  Cta, GhostButton, Empty, InfoBox, ChipSelect, Chevron,
} from './toss/kit';

const MEAL_TYPES = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
];
const mealLabel = (t: string) => MEAL_TYPES.find(m => m.value === t)?.label || t;

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Weight { id: string; weight: number; date: string; memo?: string; }

const ForkIcon: React.FC<{ color?: string }> = ({ color = TOSS.blue }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v6a2 2 0 002 2h0a2 2 0 002-2V3M6 11v10M18 3c-1.66 0-3 2-3 5s1.34 4 3 4m0 0v9" />
  </svg>
);

export const Diet: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const [meals, setMeals] = useState<DietLog[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'home' | 'addMeal' | 'addWeight'>('home');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [m, w] = await Promise.all([
        dietApi.list(isStaff ? undefined : { studentId: user.id }),
        isStaff ? Promise.resolve([] as any[]) : dietApi.listWeight({ studentId: user.id, days: 30 }),
      ]);
      setMeals(m);
      setWeights((w as any[]) as Weight[]);
    } catch (e: any) {
      toast.error(e.message || '식단을 불러오지 못했어요');
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  useDataRefresh(['diet'], load);

  const open = openId ? meals.find(m => m.id === openId) : null;

  if (loading) return <Empty>불러오는 중…</Empty>;
  if (open) return <MealDetail meal={open} user={user} isStaff={isStaff} onBack={() => setOpenId(null)} onReload={load} onDeleted={async () => { setOpenId(null); await load(); }} />;
  if (screen === 'addMeal') return <AddMeal user={user} onBack={() => setScreen('home')} onDone={async () => { setScreen('home'); await load(); }} />;
  if (screen === 'addWeight') return <AddWeight current={weights.length ? weights[weights.length - 1].weight : 58} onBack={() => setScreen('home')} onDone={async () => { setScreen('home'); await load(); }} />;

  // ── 선생님: 학생 식단 검토 ──
  if (isStaff) {
    const need = meals.filter(m => !m.teacherComment);
    return (
      <Screen>
        <BigTitle title={<>학생 식단을<br />살펴봐요</>} />
        <Scroll className="px-1">
          <SectionLabel>피드백 필요 {need.length}개</SectionLabel>
          {meals.length === 0 ? <Empty>아직 올라온 식단이 없어요</Empty> : meals.map(m => (
            <ListRow
              key={m.id}
              left={<IconChip bg={m.teacherComment ? TOSS.surf : TOSS.warnBg}><ForkIcon color={m.teacherComment ? TOSS.sub : TOSS.warn} /></IconChip>}
              title={m.description}
              sub={`${m.studentName} · ${mealLabel(m.mealType)}`}
              right={m.teacherComment ? <Tag bg={TOSS.successBg} fg={TOSS.success}>완료</Tag> : <Tag bg={TOSS.warnBg} fg={TOSS.warn}>피드백 필요</Tag>}
              onClick={() => setOpenId(m.id)}
            />
          ))}
        </Scroll>
      </Screen>
    );
  }

  // ── 학생: 체중 + 식단 ──
  const cur = weights.length ? weights[weights.length - 1].weight : null;
  const diff = weights.length > 1 ? (weights[weights.length - 1].weight - weights[0].weight) : 0;
  const todays = meals.filter(m => (m.date || '').slice(0, 10) === todayStr());
  return (
    <Screen>
      <BigTitle title={<>오늘도 잘<br />챙기고 있어요</>} />
      <Scroll className="px-1">
        <SectionLabel>체중 추이</SectionLabel>
        <div className="rounded-2xl p-3.5" style={{ background: TOSS.surf }}>
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-bold tracking-[-0.02em] text-toss-ink">{cur == null ? '–' : cur.toFixed(1)}</span>
            <span className="text-sm text-toss-sub">kg</span>
            {weights.length > 1 && (
              <span className="ml-auto text-xs font-medium" style={{ color: diff <= 0 ? TOSS.success : TOSS.warn }}>
                처음보다 {Math.abs(diff).toFixed(1)}kg {diff <= 0 ? '↓' : '↑'}
              </span>
            )}
          </div>
          {weights.length > 0 && (
            <div className="flex mt-2.5 text-[11px] text-toss-sub overflow-x-auto no-scrollbar gap-2.5">
              {weights.slice(-6).map((p) => (
                <button
                  key={p.id}
                  onClick={async () => {
                    if (!window.confirm(`${(p.date || '').slice(5, 10)} ${p.weight}kg 기록을 지울까요?`)) return;
                    try { await dietApi.deleteWeight(p.id); await load(); toast.success('지웠어요'); }
                    catch (e: any) { toast.error(e.message || '지우지 못했어요'); }
                  }}
                  className="whitespace-nowrap shrink-0 active:opacity-60"
                >{(p.date || '').slice(5, 10)} {p.weight}</button>
              ))}
            </div>
          )}
        </div>

        <SectionLabel>오늘 먹은 것 · {todays.length}끼</SectionLabel>
        {todays.length === 0 ? <Empty>오늘 기록한 식단이 없어요</Empty> : todays.map(m => (
          <ListRow
            key={m.id}
            left={<IconChip bg={TOSS.blueBg}><ForkIcon /></IconChip>}
            title={m.description}
            sub={`${mealLabel(m.mealType)}`}
            right={m.teacherComment ? <Tag bg={TOSS.successBg} fg={TOSS.success}>피드백</Tag> : <Chevron />}
            onClick={() => setOpenId(m.id)}
          />
        ))}
      </Scroll>
      <div className="flex gap-2 px-1 pt-3 pb-4 shrink-0">
        <div className="flex-1"><GhostButton onClick={() => setScreen('addWeight')}>체중 기록</GhostButton></div>
        <button onClick={() => setScreen('addMeal')} className="flex-1 rounded-2xl py-[14px] text-sm font-semibold text-white" style={{ background: TOSS.blue }}>식단 올리기</button>
      </div>
    </Screen>
  );
};

// 식단 상세 + (선생님) 피드백
const MealDetail: React.FC<{ meal: DietLog; user: User; isStaff: boolean; onBack: () => void; onReload: () => Promise<void>; onDeleted: () => Promise<void> }> = ({ meal, user, isStaff, onBack, onReload, onDeleted }) => {
  const [fb, setFb] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = !isStaff && meal.studentId === user.id;
  const remove = async () => {
    if (!window.confirm('이 식단 기록을 지울까요?')) return;
    try { await dietApi.delete(meal.id); toast.success('지웠어요'); await onDeleted(); }
    catch (e: any) { toast.error(e.message || '지우지 못했어요'); }
  };
  const send = async () => {
    if (!fb.trim()) return;
    setBusy(true);
    try {
      await dietApi.update(meal.id, { teacherComment: fb.trim() } as any);
      toast.success('피드백을 보냈어요');
      await onReload();
      onBack();
    } catch (e: any) {
      toast.error(e.message || '보내지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <BackHeader title="식단" onBack={onBack} />
      <Scroll>
        <div className="h-36 flex items-center justify-center overflow-hidden" style={{ background: '#D9E6CC' }}>
          {meal.imageUrl
            ? <img src={resolveFileUrl(meal.imageUrl)} alt="" className="w-full h-full object-cover" />
            : <ForkIcon color={TOSS.success} />}
        </div>
        <div className="px-1 pt-4">
          <div className="text-[19px] font-bold text-toss-ink">{meal.description}</div>
          <div className="text-[13px] text-toss-sub mt-1.5">{meal.studentName} · {mealLabel(meal.mealType)}</div>
          {meal.teacherComment ? (
            <div className="mt-4">
              <div className="text-[13px] font-medium text-toss-sub mb-2.5">선생님 피드백</div>
              <InfoBox>{meal.teacherComment}</InfoBox>
            </div>
          ) : isStaff ? (
            <div className="mt-4">
              <div className="text-[13px] font-medium text-toss-sub mb-2.5">피드백 남기기</div>
              <textarea value={fb} onChange={e => setFb(e.target.value)} placeholder="조언해 주세요" className="w-full min-h-[86px] rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-toss-blue resize-none" />
            </div>
          ) : (
            <div className="mt-4"><InfoBox tone="warn">피드백을 기다리고 있어요</InfoBox></div>
          )}
          {isOwner && (
            <button onClick={remove} className="mt-5 text-[13px] text-toss-warn font-medium">이 식단 지우기</button>
          )}
        </div>
      </Scroll>
      {!meal.teacherComment && isStaff && <Cta onClick={send} disabled={!fb.trim()} loading={busy}>피드백 보내기</Cta>}
    </Screen>
  );
};

// 식단 올리기
const AddMeal: React.FC<{ user: User; onBack: () => void; onDone: () => Promise<void> }> = ({ user, onBack, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mealType, setMealType] = useState('dinner');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!desc.trim()) return;
    setBusy(true);
    try {
      let imageUrl: string | undefined;
      if (file) {
        const { url } = await uploadApi.upload(file, undefined, 'diet');
        imageUrl = url;
      }
      await dietApi.create({ studentId: user.id, mealType: mealType as any, description: desc.trim(), date: todayStr(), ...(imageUrl ? { imageUrl } : {}) } as any);
      toast.success('식단을 올렸어요');
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '올리지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <BackHeader title="식단 기록" onBack={onBack} />
      <Scroll className="px-1">
        <div className="text-[21px] font-bold leading-[1.4] text-toss-ink mt-2">사진 한 장이면<br />충분해요</div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0] || null)} />
        <div onClick={() => fileRef.current?.click()} className="rounded-2xl h-36 mt-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer overflow-hidden" style={{ background: preview ? '#000' : TOSS.surf }}>
          {preview
            ? <img src={preview} alt="" className="w-full h-full object-cover" />
            : <><svg className="w-7 h-7" fill="none" stroke={TOSS.faint} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg><span className="text-[13px] text-toss-sub">사진 찍거나 불러오기</span></>}
        </div>

        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">어떤 끼니예요?</div>
        <ChipSelect options={MEAL_TYPES} value={mealType} onChange={setMealType} />
        <div className="text-[13px] font-medium text-toss-sub mt-4 mb-2">무엇을 먹었나요?</div>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="예: 닭가슴살 샐러드" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-toss-blue" />
      </Scroll>
      <Cta onClick={submit} disabled={!desc.trim()} loading={busy}>식단 올리기</Cta>
    </Screen>
  );
};

// 체중 기록
const AddWeight: React.FC<{ current: number; onBack: () => void; onDone: () => Promise<void> }> = ({ current, onBack, onDone }) => {
  const [w, setW] = useState(current);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await dietApi.createWeight({ weight: Number(w.toFixed(1)), date: todayStr() });
      toast.success('체중을 기록했어요');
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '기록하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <BackHeader title="체중 기록" onBack={onBack} />
      <Scroll className="px-1">
        <div className="text-[21px] font-bold leading-[1.4] text-toss-ink mt-2">오늘 체중을<br />알려줘요</div>
        <div className="flex items-baseline justify-center gap-1.5 my-7">
          <span className="text-[46px] font-bold tracking-[-0.03em]" style={{ color: TOSS.blue }}>{w.toFixed(1)}</span>
          <span className="text-lg font-medium text-toss-sub">kg</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setW(v => Math.max(30, +(v - 0.1).toFixed(1)))} className="w-12 h-12 rounded-full border border-slate-200 text-2xl text-toss-ink">−</button>
          <input type="range" min={35} max={110} step={0.1} value={w} onChange={e => setW(Number(e.target.value))} className="flex-1" />
          <button onClick={() => setW(v => Math.min(110, +(v + 0.1).toFixed(1)))} className="w-12 h-12 rounded-full border border-slate-200 text-2xl text-toss-ink">+</button>
        </div>
      </Scroll>
      <Cta onClick={submit} loading={busy}>체중 저장하기</Cta>
    </Screen>
  );
};
