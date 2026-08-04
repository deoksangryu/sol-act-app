import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { color, font, space } from '../theme/tokens';
import { contentApi, resolveFileUrl } from '../services/api';

// 유튜브 URL에서 11자리 videoId 추출(youtu.be / watch?v= / embed / shorts)
const ytId = (u: string): string | null => {
  const m = (u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
};

// 학생 시청각 자료 재생 — 유튜브면 인앱 임베드, 업로드 영상이면 expo-video. 열면 시청 보상(+5, 하루 1회) 지급.
export function MediaPlayerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const { id, title = '시청각 자료', url = '', kind = 'video' } = route.params ?? {};

  // 열람 시 1회 보상(서버가 하루 1회 상한 강제)
  useEffect(() => {
    if (!id) return;
    contentApi.watchMedia(id).then(() => qc.invalidateQueries({ queryKey: ['gamification'] })).catch(() => {});
  }, [id]);

  const isYoutube = kind === 'youtube' || !!ytId(url);
  const vid = ytId(url);
  const fileUrl = !isYoutube ? resolveFileUrl(url) : null;
  const player = useVideoPlayer(fileUrl, (p) => { p.loop = false; });
  const [err, setErr] = useState(false);

  return (
    <Screen edges={['top']}>
      <BackHeader title={title} onBack={() => nav.goBack()} />
      <Scroll>
        {isYoutube ? (
          vid ? (
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
              <WebView
                source={{ uri: `https://www.youtube.com/embed/${vid}?playsinline=1&rel=0&modestbranding=1` }}
                style={{ flex: 1, backgroundColor: '#000' }}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                onError={() => setErr(true)}
              />
            </View>
          ) : (
            <NotReady text="유튜브 링크를 인식하지 못했어요." />
          )
        ) : fileUrl ? (
          <View style={{ width: '100%', aspectRatio: 16 / 9, maxHeight: 520, backgroundColor: '#000' }}>
            <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />
          </View>
        ) : (
          <NotReady text="아직 재생할 영상이 없어요. (준비 중)" />
        )}

        {err && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.danger, textAlign: 'center', marginTop: 12 }}>재생 중 문제가 발생했어요.</Text>}

        <View style={{ paddingHorizontal: space.screenX, marginTop: 16 }}>
          <Text style={{ fontFamily: font.b, fontSize: 17, lineHeight: 24, color: color.ink }}>{title}</Text>
          <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 8 }}>시청하면 +5 👏 (하루 1회)</Text>
        </View>
      </Scroll>
    </Screen>
  );
}

function NotReady({ text }: { text: string }) {
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: color.surf, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.m, fontSize: 13.5, color: color.sub2, textAlign: 'center', paddingHorizontal: 24 }}>{text}</Text>
    </View>
  );
}
