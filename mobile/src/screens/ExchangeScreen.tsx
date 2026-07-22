import React from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../components/kit';
import { Section, Card } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';
import { exchangeApi, type ExchangeItemView } from '../services/api';

// 백엔드 미기동 시 폴백(교환은 백엔드 필요 — 화면만 채움)
const MOCK_ITEMS: ExchangeItemView[] = [
  { id: 'm1', name: '선생님 1:1 피드백권', description: '원하는 영상에 심화 피드백', cost: 50, icon: '💬', kind: 'feedback' },
  { id: 'm2', name: '연습실 우선 예약', description: '이번 주 연습실 우선권', cost: 40, icon: '🚪', kind: 'practice_room' },
  { id: 'm3', name: '모의면접 우선권', description: '모의면접 순번 우선', cost: 60, icon: '🎤', kind: 'mock_interview' },
  { id: 'm4', name: '커튼콜 프리즈', description: '연속 기록 하루 방어', cost: 30, icon: '🧊', kind: 'freeze' },
];

export function ExchangeScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['exchange'], queryFn: () => exchangeApi.items(), retry: false, staleTime: 20000 });
  const { data: orders } = useQuery({ queryKey: ['exchangeOrders'], queryFn: () => exchangeApi.orders(), retry: false, staleTime: 20000 });
  const balance = data?.balance ?? 0;
  const items = data?.items ?? MOCK_ITEMS;

  const redeem = (it: ExchangeItemView) => {
    if (balance < it.cost) { Alert.alert('박수가 부족해요', `${it.cost}👏가 필요해요 · 지금 ${balance}👏`); return; }
    Alert.alert(it.name, `${it.cost}👏로 교환할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '교환',
        onPress: () => {
          exchangeApi.redeem(it.id)
            .then(() => {
              qc.invalidateQueries({ queryKey: ['exchange'] });
              qc.invalidateQueries({ queryKey: ['exchangeOrders'] });
              qc.invalidateQueries({ queryKey: ['gamification'] });
              Alert.alert('교환 완료', `'${it.name}' 교환됐어요 · 남은 박수 ${Math.max(0, balance - it.cost)}👏`);
            })
            .catch((e: any) => Alert.alert('교환 실패', e?.message || '교환하지 못했어요'));
        },
      },
    ]);
  };

  return (
    <Screen bg={color.bg} edges={['top']}>
      <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}><Icon name="chevron-left" size={26} color={color.ink} /></Pressable>
        <Text style={{ fontFamily: font.xb, fontSize: 21, color: color.ink, flex: 1 }}>박수 교환소</Text>
        <View style={{ backgroundColor: color.amberBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ fontFamily: font.b, fontSize: 13, color: color.amber }}>{balance} 👏</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Section title="교환 상품">
          <Card>
            {items.map((it, i) => {
              const afford = balance >= it.cost;
              return (
                <Pressable key={it.id} onPress={() => redeem(it)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }, pressed && { backgroundColor: color.surf }]}>
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: color.surf, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 21 }}>{it.icon || '🎁'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>{it.name}</Text>
                    {!!it.description && <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>{it.description}</Text>}
                  </View>
                  <View style={{ backgroundColor: afford ? color.blue : color.surf, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8 }}>
                    <Text style={{ fontFamily: font.b, fontSize: 12.5, color: afford ? color.white : color.faint }}>{it.cost} 👏</Text>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </Section>

        {orders && orders.length > 0 && (
          <Section title="교환 내역">
            <Card>
              {orders.map((o, i) => (
                <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.sb, fontSize: 14.5, color: color.ink }}>{o.itemName}</Text>
                    <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 2 }}>{o.cost}👏 · {o.status === 'fulfilled' ? '처리 완료' : '접수됨'}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </Section>
        )}

        <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center', marginTop: 12, paddingHorizontal: space.screenX, lineHeight: 19 }}>박수는 연습·제출·루틴으로 모아요 · 현금성·핵심 기능 유료화는 하지 않아요</Text>
      </ScrollView>
    </Screen>
  );
}
