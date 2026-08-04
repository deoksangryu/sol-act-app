import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon } from '../components/Icon';
import { color, font, useContentMaxWidth } from '../theme/tokens';
import { useAuth } from '../AuthContext';
import { useRoleOverride } from '../DevRole';
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
  submit: { label: '제출', icon: 'plus', fab: true },
  learn: { label: '배움', icon: 'book' },
  my: { label: 'MY', icon: 'account' },
};

function StudentTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const maxWidth = useContentMaxWidth();
  // 흰 바 배경/보더는 화면 전체 폭, 탭 항목들만 콘텐츠 폭(태블릿=640)에 맞춰 중앙정렬.
  return (
    <View style={{ backgroundColor: color.white, borderTopWidth: 0.5, borderTopColor: color.line, paddingTop: 9, paddingBottom: insets.bottom + 6, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', width: '100%', maxWidth, alignItems: 'flex-start' }}>
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
    </View>
  );
}

// ── 선생님·원장 공용 커스텀 탭바 (콘텐츠 폭 중앙정렬) ──
function SimpleTabBar({ state, navigation, meta }: BottomTabBarProps & { meta: Record<string, { label: string; icon: string }> }) {
  const insets = useSafeAreaInsets();
  const maxWidth = useContentMaxWidth();
  return (
    <View style={{ backgroundColor: color.white, borderTopWidth: 0.5, borderTopColor: color.line, paddingTop: 9, paddingBottom: insets.bottom + 6, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', width: '100%', maxWidth }}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const m = meta[route.name] ?? { label: route.name, icon: 'help' };
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={{ flex: 1, alignItems: 'center' }}>
              <Icon name={m.icon} size={22} color={focused ? color.blue : color.sub2} />
              <Text style={{ fontFamily: focused ? font.sb : font.m, fontSize: 10.5, color: focused ? color.blue : color.sub2, marginTop: 3 }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
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

// ── 선생님·원장 3탭 (콘텐츠 폭 중앙정렬 커스텀 탭바) ──
function SimpleTabs({ items }: { items: Array<{ name: string; label: string; icon: string; component: React.ComponentType<any> }> }) {
  const meta: Record<string, { label: string; icon: string }> = {};
  items.forEach((t) => { meta[t.name] = { label: t.label, icon: t.icon }; });
  return (
    <Tab.Navigator tabBar={(p) => <SimpleTabBar {...p} meta={meta} />} screenOptions={{ headerShown: false }}>
      {items.map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} />
      ))}
    </Tab.Navigator>
  );
}

export function TabNavigator() {
  const { user } = useAuth();
  const { role: override } = useRoleOverride();
  useWebSocketConnection(user?.id ?? null);
  const role = override ?? user?.role;

  if (role === UserRole.TEACHER) {
    return <SimpleTabs items={[
      { name: 't-inbox', label: '인박스', icon: 'inbox', component: InboxScreen },
      { name: 't-log', label: '수업일지', icon: 'notebook', component: TeacherLogScreen },
      { name: 't-students', label: '학생', icon: 'account-group', component: TeacherStudentsScreen },
    ]} />;
  }
  if (role === UserRole.DIRECTOR) {
    return <SimpleTabs items={[
      { name: 'a-dash', label: '현황', icon: 'chart-box', component: AdminDashScreen },
      { name: 'a-schedule', label: '일정', icon: 'calendar', component: AdminScheduleScreen },
      { name: 'a-students', label: '학생', icon: 'account-group', component: AdminStudentsScreen },
    ]} />;
  }
  return <StudentTabs />;
}
