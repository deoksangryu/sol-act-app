import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll } from '../components/kit';
import { Icon } from '../components/Icon';
import { color, radius, space } from '../theme/tokens';
import { notificationApi } from '../services/api';
import { md } from '../lib/date';

// 알림 메시지 → 이동할 탭(6탭만). 별도 타깃 필드가 없어 키워드 추론.
function inferTab(message: string): string | null {
  if (/영상|포트폴리오/.test(message)) return 'video';
  if (/계획/.test(message)) return 'plan';
  if (/식단/.test(message)) return 'diet';
  if (/음원|음악/.test(message)) return 'music';
  if (/제시대사/.test(message)) return 'practice';
  if (/일지|수업|출석|출결/.test(message)) return 'classes';
  return null;
}

const CAT: Record<string, { icon: string; bg: string; fg: string }> = {
  video: { icon: 'video', bg: color.blueBg, fg: color.blue },
  diet: { icon: 'salad', bg: color.successBg, fg: color.success },
  music: { icon: 'headphones', bg: color.purpleBg, fg: color.purple },
  classes: { icon: 'school', bg: color.blueBg, fg: color.blue },
  plan: { icon: 'calendar-check', bg: color.blueBg, fg: color.blue },
  practice: { icon: 'masks-theater', bg: color.blueBg, fg: color.blue },
};

function dtShort(iso: string): string {
  if (!iso) return '';
  const t = iso.length > 11 ? iso.slice(11, 16) : '';
  return t ? `${md(iso)} ${t}` : md(iso);
}

export function NotificationsScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => notificationApi.list() });

  const markAll = async () => {
    try { await notificationApi.markAllRead(); qc.invalidateQueries({ queryKey: ['notifications'] }); } catch { /* noop */ }
  };
  const goto = (tab: string) => { nav.navigate('tabs', { screen: tab }); nav.goBack(); };
  const hasUnread = notifs.some((n) => !n.read);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ padding: 6 }}>
          <Icon name="arrow-left" size={22} color={color.ink} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '600', color: color.ink }}>알림</Text>
      </View>

      <Scroll>
        {notifs.length === 0 ? (
          <Text style={{ padding: 48, textAlign: 'center', color: color.sub, fontSize: 13 }}>새로운 알림이 없어요</Text>
        ) : notifs.map((n) => {
          const tab = inferTab(n.message);
          const c = (tab && CAT[tab]) || CAT.classes;
          return (
            <Pressable key={n.id} onPress={() => { if (tab) goto(tab); }}
              style={{ flexDirection: 'row', gap: 12, paddingHorizontal: space.screenX, paddingVertical: 14, alignItems: 'flex-start', backgroundColor: n.read ? color.white : color.blueBg }}>
              <View style={{ width: 42, height: 42, borderRadius: radius.chip, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={c.icon} size={20} color={c.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: n.read ? '500' : '600', color: color.ink, lineHeight: 20 }}>{n.message}</Text>
                  {!n.read && <View style={{ width: 7, height: 7, borderRadius: radius.pill, backgroundColor: color.blue, marginTop: 5 }} />}
                </View>
                <Text style={{ fontSize: 11, color: color.sub, marginTop: 4 }}>{dtShort(n.date)}</Text>
              </View>
            </Pressable>
          );
        })}
      </Scroll>

      {hasUnread && (
        <View style={{ paddingHorizontal: space.screenX, paddingVertical: 12 }}>
          <Pressable onPress={markAll} style={{ backgroundColor: color.surf, borderRadius: radius.button, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: color.ink }}>모두 읽음 표시</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
