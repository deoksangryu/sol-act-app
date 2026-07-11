import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from '../components/Icon';
import { color } from '../theme/tokens';
import { DietScreen, MusicScreen } from '../screens/tabs';
import { ClassesScreen } from '../screens/ClassesScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { PracticeScreen } from '../screens/PracticeScreen';
import { VideoScreen } from '../screens/VideoScreen';
import { useAuth } from '../AuthContext';
import { useWebSocketConnection } from '../services/ws';

const Tab = createBottomTabNavigator();

const TABS: Array<{ name: string; label: string; icon: string; component: React.ComponentType<any> }> = [
  { name: 'classes', label: '수업', icon: 'school', component: ClassesScreen },
  { name: 'plan', label: '계획', icon: 'calendar-check', component: PlanScreen },
  { name: 'video', label: '영상', icon: 'video', component: VideoScreen },
  { name: 'practice', label: '제시대사', icon: 'masks-theater', component: PracticeScreen },
  { name: 'diet', label: '식단', icon: 'salad', component: DietScreen },
  { name: 'music', label: '음악', icon: 'headphones', component: MusicScreen },
];

export function TabNavigator() {
  const { user } = useAuth();
  // 인증된 트리에서 WS 연결(실시간 data_changed → React Query invalidate)
  useWebSocketConnection(user?.id ?? null);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.sub,
        tabBarStyle: { backgroundColor: color.white, borderTopColor: color.line, borderTopWidth: 0.5 },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      {TABS.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            tabBarLabel: t.label,
            tabBarIcon: ({ color: tint }) => <Icon name={t.icon} size={22} color={tint} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
