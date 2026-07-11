import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { NoticesScreen } from '../screens/NoticesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

// 인증된 메인: 6탭 + 헤더에서 여는 오버레이(공지·알림·프로필)
export function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="tabs" component={TabNavigator} />
      <Stack.Screen name="notices" component={NoticesScreen} />
      <Stack.Screen name="notifications" component={NotificationsScreen} />
      <Stack.Screen name="profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
