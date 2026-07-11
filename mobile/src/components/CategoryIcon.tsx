import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { Subject } from '../types';
import { color, radius } from '../theme/tokens';

export interface CatColor { bg: string; fg: string; }

export function catColor(cat?: string | null): CatColor {
  switch (cat) {
    case Subject.ACTING: return { bg: color.blueBg, fg: color.blue };
    case Subject.MUSICAL: return { bg: color.purpleBg, fg: color.purple };
    case Subject.DANCE: return { bg: color.pinkBg, fg: color.pink };
    default: return { bg: color.surf, fg: color.sub };
  }
}

// 카테고리 SVG (web category.tsx의 path를 react-native-svg로 그대로 이식)
function ActingSvg({ c, s }: { c: string; s: number }) {
  return (
    <Svg viewBox="0 0 100 100" width={s} height={s}>
      <Path d="M 50 16 C 65 16 75 28 75 42 L 75 56 C 75 72 65 84 50 86 C 35 84 25 72 25 56 L 25 42 C 25 28 35 16 50 16 Z" fill="none" stroke={c} strokeWidth={5} strokeLinejoin="round" />
      <Circle cx={40} cy={46} r={4.5} fill={c} />
      <Circle cx={60} cy={46} r={4.5} fill={c} />
      <Path d="M 36 62 Q 50 72 64 62" stroke={c} strokeWidth={4.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function MusicalSvg({ c, s }: { c: string; s: number }) {
  return (
    <Svg viewBox="0 0 100 100" width={s} height={s}>
      <Rect x={36} y={18} width={28} height={38} rx={14} fill="none" stroke={c} strokeWidth={5} />
      <Line x1={50} y1={58} x2={50} y2={72} stroke={c} strokeWidth={6} strokeLinecap="round" />
      <Path d="M 36 76 Q 50 81 64 76" stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />
      <Circle cx={76} cy={32} r={4} fill={c} />
      <Line x1={80} y1={31} x2={80} y2={18} stroke={c} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

function DanceSvg({ c, s }: { c: string; s: number }) {
  return (
    <Svg viewBox="0 0 100 100" width={s} height={s}>
      <Circle cx={50} cy={22} r={8} fill={c} />
      <Path d="M 52 30 Q 62 22 74 12" stroke={c} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d="M 48 32 Q 36 35 28 50" stroke={c} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d="M 50 30 L 48 54" stroke={c} strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M 48 54 L 46 84" stroke={c} strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M 50 54 Q 65 56 78 62" stroke={c} strokeWidth={6.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** 카테고리 아이콘을 둥근(r13) 배경 칩 안에 렌더 */
export function CategoryIcon({ cat, size = 44 }: { cat?: string | null; size?: number }) {
  const { bg, fg } = catColor(cat);
  const s = Math.round(size * 0.66);
  let inner: React.ReactNode = null;
  if (cat === Subject.ACTING) inner = <ActingSvg c={fg} s={s} />;
  else if (cat === Subject.MUSICAL) inner = <MusicalSvg c={fg} s={s} />;
  else if (cat === Subject.DANCE) inner = <DanceSvg c={fg} s={s} />;
  return (
    <View style={{ width: size, height: size, borderRadius: radius.chip, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {inner}
    </View>
  );
}
