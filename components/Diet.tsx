import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, DietLog } from '../types';
import { dietApi, uploadApi, resolveFileUrl } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, IconChip, Tag,
  Cta, GhostButton, Empty, Chevron,
} from './toss/kit';

const MEAL_TYPES = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
];
const mealLabel = (t: string) => MEAL_TYPES.find(m => m.value === t)?.label || t;
// 식단 기록 화면의 끼니 칩 (프로토타입: 아침/점심/저녁)
const MEAL_PICKS = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
];
// 끼니별 아이콘 (프로토타입 sBd: 아침=bowl, 점심=salad, 그 외=soup)
const mealIcon = (t: string) => (t === 'breakfast' ? 'ti-bowl' : t === 'lunch' ? 'ti-salad' : 'ti-soup');

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Weight { id: string; weight: number; date: string; memo?: string; }

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
    const need = meals.filter(m => !m.teacherComment).length;
    return (
      <Screen>
        <BigTitle title={<>학생 식단을<br />살펴봐요</>} />
        <Scroll>
          <SectionLabel>학생 식단 · 피드백 필요 {need}개</SectionLabel>
          {meals.length === 0 ? <Empty>아직 올라온 식단이 없어요</Empty> : meals.map(m => (
            <ListRow
              key={m.id}
              left={
                <IconChip bg={m.teacherComment ? TOSS.surf : TOSS.warnBg}>
                  <i className="ti ti-tools-kitchen-2" style={{ fontSize: 21, color: m.teacherComment ? TOSS.sub : TOSS.warn }} />
                </IconChip>
              }
              title={m.description}
              sub={`${m.studentName} · ${mealLabel(m.mealType)}`}
              right={m.teacherComment
                ? <Tag bg={TOSS.successBg} fg={TOSS.success}>완료</Tag>
                : <Tag bg={TOSS.warnBg} fg={TOSS.warn}>피드백 필요</Tag>}
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
      <Scroll>
        <SectionLabel>체중 추이</SectionLabel>
        <div style={{ padding: '0 20px' }}>
          <div style={{ background: TOSS.surf, borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: TOSS.ink }}>{cur == null ? '–' : cur.toFixed(1)}</span>
              <span style={{ fontSize: 14, color: TOSS.sub }}>kg</span>
              {weights.length > 1 && (
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: diff <= 0 ? TOSS.success : TOSS.warn }}>
                  처음보다 {Math.abs(diff).toFixed(1)}kg {diff <= 0 ? '↓' : '↑'}
                </span>
              )}
            </div>
            {weights.length > 0 && (
              <div className="no-scrollbar" style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 11, color: TOSS.sub, overflowX: 'auto' }}>
                {weights.slice(-6).map((p) => (
                  <button
                    key={p.id}
                    onClick={async () => {
                      if (!window.confirm(`${(p.date || '').slice(5, 10)} ${p.weight}kg 기록을 지울까요?`)) return;
                      try { await dietApi.deleteWeight(p.id); await load(); toast.success('지웠어요'); }
                      catch (e: any) { toast.error(e.message || '지우지 못했어요'); }
                    }}
                    style={{ background: 'none', border: 'none', padding: 0, whiteSpace: 'nowrap', flexShrink: 0, fontSize: 11, color: TOSS.sub, cursor: 'pointer' }}
                  >{(p.date || '').slice(5, 10)} {p.weight}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <SectionLabel>오늘 먹은 것 · {todays.length}/3끼</SectionLabel>
        {todays.length === 0 ? <Empty>오늘 기록한 식단이 없어요</Empty> : todays.map(m => (
          <ListRow
            key={m.id}
            left={
              <IconChip bg={TOSS.blueBg}>
                <i className={`ti ${mealIcon(m.mealType)}`} style={{ fontSize: 21, color: TOSS.blue }} />
              </IconChip>
            }
            title={m.description}
            sub={mealLabel(m.mealType)}
            right={m.teacherComment ? <Tag bg={TOSS.successBg} fg={TOSS.success}>피드백</Tag> : <Chevron />}
            onClick={() => setOpenId(m.id)}
          />
        ))}
      </Scroll>
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px 16px', flexShrink: 0 }}>
        <div style={{ flex: 1 }}><GhostButton onClick={() => setScreen('addWeight')}>체중 기록</GhostButton></div>
        <button
          onClick={() => setScreen('addMeal')}
          style={{ flex: 1, background: TOSS.blue, color: '#fff', border: 'none', borderRadius: 14, padding: '14px 6px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >식단 올리기</button>
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
        <div style={{ height: 140, background: '#D9E6CC', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {meal.imageUrl
            ? <img src={resolveFileUrl(meal.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <i className="ti ti-salad" style={{ fontSize: 44, color: TOSS.success }} />}
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: TOSS.ink }}>{meal.description}</div>
          <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 6 }}>{meal.studentName} · {mealLabel(meal.mealType)}</div>
          {meal.teacherComment ? (
            <>
              <div style={{ height: 1, background: TOSS.line, margin: '16px 0' }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 10 }}>선생님 피드백</div>
              <div style={{ background: TOSS.surf, borderRadius: 13, padding: 13, fontSize: 14, lineHeight: 1.7, color: TOSS.ink }}>{meal.teacherComment}</div>
              <div style={{ height: 14 }} />
            </>
          ) : isStaff ? (
            <>
              <div style={{ height: 1, background: TOSS.line, margin: '16px 0' }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 10 }}>피드백 남기기</div>
              <textarea
                value={fb}
                onChange={e => setFb(e.target.value)}
                placeholder="조언해 주세요"
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 86, border: '1px solid #E5E8EB', borderRadius: 13, padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'none', color: TOSS.ink, outline: 'none' }}
              />
              <div style={{ height: 8 }} />
            </>
          ) : (
            <>
              <div style={{ background: TOSS.warnBg, borderRadius: 12, padding: 12, marginTop: 16, fontSize: 13, color: TOSS.warn, lineHeight: 1.6 }}>피드백을 기다리고 있어요</div>
              <div style={{ height: 14 }} />
            </>
          )}
          {isOwner && (
            <button onClick={remove} style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, fontSize: 13, fontWeight: 500, color: TOSS.warn, cursor: 'pointer' }}>이 식단 지우기</button>
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
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
        <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.4, color: TOSS.ink }}>사진 한 장이면<br />충분해요</div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pick(e.target.files?.[0] || null)} />
        <div
          onClick={() => fileRef.current?.click()}
          style={{ background: preview ? '#D9E6CC' : TOSS.surf, borderRadius: 16, height: 138, marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer', overflow: 'hidden' }}
        >
          {preview
            ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <>
                <i className="ti ti-camera" style={{ fontSize: 30, color: TOSS.faint }} />
                <span style={{ fontSize: 13, color: TOSS.sub }}>사진 찍거나 불러오기</span>
              </>}
        </div>

        <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '16px 0 8px' }}>어떤 끼니예요?</div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
          {MEAL_PICKS.map(o => {
            const on = mealType === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setMealType(o.value)}
                style={{ flex: 1, background: on ? TOSS.blueBg : '#fff', border: `1.5px solid ${on ? TOSS.blue : '#E5E8EB'}`, borderRadius: 11, padding: '10px 2px', fontSize: 14, fontWeight: 500, color: on ? TOSS.blue : TOSS.sub, cursor: 'pointer' }}
              >{o.label}</button>
            );
          })}
        </div>

        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="예: 닭가슴살 샐러드"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E5E8EB', borderRadius: 12, padding: 12, fontSize: 14, fontFamily: 'inherit', color: TOSS.ink, outline: 'none' }}
        />
      </div>
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
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
        <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.4, color: TOSS.ink }}>오늘 체중을<br />알려줘요</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, margin: '28px 0 12px' }}>
          <span style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-.03em', color: TOSS.blue }}>{w.toFixed(1)}</span>
          <span style={{ fontSize: 18, fontWeight: 500, color: TOSS.sub }}>kg</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setW(v => Math.max(35, +(v - 0.1).toFixed(1)))}
            style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid #E5E8EB', background: '#fff', fontSize: 24, color: TOSS.ink, cursor: 'pointer' }}
          >−</button>
          <input type="range" min={35} max={110} step={0.1} value={w} onChange={e => setW(Number(e.target.value))} style={{ flex: 1 }} />
          <button
            onClick={() => setW(v => Math.min(110, +(v + 0.1).toFixed(1)))}
            style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid #E5E8EB', background: '#fff', fontSize: 24, color: TOSS.ink, cursor: 'pointer' }}
          >+</button>
        </div>
      </div>
      <Cta onClick={submit} loading={busy}>체중 저장하기</Cta>
    </Screen>
  );
};
