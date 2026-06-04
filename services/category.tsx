import React from 'react';
import { Subject, SUBJECT_LABELS } from '../types';

// === Toss 디자인 토큰 (인라인 스타일용 hex) ===
export const TOSS = {
  blue: '#3182F6', blueBg: '#EAF2FF',
  purple: '#6D5BD0', purpleBg: '#EEEBFA',
  pink: '#E84F8B', pinkBg: '#FCE7F0',
  // sub: 흰 배경 위 약 4.6:1 — WCAG AA 통과(이전 #8B95A1는 2.9:1로 미달).
  // faint: 비활성 chevron·플레이스홀더 등 '읽지 않아도 되는' 장식 전용.
  ink: '#191F28', sub: '#6B7684', faint: '#C4CCD4',
  surf: '#F2F4F6', line: '#EEF0F2',
  success: '#1B8A4B', successBg: '#E7F4EC',
  warn: '#C2410C', warnBg: '#FFF1E6',
  // --- 토큰화된 일회성 hex (인라인 리터럴 흡수) ---
  inputLine: '#E5E8EB',          // 입력창 보더
  danger: '#E5484D',             // 일요일·위험 신호
  successInk: '#15662F',         // 연한 success 배경 위 본문(가독성 보정)
  purpleInk: '#473A9E',          // 연한 purple 배경 위 본문
  infoInk: '#1B4F8A',            // 연한 blue 배경 위 본문(음악 안내 등)
  dietBg: '#D9E6CC',             // 식단 카드 연녹 배경
  requestLine: '#FCD9B5',        // 음원 요청 카드 보더
  dashLine: '#CDD3DA',           // 점선 보더
} as const;

export interface CatColor { bg: string; fg: string; }

/** 수업 카테고리 → 색상 페어 (프로토타입 catC 대응) */
export function catColor(cat?: string | null): CatColor {
  switch (cat) {
    case Subject.ACTING: return { bg: TOSS.blueBg, fg: TOSS.blue };
    case Subject.MUSICAL: return { bg: TOSS.purpleBg, fg: TOSS.purple };
    case Subject.DANCE: return { bg: TOSS.pinkBg, fg: TOSS.pink };
    default: return { bg: TOSS.surf, fg: TOSS.sub };
  }
}

export function subjectLabel(cat?: string | null): string {
  if (cat && cat in SUBJECT_LABELS) return SUBJECT_LABELS[cat as Subject];
  return '수업';
}

// === 카테고리 SVG 아이콘 (프로토타입 SVGIc 경로 그대로) ===

function ActingSvg({ c, s }: { c: string; s: number }) {
  return (
    <svg viewBox="0 0 100 100" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
      <path d="M 50 16 C 65 16 75 28 75 42 L 75 56 C 75 72 65 84 50 86 C 35 84 25 72 25 56 L 25 42 C 25 28 35 16 50 16 Z" fill="none" stroke={c} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="40" cy="46" r="4.5" fill={c} />
      <circle cx="60" cy="46" r="4.5" fill={c} />
      <path d="M 36 62 Q 50 72 64 62" stroke={c} strokeWidth="4.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function MusicalSvg({ c, s }: { c: string; s: number }) {
  return (
    <svg viewBox="0 0 100 100" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
      <rect x="36" y="18" width="28" height="38" rx="14" fill="none" stroke={c} strokeWidth="5" />
      <line x1="50" y1="58" x2="50" y2="72" stroke={c} strokeWidth="6" strokeLinecap="round" />
      <path d="M 36 76 Q 50 81 64 76" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="76" cy="32" r="4" fill={c} />
      <line x1="80" y1="31" x2="80" y2="18" stroke={c} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DanceSvg({ c, s }: { c: string; s: number }) {
  return (
    <svg viewBox="0 0 100 100" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="22" r="8" fill={c} />
      <path d="M 52 30 Q 62 22 74 12" stroke={c} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M 48 32 Q 36 35 28 50" stroke={c} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M 50 30 L 48 54" stroke={c} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M 48 54 L 46 84" stroke={c} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M 50 54 Q 65 56 78 62" stroke={c} strokeWidth="6.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** 카테고리 아이콘을 둥근 배경 칩 안에 렌더 (프로토타입 ic() 대응) */
export const CategoryIcon: React.FC<{ cat?: string | null; size?: number }> = ({ cat, size = 44 }) => {
  const { bg, fg } = catColor(cat);
  const s = Math.round(size * 0.66);
  let inner: React.ReactNode = null;
  if (cat === Subject.ACTING) inner = <ActingSvg c={fg} s={s} />;
  else if (cat === Subject.MUSICAL) inner = <MusicalSvg c={fg} s={s} />;
  else if (cat === Subject.DANCE) inner = <DanceSvg c={fg} s={s} />;
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: 13, background: bg }}
    >
      {inner}
    </div>
  );
};
