import React, { useEffect, useState } from 'react';
import { User, PracticeCurrent, PracticeScriptView } from '../types';
import { practiceApi } from '../services/api';
import { TOSS } from '../services/category';
import { BackHeader, Cta, InfoBox, Tag } from './toss/kit';
import toast from 'react-hot-toast';

// 전체화면 오버레이 — 헤더 마스크 아이콘 진입(공지와 동일 패턴)
const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#fff', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
    {children}
  </div>
);

const fmtCountdown = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Spinner: React.FC = () => (
  <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid #E5E8EB', borderTopColor: TOSS.blue, borderRadius: '50%' }} />
);

// 대사 본문 — 학생에겐 대사만. 독백은 문단, 2인대사는 화자 라벨 + 대사.
const ScriptBody: React.FC<{ sv: PracticeScriptView }> = ({ sv }) => {
  const isDuo = sv.type === '2인대사';
  return (
    <div style={{ background: TOSS.surf, borderRadius: 16, padding: '20px 18px', marginTop: 14 }}>
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

/** 제시대사 연습 — 헤더 마스크 진입(전체화면). 1시간에 한 번, 안 본 대사 랜덤. 학생에겐 대사만. */
export const Practice: React.FC<{ user: User; onClose?: () => void }> = ({ user, onClose = () => {} }) => {
  const [data, setData] = useState<PracticeCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [remaining, setRemaining] = useState(0);

  // 최초 로드 — 현재 받은 대사 + 쿨다운
  useEffect(() => {
    practiceApi.current()
      .then((d) => { setData(d); setRemaining(d.canDrawNew ? 0 : d.cooldownSecondsRemaining); })
      .catch((e: any) => toast.error(e.message || '불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  // 1초 카운트다운(컴포넌트 생애 1개 인터벌)
  useEffect(() => {
    const t = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const canDraw = !!data && remaining <= 0;

  const onDraw = async () => {
    if (!canDraw || generating) return;
    setGenerating(true);
    try {
      // 실제 호출 + 최소 연출 시간(마치 방금 생성되는 것처럼)
      const [res] = await Promise.all([
        practiceApi.draw(),
        new Promise((r) => setTimeout(r, 1100)),
      ]);
      setData(res);
      setRemaining(res.cooldownSecondsRemaining);
    } catch (e: any) {
      toast.error(e.message || '제시대사를 받지 못했어요');
      // 쿨다운 등으로 실패 시 상태 동기화
      practiceApi.current().then((d) => { setData(d); setRemaining(d.canDrawNew ? 0 : d.cooldownSecondsRemaining); }).catch(() => {});
    } finally {
      setGenerating(false);
    }
  };

  // 로딩
  if (loading) return (
    <Overlay>
      <BackHeader title="제시대사" onBack={onClose} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
    </Overlay>
  );

  // 생성 연출
  if (generating) return (
    <Overlay>
      <BackHeader title="제시대사" onBack={onClose} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 32px' }}>
        <Spinner />
        <div style={{ fontSize: 16, fontWeight: 600, color: TOSS.ink }}>제시대사를 준비하고 있어요…</div>
        <div style={{ fontSize: 13, color: TOSS.sub }}>오늘의 대사를 뽑는 중</div>
      </div>
    </Overlay>
  );

  const cur = data?.current || null;
  const btnLabel = remaining > 0
    ? `다음 제시대사까지 ${fmtCountdown(remaining)}`
    : (cur ? '새 제시대사 받기' : '제시대사 받기');

  return (
    <Overlay>
      <BackHeader title="제시대사" onBack={onClose} />
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 20px' }}>
        {cur ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag bg={TOSS.blueBg} fg={TOSS.blue}>{cur.type}</Tag>
              <span style={{ fontSize: 12, color: TOSS.faint }}>
                {data ? `${data.seenCount} / ${data.totalScripts}개 연습` : ''}
              </span>
            </div>
            <div style={{ fontSize: 21, fontWeight: 700, color: TOSS.ink, marginTop: 12, letterSpacing: '-.02em' }}>
              오늘의 제시대사
            </div>
            <ScriptBody sv={cur} />
            <div style={{ marginTop: 16 }}>
              <InfoBox tone="info">
                상황·인물·감정은 적혀 있지 않아요. <b>직접 분석</b>해서 어떤 상황의 누구인지 정하고, 소리 내어 연기해 보는 게 연습이에요.
              </InfoBox>
            </div>
          </>
        ) : (
          // 아직 한 번도 안 받은 상태
          <div style={{ padding: '36px 4px 0', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: TOSS.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <i className="ti ti-masks-theater" style={{ fontSize: 32, color: TOSS.blue }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: TOSS.ink, marginTop: 18 }}>오늘의 제시대사를 받아보세요</div>
            <div style={{ fontSize: 14, color: TOSS.sub, marginTop: 10, lineHeight: 1.7 }}>
              버튼을 누르면 대사가 하나 주어져요.<br />상황과 감정은 스스로 분석해서 연기해 보세요.<br />
              <span style={{ color: TOSS.faint }}>한 번 받으면 1시간 뒤에 새 대사를 받을 수 있어요.</span>
            </div>
          </div>
        )}
      </div>
      <Cta onClick={onDraw} disabled={remaining > 0}>{btnLabel}</Cta>
    </Overlay>
  );
};
