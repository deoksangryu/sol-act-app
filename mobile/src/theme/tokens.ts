import type { TextStyle } from 'react-native';

// === Toss 디자인 토큰 (web services/category.tsx의 TOSS와 1:1) ===
export const color = {
  blue: '#3182F6', blueBg: '#EAF2FF',
  purple: '#6D5BD0', purpleBg: '#EEEBFA',
  pink: '#E84F8B', pinkBg: '#FCE7F0',
  ink: '#191F28', sub: '#6B7684', faint: '#C4CCD4',
  surf: '#F2F4F6', line: '#EEF0F2',
  success: '#1B8A4B', successBg: '#E7F4EC',
  warn: '#C2410C', warnBg: '#FFF1E6',
  inputLine: '#E5E8EB',
  danger: '#E5484D',
  successInk: '#15662F',
  purpleInk: '#473A9E',
  infoInk: '#1B4F8A',
  dietBg: '#D9E6CC',
  requestLine: '#FCD9B5',
  dashLine: '#CDD3DA',
  white: '#FFFFFF',
  bg: '#F8FAFC',
  scrim: 'rgba(0,0,0,0.40)',
} as const;

// 라운드: tag 7 · icon-chip 13(시그니처) · card/input 12 · button/CTA 14 · pill 999
export const radius = { tag: 7, chip: 13, card: 12, button: 14, pill: 999 } as const;

// 여백: 화면 좌우 20 · 헤더 14 · 행 세로 12 · 아이콘↔텍스트 gap 13
export const space = { screenX: 20, headerX: 14, rowY: 12, gap: 13 } as const;

// 콘텐츠 최대 폭(중앙정렬)
export const MAX_WIDTH = 480;

// 시그니처 overshoot 스프링 (확인 완료 애니메이션 등)
export const SPRING = { damping: 12, stiffness: 180, mass: 0.6 };

// 타이포 프리셋 — 기본 서체는 시스템(한글 렌더 OK). Noto Sans KR는 후속 단계에서 expo-font로 주입.
// (letterSpacing은 web의 em을 px로 환산: 타이틀 -0.02em × 23px ≈ -0.46)
export const text: Record<string, TextStyle> = {
  bigTitle: { fontSize: 23, fontWeight: '700', lineHeight: 31, letterSpacing: -0.46, color: color.ink },
  flowTitle: { fontSize: 23, fontWeight: '700', lineHeight: 31, letterSpacing: -0.46, color: color.ink },
  sectionLabel: { fontSize: 13, fontWeight: '500', color: color.sub },
  headerTitle: { fontSize: 16, fontWeight: '600', color: color.ink },
  rowTitle: { fontSize: 15, fontWeight: '500', color: color.ink },
  rowSub: { fontSize: 13, fontWeight: '400', color: color.sub },
  tag: { fontSize: 12, fontWeight: '500' },
  cta: { fontSize: 16, fontWeight: '600' },
  ghost: { fontSize: 14, fontWeight: '600', color: color.blue },
  body: { fontSize: 14, fontWeight: '400', color: color.ink },
  caption: { fontSize: 11, fontWeight: '400', color: color.sub },
  tabLabel: { fontSize: 10, fontWeight: '400' },
  wordmark: { fontSize: 28, fontWeight: '800', color: color.blue, letterSpacing: -0.3 },
};
