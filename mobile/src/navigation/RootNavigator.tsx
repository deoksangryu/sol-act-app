import React from 'react';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { EnrollmentGateScreen } from '../screens/EnrollmentGateScreen';
import { MainStack } from './MainStack';

// 부팅 게이트: 스플래시 → 인증 → 반배정 → 메인 6탭
export function RootNavigator() {
  const { status, user } = useAuth();

  if (status === 'loading') return <SplashScreen />;
  if (status === 'guest' || !user) return <LoginScreen />;

  // 반배정 게이트: 학생 && enrolledClassIds가 빈 배열 → 차단. (필드 없으면 백엔드 403에 위임)
  if (
    user.role === UserRole.STUDENT &&
    Array.isArray(user.enrolledClassIds) &&
    user.enrolledClassIds.length === 0
  ) {
    return <EnrollmentGateScreen />;
  }

  return <MainStack />;
}
