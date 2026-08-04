import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, Tag,
  Cta, Empty, InfoBox, FlowTitle, SearchBar, FilterChips, Divider,
} from '../components/kit';
import { Card } from '../components/gamify';
import { VideoUploadForm } from '../components/VideoUploadForm';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { color, radius, space, font } from '../theme/tokens';
import { portfolioApi, practiceApi, resolveFileUrl } from '../services/api';
import { useDataRefresh } from '../services/ws';
import { useDebouncedValue } from '../lib/useDebounce';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';
import type { User, PortfolioItem, FeedCard, PracticeScriptView } from '../types';

const PAGE = 24;
const UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;

const VIDEO_FILTERS = [
  { key: 'all', label: '전체' }, { key: 'acting', label: '자유연기' }, { key: 'monologue', label: '독백' },
  { key: 'musical', label: '뮤지컬 넘버' }, { key: 'dance', label: '자유무용' }, { key: 'basics', label: '발성 연습' },
];
const VIDEO_CATS = [
  { key: 'acting', label: '자유연기' }, { key: 'monologue', label: '독백' }, { key: 'musical', label: '뮤지컬 넘버' },
  { key: 'dance', label: '자유무용' }, { key: 'basics', label: '발성 연습' },
];
const catLabel = (v: string) => (v === 'scripted' ? '제시대사 연기' : (VIDEO_CATS.find((c) => c.key === v)?.label || v));
const fmtDur = (s?: number) => (s && s > 0 ? ` · ${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
const coverThumb = (v: PortfolioItem) => v.thumbnailUrl || v.videos?.find((x: any) => x.thumbnailUrl)?.thumbnailUrl;
const mmdd = (s?: string) => (s || '').slice(5, 10);

// ── 날짜별 그룹핑(한국 시간 기준) ──
const pad2 = (n: number) => String(n).padStart(2, '0');
const parseUtcMs = (s?: string) => (!s ? NaN : Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s.replace(' ', 'T') + 'Z'));
const kstDayKey = (s?: string): string => {
  const t = parseUtcMs(s);
  if (isNaN(t)) return '';
  const d = new Date(t + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};
const kstTodayKey = (): string => { const d = new Date(Date.now() + 9 * 3600 * 1000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (key: string): string => {
  if (!key) return '날짜 미상';
  const today = kstTodayKey();
  const [y, m, d] = key.split('-').map(Number);
  // 오늘/어제 상대 라벨
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const keyMs = Date.parse(key + 'T00:00:00Z');
  const diffDays = Math.round((todayMs - keyMs) / 86400000);
  const wd = WEEKDAYS[new Date(keyMs).getUTCDay()];
  const base = `${m}월 ${d}일 (${wd})`;
  if (diffDays === 0) return `오늘 · ${base}`;
  if (diffDays === 1) return `어제 · ${base}`;
  return base;
};
// 최신순으로 들어온 카드 배열을 KST 날짜별 그룹으로(순서 유지)
function groupByDate(cards: FeedCard[]): Array<{ key: string; label: string; cards: FeedCard[] }> {
  const groups: Array<{ key: string; label: string; cards: FeedCard[] }> = [];
  const idx: Record<string, number> = {};
  for (const c of cards) {
    const key = kstDayKey(c.date);
    if (idx[key] == null) { idx[key] = groups.length; groups.push({ key, label: dayLabel(key), cards: [] }); }
    groups[idx[key]].cards.push(c);
  }
  return groups;
}

type UpState = 'ready' | 'uploading' | 'failed';
const hasVideo = (v: PortfolioItem) => !!v.videoUrl || !!(v.videos && v.videos.length);
const ageMs = (v: PortfolioItem) => {
  const s = v.date || '';
  const t = Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
  return isFinite(t) ? Date.now() - t : 0;
};
const classify = (v: PortfolioItem): UpState =>
  v.uploadStatus ? v.uploadStatus : (hasVideo(v) ? 'ready' : (ageMs(v) < UPLOAD_TIMEOUT_MS ? 'uploading' : 'failed'));

function StateTag({ v, staff }: { v: PortfolioItem; staff: boolean }) {
  const s = classify(v);
  if (s === 'failed') return <Tag label="업로드 실패" tone="overdue" />;
  if (s === 'uploading') return <Tag label="업로드 중" tone="pending" />;
  const hasC = (v.comments?.length ?? 0) > 0;
  if (staff) return hasC ? <Tag label="완료" tone="done" /> : <Tag label="피드백 필요" tone="pending" />;
  return hasC ? <Tag label="피드백 완료" tone="done" /> : <Tag label="피드백 대기" tone="pending" />;
}
function CardTag({ c, staff }: { c: FeedCard; staff: boolean }) {
  const s = c.uploadStatus || 'ready';
  if (s === 'failed') return <Tag label="업로드 실패" tone="overdue" />;
  if (s === 'uploading') return <Tag label="업로드 중" tone="pending" />;
  if (c.pendingFeedback > 0) return <Tag label={staff ? (c.kind === 'group' ? `피드백 ${c.pendingFeedback}개 필요` : '피드백 필요') : '피드백 대기'} tone="pending" />;
  return <Tag label={staff ? '완료' : '피드백 완료'} tone="done" />;
}

function PlayThumb({ thumb, status = 'ready' }: { thumb?: string; status?: UpState }) {
  const iconName = status === 'failed' ? 'alert-triangle' : 'player-play';
  const iconColor = status === 'failed' ? color.warn : thumb ? color.white : color.sub;
  return (
    <View style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: thumb ? '#000' : color.surf, alignItems: 'center', justifyContent: 'center' }}>
      {thumb && <Image source={{ uri: resolveFileUrl(thumb) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />}
      {status === 'uploading' ? <ActivityIndicator color={thumb ? color.white : color.sub} /> : <Icon name={iconName} size={thumb ? 18 : 20} color={iconColor} />}
    </View>
  );
}

// ── 피드 ──
export function VideoScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return <VideoFeed user={user} />;
}

function VideoFeed({ user }: { user: User }) {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [stats, setStats] = useState<{ month: number; byCat: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [more, setMore] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  // 인박스에서 특정 학생을 눌러 들어오면 그 학생 이름을 미리 검색어로 넣어 바로 찾게 한다.
  const [query, setQuery] = useState<string>(route.params?.q ?? '');
  const search = useDebouncedValue(query.trim(), 300);
  const [openItem, setOpenItem] = useState<PortfolioItem | null>(null);
  const [openGroup, setOpenGroup] = useState<FeedCard | null>(null);
  const [uploading, setUploading] = useState(!!route.params?.openUpload);
  const cat = catFilter;

  // 교직원이 특정 학생을 지정해 들어오면 그 학생으로 서버 필터(백엔드 feed는 이름 검색을 지원 안 함 → student_id로).
  const focusStudentId: string | undefined = isStaff ? route.params?.studentId : undefined;
  const feedParams = useCallback((skip: number) => ({
    ...(isStaff ? (focusStudentId ? { studentId: focusStudentId } : {}) : { studentId: user.id }),
    ...(cat !== 'all' ? { category: cat } : {}),
    ...(search ? { search } : {}),
    skip, limit: PAGE,
  }), [isStaff, focusStudentId, user.id, cat, search]);

  const load = useCallback(async () => {
    try {
      const data = await portfolioApi.listFeed(feedParams(0));
      setCards(data); setHasMore(data.length >= PAGE);
    } catch (e: any) { Alert.alert('안내', e?.message || '영상을 불러오지 못했어요'); }
  }, [feedParams]);

  const loadMore = async () => {
    setMore(true);
    try {
      const data = await portfolioApi.listFeed(feedParams(cards.length));
      setCards((prev) => [...prev, ...data]); setHasMore(data.length >= PAGE);
    } catch { /* noop */ } finally { setMore(false); }
  };

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);
  useDataRefresh(['portfolios'], load);

  // 학생: 이번 달 몇 개·어떤 종류를 올렸는지 요약(한국 날짜 기준). 클라이언트 집계 — 백엔드 무변경.
  useEffect(() => {
    if (isStaff) return;
    const parseMs = (s?: string) => (!s ? NaN : Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s.replace(' ', 'T') + 'Z'));
    const kstYM = (s?: string) => { const t = parseMs(s); if (isNaN(t)) return ''; const d = new Date(t + 9 * 3600 * 1000); return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; };
    const nowYM = kstYM(new Date().toISOString());
    portfolioApi.list({ studentId: user.id, limit: 500 }).then((items) => {
      let month = 0; const byCat: Record<string, number> = {};
      for (const it of items) {
        if (kstYM(it.date) === nowYM) { month += 1; byCat[it.category] = (byCat[it.category] || 0) + 1; }
      }
      setStats({ month, byCat });
    }).catch(() => {});
  }, [isStaff, user.id]);

  if (openItem) return <VideoDetail item={openItem} user={user} isStaff={isStaff} onBack={() => setOpenItem(null)} onReload={load}
    onDeleted={() => { setOpenItem(null); load(); }}
    onReupload={async () => { try { await portfolioApi.delete(openItem.id); } catch { /* ignore */ } setOpenItem(null); setUploading(true); }} />;
  if (openGroup) return <GroupDetail card={openGroup} user={user} isStaff={isStaff} cat={cat} search={search} onBack={() => setOpenGroup(null)} />;
  if (uploading) return <UploadScreen
    onBack={() => { if (route.params?.openUpload) nav.goBack(); else setUploading(false); }}
    onDone={() => { if (route.params?.openUpload) nav.goBack(); else { setUploading(false); load(); } }} />;

  const cardSub = (c: FeedCard) => {
    // 날짜는 섹션 헤더에서 보여주므로 여기선 학생명(교직원)·개수/카테고리만.
    const count = c.kind === 'group' ? `영상 ${c.count}개` : (c.count > 1 ? `영상 ${c.count}개` : (c.portfolio ? catLabel(c.portfolio.category) : ''));
    return [isStaff ? c.studentName : '', count].filter(Boolean).join(' · ');
  };
  const openCard = (c: FeedCard) => { if (c.kind === 'group') setOpenGroup(c); else if (c.portfolio) setOpenItem(c.portfolio); };

  return (
    <Screen edges={['top']} bg={color.bg}>
      <TopBar />
      <BigTitle>{isStaff ? '학생 영상에\n피드백을 남겨요' : '연습 영상을\n모아봐요'}</BigTitle>
      <SearchBar value={query} onChangeText={setQuery} placeholder={isStaff ? '제목·학생 검색' : '영상 제목 검색'} />
      <View style={{ marginTop: 8 }}>
        <FilterChips items={VIDEO_FILTERS as any} value={catFilter} onChange={setCatFilter} />
      </View>
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        {!isStaff && stats && stats.month > 0 && (
          <Card style={{ marginHorizontal: space.screenX, marginTop: 10, marginBottom: 4, padding: 14 }}>
            <Text style={{ fontSize: 13.5, fontFamily: font.b, color: color.ink }}>이번 달 {stats.month}개 올렸어요 🎬</Text>
            <Text style={{ fontSize: 12.5, color: color.sub, marginTop: 4 }}>
              {Object.entries(stats.byCat).map(([k, v]) => `${catLabel(k)} ${v}`).join(' · ')}
            </Text>
          </Card>
        )}
        {loading ? <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
          : cards.length === 0 ? <Empty>{isStaff ? '아직 올라온 영상이 없어요' : '아직 올린 영상이 없어요'}</Empty>
            : groupByDate(cards).map((g) => (
                <React.Fragment key={g.key || 'unknown'}>
                  <SectionLabel>{g.label} · {g.cards.length}개</SectionLabel>
                  <Card style={{ marginHorizontal: space.screenX, marginBottom: 4 }}>
                    {g.cards.map((c) => <ListRow key={c.key} showChevron={false} left={<PlayThumb thumb={c.coverThumbnail} status={c.uploadStatus || 'ready'} />} title={c.title} sub={cardSub(c)} right={<CardTag c={c} staff={isStaff} />} onPress={() => openCard(c)} />)}
                  </Card>
                </React.Fragment>
              ))}
        {hasMore && (
          <Pressable onPress={loadMore} disabled={more} style={{ alignSelf: 'center', backgroundColor: color.white, borderRadius: radius.card, paddingHorizontal: 22, paddingVertical: 11, marginVertical: 14 }}>
            <Text style={{ fontSize: 14, fontFamily: font.sb, color: color.sub }}>{more ? '불러오는 중…' : '더 보기'}</Text>
          </Pressable>
        )}
      </Scroll>
      {!isStaff && <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}><Cta label="새 영상 올리기" onPress={() => setUploading(true)} /></View>}
    </Screen>
  );
}

// ── 그룹 상세 ──
function GroupDetail({ card, user, isStaff, cat, search, onBack }: { card: FeedCard; user: User; isStaff: boolean; cat: string; search: string; onBack: () => void }) {
  const [members, setMembers] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<PortfolioItem | null>(null);
  const load = useCallback(async () => {
    try { setMembers(await portfolioApi.list({ practiceGroup: card.title, studentId: card.studentId, ...(cat !== 'all' ? { category: cat } : {}), ...(search ? { search } : {}), limit: 200 })); }
    catch { /* noop */ }
  }, [card.title, card.studentId, cat, search]);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  useDataRefresh(['portfolios'], load);

  if (sel) return <VideoDetail item={sel} user={user} isStaff={isStaff} onBack={() => setSel(null)} onReload={load} onDeleted={() => { setSel(null); load(); }} />;
  return (
    <Screen edges={['top']}>
      <BackHeader title={card.title} onBack={onBack} />
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        {loading ? <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
          : members.length === 0 ? <Empty>영상이 없어요</Empty> : (
            <>
              <SectionLabel>영상 {members.length}개{isStaff ? ` · ${card.studentName}` : ''}</SectionLabel>
              {members.map((v) => <ListRow key={v.id} showChevron={false} left={<PlayThumb thumb={coverThumb(v)} status={classify(v)} />} title={v.title} sub={`${catLabel(v.category)} · ${mmdd(v.date)}${fmtDur(v.videoDuration)}`} right={<StateTag v={v} staff={isStaff} />} onPress={() => setSel(v)} />)}
            </>
          )}
      </Scroll>
    </Screen>
  );
}

// ── 영상 상세 (플레이어 + 피드백) ──
function VideoDetail({ item, user, isStaff, onBack, onReload, onDeleted, onReupload }: {
  item: PortfolioItem; user: User; isStaff: boolean; onBack: () => void; onReload: () => void | Promise<void>; onDeleted: () => void; onReupload?: () => void;
}) {
  const isOwner = !isStaff && item.studentId === user.id;
  const state = classify(item);
  const comments = item.comments || [];
  const [fb, setFb] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [desc, setDesc] = useState(item.description || '');
  const [script, setScript] = useState<PracticeScriptView | null>(null);

  const clips = [
    ...(item.videoUrl ? [{ id: 'cover', videoUrl: item.videoUrl, thumbnailUrl: item.thumbnailUrl, cover: true }] : []),
    ...((item.videos || []).map((v: any) => ({ id: v.id, videoUrl: v.videoUrl, thumbnailUrl: v.thumbnailUrl, cover: false }))),
  ];
  const [active, setActive] = useState(0);
  const cur = clips[Math.min(active, Math.max(0, clips.length - 1))];
  const player = useVideoPlayer(cur ? resolveFileUrl(cur.videoUrl) : null, (p) => { p.loop = false; });

  useEffect(() => {
    if (cur && player) { try { player.replace(resolveFileUrl(cur.videoUrl)); } catch { /* noop */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (item.practiceScriptId) practiceApi.getScript(item.practiceScriptId).then(setScript).catch(() => {});
    else setScript(null);
  }, [item.practiceScriptId]);

  const send = async () => {
    if (!fb.trim()) return;
    setBusy(true);
    try { await portfolioApi.addComment(item.id, fb.trim()); setFb(''); await onReload(); }
    catch (e: any) { Alert.alert('실패', e?.message || '보내지 못했어요'); } finally { setBusy(false); }
  };
  const saveEdit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try { await portfolioApi.update(item.id, { title: title.trim(), description: desc.trim() }); setEditing(false); await onReload(); }
    catch (e: any) { Alert.alert('실패', e?.message || '수정하지 못했어요'); } finally { setBusy(false); }
  };
  const remove = () => {
    Alert.alert('영상 삭제', '이 영상을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { try { await portfolioApi.delete(item.id); onDeleted(); } catch (e: any) { Alert.alert('실패', e?.message || '삭제하지 못했어요'); } } },
    ]);
  };
  const removeClip = (videoId: string) => {
    Alert.alert('영상 삭제', '이 영상을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { try { await portfolioApi.deleteVideo(item.id, videoId); setActive(0); await onReload(); } catch (e: any) { Alert.alert('실패', e?.message || '삭제하지 못했어요'); } } },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <BackHeader title="영상" onBack={onBack} right={isOwner ? <Pressable onPress={() => setEditing((v) => !v)} hitSlop={6}><Text style={{ fontSize: 13, fontFamily: font.sb, color: color.blue }}>{editing ? '취소' : '수정'}</Text></Pressable> : undefined} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
      <Scroll contentStyle={{ paddingBottom: 24 }}>
        {/* 플레이어 */}
        <View style={{ backgroundColor: color.ink, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          {cur ? (
            <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />
          ) : state === 'failed' ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
              <Icon name="alert-triangle" size={30} color={color.warn} />
              <Text style={{ color: color.white, fontSize: 14, fontFamily: font.sb, marginTop: 8 }}>업로드가 완료되지 않았어요</Text>
              <Text style={{ color: color.white, fontSize: 12, opacity: 0.7, marginTop: 4 }}>{isOwner ? '다시 올리거나 삭제할 수 있어요' : '학생에게 다시 업로드를 요청하세요'}</Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color={color.white} />
              <Text style={{ color: color.white, fontSize: 13, opacity: 0.85, marginTop: 8 }}>영상을 올리는 중이에요</Text>
            </View>
          )}
        </View>

        {clips.length > 1 && (
          <Scroll style={{ maxHeight: 84 }} contentStyle={{ flexDirection: 'row', gap: 8, paddingHorizontal: space.screenX, paddingTop: 10 }}>
            {clips.map((c, i) => (
              <Pressable key={c.id} onPress={() => setActive(i)} style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: i === active ? color.blue : 'transparent', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                {c.thumbnailUrl ? <Image source={{ uri: resolveFileUrl(c.thumbnailUrl) }} style={{ width: '100%', height: '100%' }} /> : <Icon name="player-play" size={18} color={i === active ? color.blue : color.sub} />}
                {isOwner && !c.cover && (
                  <Pressable onPress={() => removeClip(c.id)} style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: color.warn, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.white }}>
                    <Icon name="x" size={10} color={color.white} />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </Scroll>
        )}

        <View style={{ paddingHorizontal: space.screenX, paddingTop: 16 }}>
          {editing ? (
            <View style={{ gap: 8 }}>
              <TextInput value={title} onChangeText={setTitle} placeholder="제목" placeholderTextColor={color.faint} style={inp} />
              <TextInput value={desc} onChangeText={setDesc} placeholder="설명" placeholderTextColor={color.faint} style={inp} />
              <Cta label="저장하기" onPress={saveEdit} disabled={!title.trim()} loading={busy} />
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 19, fontFamily: font.b, color: color.ink }}>{item.title}</Text>
              <Text style={{ fontSize: 13, color: color.sub, marginTop: 6 }}>{item.studentName} · {catLabel(item.category)} · {mmdd(item.date)}</Text>
              {!!item.description && item.description !== item.title && <Text style={{ fontSize: 14, color: color.ink, lineHeight: 24, marginTop: 12 }}>{item.description}</Text>}
            </>
          )}

          {!!script && (
            <View style={{ marginTop: 14, backgroundColor: color.surf, borderRadius: radius.chip, padding: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <Tag label={script.type} tone="todo" />
                <Text style={{ fontSize: 12, color: color.sub }}>연기한 제시대사</Text>
              </View>
              {script.script.map((ln, i) => (
                <Text key={i} style={{ fontSize: 14, lineHeight: 24, color: color.ink, marginTop: i ? 8 : 0 }}>
                  {script.type === '2인대사' && ln.speaker ? <Text style={{ fontFamily: font.b, color: color.blue }}>{ln.speaker} </Text> : null}{ln.text}
                </Text>
              ))}
            </View>
          )}

          {state === 'ready' && (
            <>
              <Divider />
              <Text style={{ fontSize: 13, fontFamily: font.m, color: color.sub, marginBottom: 10 }}>강사 피드백 {comments.length}개</Text>
              {comments.length === 0 && !isStaff && <InfoBox tone="info">24시간 안에 피드백이 와요</InfoBox>}
              {comments.map((c) => (
                <View key={c.id} style={{ backgroundColor: color.surf, borderRadius: radius.chip, padding: 13, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontFamily: font.sb, color: color.ink }}>{c.authorName}</Text>
                    <Text style={{ fontSize: 11, color: color.sub }}>{mmdd(c.date)}</Text>
                  </View>
                  <Text style={{ fontSize: 14, lineHeight: 24, color: color.ink }}>{c.content}</Text>
                </View>
              ))}
              {isStaff && (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4, marginBottom: 8 }}>
                    {FEEDBACK_PRESETS.map((m) => (
                      <Pressable key={m} onPress={() => setFb(m)} style={{ backgroundColor: color.blueBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text style={{ fontSize: 12.5, fontFamily: font.m, color: color.blue }}>{m}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput value={fb} onChangeText={setFb} placeholder="빠른 문구를 고르거나 직접 입력하세요" placeholderTextColor={color.faint} multiline style={[inp, { minHeight: 90, textAlignVertical: 'top' }]} />
                </>
              )}
            </>
          )}

          {state === 'failed' && isOwner && onReupload && (
            <View style={{ marginTop: 16 }}><Cta label="다시 올리기" onPress={onReupload} /></View>
          )}
          {isOwner && !editing && (
            <Pressable onPress={remove} style={{ marginTop: 16 }} hitSlop={6}><Text style={{ fontSize: 13, fontFamily: font.m, color: color.warn }}>이 영상 삭제하기</Text></Pressable>
          )}
        </View>
      </Scroll>
      {isStaff && state === 'ready' && (
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
          <Cta label="피드백 보내기" onPress={send} disabled={!fb.trim()} loading={busy} />
        </View>
      )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ── 업로드 ── (공용 인라인 폼 재사용 — 선택/촬영 → 제목·카테고리 → 그 자리에서 업로드)
function UploadScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  return (
    <Screen edges={['top']} bg={color.bg}>
      <BackHeader title="영상 올리기" onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
      <Scroll contentStyle={{ padding: space.screenX, paddingBottom: 24 }}>
        <FlowTitle>어떤 연습{'\n'}영상인가요?</FlowTitle>
        <View style={{ marginTop: 16 }}>
          <VideoUploadForm onUploaded={onDone} />
        </View>
      </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: color.ink } as const;

// 빠른 피드백 프리셋 — 탭 한 번으로 입력칸을 채워 바로 보낼 수 있어요(직접 수정도 가능).
const FEEDBACK_PRESETS = ['자세와 발성 좋아요 👍', '감정 표현이 살아있어요', '발성을 더 키워봐요', '대사를 또렷하게 전달해봐요', '호흡을 안정적으로 가져가요'];
