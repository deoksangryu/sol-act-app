import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader, BigTitle, InfoBox, Tag, ListRow, SectionLabel, Cta, Divider } from '../components/kit';
import { TopBar } from '../components/TopBar';
import { Icon } from '../components/Icon';
import { color, radius, space } from '../theme/tokens';
import { practiceApi, portfolioApi, resolveFileUrl } from '../services/api';
import { pickMedia } from '../services/upload';
import { useUploads } from '../services/UploadContext';
import { useDataRefresh } from '../services/ws';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';
import type { PracticeScriptView, PortfolioItem } from '../types';
import { md } from '../lib/date';

const MAX_SEC = 120;
const fmtCountdown = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

const itemStatus = (v: PortfolioItem): 'ready' | 'uploading' | 'failed' =>
  (v.uploadStatus as any) || (v.videoUrl ? 'ready' : 'uploading');

function PerfTag({ status, hasFeedback }: { status: string; hasFeedback: boolean }) {
  if (status === 'failed') return <Tag label="업로드 실패" tone="pending" />;
  if (status === 'uploading') return <Tag label="업로드 중" tone="todo" />;
  return hasFeedback ? <Tag label="피드백 완료" tone="done" /> : <Tag label="피드백 대기" tone="todo" />;
}

function ScriptBody({ sv, compact }: { sv: PracticeScriptView; compact?: boolean }) {
  const isDuo = sv.type === '2인대사';
  return (
    <View style={{ backgroundColor: color.surf, borderRadius: 16, paddingHorizontal: 18, paddingVertical: compact ? 16 : 22, marginTop: 14 }}>
      {sv.script.map((ln, i) => (
        <View key={i} style={{ marginTop: i ? (isDuo ? 16 : 13) : 0 }}>
          {isDuo && !!ln.speaker && <Text style={{ fontSize: 13, fontWeight: '700', color: color.blue, marginBottom: 4 }}>{ln.speaker}</Text>}
          <Text style={{ fontSize: 17, lineHeight: 31, color: color.ink, letterSpacing: -0.17 }}>{ln.text}</Text>
        </View>
      ))}
    </View>
  );
}

// ── 내 연기영상 상세 ──
function PerformanceDetail({ portfolioId, scriptId, onBack }: { portfolioId: string; scriptId?: string; onBack: () => void }) {
  const { data: item, isLoading } = useQuery({ queryKey: ['portfolio', portfolioId], queryFn: () => portfolioApi.get(portfolioId) });
  const { data: script } = useQuery({ queryKey: ['practice', 'script', scriptId], queryFn: () => practiceApi.getScript(scriptId!), enabled: !!scriptId });
  const comments = item?.comments || [];
  const status = item ? itemStatus(item) : 'uploading';

  return (
    <Screen edges={['top']}>
      <BackHeader title="내 연기영상" onBack={onBack} />
      <Scroll>
        <View style={{ backgroundColor: color.ink, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          {status === 'ready' && item?.thumbnailUrl ? (
            <Image source={{ uri: resolveFileUrl(item.thumbnailUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Icon name={status === 'failed' ? 'alert-triangle' : 'player-play'} size={28} color={status === 'failed' ? color.warn : color.white} />
              <Text style={{ fontSize: 13, color: color.white, opacity: 0.85 }}>{status === 'failed' ? '업로드가 완료되지 않았어요' : status === 'ready' ? '영상 준비됨' : '영상을 올리는 중이에요'}</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: space.screenX, paddingVertical: 16 }}>
          {isLoading && !item ? <ActivityIndicator color={color.blue} /> : (
            <>
              {!!script && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Tag label={script.type} tone="todo" />
                    <Text style={{ fontSize: 13, color: color.sub }}>연기한 제시대사</Text>
                  </View>
                  <ScriptBody sv={script} compact />
                </>
              )}
              <Divider />
              <Text style={{ fontSize: 13, fontWeight: '500', color: color.sub, marginVertical: 12 }}>선생님 피드백 {comments.length}개</Text>
              {comments.length === 0 ? (
                <InfoBox tone="info">아직 피드백이 없어요. 선생님이 확인하면 알려드려요.</InfoBox>
              ) : comments.map((c) => (
                <View key={c.id} style={{ backgroundColor: color.surf, borderRadius: radius.chip, padding: 13, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: color.ink }}>{c.authorName}</Text>
                    <Text style={{ fontSize: 11, color: color.sub }}>{md(c.date)}</Text>
                  </View>
                  <Text style={{ fontSize: 14, lineHeight: 24, color: color.ink }}>{c.content}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </Scroll>
    </Screen>
  );
}

// ── 학생: 제시대사 뽑기 + 연기영상 ──
function StudentPractice({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { upload } = useUploads();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['practice', 'current'], queryFn: () => practiceApi.current() });
  const { data: mine = [] } = useQuery({ queryKey: ['portfolios', 'scripted', userId], queryFn: () => portfolioApi.list({ studentId: userId, category: 'scripted', limit: 50 }) });
  useDataRefresh(['portfolios'], () => { qc.invalidateQueries({ queryKey: ['practice'] }); qc.invalidateQueries({ queryKey: ['portfolios'] }); });

  const [remaining, setRemaining] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [requested, setRequested] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [detail, setDetail] = useState<{ portfolioId: string; scriptId?: string } | null>(null);
  const prevDrawn = useRef<string | null | undefined>(undefined);

  // 쿨다운 시드 — 새 뽑기로 drawnAt이 바뀔 때만 재설정(백그라운드 refetch로 카운트다운 리셋 방지)
  useEffect(() => {
    if (!data) return;
    if (prevDrawn.current !== data.drawnAt) {
      prevDrawn.current = data.drawnAt;
      setRemaining(data.canDrawNew ? 0 : data.cooldownSecondsRemaining);
    }
  }, [data]);

  useEffect(() => {
    const t = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const cur = data?.current || null;
  const perf = data?.performance || null;
  const drawOff = remaining > 0 || generating;
  const drawLabel = remaining > 0 ? `다음 제시대사까지 ${fmtCountdown(remaining)}` : (cur ? '새 제시대사 받기' : '제시대사 받기');

  const onDraw = async () => {
    if (drawOff) return;
    setGenerating(true);
    try {
      const [res] = await Promise.all([practiceApi.draw(), new Promise((r) => setTimeout(r, 900))]);
      qc.setQueryData(['practice', 'current'], res);
    } catch (e: any) {
      Alert.alert('안내', e?.message || '제시대사를 받지 못했어요');
      qc.invalidateQueries({ queryKey: ['practice'] });
    } finally {
      setGenerating(false);
    }
  };

  const onRequestMore = async () => {
    if (requested) return;
    try {
      const res = await practiceApi.requestMore();
      setRequested(true);
      Alert.alert('요청 완료', res.already ? '이미 요청했어요. 원장님께 전달돼 있어요.' : '원장님께 새 제시대사를 요청했어요!');
    } catch (e: any) { Alert.alert('실패', e?.message || '요청하지 못했어요'); }
  };

  const onUploadVideo = async () => {
    if (!cur || uploadBusy) return;
    try {
      const media = await pickMedia('video', { videoMaxDuration: MAX_SEC });
      if (!media) return;
      if (media.durationMs != null && media.durationMs > MAX_SEC * 1000) {
        Alert.alert('안내', `2분 이내 영상만 올릴 수 있어요 (약 ${Math.round(media.durationMs / 1000)}초)`);
        return;
      }
      setUploadBusy(true);
      const snippet = (cur.script[0]?.text || '').replace(/\s+/g, ' ').trim().slice(0, 14);
      const p = await portfolioApi.create({
        title: snippet ? `제시대사 · ${snippet}…` : '제시대사 연기',
        description: (cur.script[0]?.text || '제시대사 연기').slice(0, 40),
        category: 'scripted',
        videoUrl: '',
        practiceScriptId: cur.id,
      });
      await upload('제시대사 연기', media, { subfolder: 'portfolios', targetType: 'portfolio', targetId: p.id });
      qc.invalidateQueries({ queryKey: ['practice'] });
      qc.invalidateQueries({ queryKey: ['portfolios'] });
    } catch (e: any) { Alert.alert('실패', e?.message || '영상을 올리지 못했어요'); }
    finally { setUploadBusy(false); }
  };

  if (detail) return <PerformanceDetail portfolioId={detail.portfolioId} scriptId={detail.scriptId} onBack={() => setDetail(null)} />;

  return (
    <Screen edges={['top']}>
      <TopBar />
      <BigTitle>제시대사</BigTitle>
      <Scroll contentStyle={{ paddingHorizontal: space.screenX, paddingBottom: 32 }}>
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={color.blue} /></View>
        ) : generating ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', gap: 14 }}>
            <ActivityIndicator color={color.blue} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: color.ink }}>제시대사를 준비하고 있어요…</Text>
            <Text style={{ fontSize: 13, color: color.sub }}>오늘의 대사를 뽑는 중</Text>
          </View>
        ) : isError && !data ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', gap: 14 }}>
            <Icon name="cloud-off" size={30} color={color.faint} />
            <Text style={{ fontSize: 15, color: color.sub }}>제시대사를 불러오지 못했어요.</Text>
            <Pressable onPress={() => refetch()} style={{ borderWidth: 1.5, borderColor: color.blue, borderRadius: radius.button, paddingHorizontal: 22, paddingVertical: 12 }}>
              <Text style={{ color: color.blue, fontWeight: '600' }}>다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {data?.exhausted && (
              <View style={{ marginBottom: 16, gap: 10 }}>
                <InfoBox tone="success">제시대사 {data.totalScripts}개를 모두 연습했어요! 👏 원장님께 새 대사를 요청할 수 있어요.</InfoBox>
                <Pressable onPress={onRequestMore} disabled={requested} style={{ borderWidth: 1.5, borderColor: color.blue, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}>
                  <Text style={{ color: color.blue, fontWeight: '600', fontSize: 14 }}>{requested ? '요청했어요 ✓' : '원장님께 새 제시대사 요청하기'}</Text>
                </Pressable>
              </View>
            )}

            {cur ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Tag label={cur.type} tone="todo" />
                  <Text style={{ fontSize: 12, color: color.faint }}>{data ? `${data.seenCount} / ${data.totalScripts}` : ''}</Text>
                </View>
                <ScriptBody sv={cur} />
                <View style={{ marginTop: 14 }}>
                  <Cta label={drawLabel} onPress={onDraw} disabled={drawOff} />
                </View>

                {perf ? (
                  <Pressable onPress={() => setDetail({ portfolioId: perf.portfolioId, scriptId: cur.id })}
                    style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.surf, borderRadius: radius.button, padding: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {perf.thumbnailUrl ? <Image source={{ uri: resolveFileUrl(perf.thumbnailUrl) }} style={{ width: '100%', height: '100%' }} /> : <Icon name="player-play" size={18} color={color.white} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: color.ink }}>내 연기영상</Text>
                      <Text style={{ fontSize: 12, color: color.sub, marginTop: 2 }}>{perf.hasFeedback ? `피드백 ${perf.commentCount}개` : '눌러서 확인'}</Text>
                    </View>
                    <PerfTag status={perf.uploadStatus} hasFeedback={perf.hasFeedback} />
                  </Pressable>
                ) : (
                  <Pressable onPress={onUploadVideo} disabled={uploadBusy} style={{ marginTop: 10, borderWidth: 1.5, borderColor: color.blue, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}>
                    <Text style={{ color: color.blue, fontWeight: '600', fontSize: 14 }}>{uploadBusy ? '올리는 중…' : '🎬 이 대사로 연기영상 올리기 (2분 이내)'}</Text>
                  </Pressable>
                )}

                <View style={{ marginTop: 16 }}>
                  <InfoBox tone="info">상황·인물·감정은 적혀 있지 않아요. 직접 분석해서 어떤 상황의 누구인지 정하고, 소리 내어 연기해 보세요.{cur.type === '2인대사' ? '\n2인 대사예요 — 상대역은 상상하며 연기해 보세요.' : ''}</InfoBox>
                </View>
              </View>
            ) : (
              <View style={{ paddingTop: 32, alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: color.blueBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="masks-theater" size={32} color={color.blue} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: color.ink, marginTop: 18 }}>오늘의 제시대사를 받아보세요</Text>
                <Text style={{ fontSize: 14, color: color.sub, marginTop: 10, lineHeight: 24, textAlign: 'center' }}>버튼을 누르면 대사가 하나 주어져요.{'\n'}상황과 감정은 스스로 분석해서 연기해 보세요.</Text>
                <View style={{ alignSelf: 'stretch', marginTop: 22 }}>
                  <Cta label={drawLabel} onPress={onDraw} disabled={drawOff} />
                </View>
              </View>
            )}

            {mine.length > 0 && (
              <>
                <Divider />
                <SectionLabel>내 연기영상 {mine.length}</SectionLabel>
                {mine.map((v) => {
                  const st = itemStatus(v);
                  const hasFb = (v.comments?.length ?? 0) > 0;
                  return (
                    <ListRow key={v.id} showChevron={false}
                      left={<View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{v.thumbnailUrl ? <Image source={{ uri: resolveFileUrl(v.thumbnailUrl) }} style={{ width: '100%', height: '100%' }} /> : <Icon name="player-play" size={17} color={color.white} />}</View>}
                      title="제시대사 연기" sub={md(v.date)}
                      right={<PerfTag status={st} hasFeedback={hasFb} />}
                      onPress={() => setDetail({ portfolioId: v.id, scriptId: v.practiceScriptId })} />
                  );
                })}
              </>
            )}
          </>
        )}
      </Scroll>
    </Screen>
  );
}

export function PracticeScreen() {
  const { user } = useAuth();
  if (!user) return null;
  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  if (isStaff) {
    return (
      <Screen edges={['top']}>
        <TopBar />
        <BigTitle>제시대사</BigTitle>
        <View style={{ paddingHorizontal: space.screenX, paddingTop: 8 }}>
          <InfoBox tone="info">학생 연기영상 검토·피드백은 곧 '영상' 탭에서 제공됩니다.</InfoBox>
        </View>
      </Screen>
    );
  }
  return <StudentPractice userId={user.id} />;
}
