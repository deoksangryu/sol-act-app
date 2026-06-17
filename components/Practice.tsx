import React, { useEffect, useRef, useState } from 'react';
import { User, PracticeCurrent, PracticeScriptView, PortfolioItem } from '../types';
import { practiceApi, portfolioApi, uploadApi, API_URL, getToken, resolveFileUrl } from '../services/api';
import { nativeBackgroundUpload, confirmVideoAudioRisk } from '../services/nativeUpload';
import { getVideoDuration } from '../services/videoMeta';
import { useDataRefresh } from '../services/useWebSocket';
import { TOSS } from '../services/category';
import { Screen, BackHeader, InfoBox, Tag, ListRow, SectionLabel } from './toss/kit';
import toast from 'react-hot-toast';

const MAX_SEC = 120; // 제시대사 연기영상은 2분 이내

const fmtCountdown = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

const Spinner: React.FC = () => (
  <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid #E5E8EB', borderTopColor: TOSS.blue, borderRadius: '50%' }} />
);

// 대사 본문 — 학생에겐 대사만. 독백은 문단, 2인대사는 화자 라벨 + 대사.
const ScriptBody: React.FC<{ sv: PracticeScriptView; compact?: boolean }> = ({ sv, compact }) => {
  const isDuo = sv.type === '2인대사';
  return (
    <div style={{ background: TOSS.surf, borderRadius: 16, padding: compact ? '16px 16px' : '22px 18px', marginTop: 14 }}>
      {sv.script.map((ln, i) => (
        <div key={i} style={{ marginTop: i ? (isDuo ? 16 : 13) : 0 }}>
          {isDuo && ln.speaker && (
            <div style={{ fontSize: 13, fontWeight: 700, color: TOSS.blue, marginBottom: 4 }}>{ln.speaker}</div>
          )}
          <div style={{ fontSize: 17, lineHeight: 1.85, color: TOSS.ink, whiteSpace: 'pre-wrap', letterSpacing: '-.01em' }}>{ln.text}</div>
        </div>
      ))}
    </div>
  );
};

// 연기영상 상태 → 태그
const perfTag = (status: string, hasFeedback: boolean): React.ReactNode => {
  if (status === 'failed') return <Tag bg={TOSS.warnBg} fg={TOSS.warn}>업로드 실패</Tag>;
  if (status === 'uploading') return <Tag bg={TOSS.blueBg} fg={TOSS.blue}>업로드 중</Tag>;
  return hasFeedback
    ? <Tag bg={TOSS.successBg} fg={TOSS.success}>피드백 완료</Tag>
    : <Tag bg={TOSS.blueBg} fg={TOSS.blue}>피드백 대기</Tag>;
};

const itemStatus = (v: PortfolioItem): 'ready' | 'uploading' | 'failed' =>
  (v.uploadStatus as any) || (v.videoUrl ? 'ready' : 'uploading');

// ── 내 연기영상 상세 — 재생 + 연기한 제시대사 원문 + 피드백 ──
const PerformanceDetail: React.FC<{ portfolioId: string; scriptId?: string; onBack: () => void }> = ({ portfolioId, scriptId, onBack }) => {
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [script, setScript] = useState<PracticeScriptView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portfolioApi.get(portfolioId).then(setItem).catch(() => {}).finally(() => setLoading(false));
    if (scriptId) practiceApi.getScript(scriptId).then(setScript).catch(() => {});
  }, [portfolioId, scriptId]);

  const comments = item?.comments || [];
  const status = item ? itemStatus(item) : 'uploading';

  return (
    <Screen>
      <BackHeader title="내 연기영상" onBack={onBack} />
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ background: TOSS.ink, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {item?.videoUrl
            ? <video src={resolveFileUrl(item.videoUrl)} controls playsInline style={{ width: '100%', height: '100%' }} />
            : <div style={{ textAlign: 'center', color: '#fff' }}>
                <i className={`ti ${status === 'failed' ? 'ti-alert-triangle' : 'ti-loader-2 spin'}`} style={{ fontSize: 28, color: status === 'failed' ? TOSS.warn : '#fff' }} />
                <div style={{ fontSize: 13, marginTop: 8, opacity: 0.85 }}>{status === 'failed' ? '업로드가 완료되지 않았어요' : '영상을 올리는 중이에요'}</div>
                {status !== 'failed' && <div style={{ fontSize: 11, marginTop: 2, opacity: 0.6 }}>앱을 닫아도 계속 업로드돼요</div>}
              </div>}
        </div>
        <div style={{ padding: '16px 20px 24px' }}>
          {loading && !item ? <Spinner /> : (
            <>
              {script && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag bg={TOSS.blueBg} fg={TOSS.blue}>{script.type}</Tag>
                    <span style={{ fontSize: 13, color: TOSS.sub }}>연기한 제시대사</span>
                  </div>
                  <ScriptBody sv={script} compact />
                </>
              )}
              <div style={{ height: 1, background: TOSS.line, margin: '18px 0' }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: TOSS.sub, marginBottom: 10 }}>선생님 피드백 {comments.length}개</div>
              {comments.length === 0
                ? <InfoBox tone="info">아직 피드백이 없어요. 선생님이 확인하면 알려드려요.</InfoBox>
                : comments.map(c => (
                    <div key={c.id} style={{ background: TOSS.surf, borderRadius: 13, padding: 13, marginBottom: 8, fontSize: 14, lineHeight: 1.7, color: TOSS.ink }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: TOSS.ink }}>{c.authorName}</span>
                        <span style={{ fontSize: 11, color: TOSS.sub }}>{(c.date || '').slice(5, 10)}</span>
                      </div>
                      {c.content}
                    </div>
                  ))}
            </>
          )}
        </div>
      </div>
    </Screen>
  );
};

/** 제시대사 탭 — 뽑기 몰입형. 1시간에 한 번 안 본 대사 랜덤(학생에겐 대사만).
 *  뽑은 대사마다 2분 이내 연기영상을 선택적으로 1개 올릴 수 있고, 선생·원장이 피드백한다. */
export const Practice: React.FC<{ user: User; asTab?: boolean; onClose?: () => void }> = ({ user, asTab = false, onClose = () => {} }) => {
  const [data, setData] = useState<PracticeCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [requested, setRequested] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [mine, setMine] = useState<PortfolioItem[]>([]);
  const [detail, setDetail] = useState<{ portfolioId: string; scriptId?: string } | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoadError(false);
    practiceApi.current()
      .then((d) => { setData(d); setRemaining(d.canDrawNew ? 0 : d.cooldownSecondsRemaining); })
      .catch((e: any) => { setLoadError(true); toast.error(e.message || '불러오지 못했어요'); })
      .finally(() => setLoading(false));
  };
  const loadMine = () => portfolioApi.list({ studentId: user.id, category: 'scripted', limit: 50 }).then(setMine).catch(() => {});
  useEffect(() => { load(); loadMine(); /* eslint-disable-next-line */ }, []);
  useDataRefresh(['portfolios'], () => { load(); loadMine(); });

  useEffect(() => {
    const t = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const cur = data?.current || null;
  const perf = data?.performance || null;
  const canDraw = !!data && remaining <= 0;

  const onDraw = async () => {
    if (!canDraw || generating) return;
    setGenerating(true);
    try {
      const [res] = await Promise.all([practiceApi.draw(), new Promise((r) => setTimeout(r, 1100))]);
      setData(res);
      setRemaining(res.cooldownSecondsRemaining);
    } catch (e: any) {
      toast.error(e.message || '제시대사를 받지 못했어요');
      practiceApi.current().then((d) => { setData(d); setRemaining(d.canDrawNew ? 0 : d.cooldownSecondsRemaining); }).catch(() => {});
    } finally {
      setGenerating(false);
    }
  };

  const onRequestMore = async () => {
    if (requested) return;
    try {
      const res = await practiceApi.requestMore();
      setRequested(true);
      toast.success(res.already ? '이미 요청했어요. 원장님께 전달돼 있어요.' : '원장님께 새 제시대사를 요청했어요!');
    } catch (e: any) {
      toast.error(e.message || '요청하지 못했어요');
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !cur) return;
    const dur = await getVideoDuration(f);
    if (dur != null && dur > MAX_SEC) {
      toast.error(`2분 이내 영상만 올릴 수 있어요 (현재 약 ${Math.round(dur)}초)`);
      return;
    }
    if (!(await confirmVideoAudioRisk(f))) return;
    setUploadBusy(true);
    setProgress(null);
    try {
      const snippet = (cur.script[0]?.text || '').replace(/\s+/g, ' ').trim().slice(0, 14);
      const p = await portfolioApi.create({
        title: snippet ? `제시대사 · ${snippet}…` : '제시대사 연기',
        description: (cur.script[0]?.text || '제시대사 연기').slice(0, 40),
        category: 'scripted' as any,
        videoUrl: '',
        practiceScriptId: cur.id,
      } as any);
      const bg = await nativeBackgroundUpload(f, API_URL, getToken() || '', {
        subfolder: 'portfolios', targetType: 'portfolio', targetId: p.id, displayName: '제시대사 연기',
      });
      if (!bg) {
        await uploadApi.upload(f, (pr) => setProgress(pr), 'portfolios', 'portfolio', p.id, (_ph, pr) => setProgress(pr));
      }
      toast.success(bg ? '업로드를 시작했어요. 앱을 닫아도 계속돼요.' : '연기영상을 올렸어요');
      setTimeout(() => { load(); loadMine(); }, 500);
    } catch (err: any) {
      toast.error(err.message || '영상을 올리지 못했어요');
    } finally {
      setUploadBusy(false);
      setProgress(null);
    }
  };

  // ── 상세 화면 ──
  if (detail) return <PerformanceDetail portfolioId={detail.portfolioId} scriptId={detail.scriptId} onBack={() => setDetail(null)} />;

  // 공통 래퍼: 탭이면 헤더 없이, 오버레이면 BackHeader
  const Wrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Screen>
      {!asTab && <BackHeader title="제시대사" onBack={onClose} />}
      {children}
    </Screen>
  );

  if (loading) return <Wrap><div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div></Wrap>;

  if (generating) return (
    <Wrap>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 32px' }}>
        <Spinner />
        <div style={{ fontSize: 16, fontWeight: 600, color: TOSS.ink }}>제시대사를 준비하고 있어요…</div>
        <div style={{ fontSize: 13, color: TOSS.sub }}>오늘의 대사를 뽑는 중</div>
      </div>
    </Wrap>
  );

  if (loadError && !data) return (
    <Wrap>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 32px' }}>
        <i className="ti ti-cloud-off" style={{ fontSize: 30, color: TOSS.faint }} />
        <div style={{ fontSize: 15, color: TOSS.sub }}>제시대사를 불러오지 못했어요.</div>
        <button onClick={() => { setLoading(true); load(); }} style={{ background: '#fff', border: `1.5px solid ${TOSS.blue}`, color: TOSS.blue, borderRadius: 14, padding: '12px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>다시 시도</button>
      </div>
    </Wrap>
  );

  const drawLabel = remaining > 0 ? `다음 제시대사까지 ${fmtCountdown(remaining)}` : (cur ? '새 제시대사 받기' : '제시대사 받기');
  const drawOff = remaining > 0 || generating;

  return (
    <Wrap>
      <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={onFile} />
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 24px' }}>
        {data?.exhausted && (
          <div style={{ marginBottom: 16 }}>
            <InfoBox tone="success">제시대사 {data.totalScripts}개를 모두 연습했어요! 👏 원장님께 새 대사를 요청할 수 있어요.</InfoBox>
            <button onClick={requested ? undefined : onRequestMore} disabled={requested}
              style={{ width: '100%', marginTop: 10, background: '#fff', border: `1.5px solid ${TOSS.blue}`, color: TOSS.blue, borderRadius: 14, padding: '13px 6px', fontSize: 14, fontWeight: 600, cursor: requested ? 'default' : 'pointer' }}>
              {requested ? '요청했어요 ✓' : '원장님께 새 제시대사 요청하기'}
            </button>
          </div>
        )}

        {cur ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Tag bg={TOSS.blueBg} fg={TOSS.blue}>{cur.type}</Tag>
              <span style={{ fontSize: 12, color: TOSS.faint }}>{data ? `${data.seenCount} / ${data.totalScripts}` : ''}</span>
            </div>
            <div style={{ textAlign: 'left' }}><ScriptBody sv={cur} /></div>
            {remaining > 0 && (
              <div style={{ fontSize: 13, color: TOSS.sub, marginTop: 12 }}>⏱ 다음 대사까지 {fmtCountdown(remaining)}</div>
            )}
            <button onClick={drawOff ? undefined : onDraw} disabled={drawOff}
              style={{ width: '100%', marginTop: 14, background: drawOff ? TOSS.surf : TOSS.blue, color: drawOff ? TOSS.sub : '#fff', border: 'none', borderRadius: 14, padding: 15, fontSize: 16, fontWeight: 600, cursor: drawOff ? 'default' : 'pointer' }}>
              {drawLabel}
            </button>

            {/* 연기영상 — 선택. 이미 올렸으면 상태 카드, 아니면 올리기 버튼 */}
            {perf ? (
              <div onClick={() => setDetail({ portfolioId: perf.portfolioId, scriptId: cur.id })}
                style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, background: TOSS.surf, borderRadius: 14, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: TOSS.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {perf.thumbnailUrl
                    ? <img src={resolveFileUrl(perf.thumbnailUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <i className="ti ti-player-play" style={{ fontSize: 18, color: '#fff' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TOSS.ink }}>내 연기영상</div>
                  <div style={{ fontSize: 12, color: TOSS.sub, marginTop: 2 }}>{perf.hasFeedback ? `피드백 ${perf.commentCount}개` : '눌러서 확인'}</div>
                </div>
                {perfTag(perf.uploadStatus, perf.hasFeedback)}
              </div>
            ) : (
              <button onClick={uploadBusy ? undefined : () => fileRef.current?.click()} disabled={uploadBusy}
                style={{ width: '100%', marginTop: 10, background: '#fff', border: `1.5px solid ${TOSS.blue}`, color: TOSS.blue, borderRadius: 14, padding: '13px 6px', fontSize: 14, fontWeight: 600, cursor: uploadBusy ? 'default' : 'pointer' }}>
                {uploadBusy ? (progress != null ? `올리는 중 ${Math.round(progress)}%` : '올리는 중…') : '🎬 이 대사로 연기영상 올리기 (2분 이내)'}
              </button>
            )}

            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <InfoBox tone="info">
                상황·인물·감정은 적혀 있지 않아요. <b>직접 분석</b>해서 어떤 상황의 누구인지 정하고, 소리 내어 연기해 보세요.
                {cur.type === '2인대사' && <><br />2인 대사예요 — 상대역은 상상하며, 두 인물을 모두 연기하거나 한쪽에 집중해 보세요.</>}
              </InfoBox>
            </div>
          </div>
        ) : (
          <div style={{ padding: '32px 4px 8px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: TOSS.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <i className="ti ti-masks-theater" style={{ fontSize: 32, color: TOSS.blue }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: TOSS.ink, marginTop: 18 }}>오늘의 제시대사를 받아보세요</div>
            <div style={{ fontSize: 14, color: TOSS.sub, marginTop: 10, lineHeight: 1.7 }}>
              버튼을 누르면 대사가 하나 주어져요.<br />상황과 감정은 스스로 분석해서 연기해 보세요.<br />
              <span style={{ color: TOSS.faint }}>한 번 받으면 1시간 뒤에 새 대사를 받을 수 있어요.</span>
            </div>
            <button onClick={drawOff ? undefined : onDraw} disabled={drawOff}
              style={{ width: '100%', marginTop: 22, background: drawOff ? TOSS.surf : TOSS.blue, color: drawOff ? TOSS.sub : '#fff', border: 'none', borderRadius: 14, padding: 15, fontSize: 16, fontWeight: 600, cursor: drawOff ? 'default' : 'pointer' }}>
              {drawLabel}
            </button>
          </div>
        )}

        {/* 내 연기영상 목록 */}
        {mine.length > 0 && (
          <>
            <div style={{ height: 1, background: TOSS.line, margin: '22px 0 4px' }} />
            <SectionLabel>내 연기영상 {mine.length}</SectionLabel>
            {mine.map((v) => {
              const st = itemStatus(v);
              const hasFb = (v.comments?.length ?? 0) > 0;
              return (
                <ListRow key={v.id}
                  left={<div style={{ width: 44, height: 44, borderRadius: 10, background: TOSS.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {v.thumbnailUrl ? <img src={resolveFileUrl(v.thumbnailUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ti ti-player-play" style={{ fontSize: 17, color: '#fff' }} />}
                  </div>}
                  title="제시대사 연기"
                  sub={(v.date || '').slice(5, 10)}
                  right={perfTag(st, hasFb)}
                  onClick={() => setDetail({ portfolioId: v.id, scriptId: v.practiceScriptId })}
                />
              );
            })}
          </>
        )}
      </div>
    </Wrap>
  );
};
