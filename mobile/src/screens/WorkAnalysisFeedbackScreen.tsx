import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { color, font, radius, space } from '../theme/tokens';
import { workAnalysisApi, AnalysisVersionView } from '../services/api';

// 학생: 받은 첨삭 보기(3분할 + 칸별 코멘트) + 고쳐서 다시 내기.
export function WorkAnalysisFeedbackScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const id: string = route.params?.id;
  const [revising, setRevising] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['workAnalyses', id], queryFn: () => workAnalysisApi.detail(id), staleTime: 5000 });

  // 첨삭 있는 최신 버전 → 없으면 최신 버전
  const reviewed = data ? [...data.versions].reverse().find((v) => v.feedback) : undefined;
  const latest: AnalysisVersionView | undefined = reviewed ?? (data ? data.versions[data.versions.length - 1] : undefined);
  const fb = latest?.feedback;

  const revise = async () => {
    setRevising(true);
    try {
      const r = await workAnalysisApi.revise(id);
      qc.invalidateQueries({ queryKey: ['workAnalyses'] });
      nav.replace('workAnalysisWizard', { id });
    } catch (e: any) { Alert.alert('실패', e?.message || '개정 버전을 만들지 못했어요.'); }
    finally { setRevising(false); }
  };

  return (
    <Screen edges={['top']} bg={color.bg}>
      <BackHeader title="받은 첨삭" onBack={() => nav.goBack()} />
      {isLoading || !data ? (
        <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
      ) : (
        <Scroll contentStyle={{ padding: space.screenX, paddingBottom: 120 }}>
          <Text style={{ fontFamily: font.xb, fontSize: 21, color: color.ink, lineHeight: 29 }}>{data.title}{data.character ? ` · ${data.character}` : ''}</Text>
          <Text style={{ fontFamily: font.r, fontSize: 13, color: color.sub2, marginTop: 6 }}>
            {data.typeLabel} · v{latest?.versionNo ?? 1}{latest?.status === 'reviewed' ? ' · 첨삭 완료' : ' · 첨삭 대기 중'}
          </Text>

          {!fb ? (
            <View style={{ backgroundColor: color.white, borderRadius: radius.card, padding: 24, marginTop: 20, alignItems: 'center' }}>
              <Text style={{ fontFamily: font.b, fontSize: 15, color: color.sub, textAlign: 'center' }}>아직 첨삭 전이에요</Text>
              <Text style={{ fontFamily: font.r, fontSize: 13, color: color.sub2, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>선생님이 확인하면 알림으로 알려드릴게요.{'\n'}보통 하루 안에 도착해요.</Text>
            </View>
          ) : (
            <View style={{ marginTop: 18, gap: 10 }}>
              {!!fb.good && <FbCard tone="good" label="잘한 점" body={fb.good} />}
              {!!fb.fix && <FbCard tone="fix" label="고칠 점" body={fb.fix} />}
              {!!fb.next && <FbCard tone="next" label="다음에 할 일" body={fb.next} />}
              {(latest?.comments?.length ?? 0) > 0 && (
                <>
                  <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginTop: 12, marginBottom: 2 }}>칸별 코멘트</Text>
                  {latest!.comments!.map((c) => (
                    <View key={c.id} style={{ backgroundColor: color.white, borderRadius: radius.card, padding: 16 }}>
                      <Text style={{ fontFamily: font.b, fontSize: 12, color: color.sub2, marginBottom: 6 }}>{FIELD_KO[c.fieldKey] ?? c.fieldKey}</Text>
                      <Text style={{ fontFamily: font.r, fontSize: 15, lineHeight: 23, color: color.ink }}>{c.content}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </Scroll>
      )}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.screenX, paddingBottom: 28, backgroundColor: color.bg }}>
        <Pressable onPress={revise} disabled={revising} style={{ height: 54, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: color.blue }}>
          {revising ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 16, color: color.white }}>고쳐서 다시 내기</Text>}
        </Pressable>
      </View>
    </Screen>
  );
}

const TONE = {
  good: color.success, fix: color.danger, next: color.blue,
};
function FbCard({ tone, label, body }: { tone: 'good' | 'fix' | 'next'; label: string; body: string }) {
  return (
    <View style={{ backgroundColor: color.white, borderRadius: radius.card, padding: 18 }}>
      <Text style={{ fontFamily: font.b, fontSize: 12, color: TONE[tone], marginBottom: 8 }}>{label}</Text>
      <Text style={{ fontFamily: font.r, fontSize: 15, lineHeight: 24, color: color.sub }}>{body}</Text>
    </View>
  );
}

export const FIELD_KO: Record<string, string> = {
  oneLine: '한 줄 상황', goal: '목표', other: '상대', obstacle: '장애물', tactics: '전술', expectation: '기대',
  partnerWho: '보이지 않는 상대', partnerDo: '독백 동안 상대의 행동', catchPoint: '받기 포인트', beats: '비트',
  theme: '주제', structure: '구조', why: '넘버의 극적 기능', songType: '넘버 유형',
  given: '주어진 상황', subtext: '서브텍스트',
};
