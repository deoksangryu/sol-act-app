import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon } from '../components/Icon';
import { color, font } from '../theme/tokens';
import { useAuth } from '../AuthContext';
import { useWebSocketConnection } from '../services/ws';
import { UserRole } from '../types';
import { HomeScreen } from '../screens/v2Home';
import { InboxScreen } from '../screens/v2Inbox';
import { PracticeV2Screen, LearnScreen, SubmitScreen, MyScreen } from '../screens/v2Student';
import { TeacherLogScreen, TeacherStudentsScreen } from '../screens/v2Teacher';
import { AdminDashScreen, AdminScheduleScreen, AdminStudentsScreen } from '../screens/v2Admin';

const Tab = createBottomTabNavigator();

type TabMeta = { label: string; icon: string; fab?: boolean };

// ── 학생 커스텀 탭바 (중앙 제출 FAB) ──
const STU_META: Record<string, TabMeta> = {
  home: { label: '홈', icon: 'home' },
  practice: { label: '연습', icon: 'timer' },
  submit: { label: '제출', icon: 'microphone', fab: true },
  learn: { label: '배움', icon: 'book' },
  my: { label: 'MY', icon: 'account' },
};

function StudentTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: color.white, borderTopWidth: 0.5, borderTopColor: color.line, paddingTop: 9, paddingBottom: insets.bottom + 6, alignItems: 'flex-start' }}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const meta = STU_META[route.name] ?? { label: route.name, icon: 'help' };
        const onPress = () => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        if (meta.fab) {
          return (
            <View key={route.key} style={{ width: 64, alignItems: 'center' }}>
              <Pressable onPress={onPress} style={{ width: 52, height: 52, borderRadius: 26, marginTop: -22, backgroundColor: color.blue, borderWidth: 4, borderColor: color.white, alignItems: 'center', justifyContent: 'center', shadowColor: color.blue, shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
                <Icon name={meta.icon} size={22} color={color.white} />
              </Pressable>
              <Text style={{ fontFamily: font.m, fontSize: 10.5, color: color.sub2, marginTop: 3 }}>{meta.label}</Text>
            </View>
          );
        }
        return (
          <Pressable key={route.key} onPress={onPress} style={{ flex: 1, alignItems: 'center' }}>
            <Icon name={meta.icon} size={22} color={focused ? color.blue : color.sub2} />
            <Text style={{ fontFamily: focused ? font.sb : font.m, fontSize: 10.5, color: focused ? color.blue : color.sub2, marginTop: 3 }}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StudentTabs() {
  return (
    <Tab.Navigator tabBar={(p) => <StudentTabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="home" component={HomeScreen} />
      <Tab.Screen name="practice" component={PracticeV2Screen} />
      <Tab.Screen name="submit" component={SubmitScreen} />
      <Tab.Screen name="learn" component={LearnScreen} />
      <Tab.Screen name="my" component={MyScreen} />
    </Tab.Navigator>
  );
}

// ── 선생님·원장 기본 3탭 ──
function SimpleTabs({ items }: { items: Array<{ name: string; label: string; icon: string; component: React.ComponentType<any> }> }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.blue,
        tabBarInactiveTintColor: color.sub2,
        tabBarStyle: { backgroundColor: color.white, borderTopColor: color.line, borderTopWidth: 0.5 },
        tabBarLabelStyle: { fontFamily: font.m, fontSize: 10.5 },
      }}
    >
      {items.map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} options={{ tabBarLabel: t.label, tabBarIcon: ({ color: c }) => <Icon name={t.icon} size={22} color={c} /> }} />
      ))}
    </Tab.Navigator>
  );
}

export function TabNavigator() {
  const { user } = useAuth();
  useWebSocketConnection(user?.id ?? null);

  if (user?.role === UserRole.TEACHER) {
    return <SimpleTabs items={[
      { name: 't-inbox', label: '인박스', icon: 'inbox', component: InboxScreen },
      { name: 't-log', label: '수업일지', icon: 'notebook', component: TeacherLogScreen },
      { name: 't-students', label: '학생', icon: 'account-group', component: TeacherStudentsScreen },
    ]} />;
  }
  if (user?.role === UserRole.DIRECTOR) {
    return <SimpleTabs items={[
      { name: 'a-dash', label: '현황', icon: 'chart-box', component: AdminDashScreen },
      { name: 'a-schedule', label: '일정', icon: 'calendar', component: AdminScheduleScreen },
      { name: 'a-students', label: '학생', icon: 'account-group', component: AdminStudentsScreen },
    ]} />;
  }
  return <StudentTabs />;
}
