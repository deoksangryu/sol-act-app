import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Icon } from './Icon';
import { Avatar } from './kit';
import { color, space } from '../theme/tokens';
import { notificationApi } from '../services/api';
import { useAuth } from '../AuthContext';

/** 전 화면 공용 상단바: 공지(확성기) · 알림(벨+미읽음 배지) · 아바타(프로필) */
export function TopBar() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const { data: notifs = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => notificationApi.list(), staleTime: 30000 });
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, paddingHorizontal: space.screenX, paddingVertical: 10 }}>
      <Pressable onPress={() => nav.navigate('notices')} hitSlop={8}>
        <Icon name="speakerphone" size={22} color={color.ink} />
      </Pressable>
      <Pressable onPress={() => nav.navigate('notifications')} hitSlop={8}>
        <Icon name="bell" size={22} color={color.ink} />
        {unread > 0 && (
          <View style={{ position: 'absolute', top: -5, right: -7, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: color.warn, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
            <Text style={{ color: color.white, fontSize: 9, fontWeight: '700' }}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </Pressable>
      <Pressable onPress={() => nav.navigate('profile')} hitSlop={8}>
        <Avatar name={user?.name} size={32} />
      </Pressable>
    </View>
  );
}
