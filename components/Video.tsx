import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { User, UserRole, PortfolioItem, FeedCard } from '../types';
import { portfolioApi, uploadApi, resolveFileUrl, API_URL, getToken } from '../services/api';
import { nativeBackgroundUpload } from '../services/nativeUpload';
import { useDataRefresh } from '../services/useWebSocket';
import { useDebouncedValue } from '../services/useDebounce';
import { TOSS } from '../services/category';
import {
  Screen, Scroll, BigTitle, SectionLabel, BackHeader, ListRow, Tag,
  Cta, Empty, InfoBox, ChipSelect, ListSkeleton, FlowTitle, toneColors, SearchBar, FilterChips,
} from './toss/kit';

// 영상 필터 칩(전체 + 카테고리)
const VIDEO_FILTERS = [{ value: 'all', label: '전체' }, { value: 'acting', label: '자유연기' }, { value: 'monologue', label: '독백' }, { value: 'musical', label: '뮤지컬 넘버' }, { value: 'dance', label: '자유무용' }, { value: 'basics', label: '발성 연습' }];

const VIDEO_CATS = [
  { value: 'acting', label: '자유연기' },
  { value: 'monologue', label: '독백' },
  { value: 'musical', label: '뮤지컬 넘버' },
  { value: 'dance', label: '자유무용' },
  { value: 'basics', label: '발성 연습' },
];
const catLabel = (v: string) => VIDEO_CATS.find(c => c.value === v)?.label || v;
// 영상 길이(초) → ' · M:SS' (없으면 빈 문자열)
const fmtDur = (s?: number) => (s && s > 0 ? ` · ${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');

// 포트폴리오의 대표 썸네일(커버 우선, 없으면 추가 영상에서)
const coverThumb = (v: PortfolioItem) => v.thumbnailUrl || v.videos?.find(x => x.thumbnailUrl)?.thumbnailUrl;

// === 업로드 상태 분류 ===
type UpState = 'ready' | 'uploading' | 'failed';
const UPLOAD_TIMEOUT_MS = 30 * 60 * 1000; // 백엔드 UPLOAD_TIMEOUT(30분)과 동일 — 실패를 빨리 인지
const hasVideo = (v: PortfolioItem) => !!v.videoUrl || !!(v.videos && v.videos.length);
// created_at(naive UTC, 'YYYY-MM-DD HH:MM:SS')을 UTC로 파싱해 경과(ms)
const ageMs = (v: PortfolioItem) => {
  const s = v.date || '';
  const t = Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
  return isFinite(t) ? Date.now() - t : 0;
};
// 서버 uploadStatus 우선, 없으면 영상유무 + 생성나이로 추정
const classify = (v: PortfolioItem): UpState =>
  v.uploadStatus ? v.uploadStatus : (hasVideo(v) ? 'ready' : (ageMs(v) < UPLOAD_TIMEOUT_MS ? 'uploading' : 'failed'));

// 행 우측 상태 태그(업로드 상태 우선, 그 다음 피드백 상태)
const stateTag = (v: PortfolioItem, staff: boolean): React.ReactNode => {
  const s = classify(v);
  if (s === 'failed') return <Tag {...toneColors('overdue')}>업로드 실패</Tag>;
  if (s === 'uploading') return <Tag {...toneColors('pending')}>업로드 중</Tag>;
  const hasC = (v.comments?.length ?? 0) > 0;
  if (staff) return hasC ? <Tag bg={TOSS.successBg} fg={TOSS.success}>완료</Tag> : <Tag {...toneColors('pending')}>피드백 필요</Tag>;
  return hasC ? <Tag bg={TOSS.successBg} fg={TOSS.success}>피드백 완료</Tag> : <Tag {...toneColors('pending')}>피드백 대기</Tag>;
};

// 피드 카드 우측 상태 태그(업로드 상태 우선, 그 다음 피드백 집계)
const cardTag = (c: FeedCard, staff: boolean): React.ReactNode => {
  const s = c.uploadStatus || 'ready';
  if (s === 'failed') return <Tag {...toneColors('overdue')}>업로드 실패</Tag>;
  if (s === 'uploading') return <Tag {...toneColors('pending')}>업로드 중</Tag>;
  if (c.pendingFeedback > 0) return <Tag {...toneColors('pending')}>{staff ? (c.kind === 'group' ? `피드백 ${c.pendingFeedback}개 필요` : '피드백 필요') : '피드백 대기'}</Tag>;
  return <Tag bg={TOSS.successBg} fg={TOSS.success}>{staff ? '완료' : '피드백 완료'}</Tag>;
};

// 영상 썸네일 (56x56) — 썸네일 로딩 중엔 회색 스켈레톤, 실패=경고, 업로드중=스피너
const PlayThumb: React.FC<{ thumb?: string; status?: UpState }> = ({ thumb, status = 'ready' }) => {
  const [loaded, setLoaded] = useState(false);
  const icon = status === 'failed' ? 'ti-alert-triangle' : status === 'uploading' ? 'ti-loader-2 spin' : 'ti-player-play';
  const iconColor = status === 'failed' ? TOSS.warn : thumb ? '#fff' : TOSS.sub;
  return (
    <div style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, overflow: 'hidden', position: 'relative',
      background: thumb ? '#000' : TOSS.surf, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {thumb && <img src={resolveFileUrl(thumb)} loading="lazy" decoding="async" alt="" onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity .15s' }} />}
      {thumb && !loaded && <div className="skel" style={{ position: 'absolute', inset: 0 }} />}
      <i className={`ti ${icon}`}
        style={{ position: 'relative', fontSize: thumb ? 18 : 20, color: iconColor, filter: thumb && status !== 'failed' ? 'drop-shadow(0 1px 3px rgba(0,0,0,.6))' : undefined }} />
    </div>
  );
};

export const Video: React.FC<{ user: User }> = ({ user }) => {
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const PAGE = 24;
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [more, setMore] = useState(false);
  const [openItem, setOpenItem] = useState<PortfolioItem | null>(null);  // single 카드 → 상세
  const [openGroup, setOpenGroup] = useState<FeedCard | null>(null);     // group 카드 → 그룹 상세
  const [uploading, setUploading] = useState(false);
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), 300);

  // 카드 단위 피드(서버에서 individual=그룹, single/단일=개별로 묶음) + 검색/카테고리
  const feedParams = (skip: number) => ({
    ...(isStaff ? {} : { studentId: user.id }),
    ...(cat !== 'all' ? { category: cat } : {}),
    ...(search ? { search } : {}),
    skip, limit: PAGE,
  });
  const load = async () => {
    try {
      const data = await portfolioApi.listFeed(feedParams(0));
      setCards(data); setHasMore(data.length >= PAGE);
    } catch (e: any) {
      toast.error(e.message || '영상을 불러오지 못했어요');
    }
  };
  const loadMore = async () => {
    setMore(true);
    try {
      const data = await portfolioApi.listFeed(feedParams(cards.length));
      setCards(prev => [...prev, ...data]); setHasMore(data.length >= PAGE);
    } catch (e: any) { toast.error(e.message || '더 불러오지 못했어요'); }
    finally { setMore(false); }
  };
  // 최초 + 카테고리/검색 변경 시 page 0부터 재조회(첫 진입만 스켈레톤, 이후 부드럽게 교체)
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, [cat, search]);
  useDataRefresh(['portfolios'], load);
  const renderMore = () => hasMore ? (
    <button onClick={loadMore} disabled={more} style={{ display: 'block', margin: '12px auto 20px', background: TOSS.surf, color: TOSS.sub, border: 'none', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{more ? '불러오는 중…' : '더 보기'}</button>
  ) : null;

  if (loading) return <ListSkeleton />;

  if (openItem) return <VideoDetail item={openItem} user={user} isStaff={isStaff} onBack={() => setOpenItem(null)} onReload={load}
    onDeleted={async () => { setOpenItem(null); await load(); }}
    onReupload={async () => { try { await portfolioApi.delete(openItem.id); } catch { /* 이미 없으면 무시 */ } setOpenItem(null); setUploading(true); }} />;
  if (openGroup) return <GroupDetail card={openGroup} user={user} isStaff={isStaff} cat={cat} search={search} onBack={() => setOpenGroup(null)} />;
  if (uploading) return <UploadScreen onBack={() => setUploading(false)} onDone={async () => { setUploading(false); await load(); }} />;

  const cardSub = (c: FeedCard) => {
    const date = (c.date || '').slice(5, 10);
    const count = c.kind === 'group' ? `영상 ${c.count}개` : (c.count > 1 ? `영상 ${c.count}개` : (c.portfolio ? catLabel(c.portfolio.category) : ''));
    return [isStaff ? c.studentName : '', count, date].filter(Boolean).join(' · ');
  };
  const openCard = (c: FeedCard) => { if (c.kind === 'group') setOpenGroup(c); else if (c.portfolio) setOpenItem(c.portfolio); };
  const cardRow = (c: FeedCard) => (
    <ListRow key={c.key} left={<PlayThumb thumb={c.coverThumbnail} status={c.uploadStatus || 'ready'} />}
      title={c.title} sub={cardSub(c)} right={cardTag(c, isStaff)} onClick={() => openCard(c)} />
  );

  return (
    <Screen>
      <BigTitle title={isStaff ? <>학생 영상에<br />피드백을 남겨요</> : <>연습 영상을<br />모아봐요</>} />
      <SearchBar value={query} onChange={setQuery} placeholder={isStaff ? '제목·학생 영상 검색' : '영상 제목 검색'} />
      <FilterChips options={VIDEO_FILTERS} value={cat} onChange={setCat} />
      <Scroll>
        <SectionLabel>{isStaff ? '학생 영상' : '내 연습 영상'} {cards.length}{hasMore ? '+' : ''}</SectionLabel>
        {cards.length === 0 ? <Empty>{isStaff ? '아직 올라온 영상이 없어요' : '아직 올린 영상이 없어요'}</Empty> : cards.map(cardRow)}
        {renderMore()}
      </Scroll>
      {!isStaff && <Cta onClick={() => setUploading(true)}>새 영상 올리기</Cta>}
    </Screen>
  );
};

// 그룹(연습묶음) 상세 — 같은 practice_group 멤버 영상 목록 → 각 영상 상세
const GroupDetail: React.FC<{ card: FeedCard; user: User; isStaff: boolean; cat: string; search: string; onBack: () => void }> = ({ card, user, isStaff, cat, search, onBack }) => {
  const [members, setMembers] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<PortfolioItem | null>(null);
  const load = async () => {
    // 피드와 동일한 필터(카테고리/검색) 적용 → 카드 count와 멤버 목록이 일치
    try { setMembers(await portfolioApi.list({ practiceGroup: card.title, studentId: card.studentId, ...(cat !== 'all' ? { category: cat } : {}), ...(search ? { search } : {}), limit: 200 })); }
    catch (e: any) { toast.error(e.message || '불러오지 못했어요'); }
  };
  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line */ }, []);
  useDataRefresh(['portfolios'], load);
  if (sel) return <VideoDetail item={sel} user={user} isStaff={isStaff} onBack={() => setSel(null)} onReload={load} onDeleted={async () => { setSel(null); await load(); }} />;
  return (
    <Screen>
      <BackHeader title={card.title} onBack={onBack} />
      <Scroll>
        {loading ? <ListSkeleton /> : members.length === 0 ? <Empty>영상이 없어요</Empty> : (
          <>
            <SectionLabel>영상 {members.length}개{isStaff ? ` · ${card.studentName}` : ''}</SectionLabel>
            {members.map(v => (
              <ListRow key={v.id} left={<PlayThumb thumb={coverThumb(v)} status={classify(v)} />} title={v.title}
                sub={`${catLabel(v.category)} · ${(v.date || '').slice(5, 10)}${fmtDur(v.videoDuration)}`}
                right={stateTag(v, isStaff)} onClick={() => setSel(v)} />
            ))}
          </>
        )}
      </Scroll>
    </Screen>
  );
};

// 영상 상세 (검은 플레이어 + 강사 피드백)
const VideoDetail: React.FC<{ item: PortfolioItem; user: User; isStaff: boolean; onBack: () => void; onReload: () => Promise<void>; onDeleted: () => Promise<void>; onReupload?: () => void }> = ({ item, user, isStaff, onBack, onReload, onDeleted, onReupload }) => {
  const [fb, setFb] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [desc, setDesc] = useState(item.description || '');
  const comments = item.comments || [];
  const isOwner = !isStaff && item.studentId === user.id;

  // 커버(video_url) + 추가 영상(videos[])을 하나의 클립 목록으로
  const clips = [
    ...(item.videoUrl ? [{ id: 'cover', videoUrl: item.videoUrl, thumbnailUrl: item.thumbnailUrl as string | undefined, cover: true }] : []),
    ...(item.videos || []).map(v => ({ id: v.id, videoUrl: v.videoUrl, thumbnailUrl: v.thumbnailUrl, cover: false })),
  ];
  const [active, setActive] = useState(0);
  const cur = clips[Math.min(active, Math.max(0, clips.length - 1))];
  const removeClip = async (videoId: string) => {
    if (!window.confirm('이 영상을 삭제할까요?')) return;
    try { await portfolioApi.deleteVideo(item.id, videoId); toast.success('삭제했어요'); setActive(0); await onReload(); }
    catch (e: any) { toast.error(e.message || '삭제하지 못했어요'); }
  };

  const send = async () => {
    if (!fb.trim()) return;
    setBusy(true);
    try {
      await portfolioApi.addComment(item.id, fb.trim());
      toast.success('피드백을 보냈어요');
      setFb('');
      await onReload();
    } catch (e: any) {
      toast.error(e.message || '보내지 못했어요');
    } finally { setBusy(false); }
  };
  const saveEdit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await portfolioApi.update(item.id, { title: title.trim(), description: desc.trim() });
      toast.success('수정했어요');
      setEditing(false);
      await onReload();
    } catch (e: any) { toast.error(e.message || '수정하지 못했어요'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('이 영상을 삭제할까요?')) return;
    try { await portfolioApi.delete(item.id); toast.success('삭제했어요'); await onDeleted(); }
    catch (e: any) { toast.error(e.message || '삭제하지 못했어요'); }
  };

  return (
    <Screen>
      <BackHeader title="영상" onBack={onBack} right={isOwner ? (
        <button onClick={() => setEditing(v => !v)} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: TOSS.blue, padding: 4, cursor: 'pointer' }}>{editing ? '취소' : '수정'}</button>
      ) : undefined} />
      <Scroll>
        {/* 검은 플레이어 (여러 영상이면 아래 썸네일로 전환) */}
        <div style={{ background: TOSS.ink, height: 184, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cur
            ? <video key={cur.id} src={resolveFileUrl(cur.videoUrl)} controls playsInline style={{ width: '100%', height: '100%' }} />
            : classify(item) === 'failed'
              ? <div style={{ textAlign: 'center', color: '#fff', padding: '0 24px' }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 30, color: TOSS.warn }} />
                  <div style={{ fontSize: 14, marginTop: 8, fontWeight: 600 }}>업로드가 완료되지 않았어요</div>
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>{isOwner ? '다시 올리거나 삭제할 수 있어요' : '학생에게 다시 업로드를 요청하세요'}</div>
                </div>
              : <div style={{ textAlign: 'center', color: '#fff' }}>
                  <i className="ti ti-loader-2 spin" style={{ fontSize: 30 }} />
                  <div style={{ fontSize: 13, marginTop: 8, opacity: 0.85 }}>영상을 올리는 중이에요</div>
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.6 }}>앱을 닫아도 계속 업로드돼요</div>
                </div>}
        </div>
        {clips.length > 1 && (
          <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 20px 0' }}>
            {clips.map((c, i) => (
              <div key={c.id} onClick={() => setActive(i)} style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
                <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', boxSizing: 'border-box',
                  border: i === active ? `2px solid ${TOSS.blue}` : '2px solid transparent',
                  background: c.thumbnailUrl ? `#000 center/cover no-repeat url(${resolveFileUrl(c.thumbnailUrl)})` : TOSS.surf,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {!c.thumbnailUrl && <i className="ti ti-player-play" style={{ fontSize: 18, color: i === active ? TOSS.blue : TOSS.sub }} />}
                </div>
                {isOwner && !c.cover && (
                  <button onClick={e => { e.stopPropagation(); removeClip(c.id); }}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999, background: TOSS.warn, color: '#fff', border: '2px solid #fff', fontSize: 12, lineHeight: '16px', cursor: 'pointer', padding: 0 }}>×</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '16px 20px 0' }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목"
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: '11px 13px', fontSize: 15, color: TOSS.ink, outline: 'none' }} />
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="설명"
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: '11px 13px', fontSize: 15, color: TOSS.ink, outline: 'none' }} />
              <button onClick={saveEdit} disabled={busy || !title.trim()}
                style={{ width: '100%', background: TOSS.blue, color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>저장하기</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 19, fontWeight: 700, color: TOSS.ink }}>{item.title}</div>
              <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 6 }}>{item.studentName} · {catLabel(item.category)} · {(item.date || '').slice(5, 10)}</div>
              {item.description && item.description !== item.title && (
                <div style={{ fontSize: 14, color: TOSS.ink, lineHeight: 1.7, marginTop: 12 }}>{item.description}</div>
              )}
            </>
          )}

          {/* 피드백 영역은 영상이 실제로 있는 ready 상태에서만 (실패/업로드중엔 의미 없음) */}
          {classify(item) === 'ready' && (
            <>
              <div style={{ height: 1, background: TOSS.line, margin: '16px 0' }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 10 }}>강사 피드백 {comments.length}개</div>

              {comments.length === 0 && !isStaff && (
                <InfoBox tone="info">24시간 안에 피드백이 와요</InfoBox>
              )}

              {comments.map(c => (
                <div key={c.id} style={{ background: TOSS.surf, borderRadius: 13, padding: 13, marginBottom: 8, fontSize: 14, lineHeight: 1.7, color: TOSS.ink }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: TOSS.ink }}>{c.authorName}</span>
                    <span style={{ fontSize: 11, color: TOSS.sub }}>{(c.date || '').slice(5, 10)}</span>
                  </div>
                  {c.content}
                </div>
              ))}

              {isStaff && (
                <>
                  {comments.length === 0 && <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 10 }}>피드백 남기기</div>}
                  <textarea value={fb} onChange={e => setFb(e.target.value)} placeholder="구체적으로 알려주세요"
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 90, border: `1px solid ${TOSS.inputLine}`, borderRadius: 13, padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'none', color: TOSS.ink, outline: 'none', marginTop: 4 }} />
                </>
              )}
            </>
          )}

          {/* 실패: 본인이면 다시 올리기 */}
          {classify(item) === 'failed' && isOwner && onReupload && (
            <button onClick={onReupload} style={{ width: '100%', marginTop: 16, background: TOSS.blue, color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>다시 올리기</button>
          )}

          {isOwner && !editing && (
            <button onClick={remove} style={{ background: 'none', border: 'none', marginTop: 16, fontSize: 13, fontWeight: 500, color: TOSS.warn, cursor: 'pointer', padding: 0 }}>이 영상 삭제하기</button>
          )}
          <div style={{ height: 14 }} />
        </div>
      </Scroll>
      {isStaff && classify(item) === 'ready' && <Cta onClick={send} disabled={!fb.trim()} loading={busy}>피드백 보내기</Cta>}
    </Screen>
  );
};

// 영상 올리기
const UploadScreen: React.FC<{ onBack: () => void; onDone: () => Promise<void> }> = ({ onBack, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [mode, setMode] = useState<'individual' | 'single'>('individual');
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // 한 파일 업로드(네이티브 백그라운드 우선, 실패 시 웹 폴백)
  const uploadOne = async (f: File, targetType: string, targetId: string, label: string, prog: string): Promise<boolean> => {
    const bg = await nativeBackgroundUpload(f, API_URL, getToken() || '', {
      subfolder: 'portfolios', targetType, targetId, displayName: label,
    });
    if (bg) return true;
    setPhase(prog);
    await uploadApi.upload(f, pr => setProgress(pr), 'portfolios', targetType, targetId,
      (ph, pr) => { setPhase(ph === 'compressing' || ph === 'client_compressing' ? '영상 변환 중' : prog); setProgress(pr); });
    return false;
  };

  const submit = async () => {
    if (files.length === 0 || !cat || !title.trim()) return;
    setBusy(true);
    try {
      let bgCount = 0;
      const single = files.length > 1 && mode === 'single';
      if (single) {
        // 모드 A: 하나의 포트폴리오에 여러 영상 (첫 영상=커버, 이후=추가영상)
        const p = await portfolioApi.create({
          title: title.trim(), description: desc.trim() || title.trim(), category: cat as any,
          videoUrl: '', uploadMode: 'single', totalVideos: files.length,
        });
        for (let i = 0; i < files.length; i++) {
          const tType = i === 0 ? 'portfolio' : 'portfolio_video';
          if (await uploadOne(files[i], tType, p.id, `${title.trim()} ${i + 1}`, `업로드 중 (${i + 1}/${files.length})`)) bgCount++;
        }
      } else {
        // 모드 B: 영상마다 별도 포트폴리오
        for (let i = 0; i < files.length; i++) {
          const t = files.length > 1 ? `${title.trim()} ${i + 1}` : title.trim();
          const p = await portfolioApi.create({
            title: t, description: desc.trim() || t, category: cat as any, videoUrl: '',
            uploadMode: 'individual', totalVideos: files.length, videoIndex: i + 1,
            ...(files.length > 1 ? { practiceGroup: title.trim() } : {}),
          });
          if (await uploadOne(files[i], 'portfolio', p.id, t, files.length > 1 ? `업로드 중 (${i + 1}/${files.length})` : '업로드 중')) bgCount++;
        }
      }
      toast.success(bgCount > 0 ? '백그라운드 업로드를 시작했어요. 앱을 닫아도 계속돼요.' : '영상을 올렸어요');
      await onDone();
    } catch (e: any) {
      toast.error(e.message || '올리지 못했어요');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Screen>
      <BackHeader title="영상 올리기" onBack={onBack} />
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
        <FlowTitle pad="0">어떤 연습<br />영상인가요?</FlowTitle>

        {/* 영상 선택 박스 (여러 개 가능) */}
        <input ref={fileRef} type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={e => setFiles(Array.from(e.target.files || []))} />
        <div onClick={() => fileRef.current?.click()}
          style={{ background: files.length ? TOSS.successBg : TOSS.surf, borderRadius: 16, height: 116, marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
          <i className={`ti ${files.length ? 'ti-circle-check' : 'ti-photo'}`} style={{ fontSize: 30, color: files.length ? TOSS.success : TOSS.faint }} />
          <span style={{ fontSize: 13, color: files.length ? TOSS.success : TOSS.sub, maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {files.length === 0 ? '영상을 선택하세요 (여러 개 가능)' : files.length === 1 ? files[0].name : `${files.length}개 선택됨`}
          </span>
        </div>

        {/* 여러 영상일 때 업로드 방식 선택 */}
        {files.length > 1 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '16px 0 8px' }}>업로드 방식</div>
            <ChipSelect options={[{ value: 'individual', label: '각각 따로 올리기' }, { value: 'single', label: '하나로 묶기' }]}
              value={mode} onChange={v => setMode(v as 'individual' | 'single')} />
            <div style={{ fontSize: 12, color: TOSS.sub, marginTop: 6 }}>
              {mode === 'single' ? '여러 영상을 한 포트폴리오로 묶어요 (테이크·각도별)' : '영상마다 별도 포트폴리오로 올려요'}
            </div>
          </>
        )}

        <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '16px 0 8px' }}>제목</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 자유연기 3차"
          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: '12px 13px', fontSize: 15, color: TOSS.ink, outline: 'none' }} />

        <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '16px 0 8px' }}>설명 <span style={{ color: TOSS.faint, fontWeight: 400 }}>(선택)</span></div>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="예: 복식호흡 중점 연습"
          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${TOSS.inputLine}`, borderRadius: 12, padding: '12px 13px', fontSize: 15, color: TOSS.ink, outline: 'none' }} />

        <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, margin: '16px 0 8px' }}>카테고리</div>
        <ChipSelect wrap options={VIDEO_CATS} value={cat} onChange={setCat} />

        {progress != null && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: TOSS.sub, marginBottom: 4 }}>{phase} {Math.round(progress)}%</div>
            <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: TOSS.surf }}>
              <div style={{ height: '100%', width: `${progress}%`, background: TOSS.blue }} />
            </div>
          </div>
        )}
      </div>
      <Cta onClick={submit} disabled={files.length === 0 || !cat || !title.trim()} loading={busy}>
        {files.length > 1 ? (mode === 'single' ? `${files.length}개 묶어 올리기` : `${files.length}개 올리기`) : '영상 올리기'}
      </Cta>
    </Screen>
  );
};
