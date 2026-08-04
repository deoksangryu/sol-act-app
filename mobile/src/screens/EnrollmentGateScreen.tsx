import React from 'react';
import { View, Text } from 'react-native';
import { Screen, GhostButton } from '../components/kit';
import { color, text } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { useAuth } from '../AuthContext';

// 반배정 게이트: 학생이고 배정된 반이 없으면 서비스 전면 차단(새로고침/로그아웃만).
export function EnrollmentGateScreen() {
  const { logout, refresh } = useAuth();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 }}>
        <Icon name="school" size={48} color={color.faint} />
        <Text style={[text.bigTitle, { textAlign: 'center' }]}>반배정 대기 중</Text>
        <Text style={{ color: color.sub, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
          아직 반이 배정되지 않았습니다.{'\n'}선생님이 반을 배정하면 서비스를 이용할 수 있어요.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
          <GhostButton label="새로고침" onPress={refresh} />
          <GhostButton label="로그아웃" onPress={logout} />
        </View>
      </View>
    </Screen>
  );
}
