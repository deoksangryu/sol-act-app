import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/AuthContext';
import { UploadProvider } from './src/services/UploadContext';
import { UploadIndicator } from './src/components/UploadIndicator';
import { RootNavigator } from './src/navigation/RootNavigator';
import { DevRoleProvider, DevRoleSwitcher } from './src/DevRole';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
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
