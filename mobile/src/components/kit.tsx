import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, Animated, Image,
  StyleSheet, ActivityIndicator, ViewStyle, StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, text, radius, space, MAX_WIDTH } from '../theme/tokens';
import { Icon } from './Icon';

// === Screen: 안전영역 + 흰 배경 + 480 중앙정렬 컨테이너 ===
export function Screen({ children, edges }: { children: React.ReactNode; edges?: Array<'top' | 'bottom' | 'left' | 'right'> }) {
  return (
    <SafeAreaView style={s.screen} edges={edges ?? ['top', 'bottom']}>
      <View style={s.centered}>{children}</View>
    </SafeAreaView>
  );
}

// === Scroll: 스크롤바 숨김 영역 ===
export function Scroll({ children, style, contentStyle }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView style={[s.flex1, style]} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

// === 타이틀/라벨 ===
export function BigTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ paddingHorizontal: space.screenX, paddingTop: 14, paddingBottom: sub ? 8 : 14 }}>
      <Text style={text.bigTitle}>{children}</Text>
      {!!sub && <Text style={{ fontSize: 14, color: color.sub, marginTop: 4 }}>{sub}</Text>}
    </View>
  );
}
export function FlowTitle({ children }: { children: React.ReactNode }) {
  return <Text style={text.flowTitle}>{children}</Text>;
}
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[text.sectionLabel, { paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6 }]}>{children}</Text>;
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <Text style={{ paddingHorizontal: space.screenX, paddingVertical: 24, color: color.sub, fontSize: 14, textAlign: 'center' }}>{children}</Text>;
}

// === BackHeader: ← + 타이틀 + (우측 슬롯) ===
export function BackHeader({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} hitSlop={8} style={s.headerBtn}>
        <Icon name="arrow-left" size={22} color={color.ink} />
      </Pressable>
      {!!title && <Text style={[text.headerTitle, s.flex1]} numberOfLines={1}>{title}</Text>}
      <View>{right}</View>
    </View>
  );
}

// === ListRow: 좌측슬롯 + 타이틀/서브 + chevron ===
export function ListRow({ left, title, sub, right, onPress, showChevron = true }: {
  left?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode;
  right?: React.ReactNode; onPress?: () => void; showChevron?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && onPress ? { backgroundColor: color.surf } : null]}>
      {!!left && <View style={{ marginRight: space.gap }}>{left}</View>}
      <View style={s.flex1}>
        <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
        {sub != null && <Text style={[text.rowSub, { marginTop: 2 }]} numberOfLines={1}>{sub}</Text>}
      </View>
      {right}
      {showChevron && onPress && <Icon name="chevron-right" size={18} color={color.faint} />}
    </Pressable>
  );
}

// === Cta: 풀와이드 파란 버튼 ===
export function Cta({ label, onPress, disabled, loading }: { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean }) {
  const off = disabled || loading;
  return (
    <Pressable onPress={off ? undefined : onPress} style={({ pressed }) => [s.cta, { backgroundColor: off ? color.surf : color.blue, opacity: pressed && !off ? 0.92 : 1 }]}>
      {loading
        ? <ActivityIndicator color={color.sub} />
        : <Text style={[text.cta, { color: off ? color.sub : color.white }]}>{label}</Text>}
    </Pressable>
  );
}

// === GhostButton: 흰 배경 + 파란 1.5px 보더 ===
export function GhostButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.ghost, { opacity: pressed ? 0.92 : 1 }]}>
      <Text style={text.ghost}>{label}</Text>
    </Pressable>
  );
}

// === Tag: 상태 칩 ===
type TagTone = 'done' | 'todo' | 'pending' | 'overdue' | 'neutral';
const TAG_TONE: Record<TagTone, { bg: string; fg: string }> = {
  done: { bg: color.successBg, fg: color.successInk },
  todo: { bg: color.blueBg, fg: color.blue },
  pending: { bg: color.warnBg, fg: color.warn },
  overdue: { bg: '#FDE8E8', fg: color.danger },
  neutral: { bg: color.surf, fg: color.sub },
};
export function Tag({ label, tone = 'neutral', bg, fg }: { label: string; tone?: TagTone; bg?: string; fg?: string }) {
  const t = TAG_TONE[tone];
  return (
    <View style={[s.tag, { backgroundColor: bg ?? t.bg }]}>
      <Text style={[text.tag, { color: fg ?? t.fg }]}>{label}</Text>
    </View>
  );
}

// === IconChip: 44×44 r13 회색칩 + 글리프 ===
export function IconChip({ name, tint = color.sub, bg = color.surf, size = 44 }: { name: string; tint?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.chip, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={Math.round(size * 0.47)} color={tint} />
    </View>
  );
}

// === Avatar: 원형 이니셜 ===
export function Avatar({ name, size = 36, bg = color.blueBg, fg = color.blue, uri }: { name?: string; size?: number; bg?: string; fg?: string; uri?: string }) {
  const initial = (name || '').trim().charAt(0) || '?';
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: bg }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '600', fontSize: Math.round(size * 0.42) }}>{initial}</Text>
    </View>
  );
}

// === InfoBox: 안내 박스 ===
type InfoTone = 'info' | 'warn' | 'purple' | 'success';
const INFO_TONE: Record<InfoTone, { bg: string; fg: string }> = {
  info: { bg: color.blueBg, fg: color.infoInk },
  warn: { bg: color.warnBg, fg: color.warn },
  purple: { bg: color.purpleBg, fg: color.purpleInk },
  success: { bg: color.successBg, fg: color.successInk },
};
export function InfoBox({ children, tone = 'info' }: { children: React.ReactNode; tone?: InfoTone }) {
  const t = INFO_TONE[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.card, padding: 13 }}>
      <Text style={{ color: t.fg, fontSize: 13, lineHeight: 20.8 }}>{children}</Text>
    </View>
  );
}

// === SearchBar ===
export function SearchBar({ value, onChangeText, placeholder = '검색' }: { value: string; onChangeText: (t: string) => void; placeholder?: string }) {
  return (
    <View style={s.search}>
      <Icon name="search" size={18} color={color.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        style={[s.flex1, { fontSize: 15, color: color.ink, padding: 0 }]}
      />
      {!!value && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Icon name="x" size={16} color={color.faint} />
        </Pressable>
      )}
    </View>
  );
}

// === FilterChips: 활성 = ink pill + 흰 글자 ===
export function FilterChips<T extends string>({ items, value, onChange }: { items: Array<{ key: T; label: string }>; value: T; onChange: (k: T) => void }) {
  return (
    <View style={s.chipRow}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={[s.filterChip, { backgroundColor: active ? color.ink : color.surf }]}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: active ? color.white : color.sub }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// === ChipSelect: 활성 = blueBg + 파란 보더/글자 (선택 입력용) ===
export function ChipSelect<T extends string>({ items, value, onChange, wrap }: { items: Array<{ key: T; label: string }>; value: T | null; onChange: (k: T) => void; wrap?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 8 }}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={{ borderWidth: 1.5, borderColor: active ? color.blue : color.inputLine, backgroundColor: active ? color.blueBg : color.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: active ? color.blue : color.sub }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// === Divider: 0.5px 헤어라인 ===
export function Divider() {
  return <View style={s.divider} />;
}

// === DoneScreen: 완료 확인(82 원 + 흰 체크 + overshoot 스프링) ===
export function DoneScreen({ title, sub, onConfirm }: { title: string; sub?: string; onConfirm: () => void }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 170, mass: 0.6 }).start();
  }, [scale]);
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 }}>
        <Animated.View style={{ width: 82, height: 82, borderRadius: radius.pill, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
          <Icon name="check" size={44} color={color.white} />
        </Animated.View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: color.ink, textAlign: 'center' }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 14, color: color.sub, textAlign: 'center' }}>{sub}</Text>}
      </View>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
        <Cta label="확인" onPress={onConfirm} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  centered: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.headerX, paddingVertical: 8, gap: 4 },
  headerBtn: { padding: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.screenX, paddingVertical: space.rowY },
  cta: { height: 52, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  ghost: { height: 52, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: color.white, borderWidth: 1.5, borderColor: color.blue },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.tag, alignSelf: 'flex-start' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.white, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 12, height: 44 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: space.screenX },
  filterChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginHorizontal: space.screenX },
});
