import React from 'react';

// 연습실 원칙 (practice-principles-poster.html 의 본문을 앱 시트로 옮김)
const GOLD = '#c9a24b';
const GOLD_BRIGHT = '#e7c46a';
const BONE = '#f2ede0';
const MUTED = '#8c8676';
const LINE = '#2b2820';

const PRINCIPLES = [
  { n: '01', t: '오늘 확인할 질문 하나를 들고 들어가라', b: '질문 없는 반복은 연습이 아니라 워밍업이다. “이 대사를 낮게 깔면 긴장이 사는가” — 검증할 한 가지를 정하고 시작하라.' },
  { n: '02', t: '한 번에 하나만 바꿔라', b: '다 고치려다 다 무너진다. 오늘은 호흡만, 다음은 시선만. 변수를 하나만 통제해야 무엇을 바꿔 무엇이 달라졌는지 배운다.' },
  { n: '03', t: '감정을 짜내지 마라, 의도로 행동하라', b: '“슬프게”는 가짜를 부른다. “가지 말라고 붙잡는다” — 상대에게 무엇을 하려는가를 정하면 감정은 따라온다.' },
  { n: '04', t: '실패를 데이터로 삼아라', b: '망한 건 부끄러운 게 아니라 수확이다. “방금 건 왜 안 됐지?”를 입 밖으로 꺼내라. 안 되는 방식 하나를 확인한 것도 전진이다.' },
  { n: '05', t: '찍어서 네 눈으로 봐라', b: '머릿속 의도와 화면 속 결과는 다르다. 녹화하고 어디서 어긋났는지 직접 짚어라. 객관화 없이는 깨달음이 네 것이 되지 않는다.' },
  { n: '06', t: '끝낼 때 다음 시도를 남겨라', b: '“다음엔 이걸 해본다” 한 줄을 적고 나가라. 연습과 연습이 이어져야 성장 곡선이 생긴다. 끊기면 매번 0에서 시작이다.' },
];

export const PracticePrinciples: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', flexDirection: 'column', background: 'radial-gradient(120% 70% at 50% -8%, #16140f 0%, #0d0d0f 55%, #08080a 100%)' }}>
    {/* 헤더 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', flexShrink: 0, paddingTop: 'calc(8px + env(safe-area-inset-top))' }}>
      <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', display: 'flex' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 22, color: BONE }} />
      </button>
      <span style={{ fontSize: 14, fontWeight: 600, color: BONE, letterSpacing: '.02em' }}>연습실 원칙</span>
    </div>

    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 22px 32px' }}>
      <div style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.45em', color: GOLD, fontWeight: 700, marginTop: 6 }}>연기 입시 · 연습실 원칙</div>
      <div style={{ textAlign: 'center', marginTop: 18, lineHeight: 1.05 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: BONE, letterSpacing: '-.01em' }}>반복하지 마라</div>
        <div style={{ fontSize: 38, fontWeight: 800, color: GOLD_BRIGHT, letterSpacing: '-.01em' }}>검증하라</div>
      </div>
      <p style={{ textAlign: 'center', margin: '20px auto 0', maxWidth: 340, fontSize: 13, lineHeight: 1.8, color: '#cfc9bb', fontWeight: 300 }}>
        <b style={{ color: GOLD_BRIGHT, fontWeight: 700 }}>30번을 반복해도, 묻지 않으면 1번 한 것과 같다.</b><br />
        연습은 외우는 게 아니라 가설을 던지고 부딪혀 깨지는 일이다. 깨달음은 선생이 주는 게 아니라, 네가 직접 부딪혀야 생긴다.
      </p>
      <div style={{ width: 44, height: 2, background: GOLD, margin: '24px auto 8px' }} />

      <div style={{ borderTop: `1px solid ${LINE}` }}>
        {PRINCIPLES.map((p) => (
          <div key={p.n} style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: 14, padding: '18px 2px', borderBottom: `1px solid ${LINE}`, alignItems: 'start' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: GOLD, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{p.n}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: BONE, lineHeight: 1.35 }}>{p.t}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginTop: 6 }}>{p.b}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', margin: '28px auto 0', maxWidth: 340 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: GOLD_BRIGHT, lineHeight: 1.6 }}>“오늘, 나는 무엇을 부딪혀 깨뜨릴 것인가?”</div>
        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.7, marginTop: 10 }}>이 질문에 답하지 못하면 — 아직 연습을 시작하지 않은 것이다.</div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 26, fontSize: 10, letterSpacing: '.3em', color: '#5a5648' }}>쏠연기뮤지컬학원</div>
    </div>
  </div>
);
