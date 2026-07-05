import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, Track, MusicDownloadRequest, MUSIC_PURPOSES } from '../types';
import { musicApi, resolveFileUrl } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { useDebouncedValue } from '../services/useDebounce';
import { TOSS } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, IconChip, Tag, Chevron,
  Empty, InfoBox, ChipSelect, Avatar, ListSkeleton, FlowTitle, toneColors, SearchBar, FilterChips,
} from './toss/kit';

// 트랙 상태 → 칩 (프로토타입 pill 대응)
function statusTag(t: Track): React.ReactNode {
  const r = t.myRequest;
  if (!r) return null;
  if (r.status === 'pending') return <Tag {...toneColors('pending')}>요청 대기</Tag>;
  if (r.status === 'approved') return <Tag bg={TOSS.successBg} fg={TOSS.success}>승인됨</Tag>;
  if (r.status === 'rejected') return <Tag>거절됨</Tag>;
  return null;
}

export const Music: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const isDirector = user.role === UserRole.DIRECTOR; // 음원 요청은 원장만 관리
  const PAGE = 60;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [requests, setRequests] = useState<MusicDownloadRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [more, setMore] = useState(false);
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);     // 트랙 상세
  const [requestId, setRequestId] = useState<string | null>(null); // 다운로드 요청 화면
  const [reviewId, setReviewId] = useState<string | null>(null);   // 요청 승인/거절 화면(원장)

  const search = useDebouncedValue(query.trim(), 300);
  const filtering = cat !== 'all' || !!search;
  // 서버사이드 카테고리 + 검색(전 곡 대상)
  const trackParams = (skip: number) => ({ category: cat, ...(search ? { search } : {}), skip, limit: PAGE });
  const load = async () => {
    try {
      const [t, r] = await Promise.all([
        musicApi.listTracks(trackParams(0)),
        isDirector ? musicApi.listRequests() : Promise.resolve([] as MusicDownloadRequest[]),
      ]);
      setTracks(t); setHasMore(t.length >= PAGE);
      setRequests(r);
    } catch (e: any) {
      toast.error(e.message || '음악을 불러오지 못했어요');
    }
  };
  const loadMore = async () => {
    setMore(true);
    try {
      const t = await musicApi.listTracks(trackParams(tracks.length));
      setTracks(prev => [...prev, ...t]); setHasMore(t.length >= PAGE);
    } catch (e: any) { toast.error(e.message || '더 불러오지 못했어요'); }
    finally { setMore(false); }
  };
  // 최초 + 카테고리/검색 변경 시 재조회(첫 진입만 스켈레톤, 이후 부드럽게 교체)
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, [cat, search]);
  useDataRefresh(['music'], load);

  // 카테고리 칩(전체 + 신_무용음악 5장르) — value는 DB category와 정확히 일치해야 필터됨
  const CAT_OPTS = [
    { value: 'all', label: '전체' },
    { value: '붉은 빛의 정열과 긴장감', label: '붉은 빛의 정열과 긴장감' },
    { value: '차갑고 묵직한 철과 콘크리트', label: '차갑고 묵직한 철과 콘크리트' },
    { value: '무대 위의 클래식과 무용수', label: '무대 위의 클래식과 무용수' },
    { value: '어둠 속의 추격과 박동', label: '어둠 속의 추격과 박동' },
    { value: '숲과 자연의 신비로움', label: '숲과 자연의 신비로움' },
  ];
  const renderMore = () => hasMore ? (
    <button onClick={loadMore} disabled={more} style={{ display: 'block', margin: '12px auto 20px', background: TOSS.surf, color: TOSS.sub, border: 'none', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{more ? '불러오는 중…' : '더 보기'}</button>
  ) : null;

  const openTrack = openId ? tracks.find(t => t.id === openId) : null;
  const requestTrack = requestId ? tracks.find(t => t.id === requestId) : null;
  const reviewReq = reviewId ? requests.find(r => r.id === reviewId) : null;

  if (loading) return <ListSkeleton />;

  // ── 다운로드 요청 화면 (학생) ── sMr
  if (requestTrack) {
    return <RequestScreen track={requestTrack} onBack={() => setRequestId(null)} onDone={async () => { setRequestId(null); setOpenId(null); await load(); }} />;
  }

  // ── 요청 승인/거절 화면 (원장) ── sMm
  if (reviewReq) {
    return <ReviewScreen req={reviewReq} onBack={() => setReviewId(null)} onDone={async () => { setReviewId(null); await load(); }} />;
  }

  // ── 트랙 상세(플레이어) ── sMp
  if (openTrack) {
    return (
      <TrackDetail
        track={openTrack}
        isStaff={isStaff}
        onBack={() => setOpenId(null)}
        onRequest={() => setRequestId(openTrack.id)}
      />
    );
  }

  // ── 스태프: (원장만) 승인 대기 + 라이브러리 ── sMu(teacher)
  if (isStaff) {
    const pending = requests.filter(r => r.status === 'pending');
    return (
      <Screen>
        <BigTitle title={<>무용 음악을<br />관리해요</>} />
        <SearchBar value={query} onChange={setQuery} placeholder="곡 제목 검색" />
        <FilterChips options={CAT_OPTS} value={cat} onChange={setCat} />
        <Scroll>
          {!filtering && isDirector && (pending.length > 0 ? (
            <>
              <SectionLabel>승인 대기 {pending.length}개</SectionLabel>
              {pending.map(r => (
                <div
                  key={r.id}
                  onClick={() => setReviewId(r.id)}
                  style={{ margin: '0 20px 8px', padding: '13px 14px', border: `1px solid ${TOSS.blueBg}`, background: TOSS.blueBg, borderRadius: 13, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Avatar name={r.studentName} size={28} bg="#fff" fg={TOSS.blue} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: TOSS.ink }}>{r.studentName}님이 요청했어요</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: TOSS.ink }}>{r.trackTitle}</div>
                  <div style={{ fontSize: 12, color: TOSS.sub, marginTop: 3 }}>목적: {r.purpose}</div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ margin: '14px 20px', padding: '13px 15px', background: TOSS.successBg, borderRadius: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <i className="ti ti-circle-check" style={{ fontSize: 18, color: TOSS.success }} />
              <span style={{ fontSize: 13, color: TOSS.successInk }}>대기 중인 요청이 없어요</span>
            </div>
          ))}
          <SectionLabel>{filtering ? `검색 결과 ${tracks.length}곡` : `음악 라이브러리 ${tracks.length}곡`}</SectionLabel>
          {tracks.length === 0 ? <Empty>해당하는 음악이 없어요</Empty> : tracks.map(t => (
            <ListRow
              key={t.id}
              left={<IconChip bg={TOSS.surf}><i className="ti ti-music" style={{ fontSize: 21, color: TOSS.sub }} /></IconChip>}
              title={t.title}
              sub={`${t.category}${t.duration ? ' · ' + t.duration : ''}`}
              onClick={() => setOpenId(t.id)}
            />
          ))}
          {renderMore()}
        </Scroll>
      </Screen>
    );
  }

  // ── 학생: 카테고리 필터 + 검색 + 곡 목록 ── sMu(student)
  return (
    <Screen>
      <BigTitle title={<>무용 음악을<br />들어봐요</>} sub="연습실 안에서 자유롭게 들어요" />
      <SearchBar value={query} onChange={setQuery} placeholder="곡 제목 검색" />
      <FilterChips options={CAT_OPTS} value={cat} onChange={setCat} />
      <Scroll>
        <SectionLabel>{filtering ? `검색 결과 ${tracks.length}곡` : `무용 음악 ${tracks.length}곡`}</SectionLabel>
        {tracks.length === 0 ? <Empty>해당하는 음악이 없어요</Empty> : tracks.map(t => (
          <ListRow
            key={t.id}
            left={<IconChip bg={TOSS.blueBg}><i className="ti ti-music" style={{ fontSize: 21, color: TOSS.blue }} /></IconChip>}
            title={t.title}
            sub={`${t.category}${t.mood ? ' · ' + t.mood : ''}${t.duration ? ' · ' + t.duration : ''}`}
            right={statusTag(t) || <Chevron />}
            onClick={() => setOpenId(t.id)}
          />
        ))}
        {renderMore()}
      </Scroll>
    </Screen>
  );
};

// 트랙 상세 + 플레이어 ── sMp
const TrackDetail: React.FC<{
  track: Track; isStaff: boolean; onBack: () => void; onRequest: () => void;
}> = ({ track, isStaff, onBack, onRequest }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const r = track.myRequest;
  // 서명된 스트림 우선(학생은 fileUrl이 비어있음). 정적 경로 직접 노출 방지.
  const playUrl = track.streamUrl || track.fileUrl;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => toast.error('재생할 수 없어요')); } else { a.pause(); }
  };
  const seek = (v: number) => { const a = audioRef.current; if (a) { a.currentTime = v; setCur(v); } };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // 앱 내 다운로드는 제공하지 않아요 — 승인되면 원장님이 음원을 직접 전달해요.
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
    <Screen>
      <BackHeader title="음악" onBack={onBack} />
      <Scroll>
        {/* 그라데이션 앨범아트 */}
        <div style={{ padding: '8px 28px 0' }}>
          <div style={{ width: '100%', paddingBottom: '100%', position: 'relative', background: `linear-gradient(135deg, ${TOSS.blueBg} 0%, ${TOSS.purpleBg} 100%)`, borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-music" style={{ fontSize: 90, color: TOSS.blue, opacity: 0.85 }} />
            </div>
          </div>
        </div>
        {/* 제목 */}
        <div style={{ padding: '18px 20px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: TOSS.ink }}>{track.title}</div>
          <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 6 }}>{track.category}{track.mood ? ' · ' + track.mood : ''}</div>
        </div>
        {/* 진행바 */}
        <div style={{ padding: '24px 24px 0' }}>
          <input
            type="range" min={0} max={dur || 0} step={0.1} value={cur}
            onChange={e => seek(Number(e.target.value))}
            disabled={!playUrl}
            style={{ width: '100%', accentColor: TOSS.blue }}
          />
          {!playUrl && <div style={{ height: 4, background: TOSS.surf, borderRadius: 2, position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress}%`, background: TOSS.blue }} /></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11, color: TOSS.sub }}>
            <span>{fmt(cur)}</span>
            <span>{total}</span>
          </div>
        </div>
        {/* 큰 재생 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, paddingBottom: 16 }}>
          <button
            onClick={toggle}
            disabled={!playUrl}
            style={{ width: 62, height: 62, borderRadius: '50%', background: TOSS.blue, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: playUrl ? 'pointer' : 'default', opacity: playUrl ? 1 : 0.4 }}
          >
            <i className={`ti ${playing ? 'ti-player-pause-filled' : 'ti-player-play-filled'}`} style={{ fontSize: 28 }} />
          </button>
        </div>
        {!playUrl && <div style={{ textAlign: 'center', fontSize: 12, color: TOSS.sub }}>음원 파일이 아직 준비 중이에요</div>}
        {playUrl && (
          <audio
            ref={audioRef}
            src={resolveFileUrl(playUrl)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setCur(0); }}
            onTimeUpdate={() => setCur(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)}
            onError={() => { setPlaying(false); toast.error('음원을 불러오지 못했어요'); }}
            playsInline
            preload="metadata"
          />
        )}
        {/* 요청 상태 안내 */}
        {r && (
          <div style={{ margin: '4px 20px 14px', background: TOSS.surf, borderRadius: 12, padding: 12, fontSize: 13, color: TOSS.sub, lineHeight: 1.6 }}>
            {r.status === 'pending' ? '요청을 검토 중이에요' : r.status === 'approved' ? '요청이 승인됐어요. 원장님이 음원을 전달해드려요.' : `요청이 거절됐어요.${r.responseNote ? ' ' + r.responseNote : ' 다시 요청할 수 있어요.'}`}
          </div>
        )}
        <div style={{ padding: '0 20px 14px' }}>
          <InfoBox>연습실 안에서는 자유롭게 들을 수 있어요. 외부 공유는 저작권 문제가 될 수 있어요.</InfoBox>
        </div>
      </Scroll>
      {cta && (
        <div style={{ padding: '12px 20px 16px', flexShrink: 0 }}>
          <button
            onClick={cta.on ? onRequest : undefined}
            disabled={!cta.on}
            style={{ width: '100%', background: cta.on ? TOSS.blue : TOSS.surf, color: cta.on ? '#fff' : TOSS.sub, border: 'none', borderRadius: 14, padding: 15, fontSize: 16, fontWeight: 600, cursor: cta.on ? 'pointer' : 'default' }}
          >
            {cta.label}
          </button>
        </div>
      )}
    </Screen>
  );
};

// 다운로드 요청 (목적 선택) ── sMr
const RequestScreen: React.FC<{ track: Track; onBack: () => void; onDone: () => Promise<void> }> = ({ track, onBack, onDone }) => {
  const [purpose, setPurpose] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!purpose) return;
    setBusy(true);
    try {
      await musicApi.createRequest({ trackId: track.id, purpose });
      toast.success('원장님께 요청을 보냈어요');
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '요청하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <BackHeader title="다운로드 권한 요청" onBack={onBack} />
      <Scroll>
        <div style={{ padding: '8px 20px' }}>
          <FlowTitle pad="0">왜 다운로드가<br />필요한가요?</FlowTitle>
          <div style={{ fontSize: 14, color: TOSS.sub, marginTop: 6 }}>원장님이 사용 목적을 보고 승인해요</div>
          <div style={{ background: TOSS.surf, borderRadius: 14, padding: 13, marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconChip bg={TOSS.blueBg} size={40}><i className="ti ti-music" style={{ fontSize: 19, color: TOSS.blue }} /></IconChip>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TOSS.ink }}>{track.title}</div>
              <div style={{ fontSize: 12, color: TOSS.sub, marginTop: 2 }}>{track.category}{track.duration ? ' · ' + track.duration : ''}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '18px 0 8px' }}>사용 목적</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {MUSIC_PURPOSES.map(pp => {
              const on = purpose === pp;
              return (
                <button
                  key={pp}
                  onClick={() => setPurpose(pp)}
                  style={{ background: on ? TOSS.blueBg : '#fff', border: `1.5px solid ${on ? TOSS.blue : TOSS.inputLine}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: on ? TOSS.blue : TOSS.sub, cursor: 'pointer' }}
                >
                  {pp}
                </button>
              );
            })}
          </div>
          <div style={{ background: TOSS.blueBg, borderRadius: 12, padding: 12, marginTop: 18, fontSize: 13, color: TOSS.infoInk, lineHeight: 1.6 }}>입시 연습 용도로만 써요. 외부 공유는 저작권 문제가 될 수 있어요</div>
        </div>
      </Scroll>
      <div style={{ padding: '12px 20px 16px', flexShrink: 0 }}>
        <button
          onClick={purpose && !busy ? submit : undefined}
          disabled={!purpose || busy}
          style={{ width: '100%', background: purpose && !busy ? TOSS.blue : TOSS.surf, color: purpose && !busy ? '#fff' : TOSS.sub, border: 'none', borderRadius: 14, padding: 15, fontSize: 16, fontWeight: 600, cursor: purpose && !busy ? 'pointer' : 'default' }}
        >
          {busy ? '잠시만요…' : '요청 보내기'}
        </button>
      </div>
    </Screen>
  );
};

// 요청 승인/거절 (원장) ── sMm
const ReviewScreen: React.FC<{ req: MusicDownloadRequest; onBack: () => void; onDone: () => Promise<void> }> = ({ req, onBack, onDone }) => {
  const [busy, setBusy] = useState(false);
  const respond = async (status: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await musicApi.respondRequest(req.id, { status });
      toast.success(status === 'approved' ? '승인했어요' : '요청을 검토했어요');
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '처리하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  const reqDate = (req.createdAt || '').slice(0, 10);
  return (
    <Screen>
      <BackHeader title="다운로드 요청" onBack={onBack} />
      <Scroll>
        <div style={{ padding: '8px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
            <Avatar name={req.studentName} size={48} bg={TOSS.blueBg} fg={TOSS.blue} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: TOSS.ink }}>{req.studentName}</div>
              <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 3 }}>{reqDate ? `${reqDate}에 요청` : '요청'}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 8 }}>요청한 음악</div>
          <div style={{ background: TOSS.surf, borderRadius: 13, padding: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconChip bg={TOSS.blueBg} size={42}><i className="ti ti-music" style={{ fontSize: 20, color: TOSS.blue }} /></IconChip>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOSS.ink }}>{req.trackTitle}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '18px 0 8px' }}>사용 목적</div>
          <div style={{ background: TOSS.surf, borderRadius: 12, padding: 13, fontSize: 14, lineHeight: 1.6, color: TOSS.ink }}>{req.purpose}</div>
          <div style={{ background: TOSS.blueBg, borderRadius: 12, padding: 12, marginTop: 14, fontSize: 13, color: TOSS.infoInk, lineHeight: 1.6 }}>결정하면 {req.studentName}님에게 즉시 알림이 가요</div>
        </div>
      </Scroll>
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px 16px', flexShrink: 0 }}>
        <button
          onClick={busy ? undefined : () => respond('rejected')}
          disabled={busy}
          style={{ flex: 1, background: '#fff', border: `1.5px solid ${TOSS.inputLine}`, color: TOSS.sub, borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
        >
          거절
        </button>
        <button
          onClick={busy ? undefined : () => respond('approved')}
          disabled={busy}
          style={{ flex: 2, background: TOSS.blue, border: 'none', color: '#fff', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
        >
          승인하기
        </button>
      </div>
    </Screen>
  );
};
