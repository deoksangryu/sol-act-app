import React from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AuthProvider } from './src/AuthContext';
import { UploadProvider } from './src/services/UploadContext';
import { UploadIndicator } from './src/components/UploadIndicator';
import { RootNavigator } from './src/navigation/RootNavigator';
import { DevRoleProvider, DevRoleSwitcher } from './src/DevRole';

const queryClient = new QueryClient({
  // refetchOnWindowFocus: RN에선 focusManager+AppState로 '포그라운드 복귀'가 곧 focus.
  // 앱을 다시 열면 활성 쿼리를 재조회 → 백그라운드 사이 완료된 업로드·도착 알림·상대 제출이 자동 반영.
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

// 포그라운드 복귀를 react-query의 focus 이벤트로 연결(앱 전체 1회 등록).
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
  return () => sub.remove();
});

export default function App() {
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('./assets/fonts/Pretendard-ExtraBold.otf'),
  });
  if (!fontsLoaded) return null; // 네이티브 스플래시 유지 중 폰트 로드(로컬, 즉시)

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DevRoleProvider>
            <UploadProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
              <UploadIndicator />
              <DevRoleSwitcher />
              <StatusBar style="dark" />
            </UploadProvider>
          </DevRoleProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
