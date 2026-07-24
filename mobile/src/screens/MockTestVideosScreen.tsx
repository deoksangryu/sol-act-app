import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { color, font, space } from '../theme/tokens';
import { mockTestApi, resolveFileUrl } from '../services/api';

// 학생: 원장이 나에게 배포한 모의테스트 영상들(본인 것만). 여러 개면 번호칩으로 전환.
export function MockTestVideosScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const id: string = route.params?.id;
  const title: string = route.params?.title || '내 모의테스트 영상';
  const { data, isLoading } = useQuery({ queryKey: ['mockTests', 'myVideos', id], queryFn: () => mockTestApi.myVideos(id), enabled: !!id });
  const videos = data ?? [];
  const [active, setActive] = useState(0);
  const cur = videos[active];
  const player = useVideoPlayer(cur ? resolveFileUrl(cur.videoUrl) : null, (p) => { p.loop = false; });

  useEffect(() => {
    if (cur && player) {
      try { player.replace(resolveFileUrl(cur.videoUrl)); } catch { /* noop */ }
    }
  }, [active, cur?.videoUrl]);

  return (
    <Screen edges={['top']}>
      <BackHeader title={title} onBack={() => nav.goBack()} />
      <Scroll>
        {isLoading && <ActivityIndicator style={{ marginTop: 32 }} color={color.blue} />}
        {!isLoading && cur && (
          <>
            <View style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 520, backgroundColor: '#000' }}>
              <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />
            </View>
            {videos.length > 1 && (
              <View style={{ flexDirection: 'row', gap: 8, padding: space.screenX, flexWrap: 'wrap' }}>
                {videos.map((v, i) => (
                  <Pressable key={v.id} onPress={() => setActive(i)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: i === active ? color.blue : color.surf }}>
                    <Text style={{ fontFamily: font.b, fontSize: 12.5, color: i === active ? color.white : color.ink }}>{i + 1}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
        {!isLoading && !cur && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontFamily: font.m, fontSize: 14, color: color.sub }}>아직 배포된 영상이 없어요</Text>
          </View>
        )}
      </Scroll>
    </Screen>
  );
}
