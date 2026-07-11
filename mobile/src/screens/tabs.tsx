import React from 'react';
import { View, Text } from 'react-native';
import { Screen, Scroll, BigTitle, InfoBox, Divider, ListRow } from '../components/kit';
import { CategoryIcon } from '../components/CategoryIcon';
import { TopBar } from '../components/TopBar';
import { color, space, text } from '../theme/tokens';
import { useAuth } from '../AuthContext';
import { Subject, UserRole } from '../types';

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.STUDENT]: '수강생',
  [UserRole.TEACHER]: '선생님',
  [UserRole.DIRECTOR]: '원장',
};

// Foundation 스텁: 디자인 시스템을 실제로 확인하기 위한 임시 화면.
function StubScreen({ title, note }: { title: string; note: string }) {
  const { user } = useAuth();
  return (
    <Screen edges={['top']}>
      <TopBar />
      <BigTitle>{title}</BigTitle>

      <Scroll contentStyle={{ paddingBottom: 32, gap: 12 }}>
        <View style={{ paddingHorizontal: space.screenX }}>
          <InfoBox tone="info">
            로그인 성공 · {user?.name ?? '-'} ({user ? ROLE_LABEL[user.role] : '-'}){'\n'}
            {note}
          </InfoBox>
        </View>

        {/* 디자인 프리미티브 미리보기 (카테고리 아이콘 + 리스트 행) */}
        <View style={{ marginTop: 8 }}>
          <ListRow left={<CategoryIcon cat={Subject.ACTING} />} title="연기 수업" sub="플랫 · Toss 스타일" onPress={() => {}} />
          <Divider />
          <ListRow left={<CategoryIcon cat={Subject.MUSICAL} />} title="뮤지컬 수업" sub="아이콘 칩 r13" onPress={() => {}} />
          <Divider />
          <ListRow left={<CategoryIcon cat={Subject.DANCE} />} title="무용 수업" sub="그림자 없음" onPress={() => {}} />
        </View>

        <Text style={[text.caption, { paddingHorizontal: space.screenX, marginTop: 12 }]}>
          이 화면은 Foundation 스텁입니다. 실제 기능은 로드맵 3~7단계에서 구현됩니다.
        </Text>
      </Scroll>
    </Screen>
  );
}

export const DietScreen = () => <StubScreen title="식단" note="식사·체중·차트·피드백" />;
export const MusicScreen = () => <StubScreen title="음악" note="464곡 스트리밍·다운로드 요청" />;
