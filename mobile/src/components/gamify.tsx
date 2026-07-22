import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Vibration, StyleProp, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { color, font, radius, space, shadow } from '../theme/tokens';
import { Icon } from './Icon';
import { notificationApi } from '../services/api';

// 흰 라운드22 카드 — 바깥 View가 그림자+라운드(overflow 없음 → iOS에서도 그림자 안 잘림),
// 안쪽 View가 라운드 클리핑(눌림 하이라이트를 모서리에 맞춰 자름). iOS·Android 동일 렌더.
export function Card({ children, style, flat }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; flat?: boolean }) {
  return (
    <View style={[{ backgroundColor: color.white, borderRadius: radius.card }, !flat && shadow.card, style]}>
      <View style={{ borderRadius: radius.card, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

// 공용 페이지 헤더 — 아이라벨(작은 회색) + ExtraBold 타이틀 + (우측 슬롯) + (설정 진입).
// 학생 v2 탭은 MY에서 프로필로 가지만, 교사/원장은 이 설정 기어가 프로필·로그아웃의 유일한 통로.
// 헤더용 알림 벨(미읽음 배지 포함) — 알림 화면으로 이동. 학생·원장의 TopBar 벨과 동일한 알림함을 교사 화면에도 제공.
export function HeaderBell() {
  const nav = useNavigation<any>();
  const { data: notifs = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => notificationApi.list(), staleTime: 30000 });
  const unread = notifs.filter((n) => !n.read).length;
  return (
    <Pressable onPress={() => nav.navigate('notifications')} hitSlop={8} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 12, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' }, shadow.card, pressed && { opacity: 0.7 }]}>
      <Icon name="bell" size={20} color={color.sub} />
      {unread > 0 && (
        <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: color.warn, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: color.bg }}>
          <Text style={{ color: color.white, fontSize: 9, fontFamily: font.b }}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PageHeader({ eyebrow, title, right, onSettings, onBack, bell }: { eyebrow?: string; title: string; right?: React.ReactNode; onSettings?: () => void; onBack?: () => void; bell?: boolean }) {
  return (
    <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={8} style={({ pressed }) => [{ marginRight: 8, marginTop: eyebrow ? 16 : 2 }, pressed && { opacity: 0.5 }]}>
          <Icon name="arrow-left" size={24} color={color.ink} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginBottom: 3 }}>{eyebrow}</Text>}
        <Text style={{ fontFamily: font.xb, fontSize: 22, lineHeight: 29, letterSpacing: -0.4, color: color.ink }}>{title}</Text>
      </View>
      {(right || onSettings || bell) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, marginLeft: 10 }}>
          {right}
          {bell && <HeaderBell />}
          {onSettings && (
            <Pressable onPress={onSettings} hitSlop={8} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 12, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' }, shadow.card, pressed && { opacity: 0.7 }]}>
              <Icon name="settings" size={20} color={color.sub} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// 섹션(제목 + 우측 메타 + 흰 카드)
export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: space.screenX, marginTop: 22 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11, paddingHorizontal: 2 }}>
        <Text style={{ fontFamily: font.b, fontSize: 16.5, letterSpacing: -0.3, color: color.ink }}>{title}</Text>
        {typeof right === 'string' ? <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>{right}</Text> : right}
      </View>
      {children}
    </View>
  );
}

// 히어로 대시보드 (누적 + 지난달 대비 + 3분할)
export function Hero({ label, value, diff, stats }: { label: string; value: React.ReactNode; diff?: string; stats: Array<{ label: string; value: string }> }) {
  return (
    <View style={[{ marginHorizontal: space.screenX, marginTop: 14, backgroundColor: color.white, borderRadius: radius.hero, padding: 22 }, shadow.card]}>
      <Text style={{ fontFamily: font.sb, fontSize: 14, color: color.sub }}>{label}</Text>
      <Text style={{ fontFamily: font.xb, fontSize: 32, letterSpacing: -0.9, color: color.ink, marginTop: 6, marginBottom: 6 }}>{value}</Text>
      {!!diff && (
        <View style={{ alignSelf: 'flex-start', backgroundColor: color.blueBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ fontFamily: font.b, fontSize: 13, color: color.blue }}>↑ {diff}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: color.line, paddingTop: 13 }}>
        {stats.map((s, i) => (
          <View key={s.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: color.line }}>
            <Text style={{ fontFamily: font.b, fontSize: 16, color: color.ink }}>{s.value}</Text>
            <Text style={{ fontFamily: font.m, fontSize: 12, color: color.sub2, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// 피드백 도착 배너
export function FeedbackBanner({ title, sub, onPress }: { title: string; sub: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginHorizontal: space.screenX, marginTop: 12, backgroundColor: color.blue, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: color.blue, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="message" size={20} color={color.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.b, fontSize: 14.5, color: color.white }}>{title}</Text>
        <Text style={{ fontFamily: font.r, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={color.white} />
    </Pressable>
  );
}

// 루틴 체크 행 (탭 → 완료 + 즉시 +N👏 연출 + 햅틱)
export function ClapCheckRow({ title, sub, reward, done: init, first, onDone }: { title: string; sub?: string; reward: number; done?: boolean; first?: boolean; onDone?: () => void }) {
  const [done, setDone] = useState(!!init);
  const popO = useRef(new Animated.Value(0)).current;
  const popY = useRef(new Animated.Value(0)).current;
  const toggle = () => {
    if (done) return;
    setDone(true);
    Vibration.vibrate(15);
    popO.setValue(0); popY.setValue(0);
    Animated.parallel([
      Animated.timing(popY, { toValue: -22, duration: 900, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(popO, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(popO, { toValue: 0, duration: 500, delay: 250, useNativeDriver: true }),
      ]),
    ]).start();
    onDone?.();
  };
  return (
    <Pressable onPress={toggle} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderTopWidth: first ? 0 : 1, borderTopColor: color.line }, pressed && !done && { backgroundColor: color.surf }]}>
      <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: done ? color.blue : '#D1D6DB', backgroundColor: done ? color.blue : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {done && <Icon name="check" size={14} color={color.white} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.sb, fontSize: 15, color: done ? color.sub2 : color.ink, textDecorationLine: done ? 'line-through' : 'none' }}>{title}</Text>
        {!!sub && <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>{sub}</Text>}
      </View>
      <View>
        <Text style={{ fontFamily: font.b, fontSize: 13.5, color: done ? color.success : color.amber }}>+{reward} 👏</Text>
        <Animated.Text style={{ position: 'absolute', right: 0, top: 0, fontFamily: font.b, fontSize: 13, color: color.amber, opacity: popO, transform: [{ translateY: popY }] }}>+{reward} 👏</Animated.Text>
      </View>
    </Pressable>
  );
}

// 일반 v2 행 (미션·일정 — 아이콘칩 + 제목/서브 + 우측)
export function V2Row({ icon, iconBg, iconColor, left, title, sub, right, onPress, first }: { icon?: string; iconBg?: string; iconColor?: string; left?: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; first?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderTopWidth: first ? 0 : 1, borderTopColor: color.line }, pressed && onPress && { backgroundColor: color.surf }]}>
      {left ? left : (!!icon && (
        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: iconBg ?? color.surf, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={iconColor ?? color.sub} />
        </View>
      ))}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{title}</Text>
        {!!sub && <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
}
