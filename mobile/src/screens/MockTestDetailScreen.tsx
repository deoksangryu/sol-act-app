import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { mockTestApi, resolveFileUrl } from '../services/api';
import { useUploads } from '../services/UploadContext';
import { pickMedia } from '../services/upload';

// 원장 모의테스트 상세: 학생 순번순 나열 → 음원 재생/다운로드(브라우저) + 학생별 영상 업로드 + 공지/삭제.
export function MockTestDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const id: string = route.params?.id;
  const qc = useQueryClient();
  const { upload } = useUploads();
  const [uploadingSid, setUploadingSid] = useState<string | null>(null);
  const [announcing, setAnnouncing] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['mockTests', 'detail', id], queryFn: () => mockTestApi.detail(id), enabled: !!id, staleTime: 10000 });
  const entries = data?.entries ?? [];
  const videoCount = (sid: string) => (data?.videos ?? []).filter((v) => v.studentId === sid).length;

  const openAudio = (audioUrl?: string | null) => {
    if (!audioUrl) return;
    Linking.openURL(resolveFileUrl(audioUrl)).catch(() => Alert.alert('안내', '음원을 열지 못했어요'));
  };

  const uploadVideo = async (sid: string) => {
    try {
      const media = await pickMedia('video');
      if (!media) return;
      setUploadingSid(sid);
      await upload('모의테스트 영상', media, { subfolder: 'mock_tests', targetType: 'mock_test_video', targetId: `${id}:${sid}` });
      await qc.invalidateQueries({ queryKey: ['mockTests', 'detail', id] });
      Alert.alert('업로드 시작', '영상 업로드를 시작했어요. 완료되면 학생에게 전달됩니다.');
    } catch (e: any) {
      Alert.alert('실패', e?.message || '영상을 올리지 못했어요');
    } finally {
      setUploadingSid(null);
    }
  };

  const announce = async () => {
    setAnnouncing(true);
    try {
      const r = await mockTestApi.announce(id);
      await qc.invalidateQueries({ queryKey: ['mockTests', 'detail', id] });
      Alert.alert('공지 발송', `${r.notified}명에게 공지를 보냈어요.`);
    } catch (e: any) {
      Alert.alert('실패', e?.message || '공지를 보내지 못했어요');
    } finally {
      setAnnouncing(false);
    }
  };

  const remove = () => {
    Alert.alert('삭제', '이 모의테스트를 삭제할까요? (음원·영상도 함께 삭제됩니다)', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await mockTestApi.remove(id);
            await qc.invalidateQueries({ queryKey: ['mockTests', 'list'] });
            nav.goBack();
          } catch (e: any) { Alert.alert('실패', e?.message || '삭제하지 못했어요'); }
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <BackHeader title={data?.title || '모의테스트'} onBack={() => nav.goBack()} />
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: space.screenX, gap: 12, marginTop: 8 }}>
          {isLoading && <ActivityIndicator style={{ marginTop: 24 }} color={color.blue} />}
          {data && (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={announce} disabled={announcing} style={{ flex: 1, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 12, alignItems: 'center' }}>
                  {announcing ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.white }}>📢 공지 보내기</Text>}
                </Pressable>
                <Pressable onPress={remove} style={{ backgroundColor: color.dangerBg, borderRadius: radius.button, paddingHorizontal: 16, justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.b, fontSize: 13.5, color: color.danger }}>삭제</Text>
                </Pressable>
              </View>

              <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginTop: 4 }}>참여 학생 · 순번순</Text>
              {entries.map((e) => {
                const submitted = e.status === 'submitted' && !!e.audioUrl;
                const vc = videoCount(e.studentId);
                return (
                  <Card key={e.id} style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color.surf, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: font.b, fontSize: 12, color: color.ink }}>{e.sortOrder + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontFamily: font.b, fontSize: 15, color: color.ink }}>{e.studentName}</Text>
                      <Text style={{ fontFamily: font.sb, fontSize: 12, color: submitted ? color.success : color.faint }}>{submitted ? '음원 제출' : '대기'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      {submitted && (
                        <Pressable onPress={() => openAudio(e.audioUrl)} style={{ flex: 1, backgroundColor: color.surf, borderRadius: radius.button, paddingVertical: 10, alignItems: 'center' }}>
                          <Text style={{ fontFamily: font.b, fontSize: 13, color: color.ink }}>▶ 음원 열기</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => uploadVideo(e.studentId)} disabled={uploadingSid === e.studentId} style={{ flex: 1, backgroundColor: color.blueBg, borderRadius: radius.button, paddingVertical: 10, alignItems: 'center' }}>
                        {uploadingSid === e.studentId ? <ActivityIndicator color={color.blue} /> : <Text style={{ fontFamily: font.b, fontSize: 13, color: color.blue }}>🎬 영상 올리기{vc > 0 ? ` (${vc})` : ''}</Text>}
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
              {entries.length === 0 && (
                <Card style={{ padding: 20, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 14, color: color.sub }}>참여 학생이 없어요</Text></Card>
              )}
            </>
          )}
        </View>
      </Scroll>
    </Screen>
  );
}
