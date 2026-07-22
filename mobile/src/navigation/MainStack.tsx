import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { NoticesScreen } from '../screens/NoticesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VideoScreen } from '../screens/VideoScreen';
import { DietScreen } from '../screens/DietScreen';
import { ClassesScreen } from '../screens/ClassesScreen';
import { MusicScreen } from '../screens/MusicScreen';
import { RecordScreen } from '../screens/RecordScreen';
import { ExchangeScreen } from '../screens/ExchangeScreen';
import { AdminStudentDetail } from '../screens/AdminStudentDetail';

const Stack = createNativeStackNavigator();

// 인증된 메인: 역할탭 + 헤더/딥링크에서 여는 오버레이(공지·알림·프로필·영상)
export function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="tabs" component={TabNavigator} />
      <Stack.Screen name="notices" component={NoticesScreen} />
      <Stack.Screen name="notifications" component={NotificationsScreen} />
      <Stack.Screen name="profile" component={ProfileScreen} />
      {/* 영상: 학생=내 영상 갤러리(재생·피드백확인·업로드), 교사/원장=전체 영상 리뷰(재생+피드백작성) */}
      <Stack.Screen name="videos" component={VideoScreen} />
      {/* 체중·식단: 학생=본인 기록, 교사/원장=학생 식단/체중 열람 */}
      <Stack.Screen name="diet" component={DietScreen} />
      {/* 수업·수업일지: 교사=수업일지 작성·학생메모, 학생=전달분 열람 */}
      <Stack.Screen name="classes" component={ClassesScreen} />
      {/* 무용음악: 재생(배속)·다운로드 요청, 재생 시간은 연습으로 인정 */}
      <Stack.Screen name="music" component={MusicScreen} />
      {/* 연기 녹음: 마이크 녹음 → 포트폴리오 업로드(피드백 흐름 합류) */}
      <Stack.Screen name="record" component={RecordScreen} />
      {/* 박수 교환소: 모은 박수로 피드백권·프리즈 등 교환 */}
      <Stack.Screen name="exchange" component={ExchangeScreen} />
      {/* 학생 종합 상세(원장·교사): 갈채·영상·체중·식단·연습일지 한 화면 */}
      <Stack.Screen name="studentDetail" component={AdminStudentDetail} />
    </Stack.Navigator>
  );
}
