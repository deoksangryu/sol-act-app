import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, LayoutChangeEvent, GestureResponderEvent } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, IconChip, Tag,
  Empty, InfoBox, ChipSelect, Avatar, FlowTitle, SearchBar, Cta,
} from '../components/kit';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { color, radius, space } from '../theme/tokens';
import { musicApi, resolveFileUrl } from '../services/api';
import { useDataRefresh } from '../services/ws';
import { useDebouncedValue } from '../lib/useDebounce';
import { useAuth } from '../AuthContext';
import { UserRole, MUSIC_PURPOSES } from '../types';
import type { User, Track, MusicDownloadRequest } from '../types';

const PAGE = 60;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function statusTag(t: Track) {
  const r = t.myRequest;
  if (!r) return null;
  if (r.status === 'pending') return <Tag label="요청 대기" tone="pending" />;
  if (r.status === 'approved') return <Tag label="승인됨" tone="done" />;
  if (r.status === 'rejected') return <Tag label="거절됨" tone="neutral" />;
  return null;
}

export function MusicScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return <MusicMain user={user} />;
}

function MusicMain({ user }: { user: User }) {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const isDirector = user.role === UserRole.DIRECTOR;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [requests, setRequests] = useState<MusicDownloadRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), 300);
  const filtering = !!search;
  const [openId, setOpenId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const params = useCallback((skip: number) => ({ ...(search ? { search } : {}), skip, limit: PAGE }), [search]);
  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        musicApi.listTracks(params(0)),
        isDirector ? musicApi.listRequests() : Promise.resolve([] as MusicDownloadRequest[]),
      ]);
      setTracks(t); setHasMore(t.length >= PAGE); setRequests(r);
    } catch (e: any) { Alert.alert('안내', e?.message || '음악을 불러오지 못했어요'); }
  }, [params, isDirector]);
  const loadMore = async () => {
    setMore(true);
    try { const t = await musicApi.listTracks(params(tracks.length)); setTracks((p) => [...p, ...t]); setHasMore(t.length >= PAGE); }
    catch { /* noop */ } finally { setMore(false); }
  };
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  useDataRefresh(['music'], load);

  const openTrack = openId ? tracks.find((t) => t.id === openId) : null;
  const requestTrack = requestId ? tracks.find((t) => t.id === requestId) : null;
  const reviewReq = reviewId ? requests.find((r) => r.id === reviewId) : null;

  if (requestTrack) return <RequestScreen track={requestTrack} onBack={() => setRequestId(null)} onDone={() => { setRequestId(null); setOpenId(null); load(); }} />;
  if (reviewReq) return <ReviewScreen req={reviewReq} onBack={() => setReviewId(null)} onDone={() => { setReviewId(null); load(); }} />;
  if (openTrack) return <TrackDetail track={openTrack} isStaff={isStaff} onBack={() => setOpenId(null)} onRequest={() => setRequestId(openTrack.id)} />;

  const renderMore = () => hasMore ? (
    <Pressable onPress={loadMore} disabled={more} style={{ alignSelf: 'center', backgroundColor: color.surf, borderRadius: radius.card, paddingHorizontal: 22, paddingVertical: 11, marginVertical: 14 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: color.sub }}>{more ? '불러오는 중…' : '더 보기'}</Text>
    </Pressable>
  ) : null;

  const trackRow = (t: Track, tint: string, bg: string) => (
    <ListRow key={t.id} left={<IconChip name="music" tint={tint} bg={bg} />} title={t.title}
      sub={isStaff ? (t.duration || '') : `${t.mood ? t.mood + ' · ' : ''}${t.duration || ''}`}
      right={!isStaff ? (statusTag(t) ?? undefined) : undefined}
      showChevron={isStaff || !statusTag(t)}
      onPress={() => setOpenId(t.id)} />
  );

  if (isStaff) {
    const pending = requests.filter((r) => r.status === 'pending');
    return (
      <Screen edges={['top']}>
        <TopBar />
        <BigTitle>무용 음악을{'\n'}관리해요</BigTitle>
        <SearchBar value={query} onChangeText={setQuery} placeholder="곡 제목 검색" />
        <Scroll contentStyle={{ paddingBottom: 40 }}>
          {loading ? <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View> : (
            <>
              {!filtering && isDirector && (pending.length > 0 ? (
                <>
                  <SectionLabel>승인 대기 {pending.length}개</SectionLabel>
                  {pending.map((r) => (
                    <Pressable key={r.id} onPress={() => setReviewId(r.id)} style={{ marginHorizontal: space.screenX, marginBottom: 8, padding: 14, borderWidth: 1, borderColor: color.blueBg, backgroundColor: color.blueBg, borderRadius: radius.chip }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Avatar name={r.studentName} size={28} bg={color.white} fg={color.blue} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: color.ink }}>{r.studentName}님이 요청했어요</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: color.ink }}>{r.trackTitle}</Text>
                      <Text style={{ fontSize: 12, color: color.sub, marginTop: 3 }}>목적: {r.purpose}</Text>
                    </Pressable>
                  ))}
                </>
              ) : (
                <View style={{ marginHorizontal: space.screenX, marginVertical: 14, padding: 14, backgroundColor: color.successBg, borderRadius: radius.chip, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Icon name="circle-check" size={18} color={color.success} />
                  <Text style={{ fontSize: 13, color: color.successInk }}>대기 중인 요청이 없어요</Text>
                </View>
              ))}
              <SectionLabel>{filtering ? `검색 결과 ${tracks.length}곡` : `음악 라이브러리 ${tracks.length}곡`}</SectionLabel>
              {tracks.length === 0 ? <Empty>해당하는 음악이 없어요</Empty> : tracks.map((t) => trackRow(t, color.sub, color.surf))}
              {renderMore()}
            </>
          )}
        </Scroll>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <TopBar />
      <BigTitle sub="연습실 안에서 자유롭게 들어요">무용 음악을{'\n'}들어봐요</BigTitle>
      <SearchBar value={query} onChangeText={setQuery} placeholder="곡 제목 검색" />
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        {loading ? <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View> : (
          <>
            <SectionLabel>{filtering ? `검색 결과 ${tracks.length}곡` : `무용 음악 ${tracks.length}곡`}</SectionLabel>
            {tracks.length === 0 ? <Empty>해당하는 음악이 없어요</Empty> : tracks.map((t) => trackRow(t, color.blue, color.blueBg))}
            {renderMore()}
          </>
        )}
      </Scroll>
    </Screen>
  );
}

function TrackDetail({ track, isStaff, onBack, onRequest }: { track: Track; isStaff: boolean; onBack: () => void; onRequest: () => void }) {
  const playUrl = track.streamUrl || track.fileUrl;
  const source = playUrl ? resolveFileUrl(playUrl) : null;
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const [barW, setBarW] = useState(0);
  const playing = status?.playing ?? false;
  const cur = status?.currentTime ?? 0;
  const dur = status?.duration ?? 0;
  const r = track.myRequest;

  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }, []);

  const toggle = () => { if (!source) return; if (playing) player.pause(); else player.play(); };
  const onBarPress = (e: GestureResponderEvent) => { if (dur > 0 && barW > 0) player.seekTo((e.nativeEvent.locationX / barW) * dur); };

  const cta: { label: string; on: boolean } | null = (() => {
    if (isStaff) return null;
    if (!r) return { label: '음원 요청하기', on: true };
    if (r.status === 'pending') return { label: '승인을 기다리고 있어요', on: false };
    if (r.status === 'approved') return { label: '승인됐어요 · 곧 전달해드려요', on: false };
    if (r.status === 'rejected') return { label: '다시 요청하기', on: true };
    return null;
  })();

  const total = dur ? fmt(dur) : (track.duration || '0:00');
  const progress = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <Screen edges={['top']}>
      <BackHeader title="음악" onBack={onBack} />
      <Scroll contentStyle={{ paddingBottom: 20 }}>
        <View style={{ paddingHorizontal: 28, paddingTop: 8 }}>
          <LinearGradient colors={[color.blueBg, color.purpleBg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ aspectRatio: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="music" size={90} color={color.blue} />
          </LinearGradient>
        </View>
        <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.44, color: color.ink, textAlign: 'center' }}>{track.title}</Text>
          {(track.mood || track.duration) ? <Text style={{ fontSize: 13, color: color.sub, marginTop: 6 }}>{track.mood ? track.mood + ' · ' : ''}{track.duration || ''}</Text> : null}
        </View>

        {/* 진행바 (탭하면 이동) */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <Pressable onPress={onBarPress} onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)} hitSlop={10}>
            <View style={{ height: 5, borderRadius: radius.pill, backgroundColor: color.surf, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${progress}%`, backgroundColor: color.blue }} />
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
            <Text style={{ fontSize: 11, color: color.sub }}>{fmt(cur)}</Text>
            <Text style={{ fontSize: 11, color: color.sub }}>{total}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={toggle} disabled={!source} style={{ width: 62, height: 62, borderRadius: radius.pill, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center', opacity: source ? 1 : 0.4 }}>
            <Icon name={playing ? 'player-pause' : 'player-play'} size={28} color={color.white} />
          </Pressable>
        </View>
        {!source && <Text style={{ textAlign: 'center', fontSize: 12, color: color.sub }}>음원 파일이 아직 준비 중이에요</Text>}

        {r && (
          <View style={{ marginHorizontal: space.screenX, marginTop: 4, marginBottom: 14, backgroundColor: color.surf, borderRadius: radius.card, padding: 12 }}>
            <Text style={{ fontSize: 13, color: color.sub, lineHeight: 21 }}>
              {r.status === 'pending' ? '요청을 검토 중이에요' : r.status === 'approved' ? '요청이 승인됐어요. 원장님이 음원을 전달해드려요.' : `요청이 거절됐어요.${r.responseNote ? ' ' + r.responseNote : ' 다시 요청할 수 있어요.'}`}
            </Text>
          </View>
        )}
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 8 }}>
          <InfoBox>연습실 안에서는 자유롭게 들을 수 있어요. 외부 공유는 저작권 문제가 될 수 있어요.</InfoBox>
        </View>
      </Scroll>
      {cta && (
        <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16, paddingTop: 4 }}>
          <Cta label={cta.label} onPress={cta.on ? onRequest : undefined} disabled={!cta.on} />
        </View>
      )}
    </Screen>
  );
}

function RequestScreen({ track, onBack, onDone }: { track: Track; onBack: () => void; onDone: () => void }) {
  const [purpose, setPurpose] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!purpose) return;
    setBusy(true);
    try { await musicApi.createRequest({ trackId: track.id, purpose }); onDone(); }
    catch (e: any) { Alert.alert('실패', e?.message || '요청하지 못했어요'); } finally { setBusy(false); }
  };
  return (
    <Screen edges={['top']}>
      <BackHeader title="다운로드 권한 요청" onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX }}>
        <FlowTitle>왜 다운로드가{'\n'}필요한가요?</FlowTitle>
        <Text style={{ fontSize: 14, color: color.sub, marginTop: 6 }}>원장님이 사용 목적을 보고 승인해요</Text>
        <View style={{ backgroundColor: color.surf, borderRadius: radius.button, padding: 13, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconChip name="music" tint={color.blue} bg={color.blueBg} size={40} />
          <View><Text style={{ fontSize: 14, fontWeight: '600', color: color.ink }}>{track.title}</Text><Text style={{ fontSize: 12, color: color.sub, marginTop: 2 }}>{track.duration || ''}</Text></View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '500', color: color.sub, marginTop: 18, marginBottom: 8 }}>사용 목적</Text>
        <ChipSelect wrap items={MUSIC_PURPOSES.map((p) => ({ key: p, label: p }))} value={purpose} onChange={setPurpose} />
        <View style={{ marginTop: 18 }}><InfoBox>입시 연습 용도로만 써요. 외부 공유는 저작권 문제가 될 수 있어요.</InfoBox></View>
      </Scroll>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
        <Cta label="요청 보내기" onPress={submit} disabled={!purpose} loading={busy} />
      </View>
    </Screen>
  );
}

function ReviewScreen({ req, onBack, onDone }: { req: MusicDownloadRequest; onBack: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const respond = async (status: 'approved' | 'rejected') => {
    setBusy(true);
    try { await musicApi.respondRequest(req.id, { status }); onDone(); }
    catch (e: any) { Alert.alert('실패', e?.message || '처리하지 못했어요'); } finally { setBusy(false); }
  };
  const reqDate = (req.createdAt || '').slice(0, 10);
  return (
    <Screen edges={['top']}>
      <BackHeader title="다운로드 요청" onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 18 }}>
          <Avatar name={req.studentName} size={48} />
          <View><Text style={{ fontSize: 18, fontWeight: '700', color: color.ink }}>{req.studentName}</Text><Text style={{ fontSize: 13, color: color.sub, marginTop: 3 }}>{reqDate ? `${reqDate}에 요청` : '요청'}</Text></View>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '500', color: color.sub, marginBottom: 8 }}>요청한 음악</Text>
        <View style={{ backgroundColor: color.surf, borderRadius: radius.chip, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconChip name="music" tint={color.blue} bg={color.blueBg} size={42} />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: color.ink }}>{req.trackTitle}</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '500', color: color.sub, marginTop: 18, marginBottom: 8 }}>사용 목적</Text>
        <View style={{ backgroundColor: color.surf, borderRadius: radius.card, padding: 13 }}><Text style={{ fontSize: 14, lineHeight: 22, color: color.ink }}>{req.purpose}</Text></View>
        <View style={{ marginTop: 14 }}><InfoBox tone="info">결정하면 {req.studentName}님에게 즉시 알림이 가요.</InfoBox></View>
      </Scroll>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space.screenX, paddingBottom: 16 }}>
        <Pressable onPress={busy ? undefined : () => respond('rejected')} disabled={busy} style={{ flex: 1, borderWidth: 1.5, borderColor: color.inputLine, borderRadius: radius.button, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: color.sub }}>거절</Text>
        </Pressable>
        <View style={{ flex: 2 }}><Cta label="승인하기" onPress={() => respond('approved')} loading={busy} /></View>
      </View>
    </Screen>
  );
}
