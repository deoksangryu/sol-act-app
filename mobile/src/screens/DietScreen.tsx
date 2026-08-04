import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, IconChip, Tag,
  Cta, Empty, FlowTitle, SearchBar, FilterChips, InfoBox,
} from '../components/kit';
import { Card } from '../components/gamify';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { color, radius, space, font } from '../theme/tokens';
import { dietApi, resolveFileUrl } from '../services/api';
import { pickMedia } from '../services/upload';
import { useUploads } from '../services/UploadContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDataRefresh } from '../services/ws';
import { useDebouncedValue } from '../lib/useDebounce';
import { todayStr } from '../lib/date';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';
import type { User, DietLog, WeightLog, StudentWeightSummary } from '../types';

const PAGE = 24;
const MEAL_FILTERS = [{ key: 'all', label: '전체' }, { key: 'breakfast', label: '아침' }, { key: 'lunch', label: '점심' }, { key: 'dinner', label: '저녁' }, { key: 'snack', label: '간식' }];
const MEAL_TYPES = [{ key: 'breakfast', label: '아침' }, { key: 'lunch', label: '점심' }, { key: 'dinner', label: '저녁' }, { key: 'snack', label: '간식' }];
const MEAL_PICKS = [{ key: 'breakfast', label: '아침' }, { key: 'lunch', label: '점심' }, { key: 'dinner', label: '저녁' }];
const mealLabel = (t: string) => MEAL_TYPES.find((m) => m.key === t)?.label || t;
const mealIcon = (t: string) => (t === 'breakfast' ? 'bowl' : t === 'lunch' ? 'salad' : 'soup');
const mealTime = (m: { date?: string }) => { const s = m.date || ''; return s.length > 10 && s[10] === 'T' ? ` · ${s.slice(11, 16)}` : ''; };
const mmdd = (s?: string) => (s || '').slice(5, 10).replace('-', '/');
const bmiStr = (w?: number, h?: number) => { if (!w || !h) return ''; const m = h / 100; return (w / (m * m)).toFixed(1); };

function MealThumb({ url, icon }: { url?: string | null; icon: string }) {
  if (url) return <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: color.surf }}><Image source={{ uri: resolveFileUrl(url) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /></View>;
  return <IconChip name={icon} tint={color.blue} bg={color.blueBg} />;
}

// 미니 막대 체중 차트
function WeightBars({ points, onBar }: { points: { id?: string; weight: number; date: string }[]; onBar?: (p: any) => void }) {
  const ws = points.slice(-10);
  if (ws.length === 0) return null;
  const min = Math.min(...ws.map((p) => p.weight));
  const max = Math.max(...ws.map((p) => p.weight));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 92, marginTop: 14 }}>
      {ws.map((p, i) => {
        const h = max > min ? 20 + ((p.weight - min) / (max - min)) * 52 : 42;
        return (
          <Pressable key={p.id ?? i} onPress={onBar ? () => onBar(p) : undefined} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 9, color: color.sub }}>{p.weight}</Text>
            <View style={{ width: '100%', maxWidth: 22, height: h, borderRadius: 5, backgroundColor: color.blue, opacity: 0.85 }} />
            <Text style={{ fontSize: 9, color: color.sub }}>{mmdd(p.date)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DietScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return <DietMain user={user} />;
}

function DietMain({ user }: { user: User }) {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const [meals, setMeals] = useState<DietLog[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [studentWeights, setStudentWeights] = useState<StudentWeightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [more, setMore] = useState(false);
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const [screen, setScreen] = useState<'home' | 'addMeal' | 'addWeight'>(route.params?.openAdd ? 'addMeal' : 'home');
  const [openId, setOpenId] = useState<string | null>(null);
  const [weightOf, setWeightOf] = useState<StudentWeightSummary | null>(null);
  const [meal, setMeal] = useState('all');
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), 300);
  const filtering = meal !== 'all' || !!search;

  const mealParams = useCallback((skip: number) => ({
    ...(isStaff ? {} : { studentId: user.id }),
    ...(meal !== 'all' ? { mealType: meal } : {}),
    ...(search ? { search } : {}),
    skip, limit: PAGE,
  }), [isStaff, user.id, meal, search]);

  const loadMeals = useCallback(async () => {
    const m = await dietApi.list(mealParams(0));
    setMeals(m); setHasMore(m.length >= PAGE);
  }, [mealParams]);

  const load = useCallback(async () => {
    try {
      const [m, w, sw] = await Promise.all([
        dietApi.list(mealParams(0)),
        isStaff ? Promise.resolve([] as WeightLog[]) : dietApi.listWeight({ studentId: user.id, days: 365 }).catch(() => [] as WeightLog[]),
        isStaff ? dietApi.weightStudents().catch(() => [] as StudentWeightSummary[]) : Promise.resolve([] as StudentWeightSummary[]),
      ]);
      setMeals(m); setHasMore(m.length >= PAGE); setWeights(w); setStudentWeights(sw);
    } catch (e: any) { Alert.alert('안내', e?.message || '식단을 불러오지 못했어요'); }
  }, [mealParams, isStaff, user.id]);

  const loadMore = async () => {
    setMore(true);
    try { const m = await dietApi.list(mealParams(meals.length)); setMeals((p) => [...p, ...m]); setHasMore(m.length >= PAGE); }
    catch { /* noop */ } finally { setMore(false); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loading) loadMeals().catch(() => {}); }, [meal, search]); // eslint-disable-line react-hooks/exhaustive-deps
  useDataRefresh(['diet'], load);

  const open = openId ? meals.find((m) => m.id === openId) : null;

  if (open) return <MealDetail meal={open} user={user} isStaff={isStaff} onBack={() => setOpenId(null)} onReload={load} onDeleted={() => { setOpenId(null); load(); }} />;
  if (screen === 'addMeal') return <AddMeal userId={user.id} onBack={() => { if (route.params?.openAdd) nav.goBack(); else setScreen('home'); }} onDone={() => { if (route.params?.openAdd) nav.goBack(); else { setScreen('home'); load(); } }} />;
  if (screen === 'addWeight') return <AddWeight current={weights.length ? weights[weights.length - 1].weight : 58} onBack={() => setScreen('home')} onDone={() => { setScreen('home'); load(); }} />;
  if (weightOf) return <StaffWeightDetail s={weightOf} onBack={() => setWeightOf(null)} />;

  const renderMore = () => hasMore ? (
    <Pressable onPress={loadMore} disabled={more} style={{ alignSelf: 'center', backgroundColor: color.white, borderRadius: radius.card, paddingHorizontal: 22, paddingVertical: 11, marginVertical: 14 }}>
      <Text style={{ fontSize: 14, fontFamily: font.sb, color: color.sub }}>{more ? '불러오는 중…' : '더 보기'}</Text>
    </Pressable>
  ) : null;

  // ── 교직원 ──
  if (isStaff) {
    const need = meals.filter((m) => !m.teacherComment).length;
    return (
      <Screen edges={['top']} bg={color.bg}>
        <TopBar />
        <BigTitle>학생 식단을{'\n'}살펴봐요</BigTitle>
        <SearchBar value={query} onChangeText={setQuery} placeholder="식단·학생 검색" />
        <View style={{ marginTop: 8 }}><FilterChips items={MEAL_FILTERS as any} value={meal} onChange={setMeal} /></View>
        <Scroll contentStyle={{ paddingBottom: 40 }}>
          {loading ? <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View> : (
            <>
              {!filtering && studentWeights.length > 0 && (
                <>
                  <SectionLabel>학생 체중 · {studentWeights.length}명</SectionLabel>
                  <Card style={{ marginHorizontal: space.screenX, marginBottom: 4 }}>
                    {studentWeights.map((s) => {
                      const diff = s.latest - s.first;
                      return <ListRow key={s.studentId} showChevron={s.count <= 1}
                        left={<IconChip name="scale" tint={color.blue} bg={color.blueBg} />}
                        title={s.studentName} sub={`${s.latest.toFixed(1)}kg · ${s.count}회 기록`}
                        right={s.count > 1 ? <Tag label={`${diff <= 0 ? '▼' : '▲'} ${Math.abs(diff).toFixed(1)}kg`} tone={diff <= 0 ? 'done' : 'pending'} /> : undefined}
                        onPress={() => setWeightOf(s)} />;
                    })}
                  </Card>
                </>
              )}
              <SectionLabel>{filtering ? `검색 결과 ${meals.length}개` : `학생 식단 · 피드백 필요 ${need}개`}</SectionLabel>
              {meals.length === 0 ? <Empty>{filtering ? '조건에 맞는 식단이 없어요' : '아직 올라온 식단이 없어요'}</Empty> : (
                <Card style={{ marginHorizontal: space.screenX, marginBottom: 4 }}>
                  {meals.map((m) => (
                    <ListRow key={m.id} showChevron={false} left={<MealThumb url={m.imageUrl} icon="tools-kitchen-2" />} title={m.description}
                      sub={`${m.studentName} · ${mealLabel(m.mealType)}${mealTime(m)}`}
                      right={m.teacherComment ? <Tag label="완료" tone="done" /> : <Tag label="피드백 필요" tone="pending" />}
                      onPress={() => setOpenId(m.id)} />
                  ))}
                </Card>
              )}
              {renderMore()}
            </>
          )}
        </Scroll>
      </Screen>
    );
  }

  // ── 학생 ──
  const cur = weights.length ? weights[weights.length - 1].weight : null;
  const diff = weights.length > 1 ? weights[weights.length - 1].weight - weights[0].weight : 0;
  const todays = meals.filter((m) => (m.date || '').slice(0, 10) === todayStr());
  const list = filtering ? meals : todays;
  const last = weights[weights.length - 1];
  const infoParts: string[] = [];
  if (last?.bodyFat != null) infoParts.push(`체지방 ${last.bodyFat}%`);
  if (last?.muscleMass != null) infoParts.push(`근육 ${last.muscleMass}kg`);
  if (last?.visceralFat != null) infoParts.push(`내장지방 ${last.visceralFat}`);
  if (user.height) infoParts.push(`키 ${user.height}cm`);
  const bmi = bmiStr(cur ?? undefined, user.height);
  if (bmi) infoParts.push(`BMI ${bmi}`);

  const deleteWeight = (p: WeightLog) => {
    Alert.alert('체중 삭제', `${mmdd(p.date)} ${p.weight}kg 기록을 지울까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { try { await dietApi.deleteWeight(p.id); load(); } catch (e: any) { Alert.alert('실패', e?.message || '지우지 못했어요'); } } },
    ]);
  };

  return (
    <Screen edges={['top']} bg={color.bg}>
      <TopBar />
      <BigTitle>오늘도 잘{'\n'}챙기고 있어요</BigTitle>
      <SearchBar value={query} onChangeText={setQuery} placeholder="식단 검색" />
      <View style={{ marginTop: 8 }}><FilterChips items={MEAL_FILTERS as any} value={meal} onChange={setMeal} /></View>
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        {loading ? <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View> : (
          <>
            {!filtering && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.m, color: color.sub, flex: 1 }}>체중 추이</Text>
                  <Pressable onPress={() => setScreen('addWeight')} hitSlop={6}><Text style={{ fontSize: 13, fontFamily: font.sb, color: color.blue }}>+ 기록</Text></Pressable>
                </View>
                <Card style={{ marginHorizontal: space.screenX, padding: 14 }}>
                  {cur == null ? (
                    <Pressable onPress={() => setScreen('addWeight')} style={{ paddingVertical: 6 }}>
                      <Text style={{ fontSize: 14.5, fontFamily: font.sb, color: color.ink }}>아직 체중 기록이 없어요</Text>
                      <Text style={{ fontSize: 12.5, fontFamily: font.sb, color: color.blue, marginTop: 5 }}>+ 첫 체중 기록하기</Text>
                    </Pressable>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Text style={{ fontSize: 30, fontFamily: font.b, letterSpacing: -0.6, color: color.ink }}>{cur.toFixed(1)}</Text>
                        <Text style={{ fontSize: 14, color: color.sub }}>kg</Text>
                        {weights.length > 1 && <Text style={{ marginLeft: 'auto', fontSize: 12, fontFamily: font.m, color: diff <= 0 ? color.success : color.warn }}>처음보다 {Math.abs(diff).toFixed(1)}kg {diff <= 0 ? '↓' : '↑'}</Text>}
                      </View>
                      {infoParts.length > 0 && <Text style={{ fontSize: 12, color: color.sub, marginTop: 8, lineHeight: 19 }}>{infoParts.join(' · ')}</Text>}
                      <WeightBars points={weights} onBar={deleteWeight} />
                      {weights.length > 1 && <Text style={{ fontSize: 11, color: color.sub, marginTop: 8, textAlign: 'center' }}>최근 {Math.min(weights.length, 10)}개 · 막대를 누르면 삭제돼요</Text>}
                    </>
                  )}
                </Card>
              </>
            )}

            <SectionLabel>{filtering ? `검색 결과 ${meals.length}개` : `오늘 먹은 것 · ${todays.length}/3끼`}</SectionLabel>
            {list.length === 0 ? <Empty>{filtering ? '조건에 맞는 식단이 없어요' : '오늘 기록한 식단이 없어요'}</Empty> : (
              <Card style={{ marginHorizontal: space.screenX, marginBottom: 4 }}>
                {list.map((m) => (
                  <ListRow key={m.id} showChevron={false} left={<MealThumb url={m.imageUrl} icon={mealIcon(m.mealType)} />} title={m.description}
                    sub={filtering ? `${mmdd(m.date)} · ${mealLabel(m.mealType)}` : `${mealLabel(m.mealType)}${mealTime(m)}`}
                    right={m.teacherComment ? <Tag label="피드백" tone="done" /> : undefined}
                    onPress={() => setOpenId(m.id)} />
                ))}
              </Card>
            )}
            {filtering && renderMore()}
          </>
        )}
      </Scroll>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}><Cta label="식단 올리기" onPress={() => setScreen('addMeal')} /></View>
    </Screen>
  );
}

function StaffWeightDetail({ s, onBack }: { s: StudentWeightSummary; onBack: () => void }) {
  const diff = s.latest - s.first;
  const parts: string[] = [];
  if (s.bodyFat != null) parts.push(`체지방 ${s.bodyFat}%`);
  if (s.muscleMass != null) parts.push(`근육 ${s.muscleMass}kg`);
  if (s.visceralFat != null) parts.push(`내장지방 ${s.visceralFat}`);
  if (s.height) parts.push(`키 ${s.height}cm`);
  const bmi = bmiStr(s.latest, s.height ?? undefined);
  if (bmi) parts.push(`BMI ${bmi}`);
  return (
    <Screen edges={['top']}>
      <BackHeader title={`${s.studentName} 체중`} onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX }}>
        <View style={{ backgroundColor: color.surf, borderRadius: radius.button, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontSize: 32, fontFamily: font.b, letterSpacing: -0.6, color: color.ink }}>{s.latest.toFixed(1)}</Text>
            <Text style={{ fontSize: 14, color: color.sub }}>kg</Text>
            {s.count > 1 && <Text style={{ marginLeft: 'auto', fontSize: 13, fontFamily: font.m, color: diff <= 0 ? color.success : color.warn }}>처음보다 {Math.abs(diff).toFixed(1)}kg {diff <= 0 ? '↓' : '↑'}</Text>}
          </View>
          {parts.length > 0 && <Text style={{ fontSize: 12, color: color.sub, marginTop: 8, lineHeight: 19 }}>{parts.join(' · ')}</Text>}
          <WeightBars points={s.points || []} />
        </View>
        <Text style={{ fontSize: 12, color: color.sub, marginTop: 10 }}>최근 {(s.points || []).length}개 기록 · 마지막 {mmdd(s.updatedAt)}</Text>
      </Scroll>
    </Screen>
  );
}

function MealDetail({ meal, user, isStaff, onBack, onReload, onDeleted }: { meal: DietLog; user: User; isStaff: boolean; onBack: () => void; onReload: () => void | Promise<void>; onDeleted: () => void }) {
  const { upload } = useUploads();
  const isOwner = !isStaff && meal.studentId === user.id;
  const [fb, setFb] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(meal.description);
  const [mType, setMType] = useState<string>(meal.mealType);
  const [newImg, setNewImg] = useState<string | null>(null); // uploaded url

  const send = async () => {
    if (!fb.trim()) return;
    setBusy(true);
    try { await dietApi.update(meal.id, { teacherComment: fb.trim() }); await onReload(); onBack(); }
    catch (e: any) { Alert.alert('실패', e?.message || '보내지 못했어요'); } finally { setBusy(false); }
  };
  const remove = () => {
    Alert.alert('식단 삭제', '이 식단 기록을 지울까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { try { await dietApi.delete(meal.id); onDeleted(); } catch (e: any) { Alert.alert('실패', e?.message || '지우지 못했어요'); } } },
    ]);
  };
  const changePhoto = async () => {
    try { const media = await pickMedia('image'); if (!media) return; const r = await upload('식단 사진', media, { subfolder: 'diet' }); setNewImg(r.url); }
    catch (e: any) { Alert.alert('실패', e?.message || '사진을 올리지 못했어요'); }
  };
  const saveEdit = async () => {
    if (!desc.trim()) return;
    setBusy(true);
    try { await dietApi.update(meal.id, { description: desc.trim(), mealType: mType as any, ...(newImg ? { imageUrl: newImg } : {}) }); await onReload(); onBack(); }
    catch (e: any) { Alert.alert('실패', e?.message || '수정하지 못했어요'); } finally { setBusy(false); }
  };

  const imgUrl = newImg || (meal.imageUrl ? resolveFileUrl(meal.imageUrl) : null);

  return (
    <Screen edges={['top']}>
      <BackHeader title="식단" onBack={onBack} right={isOwner ? <Pressable onPress={() => { if (editing) { setDesc(meal.description); setMType(meal.mealType); setNewImg(null); } setEditing((e) => !e); }} hitSlop={6}><Text style={{ fontSize: 13, fontFamily: font.sb, color: color.blue }}>{editing ? '취소' : '수정'}</Text></Pressable> : undefined} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
      <Scroll contentStyle={{ paddingBottom: 24 }}>
        <Pressable onPress={editing ? changePhoto : undefined} style={{ backgroundColor: color.dietBg, minHeight: 200, alignItems: 'center', justifyContent: 'center' }}>
          {imgUrl ? <Image source={{ uri: imgUrl }} style={{ width: '100%', height: 260 }} resizeMode="contain" /> : <Icon name="salad" size={44} color={color.success} />}
          {editing && (
            <View style={{ position: 'absolute', bottom: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="camera" size={15} color={color.white} /><Text style={{ color: color.white, fontSize: 13, fontFamily: font.sb }}>사진 바꾸기</Text>
            </View>
          )}
        </Pressable>

        <View style={{ paddingHorizontal: space.screenX, paddingTop: 16 }}>
          {editing ? (
            <>
              <TextInput value={desc} onChangeText={setDesc} placeholder="예: 닭가슴살 샐러드" placeholderTextColor={color.faint} style={inp} />
              <Text style={{ fontSize: 13, fontFamily: font.m, color: color.sub, marginTop: 14, marginBottom: 8 }}>끼니</Text>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {MEAL_TYPES.map((o) => { const on = mType === o.key; return (
                  <Pressable key={o.key} onPress={() => setMType(o.key)} style={{ flex: 1, borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: 11, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontFamily: font.m, color: on ? color.blue : color.sub }}>{o.label}</Text>
                  </Pressable>
                ); })}
              </View>
              <Pressable onPress={remove} style={{ marginTop: 18 }} hitSlop={6}><Text style={{ fontSize: 13, fontFamily: font.m, color: color.warn }}>이 식단 지우기</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 19, fontFamily: font.b, color: color.ink }}>{meal.description}</Text>
              <Text style={{ fontSize: 13, color: color.sub, marginTop: 6 }}>{meal.studentName} · {mealLabel(meal.mealType)}{mealTime(meal)}</Text>
              {meal.teacherComment ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.m, color: color.sub, marginBottom: 10 }}>선생님 피드백</Text>
                  <View style={{ backgroundColor: color.surf, borderRadius: radius.chip, padding: 13 }}><Text style={{ fontSize: 14, lineHeight: 24, color: color.ink }}>{meal.teacherComment}</Text></View>
                </View>
              ) : isStaff ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.m, color: color.sub, marginBottom: 10 }}>피드백 남기기</Text>
                  <TextInput value={fb} onChangeText={setFb} placeholder="조언해 주세요" placeholderTextColor={color.faint} multiline style={[inp, { minHeight: 86, textAlignVertical: 'top' }]} />
                </View>
              ) : (
                <View style={{ marginTop: 16 }}><InfoBox tone="info">피드백을 기다리고 있어요</InfoBox></View>
              )}
            </>
          )}
        </View>
      </Scroll>
      {editing ? (
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}><Cta label="수정 저장하기" onPress={saveEdit} disabled={!desc.trim()} loading={busy} /></View>
      ) : (!meal.teacherComment && isStaff && (
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}><Cta label="피드백 보내기" onPress={send} disabled={!fb.trim()} loading={busy} /></View>
      ))}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AddMeal({ userId, onBack, onDone }: { userId: string; onBack: () => void; onDone: () => void }) {
  const { upload } = useUploads();
  const [mealType, setMealType] = useState('dinner');
  const [desc, setDesc] = useState('');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setPicking(true);
    try { const media = await pickMedia('image'); if (media) { const r = await upload('식단 사진', media, { subfolder: 'diet' }); setImgUrl(r.url); } }
    catch (e: any) { Alert.alert('실패', e?.message || '사진을 올리지 못했어요'); } finally { setPicking(false); }
  };
  const submit = async () => {
    if (!desc.trim()) return;
    setBusy(true);
    try { await dietApi.create({ studentId: userId, mealType: mealType as any, description: desc.trim(), date: todayStr(), ...(imgUrl ? { imageUrl: imgUrl } : {}) }); onDone(); }
    catch (e: any) { Alert.alert('실패', e?.message || '올리지 못했어요'); } finally { setBusy(false); }
  };
  return (
    <Screen edges={['top']}>
      <BackHeader title="식단 기록" onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX, paddingBottom: 24 }}>
        <FlowTitle>사진 한 장이면{'\n'}충분해요</FlowTitle>
        <Pressable onPress={pick} disabled={picking} style={{ backgroundColor: imgUrl ? color.dietBg : color.surf, borderRadius: 16, height: 138, marginTop: 16, alignItems: 'center', justifyContent: 'center', gap: 7, overflow: 'hidden' }}>
          {imgUrl ? <Image source={{ uri: resolveFileUrl(imgUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : picking ? <ActivityIndicator color={color.sub} /> : (
            <><Icon name="camera" size={30} color={color.faint} /><Text style={{ fontSize: 13, color: color.sub }}>사진 찍거나 불러오기</Text></>
          )}
        </Pressable>
        <Text style={{ fontSize: 13, fontFamily: font.m, color: color.sub, marginTop: 16, marginBottom: 8 }}>어떤 끼니예요?</Text>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {MEAL_PICKS.map((o) => { const on = mealType === o.key; return (
            <Pressable key={o.key} onPress={() => setMealType(o.key)} style={{ flex: 1, borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: 11, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: font.m, color: on ? color.blue : color.sub }}>{o.label}</Text>
            </Pressable>
          ); })}
        </View>
        <TextInput value={desc} onChangeText={setDesc} placeholder="예: 닭가슴살 샐러드" placeholderTextColor={color.faint} style={[inp, { marginTop: 14 }]} />
      </Scroll>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}><Cta label="식단 올리기" onPress={submit} disabled={!desc.trim()} loading={busy} /></View>
    </Screen>
  );
}

function AddWeight({ current, onBack, onDone }: { current: number; onBack: () => void; onDone: () => void }) {
  const [w, setW] = useState(current);
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [visceral, setVisceral] = useState('');
  const [busy, setBusy] = useState(false);
  const num = (s: string) => { const n = parseFloat(s); return s.trim() && !isNaN(n) ? n : undefined; };
  const clamp = (v: number) => Math.min(110, Math.max(35, +v.toFixed(1)));
  const submit = async () => {
    setBusy(true);
    try {
      await dietApi.createWeight({ weight: Number(w.toFixed(1)), date: todayStr(), ...(num(bodyFat) != null ? { bodyFat: num(bodyFat) } : {}), ...(num(muscle) != null ? { muscleMass: num(muscle) } : {}), ...(num(visceral) != null ? { visceralFat: Math.round(num(visceral)!) } : {}) });
      onDone();
    } catch (e: any) { Alert.alert('실패', e?.message || '기록하지 못했어요'); } finally { setBusy(false); }
  };
  const stepBtn = (label: string, d: number) => (
    <Pressable onPress={() => setW((v) => clamp(v + d))} style={{ width: 52, height: 44, borderRadius: 12, borderWidth: 1, borderColor: color.inputLine, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 15, fontFamily: font.sb, color: color.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <Screen edges={['top']}>
      <BackHeader title="체중 기록" onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX, paddingBottom: 24 }}>
        <FlowTitle>오늘 체중을{'\n'}알려줘요</FlowTitle>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 24, marginBottom: 16 }}>
          <Text style={{ fontSize: 46, fontFamily: font.b, letterSpacing: -1, color: color.blue }}>{w.toFixed(1)}</Text>
          <Text style={{ fontSize: 18, fontFamily: font.m, color: color.sub }}>kg</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {stepBtn('−1', -1)}{stepBtn('−0.1', -0.1)}{stepBtn('+0.1', 0.1)}{stepBtn('+1', 1)}
        </View>
        <Text style={{ fontSize: 13, fontFamily: font.m, color: color.sub, marginTop: 28, marginBottom: 8 }}>인바디 측정값 (선택)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([{ label: '체지방률 %', v: bodyFat, set: setBodyFat, ph: '18.5' }, { label: '근육량 kg', v: muscle, set: setMuscle, ph: '32.0' }, { label: '내장지방', v: visceral, set: setVisceral, ph: '5' }] as const).map((f) => (
            <View key={f.label} style={{ flex: 1 }}>
              <TextInput value={f.v} onChangeText={f.set} placeholder={f.ph} placeholderTextColor={color.faint} keyboardType="decimal-pad" style={[inp, { textAlign: 'center', paddingHorizontal: 8 }]} />
              <Text style={{ fontSize: 11, color: color.sub, textAlign: 'center', marginTop: 4 }}>{f.label}</Text>
            </View>
          ))}
        </View>
      </Scroll>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}><Cta label="체중 저장하기" onPress={submit} loading={busy} /></View>
    </Screen>
  );
}

const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: color.ink } as const;
