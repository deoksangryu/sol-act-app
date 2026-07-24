import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll } from '../components/kit';
import { Icon } from '../components/Icon';
import { color, radius, space, font } from '../theme/tokens';
import { notificationApi } from '../services/api';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';
import { md } from '../lib/date';

// 알림 메시지 → 이동할 화면. 알림에 별도 target 필드가 없어(entity는 DB 미저장) 메시지 키워드로 추론.
// 백엔드 notify_* 메시지 전수(2026-07-21)를 기준으로 매핑. 순서 중요(구체적 키워드 먼저).
// 'home'/'my'는 탭(중첩 네비) — goto에서 별도 처리. RN 미사용 기능(과제·질문·평가·오디션·개인레슨·계획)은
// 현재 알림이 발생하지 않으므로 매핑하지 않는다(발생 시 null=무동작, 오화면 이동보다 안전).
function inferTarget(message: string): string | null {
  if (/모의테스트/.test(message)) return 'mockTest';                            // 모의테스트 공지·음원제출·영상도착 (videos보다 먼저)
  if (/공지/.test(message)) return 'notices';                                   // 새 공지사항 / 공지 수정
  if (/일지|수업|출석|출결|클래스/.test(message)) return 'classes';             // 수업일지·연습일지·출결·클래스 등록/제외·새 수업 (videos보다 먼저: "수업일지 AI피드백")
  if (/영상|포트폴리오|피드백|리뷰|최적화|제출/.test(message)) return 'videos'; // 업로드·댓글·AI피드백·최적화완료·제출리뷰
  if (/갈채|뱃지|배지|성장상|스트릭|칭찬스티커|스티커/.test(message)) return 'my';
  if (/식단/.test(message)) return 'diet';
  if (/음원|음악/.test(message)) return 'music';
  if (/시험/.test(message)) return 'home';                                       // 새 시험 일정 → 홈 '다가오는 일정'
  return null;
}

const CAT: Record<string, { icon: string; bg: string; fg: string }> = {
  videos: { icon: 'video', bg: color.blueBg, fg: color.blue },
  diet: { icon: 'salad', bg: color.successBg, fg: color.success },
  music: { icon: 'headphones', bg: color.purpleBg, fg: color.purple },
  classes: { icon: 'school', bg: color.blueBg, fg: color.blue },
  my: { icon: 'flame', bg: color.amberBg, fg: color.amber },
  notices: { icon: 'bell', bg: color.blueBg, fg: color.blue },
  home: { icon: 'calendar', bg: color.purpleBg, fg: color.purple },
  mockTest: { icon: 'microphone', bg: color.purpleBg, fg: color.purple },
};

function dtShort(iso: string): string {
  if (!iso) return '';
  const t = iso.length > 11 ? iso.slice(11, 16) : '';
  return t ? `${md(iso)} ${t}` : md(iso);
}

export function NotificationsScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: notifs = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => notificationApi.list() });

  const markAll = async () => {
    try { await notificationApi.markAllRead(); qc.invalidateQueries({ queryKey: ['notifications'] }); } catch { /* noop */ }
  };
  // 해당 화면으로 이동(알림 화면은 스택에 남아 뒤로가기로 복귀). 타깃 없으면 무동작.
  // 'my'/'home'은 탭 화면 — 학생 탭에만 존재(시험 알림·갈채는 학생 전용). 학생이 아니면 이동 안 함(방어적).
  const goto = (route: string) => {
    if (route === 'my' || route === 'home') {
      if (user?.role === UserRole.STUDENT) nav.navigate('tabs', { screen: route });
      return;
    }
    // 모의테스트: 원장은 관리 화면, 학생은 내 모의테스트 화면으로
    if (route === 'mockTest') {
      nav.navigate(user?.role === UserRole.DIRECTOR ? 'mockTestAdmin' : 'mockTest');
      return;
    }
    nav.navigate(route);
  };
  const hasUnread = notifs.some((n) => !n.read);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ padding: 6 }}>
          <Icon name="arrow-left" size={22} color={color.ink} />
        </Pressable>
        <Text style={{ fontSize: 16, fontFamily: font.sb, color: color.ink }}>알림</Text>
      </View>

      <Scroll>
        {notifs.length === 0 ? (
          <Text style={{ padding: 48, textAlign: 'center', color: color.sub, fontSize: 13 }}>새로운 알림이 없어요</Text>
        ) : notifs.map((n) => {
          const target = inferTarget(n.message);
          const c = (target && CAT[target]) || CAT.classes;
          return (
            <Pressable key={n.id} onPress={() => { if (target) goto(target); }}
              style={{ flexDirection: 'row', gap: 12, paddingHorizontal: space.screenX, paddingVertical: 14, alignItems: 'flex-start', backgroundColor: n.read ? color.white : color.blueBg }}>
              <View style={{ width: 42, height: 42, borderRadius: radius.chip, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={c.icon} size={20} color={c.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: n.read ? font.m : font.sb, color: color.ink, lineHeight: 20 }}>{n.message.replace(/님님/g, '님')}</Text>
                  {!n.read && <View style={{ width: 7, height: 7, borderRadius: radius.pill, backgroundColor: color.blue, marginTop: 5 }} />}
                </View>
                <Text style={{ fontSize: 11, color: color.sub, marginTop: 4 }}>{dtShort(n.date)}</Text>
              </View>
            </Pressable>
          );
        })}
      </Scroll>

      {hasUnread && (
        <View style={{ paddingHorizontal: space.screenX, paddingVertical: 12 }}>
          <Pressable onPress={markAll} style={{ backgroundColor: color.surf, borderRadius: radius.button, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontFamily: font.sb, color: color.ink }}>모두 읽음 표시</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
