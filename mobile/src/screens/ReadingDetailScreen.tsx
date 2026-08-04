import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { color, font, space } from '../theme/tokens';
import { contentApi } from '../services/api';

// 작품 읽을거리 상세 — 배움 탭 읽을거리 카드에서 진입. 본문(body)이 없으면 '준비 중' 안내.
export function ReadingDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const id: string = route.params?.id;
  const paramTitle: string | undefined = route.params?.title;
  const paramSub: string | undefined = route.params?.sub;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['content', 'reading', id],
    queryFn: () => contentApi.readingDetail(id),
    enabled: !!id,
    staleTime: 60000,
  });

  const title = data?.title ?? paramTitle ?? '읽을거리';
  const sub = data?.sub ?? paramSub ?? '';
  const body = (data?.body ?? '').trim();

  return (
    <Screen edges={['top']}>
      <BackHeader title="작품 읽을거리" onBack={() => nav.goBack()} />
      <Scroll contentStyle={{ paddingHorizontal: space.screenX, paddingBottom: 40 }}>
        <Text style={{ fontFamily: font.xb, fontSize: 22, lineHeight: 30, letterSpacing: -0.4, color: color.ink, marginTop: 10 }}>{title}</Text>
        {!!sub && <Text style={{ fontFamily: font.r, fontSize: 13, color: color.sub2, marginTop: 6 }}>{sub}</Text>}
        <View style={{ height: 1, backgroundColor: color.line, marginTop: 16, marginBottom: 4 }} />

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
        ) : isError ? (
          <Text style={{ fontFamily: font.m, fontSize: 14, color: color.sub2, textAlign: 'center', paddingVertical: 40 }}>불러오지 못했어요. 잠시 후 다시 시도해주세요.</Text>
        ) : body ? (
          <Text style={{ fontFamily: font.r, fontSize: 15.5, lineHeight: 27, color: color.ink, marginTop: 14 }}>{body}</Text>
        ) : (
          <Text style={{ fontFamily: font.m, fontSize: 14, lineHeight: 22, color: color.sub2, textAlign: 'center', paddingVertical: 40 }}>본문이 아직 준비 중이에요.{'\n'}곧 채워질 예정이에요.</Text>
        )}
      </Scroll>
    </Screen>
  );
}
