import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, Tag,
  Cta, Empty, InfoBox, ChipSelect, FlowTitle, SearchBar, FilterChips, Divider,
} from '../components/kit';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { color, radius, space } from '../theme/tokens';
import { portfolioApi, practiceApi, resolveFileUrl } from '../services/api';
import { pickMediaMulti } from '../services/upload';
import { useUploads } from '../services/UploadContext';
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
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [more, setMore] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), 300);
  const [openItem, setOpenItem] = useState<PortfolioItem | null>(null);
  const [openGroup, setOpenGroup] = useState<FeedCard | null>(null);
  const [uploading, setUploading] = useState(false);
  const cat = catFilter;

  const feedParams = useCallback((skip: number) => ({
    ...(isStaff ? {} : { studentId: user.id }),
    ...(cat !== 'all' ? { category: cat } : {}),
    ...(search ? { search } : {}),
    skip, limit: PAGE,
  }), [isStaff, user.id, cat, search]);

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

  if (openItem) return <VideoDetail item={openItem} user={user} isStaff={isStaff} onBack={() => setOpenItem(null)} onReload={load}
    onDeleted={() => { setOpenItem(null); load(); }}
    onReupload={async () => { try { await portfolioApi.delete(openItem.id); } catch { /* ignore */ } setOpenItem(null); setUploading(true); }} />;
  if (openGroup) return <GroupDetail card={openGroup} user={user} isStaff={isStaff} cat={cat} search={search} onBack={() => setOpenGroup(null)} />;
  if (uploading) return <UploadScreen onBack={() => setUploading(false)} onDone={() => { setUploading(false); load(); }} />;

  const cardSub = (c: FeedCard) => {
    const count = c.kind === 'group' ? `영상 ${c.count}개` : (c.count > 1 ? `영상 ${c.count}개` : (c.portfolio ? catLabel(c.portfolio.category) : ''));
    return [isStaff ? c.studentName : '', count, mmdd(c.date)].filter(Boolean).join(' · ');
  };
  const openCard = (c: FeedCard) => { if (c.kind === 'group') setOpenGroup(c); else if (c.portfolio) setOpenItem(c.portfolio); };

  return (
    <Screen edges={['top']}>
      <TopBar />
      <BigTitle>{isStaff ? '학생 영상에\n피드백을 남겨요' : '연습 영상을\n모아봐요'}</BigTitle>
      <SearchBar value={query} onChangeText={setQuery} placeholder={isStaff ? '제목·학생 검색' : '영상 제목 검색'} />
      <View style={{ marginTop: 8 }}>
        <FilterChips items={VIDEO_FILTERS as any} value={catFilter} onChange={setCatFilter} />
      </View>
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        <SectionLabel>{isStaff ? '학생 영상' : '내 연습 영상'} {cards.length}{hasMore ? '+' : ''}</SectionLabel>
        {loading ? <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
          : cards.length === 0 ? <Empty>{isStaff ? '아직 올라온 영상이 없어요' : '아직 올린 영상이 없어요'}</Empty>
            : cards.map((c) => <ListRow key={c.key} showChevron={false} left={<PlayThumb thumb={c.coverThumbnail} status={c.uploadStatus || 'ready'} />} title={c.title} sub={cardSub(c)} right={<CardTag c={c} staff={isStaff} />} onPress={() => openCard(c)} />)}
        {hasMore && (
          <Pressable onPress={loadMore} disabled={more} style={{ alignSelf: 'center', backgroundColor: color.surf, borderRadius: radius.card, paddingHorizontal: 22, paddingVertical: 11, marginVertical: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: color.sub }}>{more ? '불러오는 중…' : '더 보기'}</Text>
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
      <BackHeader title="영상" onBack={onBack} right={isOwner ? <Pressable onPress={() => setEditing((v) => !v)} hitSlop={6}><Text style={{ fontSize: 13, fontWeight: '600', color: color.blue }}>{editing ? '취소' : '수정'}</Text></Pressable> : undefined} />
      <Scroll contentStyle={{ paddingBottom: 24 }}>
        {/* 플레이어 */}
        <View style={{ backgroundColor: color.ink, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          {cur ? (
            <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />
          ) : state === 'failed' ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
              <Icon name="alert-triangle" size={30} color={color.warn} />
              <Text style={{ color: color.white, fontSize: 14, fontWeight: '600', marginTop: 8 }}>업로드가 완료되지 않았어요</Text>
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
              <Text style={{ fontSize: 19, fontWeight: '700', color: color.ink }}>{item.title}</Text>
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
                  {script.type === '2인대사' && ln.speaker ? <Text style={{ fontWeight: '700', color: color.blue }}>{ln.speaker} </Text> : null}{ln.text}
                </Text>
              ))}
            </View>
          )}

          {state === 'ready' && (
            <>
              <Divider />
              <Text style={{ fontSize: 13, fontWeight: '500', color: color.sub, marginBottom: 10 }}>강사 피드백 {comments.length}개</Text>
              {comments.length === 0 && !isStaff && <InfoBox tone="info">24시간 안에 피드백이 와요</InfoBox>}
              {comments.map((c) => (
                <View key={c.id} style={{ backgroundColor: color.surf, borderRadius: radius.chip, padding: 13, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: color.ink }}>{c.authorName}</Text>
                    <Text style={{ fontSize: 11, color: color.sub }}>{mmdd(c.date)}</Text>
                  </View>
                  <Text style={{ fontSize: 14, lineHeight: 24, color: color.ink }}>{c.content}</Text>
                </View>
              ))}
              {isStaff && (
                <TextInput value={fb} onChangeText={setFb} placeholder="구체적으로 알려주세요" placeholderTextColor={color.faint} multiline style={[inp, { minHeight: 90, textAlignVertical: 'top', marginTop: 4 }]} />
              )}
            </>
          )}

          {state === 'failed' && isOwner && onReupload && (
            <View style={{ marginTop: 16 }}><Cta label="다시 올리기" onPress={onReupload} /></View>
          )}
          {isOwner && !editing && (
            <Pressable onPress={remove} style={{ marginTop: 16 }} hitSlop={6}><Text style={{ fontSize: 13, fontWeight: '500', color: color.warn }}>이 영상 삭제하기</Text></Pressable>
          )}
        </View>
      </Scroll>
      {isStaff && state === 'ready' && (
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
          <Cta label="피드백 보내기" onPress={send} disabled={!fb.trim()} loading={busy} />
        </View>
      )}
    </Screen>
  );
}

// ── 업로드 ──
function UploadScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { upload } = useUploads();
  const [medias, setMedias] = useState<Awaited<ReturnType<typeof pickMediaMulti>>>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [mode, setMode] = useState<'individual' | 'single'>('individual');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    try { const r = await pickMediaMulti('video'); if (r.length) setMedias(r); }
    catch (e: any) { Alert.alert('안내', e?.message || '선택하지 못했어요'); }
  };

  const submit = async () => {
    if (medias.length === 0 || !cat || !title.trim()) return;
    setBusy(true);
    try {
      const single = medias.length > 1 && mode === 'single';
      if (single) {
        const p = await portfolioApi.create({ title: title.trim(), description: desc.trim() || title.trim(), category: cat, videoUrl: '', uploadMode: 'single', totalVideos: medias.length } as any);
        for (let i = 0; i < medias.length; i++) {
          await upload(`${title.trim()} ${i + 1}`, medias[i], { subfolder: 'portfolios', targetType: i === 0 ? 'portfolio' : 'portfolio_video', targetId: p.id });
        }
      } else {
        for (let i = 0; i < medias.length; i++) {
          const t = medias.length > 1 ? `${title.trim()} ${i + 1}` : title.trim();
          const p = await portfolioApi.create({ title: t, description: desc.trim() || t, category: cat, videoUrl: '', ...(medias.length > 1 ? { practiceGroup: title.trim() } : {}) } as any);
          await upload(t, medias[i], { subfolder: 'portfolios', targetType: 'portfolio', targetId: p.id });
        }
      }
      onDone();
    } catch (e: any) { Alert.alert('실패', e?.message || '올리지 못했어요'); } finally { setBusy(false); }
  };

  const ctaLabel = medias.length > 1 ? (mode === 'single' ? `${medias.length}개 묶어 올리기` : `${medias.length}개 올리기`) : '영상 올리기';

  return (
    <Screen edges={['top']}>
      <BackHeader title="영상 올리기" onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX, paddingBottom: 24 }}>
        <FlowTitle>어떤 연습{'\n'}영상인가요?</FlowTitle>

        <Pressable onPress={pick} style={{ backgroundColor: medias.length ? color.successBg : color.surf, borderRadius: 16, height: 116, marginTop: 16, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name={medias.length ? 'circle-check' : 'photo'} size={30} color={medias.length ? color.success : color.faint} />
          <Text style={{ fontSize: 13, color: medias.length ? color.success : color.sub }}>{medias.length === 0 ? '영상을 선택하세요 (여러 개 가능)' : `${medias.length}개 선택됨`}</Text>
        </Pressable>

        {medias.length > 1 && (
          <>
            <Text style={label}>업로드 방식</Text>
            <ChipSelect items={[{ key: 'individual', label: '각각 따로 올리기' }, { key: 'single', label: '하나로 묶기' }]} value={mode} onChange={(v) => setMode(v)} />
            <Text style={{ fontSize: 12, color: color.sub, marginTop: 6 }}>{mode === 'single' ? '여러 영상을 한 포트폴리오로 묶어요' : '영상마다 별도 포트폴리오로 올려요'}</Text>
          </>
        )}

        <Text style={label}>제목</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="예: 자유연기 3차" placeholderTextColor={color.faint} style={inp} />
        <Text style={label}>설명 (선택)</Text>
        <TextInput value={desc} onChangeText={setDesc} placeholder="예: 복식호흡 중점 연습" placeholderTextColor={color.faint} style={inp} />
        <Text style={label}>카테고리</Text>
        <ChipSelect wrap items={VIDEO_CATS} value={cat} onChange={setCat} />
      </Scroll>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
        <Cta label={ctaLabel} onPress={submit} disabled={medias.length === 0 || !cat || !title.trim()} loading={busy} />
      </View>
    </Screen>
  );
}

const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: color.ink } as const;
const label = { fontSize: 13, fontWeight: '500' as const, color: color.sub, marginTop: 16, marginBottom: 8 };
