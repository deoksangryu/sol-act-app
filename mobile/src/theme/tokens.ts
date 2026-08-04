import type { TextStyle, ViewStyle } from 'react-native';
import { useWindowDimensions } from 'react-native';

// === v2 디자인 토큰 (프로토타입 sol-prototype-v1.html 팔레트) ===
// 의미 규약: 박수=amber · 완료/성장=success · 마감/위험=danger · 주액션=blue · 음악/녹음=purple
export const color = {
  blue: '#3182F6', blueBg: '#E8F3FF',
  purple: '#7048E8', purpleBg: '#F1EBFF',
  pink: '#E84F8B', pinkBg: '#FCE7F0',
  amber: '#FF9F0A', amberBg: '#FFF4E0',      // 박수 👏 accent (warn과 별개 키)
  ink: '#191F28', sub: '#4E5968', sub2: '#8B95A1', faint: '#B0B8C1',
  surf: '#F2F4F6', line: '#E6E9ED',   // 흰 카드 위에서도 보이는 헤어라인(구 #EEF0F2는 흰 배경에서 사실상 안 보임)
  success: '#02B26E', successBg: '#E5F7EF',
  warn: '#C2410C', warnBg: '#FFF1E6',        // 미처리/pending 태그·카운트 배지(유지)
  inputLine: '#E5E8EB',
  danger: '#F04452', dangerBg: '#FDEDEE',
  successInk: '#15662F',
  purpleInk: '#473A9E',
  infoInk: '#1B4F8A',
  dietBg: '#D9E6CC',
  requestLine: '#FCD9B5',
  dashLine: '#CDD3DA',
  white: '#FFFFFF',
  bg: '#F2F4F6',
  scrim: 'rgba(25,31,40,0.55)',
} as const;

// 라운드: tag 7 · icon-chip 14 · card 22(v2) · button 15 · hero 24 · modal 26 · pill 999
export const radius = { tag: 7, chip: 14, card: 22, button: 15, hero: 24, modal: 26, pill: 999 } as const;

// 여백: 화면 좌우 20 · 헤더 14 · 행 세로 12 · 아이콘↔텍스트 gap 13
export const space = { screenX: 20, headerX: 14, rowY: 12, gap: 13 } as const;

// 카드 그림자 — Android elevation(테스트 대상)에서 은은한 입체감. flat로 끌 수 있음.
export const shadow: { card: ViewStyle } = {
  card: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
};

// 콘텐츠 최대 폭(중앙정렬) — 폰 기준
export const MAX_WIDTH = 480;
// 태블릿 대응: 이 폭 이상이면 태블릿으로 보고 콘텐츠 컬럼을 조금 넓힘(가독성 유지 위해 과하게 넓히지 않음).
// 폰은 화면폭이 480보다 좁아 아래 값이 적용돼도 실제 폭은 그대로다(무영향).
export const TABLET_MIN_WIDTH = 700;
export const CONTENT_MAX_WIDTH_TABLET = 640;
// 현재 화면 폭에 맞는 콘텐츠 최대폭 반환(폰=480 / 태블릿=640).
export function useContentMaxWidth(): number {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH ? CONTENT_MAX_WIDTH_TABLET : MAX_WIDTH;
}
// 태블릿(대형 화면) 여부.
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH;
}

// 시그니처 overshoot 스프링 (확인 완료 애니메이션 등)
export const SPRING = { damping: 12, stiffness: 180, mass: 0.6 };

// === Pretendard 폰트 (App.tsx useFonts로 로드) ===
// RN Android는 단일 패밀리 weight 합성 불가 → weight별 개별 패밀리로 등록.
export const font = {
  r: 'Pretendard-Regular',    // 400
  m: 'Pretendard-Medium',     // 500
  sb: 'Pretendard-SemiBold',  // 600
  b: 'Pretendard-Bold',       // 700
  xb: 'Pretendard-ExtraBold', // 800
} as const;

// 타이포 프리셋 — weight-specific fontFamily라 fontWeight는 생략(안드로이드 합성 폴백 방지).
// (letterSpacing은 web의 em을 px로 환산: 타이틀 -0.02em × 23px ≈ -0.46)
export const text: Record<string, TextStyle> = {
  bigTitle: { fontFamily: font.xb, fontSize: 22, lineHeight: 29, letterSpacing: -0.4, color: color.ink },
  flowTitle: { fontFamily: font.xb, fontSize: 22, lineHeight: 29, letterSpacing: -0.4, color: color.ink },
  sectionLabel: { fontFamily: font.m, fontSize: 13, color: color.sub },
  headerTitle: { fontFamily: font.sb, fontSize: 16, color: color.ink },
  rowTitle: { fontFamily: font.m, fontSize: 15, color: color.ink },
  rowSub: { fontFamily: font.r, fontSize: 13, color: color.sub },
  tag: { fontFamily: font.m, fontSize: 12 },
  cta: { fontFamily: font.sb, fontSize: 16 },
  ghost: { fontFamily: font.sb, fontSize: 14, color: color.blue },
  body: { fontFamily: font.r, fontSize: 14, color: color.ink },
  caption: { fontFamily: font.r, fontSize: 11, color: color.sub },
  tabLabel: { fontFamily: font.r, fontSize: 10 },
  wordmark: { fontFamily: font.xb, fontSize: 28, color: color.blue, letterSpacing: -0.3 },
};
