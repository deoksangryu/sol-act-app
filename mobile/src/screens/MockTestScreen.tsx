import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { mockTestApi, MyMockTest } from '../services/api';
import { pickAudioFile, uploadFileUri } from '../services/upload';

// 학생 모의테스트: 내가 참여하는 모의테스트 목록 → 순번 확인 + 음원(파일) 업로드 + 내 영상 보기.
export function MockTestScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['mockTests', 'mine'], queryFn: () => mockTestApi.mine(), staleTime: 20000 });
  const items = data ?? [];

  const uploadAudio = async (mt: MyMockTest) => {
    try {
      const media = await pickAudioFile();
      if (!media) return;
      setUploadingId(mt.id);
      await uploadFileUri(media, { subfolder: 'mock_tests', targetType: 'mock_test_audio', targetId: mt.id });
      await qc.invalidateQueries({ queryKey: ['mockTests', 'mine'] });
      Alert.alert('완료', '음원을 제출했어요.');
    } catch (e: any) {
      Alert.alert('실패', e?.message || '음원을 올리지 못했어요');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <Screen edges={['top']}>
      <BackHeader title="모의테스트" onBack={() => nav.goBack()} />
      <Scroll contentStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: space.screenX, gap: 12, marginTop: 8 }}>
          {isLoading && <ActivityIndicator style={{ marginTop: 24 }} color={color.blue} />}
          {!isLoading && items.length === 0 && (
            <Card style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontFamily: font.m, fontSize: 14, color: color.sub }}>참여 중인 모의테스트가 없어요</Text>
            </Card>
          )}
          {items.map((mt) => {
            const submitted = mt.myStatus === 'submitted';
            const busy = uploadingId === mt.id;
            return (
              <Card key={mt.id} style={{ padding: 16 }}>
                <Text style={{ fontFamily: font.b, fontSize: 16, color: color.ink }}>{mt.title}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 12.5, color: color.sub, marginTop: 3 }}>
                  {mt.testDate || '날짜 미정'} · 내 순번 {mt.myOrder + 1}번
                </Text>
                {!!mt.description && (
                  <Text style={{ fontFamily: font.m, fontSize: 13, lineHeight: 20, color: color.sub, marginTop: 8 }}>{mt.description}</Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => uploadAudio(mt)}
                    disabled={busy}
                    style={{ flex: 1, backgroundColor: submitted ? color.successBg : color.blue, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' }}
                  >
                    {busy ? (
                      <ActivityIndicator color={submitted ? color.success : color.white} />
                    ) : (
                      <Text style={{ fontFamily: font.b, fontSize: 13.5, color: submitted ? color.success : color.white }}>
                        {submitted ? '✓ 제출됨 · 다시 올리기' : '🎵 음원 올리기'}
                      </Text>
                    )}
                  </Pressable>
                  {mt.myVideoCount > 0 && (
                    <Pressable
                      onPress={() => nav.navigate('mockTestVideos', { id: mt.id, title: mt.title })}
                      style={{ backgroundColor: color.surf, borderRadius: radius.button, paddingHorizontal: 14, justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: font.b, fontSize: 13, color: color.ink }}>🎬 내 영상 {mt.myVideoCount}</Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      </Scroll>
    </Screen>
  );
}
