import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, Track, MusicDownloadRequest, MUSIC_PURPOSES } from '../types';
import { musicApi, resolveFileUrl } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, IconChip, Tag,
  Cta, Empty, InfoBox, ChipSelect, Avatar,
} from './toss/kit';

const MusicNote: React.FC<{ color?: string; size?: number }> = ({ color = TOSS.blue, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

function statusTag(t: Track): React.ReactNode {
  const r = t.myRequest;
  if (!r) return null;
  if (r.status === 'pending') return <Tag bg={TOSS.warnBg} fg={TOSS.warn}>요청 대기</Tag>;
  if (r.status === 'approved') return <Tag bg={TOSS.successBg} fg={TOSS.success}>승인됨</Tag>;
  if (r.status === 'rejected') return <Tag>거절됨</Tag>;
  return null;
}

export const Music: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const isDirector = user.role === UserRole.DIRECTOR; // 음원 요청은 원장만 관리
  const [tracks, setTracks] = useState<Track[]>([]);
  const [requests, setRequests] = useState<MusicDownloadRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);     // 트랙 상세
  const [requestId, setRequestId] = useState<string | null>(null); // 다운로드 요청 화면

  const load = async () => {
    try {
      const [t, r] = await Promise.all([
        musicApi.listTracks(),
        isDirector ? musicApi.listRequests() : Promise.resolve([] as MusicDownloadRequest[]),
      ]);
      setTracks(t);
      setRequests(r);
    } catch (e: any) {
      toast.error(e.message || '음악을 불러오지 못했어요');
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  useDataRefresh(['music'], load);

  const categories = useMemo(() => {
    const set = new Set(tracks.map(t => t.category).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [tracks]);

  const filtered = useMemo(() => {
    return tracks.filter(t =>
      (cat === 'all' || t.category === cat) &&
      (!query || t.title.toLowerCase().includes(query.toLowerCase()))
    );
  }, [tracks, cat, query]);

  const openTrack = openId ? tracks.find(t => t.id === openId) : null;
  const requestTrack = requestId ? tracks.find(t => t.id === requestId) : null;

  if (loading) return <Empty>불러오는 중…</Empty>;

  // ── 다운로드 요청 화면 ──
  if (requestTrack) {
    return <RequestScreen track={requestTrack} onBack={() => setRequestId(null)} onDone={async () => { setRequestId(null); setOpenId(null); await load(); }} />;
  }

  // ── 트랙 상세(플레이어) ──
  if (openTrack) {
    return (
      <TrackDetail
        track={openTrack}
        isStaff={isStaff}
        onBack={() => setOpenId(null)}
        onRequest={() => setRequestId(openTrack.id)}
        onReload={load}
      />
    );
  }

  // ── 스태프: (원장만) 승인 대기 + 라이브러리 ──
  if (isStaff) {
    const pending = requests.filter(r => r.status === 'pending');
    return (
      <Screen>
        <BigTitle title={isDirector ? <>무용 음악을<br />관리해요</> : <>무용 음악<br />라이브러리예요</>} />
        <Scroll className="px-1">
          {isDirector && (pending.length > 0 ? (
            <>
              <SectionLabel>승인 대기 {pending.length}개</SectionLabel>
              {pending.map(r => (
                <PendingCard key={r.id} req={r} onDone={load} />
              ))}
            </>
          ) : (
            <div className="px-1 mt-3"><InfoBox tone="success">대기 중인 요청이 없어요</InfoBox></div>
          ))}
          <SectionLabel>음악 라이브러리 {tracks.length}곡</SectionLabel>
          {filtered.map(t => (
            <ListRow
              key={t.id}
              left={<IconChip bg={TOSS.surf}><MusicNote color={TOSS.sub} /></IconChip>}
              title={t.title}
              sub={`${t.category}${t.duration ? ' · ' + t.duration : ''}`}
              onClick={() => setOpenId(t.id)}
            />
          ))}
        </Scroll>
      </Screen>
    );
  }

  // ── 학생: 목록 + 카테고리 필터 + 검색 ──
  return (
    <Screen>
      <BigTitle title={<>무용 음악을<br />들어봐요</>} sub="연습실 안에서 자유롭게 들어요" />
      <div className="px-1 pb-1">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="곡 제목 검색"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm mb-2 outline-none focus:border-toss-blue"
        />
        <ChipSelect
          options={categories.map(c => ({ value: c, label: c === 'all' ? '전체' : c }))}
          value={cat}
          onChange={setCat}
        />
      </div>
      <Scroll className="px-1">
        <SectionLabel>무용 음악 {filtered.length}곡</SectionLabel>
        {filtered.length === 0 ? <Empty>해당하는 음악이 없어요</Empty> : filtered.map(t => (
          <ListRow
            key={t.id}
            left={<IconChip bg={TOSS.blueBg}><MusicNote color={TOSS.blue} /></IconChip>}
            title={t.title}
            sub={`${t.category}${t.mood ? ' · ' + t.mood : ''}${t.duration ? ' · ' + t.duration : ''}`}
            right={statusTag(t)}
            onClick={() => setOpenId(t.id)}
          />
        ))}
      </Scroll>
    </Screen>
  );
};

// 선생님 승인 대기 카드
const PendingCard: React.FC<{ req: MusicDownloadRequest; onDone: () => void }> = ({ req, onDone }) => {
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
  return (
    <div className="mx-1 mb-2 rounded-xl p-3.5 border" style={{ borderColor: '#FCD9B5', background: TOSS.warnBg }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar name={req.studentName} size={28} bg="#fff" fg={TOSS.warn} />
        <span className="text-[13px] font-semibold text-toss-ink">{req.studentName}님이 요청했어요</span>
      </div>
      <div className="text-sm font-medium text-toss-ink">🎵 {req.trackTitle}</div>
      <div className="text-xs text-toss-sub mt-0.5">목적: {req.purpose}{req.createdAt ? ` · ${(req.createdAt || '').slice(5, 10)}` : ''}</div>
      <div className="flex gap-2 mt-3">
        <button disabled={busy} onClick={() => respond('rejected')} className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white border border-slate-200 text-toss-sub">거절</button>
        <button disabled={busy} onClick={() => respond('approved')} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white" style={{ background: TOSS.blue }}>승인하기</button>
      </div>
    </div>
  );
};

// 트랙 상세 + 플레이어
const TrackDetail: React.FC<{
  track: Track; isStaff: boolean; onBack: () => void; onRequest: () => void; onReload: () => Promise<void>;
}> = ({ track, isStaff, onBack, onRequest, onReload }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const r = track.myRequest;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => toast.error('재생할 수 없어요')); } else { a.pause(); }
  };
  const seek = (v: number) => { const a = audioRef.current; if (a) { a.currentTime = v; setCur(v); } };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // 앱 내 다운로드는 제공하지 않아요 — 승인되면 원장님이 음원을 직접 전달해요.
  let cta: React.ReactNode = null;
  if (!isStaff) {
    if (!r) cta = <Cta onClick={onRequest}>음원 요청하기</Cta>;
    else if (r.status === 'pending') cta = <Cta disabled>승인을 기다리고 있어요</Cta>;
    else if (r.status === 'approved') cta = <Cta disabled>승인됐어요 · 곧 전달해드려요</Cta>;
    else if (r.status === 'rejected') cta = <Cta onClick={onRequest}>다시 요청하기</Cta>;
  }

  return (
    <Screen>
      <BackHeader title="음악" onBack={onBack} />
      <Scroll>
        <div className="px-6 pt-2">
          <div className="w-full rounded-3xl overflow-hidden relative" style={{ paddingBottom: '100%', background: `linear-gradient(135deg, ${TOSS.blueBg} 0%, ${TOSS.purpleBg} 100%)` }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <MusicNote color={TOSS.blue} size={90} />
            </div>
          </div>
        </div>
        <div className="px-5 pt-4 text-center">
          <div className="text-[22px] font-bold tracking-[-0.02em] text-toss-ink">{track.title}</div>
          <div className="text-[13px] text-toss-sub mt-1.5">{track.category}{track.mood ? ' · ' + track.mood : ''}</div>
        </div>
        <div className="px-6 mt-5">
          <input
            type="range" min={0} max={dur || 0} step={0.1} value={cur}
            onChange={e => seek(Number(e.target.value))}
            className="w-full accent-toss-blue"
            disabled={!track.fileUrl}
          />
          <div className="flex justify-between text-[11px] text-toss-sub mt-1">
            <span>{fmt(cur)}</span>
            <span>{dur ? fmt(dur) : (track.duration || '')}</span>
          </div>
        </div>
        <div className="flex justify-center mt-3 mb-2">
          <button onClick={toggle} disabled={!track.fileUrl} className="w-16 h-16 rounded-full flex items-center justify-center text-white disabled:opacity-40" style={{ background: TOSS.blue }}>
            {playing
              ? <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
              : <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
          </button>
        </div>
        {!track.fileUrl && <div className="text-center text-xs text-toss-faint">음원 파일이 아직 준비 중이에요</div>}
        {track.fileUrl && (
          <audio
            ref={audioRef}
            src={resolveFileUrl(track.fileUrl)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setCur(0); }}
            onTimeUpdate={() => setCur(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)}
            playsInline
            preload="metadata"
          />
        )}
        {r && (
          <div className="px-1 mt-4">
            <InfoBox tone={r.status === 'approved' ? 'success' : r.status === 'pending' ? 'info' : 'warn'}>
              {r.status === 'pending' ? '요청을 검토 중이에요' : r.status === 'approved' ? '요청이 승인됐어요. 원장님이 음원을 전달해드려요.' : '이번 요청은 검토 후 보류됐어요'}
            </InfoBox>
          </div>
        )}
        <div className="px-1 mt-4 mb-2">
          <InfoBox>연습실 안에서는 자유롭게 들을 수 있어요. 외부 공유는 저작권 문제가 될 수 있어요.</InfoBox>
        </div>
      </Scroll>
      {cta}
    </Screen>
  );
};

// 다운로드 요청 (목적 선택)
const RequestScreen: React.FC<{ track: Track; onBack: () => void; onDone: () => Promise<void> }> = ({ track, onBack, onDone }) => {
  const [purpose, setPurpose] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!purpose) return;
    setBusy(true);
    try {
      await musicApi.createRequest({ trackId: track.id, purpose });
      toast.success('선생님께 요청을 보냈어요');
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
      <Scroll className="px-1">
        <div className="text-[21px] font-bold leading-[1.4] text-toss-ink mt-2">왜 다운로드가<br />필요한가요?</div>
        <div className="text-sm text-toss-sub mt-1.5">선생님이 사용 목적을 보고 승인해요</div>
        <div className="rounded-2xl p-3.5 mt-4 flex items-center gap-3" style={{ background: TOSS.surf }}>
          <IconChip bg={TOSS.blueBg} size={40}><MusicNote color={TOSS.blue} size={20} /></IconChip>
          <div>
            <div className="text-sm font-semibold text-toss-ink">{track.title}</div>
            <div className="text-xs text-toss-sub mt-0.5">{track.category}{track.duration ? ' · ' + track.duration : ''}</div>
          </div>
        </div>
        <div className="text-[13px] font-medium text-toss-sub mt-[18px] mb-2">사용 목적</div>
        <ChipSelect wrap options={MUSIC_PURPOSES.map(p => ({ value: p, label: p }))} value={purpose} onChange={setPurpose} />
      </Scroll>
      <Cta onClick={submit} disabled={!purpose} loading={busy}>요청 보내기</Cta>
    </Screen>
  );
};
