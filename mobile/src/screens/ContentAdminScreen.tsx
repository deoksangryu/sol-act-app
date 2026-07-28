import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';
import { contentAdminApi, QuizAdmin, ReadingAdmin, MediaAdmin, QuoteAdmin, RoutineAdmin, MissionAdmin } from '../services/api';
import { useUploads } from '../services/UploadContext';
import { pickMedia } from '../services/upload';

type Tab = 'media' | 'reading' | 'quiz' | 'quote' | 'routine' | 'mission';
const TABS: { key: Tab; label: string }[] = [
  { key: 'media', label: '시청각' }, { key: 'reading', label: '읽을거리' },
  { key: 'quiz', label: '상식 퀴즈' }, { key: 'quote', label: '오늘의 한 줄' },
  { key: 'routine', label: '오늘의 루틴' }, { key: 'mission', label: '오늘의 미션' },
];
const MISSION_TYPE_LABEL: Record<string, string> = { video: '영상 제출', journal: '연습 일지', quiz: '상식 퀴즈' };

const inputStyle = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: color.ink, fontFamily: font.m, backgroundColor: color.white } as const;
const Label = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginBottom: 6, marginTop: 6 }}>{children}</Text>
);

export function ContentAdminScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('media');
  const [editing, setEditing] = useState<any | 'new' | null>(null);

  const mediaQ = useQuery({ queryKey: ['admin', 'media'], queryFn: () => contentAdminApi.mediaList(), enabled: tab === 'media' });
  const readingQ = useQuery({ queryKey: ['admin', 'reading'], queryFn: () => contentAdminApi.readingList(), enabled: tab === 'reading' });
  const quizQ = useQuery({ queryKey: ['admin', 'quiz'], queryFn: () => contentAdminApi.quizList(), enabled: tab === 'quiz' });
  const quoteQ = useQuery({ queryKey: ['admin', 'quote'], queryFn: () => contentAdminApi.quoteList(), enabled: tab === 'quote' });
  const routineQ = useQuery({ queryKey: ['admin', 'routine'], queryFn: () => contentAdminApi.routineList(), enabled: tab === 'routine' });
  const missionQ = useQuery({ queryKey: ['admin', 'mission'], queryFn: () => contentAdminApi.missionList(), enabled: tab === 'mission' });
  const cur = tab === 'media' ? mediaQ : tab === 'reading' ? readingQ : tab === 'quiz' ? quizQ : tab === 'quote' ? quoteQ : tab === 'routine' ? routineQ : missionQ;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', tab] });

  const del = (label: string, fn: () => Promise<any>) => {
    Alert.alert('삭제', `${label}을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { try { await fn(); invalidate(); } catch (e: any) { Alert.alert('실패', e?.message || '삭제하지 못했어요'); } } },
    ]);
  };

  const Row = ({ title, sub, badge, onEdit, onDelete }: { title: string; sub?: string; badge?: string; onEdit: () => void; onDelete: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: color.line, paddingVertical: 13, paddingHorizontal: 14 }}>
      <Pressable onPress={onEdit} style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.b, fontSize: 14.5, color: color.ink }} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, marginTop: 2 }} numberOfLines={1}>{sub}</Text>}
      </Pressable>
      {!!badge && <View style={{ backgroundColor: color.surf, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontFamily: font.b, fontSize: 10.5, color: color.sub }}>{badge}</Text></View>}
      <Pressable onPress={onEdit} hitSlop={6} style={{ paddingHorizontal: 4 }}><Icon name="chevron-right" size={18} color={color.faint} /></Pressable>
      <Pressable onPress={onDelete} hitSlop={6} style={{ paddingHorizontal: 4 }}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.faint }}>✕</Text></Pressable>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <BackHeader title="콘텐츠 관리" onBack={() => nav.goBack()} />
      {/* 탭 */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: space.screenX, marginTop: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? color.ink : color.surf }}>
              <Text style={{ fontFamily: font.b, fontSize: 13, color: on ? color.white : color.sub }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Scroll contentStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: space.screenX, marginTop: 8 }}>
          <Pressable onPress={() => setEditing('new')} style={{ backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontFamily: font.b, fontSize: 14.5, color: color.white }}>+ 새 {TABS.find((t) => t.key === tab)?.label} 추가</Text>
          </Pressable>

          {cur.isLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={color.blue} /> : (
            <Card>
              {tab === 'media' && ((mediaQ.data ?? []).length === 0
                ? <Empty />
                : (mediaQ.data ?? []).map((m) => (
                    <Row key={m.id} title={m.title} sub={m.sub ?? undefined} badge={m.kind === 'youtube' ? '유튜브' : (m.url ? '영상' : '영상 없음')}
                      onEdit={() => setEditing(m)} onDelete={() => del('시청각 자료', () => contentAdminApi.mediaDelete(m.id))} />
                  )))}
              {tab === 'reading' && ((readingQ.data ?? []).length === 0
                ? <Empty />
                : (readingQ.data ?? []).map((r) => (
                    <Row key={r.id} title={r.title} sub={r.sub ?? undefined} badge={(r.body || '').trim() ? '본문' : '본문 없음'}
                      onEdit={() => setEditing(r)} onDelete={() => del('읽을거리', () => contentAdminApi.readingDelete(r.id))} />
                  )))}
              {tab === 'quiz' && ((quizQ.data ?? []).length === 0
                ? <Empty />
                : (quizQ.data ?? []).map((q) => (
                    <Row key={q.id} title={q.question} sub={`${q.category} · 정답 ${q.options[q.answerIndex] ?? ''}`}
                      onEdit={() => setEditing(q)} onDelete={() => del('퀴즈', () => contentAdminApi.quizDelete(q.id))} />
                  )))}
              {tab === 'quote' && ((quoteQ.data ?? []).length === 0
                ? <Empty />
                : (quoteQ.data ?? []).map((q) => (
                    <Row key={q.id} title={q.text} sub={q.source ?? undefined}
                      onEdit={() => setEditing(q)} onDelete={() => del('명대사', () => contentAdminApi.quoteDelete(q.id))} />
                  )))}
              {tab === 'routine' && ((routineQ.data ?? []).length === 0
                ? <Empty />
                : (routineQ.data ?? []).map((r) => (
                    <Row key={r.id} title={r.title} sub={r.sub ?? undefined} badge={`+${r.reward}`}
                      onEdit={() => setEditing(r)} onDelete={() => del('루틴', () => contentAdminApi.routineDelete(r.id))} />
                  )))}
              {tab === 'mission' && ((missionQ.data ?? []).length === 0
                ? <Empty />
                : (missionQ.data ?? []).map((m) => (
                    <Row key={m.id} title={m.title} sub={`${MISSION_TYPE_LABEL[m.type] ?? m.type} · +${m.reward}`}
                      onEdit={() => setEditing(m)} onDelete={() => del('미션', () => contentAdminApi.missionDelete(m.id))} />
                  )))}
            </Card>
          )}
          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center', marginTop: 12 }}>
            {tab === 'quiz' ? '등록한 순서대로 매일 1문항씩 순환해요.' : tab === 'quote' ? '등록한 명대사가 매일 1개씩 순환해요.' : tab === 'media' ? '유튜브 링크 또는 영상 파일을 올리면 학생 배움 탭에 보여요.' : tab === 'routine' ? '모든 학생의 홈 "오늘의 루틴"에 공통으로 보여요. 바꾸면 즉시 반영돼요.' : tab === 'mission' ? '모든 학생의 홈 "오늘의 미션"에 보여요. 종류(영상/일지/퀴즈)가 완료 판정·이동을 정해요.' : '학생 배움 탭의 작품 읽을거리에 보여요.'}
          </Text>
        </View>
      </Scroll>

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing && (
          <EditForm tab={tab} item={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onDone={() => { setEditing(null); invalidate(); }} />
        )}
      </Modal>
    </Screen>
  );
}

const Empty = () => <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>아직 등록된 항목이 없어요</Text></View>;

// ─── 편집 폼(타입별) ───
function EditForm({ tab, item, onClose, onDone }: { tab: Tab; item: any | null; onClose: () => void; onDone: () => void }) {
  const title = `${item ? '수정' : '새'} ${TABS.find((t) => t.key === tab)?.label}`;
  return (
    <Screen edges={['top']}>
      <BackHeader title={title} onBack={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <Scroll contentStyle={{ paddingHorizontal: space.screenX, paddingBottom: 40 }}>
          {tab === 'media' && <MediaForm item={item} onDone={onDone} />}
          {tab === 'reading' && <ReadingForm item={item} onDone={onDone} />}
          {tab === 'quiz' && <QuizForm item={item} onDone={onDone} />}
          {tab === 'quote' && <QuoteForm item={item} onDone={onDone} />}
          {tab === 'routine' && <RoutineForm item={item} onDone={onDone} />}
          {tab === 'mission' && <MissionForm item={item} onDone={onDone} />}
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SaveBtn({ busy, onPress, label = '저장' }: { busy: boolean; onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={{ backgroundColor: busy ? color.inputLine : color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center', marginTop: 18 }}>
      {busy ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>{label}</Text>}
    </Pressable>
  );
}

// ── 시청각 ──
function MediaForm({ item, onDone }: { item: MediaAdmin | null; onDone: () => void }) {
  const { upload } = useUploads();
  const [id, setId] = useState<string | null>(item?.id ?? null);
  const [title, setTitle] = useState(item?.title ?? '');
  const [sub, setSub] = useState(item?.sub ?? '');
  const [kind, setKind] = useState<'youtube' | 'video'>(item?.kind ?? 'youtube');
  const [url, setUrl] = useState(item?.url ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    if (!title.trim()) { Alert.alert('제목을 입력해주세요'); return; }
    if (kind === 'youtube' && !url.trim()) { Alert.alert('유튜브 링크를 입력해주세요'); return; }
    setBusy(true);
    try {
      const payload = { title: title.trim(), sub: sub.trim(), kind, url: kind === 'youtube' ? url.trim() : (item?.url ?? '') };
      if (id) { await contentAdminApi.mediaUpdate(id, payload); onDone(); }
      else {
        const r = await contentAdminApi.mediaCreate(payload);
        if (kind === 'video') { setId(r.id); Alert.alert('저장됨', '이제 아래에서 영상 파일을 올려주세요.'); }
        else onDone();
      }
    } catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };

  const uploadVideo = async () => {
    if (!id) { Alert.alert('먼저 저장', '제목을 저장한 뒤 영상을 올려주세요.'); return; }
    try {
      const media = await pickMedia('video');
      if (!media) return;
      setUploading(true);
      await upload(`${title} 영상`, media, { subfolder: 'media', targetType: 'media_resource', targetId: id });
      Alert.alert('완료', '영상을 올렸어요. 처리 후 학생 화면에 표시돼요.');
      onDone();
    } catch (e: any) { Alert.alert('업로드 실패', e?.message || '영상을 올리지 못했어요'); }
    finally { setUploading(false); }
  };

  return (
    <View style={{ marginTop: 8 }}>
      <Label>제목</Label>
      <TextInput value={title} onChangeText={setTitle} placeholder="예: 니나 독백 레퍼런스 공연" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>부제(선택)</Label>
      <TextInput value={sub} onChangeText={setSub} placeholder="예: 김쏠 선생님 추천" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>종류</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['youtube', 'video'] as const).map((k) => {
          const on = kind === k;
          return (
            <Pressable key={k} onPress={() => setKind(k)} style={{ flex: 1, borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: radius.button, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ fontFamily: font.b, fontSize: 13.5, color: on ? color.blue : color.sub }}>{k === 'youtube' ? '📺 유튜브 링크' : '🎬 영상 업로드'}</Text>
            </Pressable>
          );
        })}
      </View>
      {kind === 'youtube' ? (
        <>
          <Label>유튜브 링크</Label>
          <TextInput value={url} onChangeText={setUrl} placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=..." placeholderTextColor={color.faint} style={inputStyle} autoCapitalize="none" keyboardType="url" />
        </>
      ) : (
        <View style={{ marginTop: 10, backgroundColor: color.surf, borderRadius: radius.card, padding: 14 }}>
          <Text style={{ fontFamily: font.m, fontSize: 12.5, color: color.sub, marginBottom: 10 }}>
            {item?.url || (id && url) ? '영상이 등록돼 있어요. 교체하려면 다시 올려주세요.' : id ? '영상 파일을 올려주세요(SSD에 저장돼요).' : '먼저 저장한 뒤 영상을 올릴 수 있어요.'}
          </Text>
          <Pressable onPress={uploadVideo} disabled={uploading || !id} style={{ backgroundColor: !id ? color.inputLine : color.ink, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}>
            {uploading ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 14, color: color.white }}>🎬 영상 {item?.url ? '교체' : '업로드'}</Text>}
          </Pressable>
        </View>
      )}
      <SaveBtn busy={busy} onPress={save} label={item ? '수정 저장' : kind === 'video' ? '저장하고 영상 올리기' : '저장'} />
    </View>
  );
}

// ── 읽을거리 ──
function ReadingForm({ item, onDone }: { item: ReadingAdmin | null; onDone: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [sub, setSub] = useState(item?.sub ?? '');
  const [minutes, setMinutes] = useState(String(item?.minutes ?? 5));
  const [body, setBody] = useState(item?.body ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) { Alert.alert('제목을 입력해주세요'); return; }
    setBusy(true);
    try {
      const payload = { title: title.trim(), sub: sub.trim(), minutes: Math.max(1, parseInt(minutes, 10) || 5), body: body.trim() };
      if (item) await contentAdminApi.readingUpdate(item.id, payload); else await contentAdminApi.readingCreate(payload);
      onDone();
    } catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: 8 }}>
      <Label>제목</Label>
      <TextInput value={title} onChangeText={setTitle} placeholder="예: 『갈매기』 딥리딩 3화" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>부제(선택)</Label>
      <TextInput value={sub} onChangeText={setSub} placeholder="예: 니나는 왜 무대로 돌아왔나" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>예상 읽기 시간(분)</Label>
      <TextInput value={minutes} onChangeText={setMinutes} keyboardType="number-pad" style={inputStyle} />
      <Label>본문</Label>
      <TextInput value={body} onChangeText={setBody} placeholder="읽을거리 본문을 입력하세요" placeholderTextColor={color.faint} style={[inputStyle, { minHeight: 200, textAlignVertical: 'top' }]} multiline />
      <SaveBtn busy={busy} onPress={save} label={item ? '수정 저장' : '저장'} />
    </View>
  );
}

// ── 상식 퀴즈 ──
function QuizForm({ item, onDone }: { item: QuizAdmin | null; onDone: () => void }) {
  const [category, setCategory] = useState(item?.category ?? '상식');
  const [question, setQuestion] = useState(item?.question ?? '');
  const [options, setOptions] = useState<string[]>(item?.options?.length ? [...item.options] : ['', '']);
  const [answerIndex, setAnswerIndex] = useState(item?.answerIndex ?? 0);
  const [explanation, setExplanation] = useState(item?.explanation ?? '');
  const [busy, setBusy] = useState(false);
  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const addOpt = () => setOptions((o) => (o.length < 5 ? [...o, ''] : o));
  const rmOpt = (i: number) => setOptions((o) => { const n = o.filter((_, j) => j !== i); if (answerIndex >= n.length) setAnswerIndex(0); return n; });
  const save = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) { Alert.alert('문제를 입력해주세요'); return; }
    if (opts.length < 2) { Alert.alert('보기를 2개 이상 입력해주세요'); return; }
    if (answerIndex >= opts.length) { Alert.alert('정답을 다시 선택해주세요'); return; }
    setBusy(true);
    try {
      const payload = { category: category.trim() || '상식', question: question.trim(), options: opts, answerIndex, explanation: explanation.trim() };
      if (item) await contentAdminApi.quizUpdate(item.id, payload); else await contentAdminApi.quizCreate(payload);
      onDone();
    } catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: 8 }}>
      <Label>분류</Label>
      <TextInput value={category} onChangeText={setCategory} placeholder="예: 연극사" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>문제</Label>
      <TextInput value={question} onChangeText={setQuestion} placeholder="문제를 입력하세요" placeholderTextColor={color.faint} style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]} multiline />
      <Label>보기 (정답을 탭해서 선택)</Label>
      {options.map((o, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Pressable onPress={() => setAnswerIndex(i)} hitSlop={6} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: answerIndex === i ? color.success : color.inputLine, backgroundColor: answerIndex === i ? color.success : color.white, alignItems: 'center', justifyContent: 'center' }}>
            {answerIndex === i && <Text style={{ color: color.white, fontSize: 13 }}>✓</Text>}
          </Pressable>
          <TextInput value={o} onChangeText={(v) => setOpt(i, v)} placeholder={`보기 ${i + 1}`} placeholderTextColor={color.faint} style={[inputStyle, { flex: 1 }]} />
          {options.length > 2 && <Pressable onPress={() => rmOpt(i)} hitSlop={6}><Text style={{ fontFamily: font.b, fontSize: 16, color: color.faint }}>✕</Text></Pressable>}
        </View>
      ))}
      {options.length < 5 && <Pressable onPress={addOpt} style={{ paddingVertical: 8 }}><Text style={{ fontFamily: font.b, fontSize: 13, color: color.blue }}>+ 보기 추가</Text></Pressable>}
      <Label>해설(선택)</Label>
      <TextInput value={explanation} onChangeText={setExplanation} placeholder="정답 해설" placeholderTextColor={color.faint} style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]} multiline />
      <SaveBtn busy={busy} onPress={save} label={item ? '수정 저장' : '저장'} />
    </View>
  );
}

// ── 오늘의 한 줄 ──
function QuoteForm({ item, onDone }: { item: QuoteAdmin | null; onDone: () => void }) {
  const [text, setText] = useState(item?.text ?? '');
  const [source, setSource] = useState(item?.source ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!text.trim()) { Alert.alert('대사를 입력해주세요'); return; }
    setBusy(true);
    try {
      const payload = { text: text.trim(), source: source.trim() };
      if (item) await contentAdminApi.quoteUpdate(item.id, payload); else await contentAdminApi.quoteCreate(payload);
      onDone();
    } catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: 8 }}>
      <Label>명대사</Label>
      <TextInput value={text} onChangeText={setText} placeholder={'예: "난 갈매기… 아니, 그게 아니야. 난 배우야."'} placeholderTextColor={color.faint} style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]} multiline />
      <Label>출처(선택)</Label>
      <TextInput value={source} onChangeText={setSource} placeholder="예: 니나 · 4막" placeholderTextColor={color.faint} style={inputStyle} />
      <SaveBtn busy={busy} onPress={save} label={item ? '수정 저장' : '저장'} />
    </View>
  );
}

// ── 오늘의 루틴 ──
function RoutineForm({ item, onDone }: { item: RoutineAdmin | null; onDone: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [sub, setSub] = useState(item?.sub ?? '');
  const [reward, setReward] = useState(String(item?.reward ?? 5));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) { Alert.alert('루틴 이름을 입력해주세요'); return; }
    setBusy(true);
    try {
      const payload = { title: title.trim(), sub: sub.trim(), reward: Math.max(0, Math.min(60, parseInt(reward, 10) || 5)) };
      if (item) await contentAdminApi.routineUpdate(item.id, payload); else await contentAdminApi.routineCreate(payload);
      onDone();
    } catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: 8 }}>
      <Label>루틴 이름</Label>
      <TextInput value={title} onChangeText={setTitle} placeholder="예: 발성 루틴 10분" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>설명(선택)</Label>
      <TextInput value={sub} onChangeText={setSub} placeholder="예: 아침 워밍업" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>보상 박수 (0~60)</Label>
      <TextInput value={reward} onChangeText={setReward} keyboardType="number-pad" style={inputStyle} />
      <SaveBtn busy={busy} onPress={save} label={item ? '수정 저장' : '저장'} />
    </View>
  );
}

// ── 오늘의 미션 ──
function MissionForm({ item, onDone }: { item: MissionAdmin | null; onDone: () => void }) {
  const [type, setType] = useState<'video' | 'journal' | 'quiz'>(item?.type ?? 'video');
  const [title, setTitle] = useState(item?.title ?? '');
  const [sub, setSub] = useState(item?.sub ?? '');
  const [reward, setReward] = useState(String(item?.reward ?? 5));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) { Alert.alert('미션 제목을 입력해주세요'); return; }
    setBusy(true);
    try {
      const payload = { type, title: title.trim(), sub: sub.trim(), reward: Math.max(0, Math.min(99, parseInt(reward, 10) || 5)) };
      if (item) await contentAdminApi.missionUpdate(item.id, payload); else await contentAdminApi.missionCreate(payload);
      onDone();
    } catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: 8 }}>
      <Label>종류 (완료 판정·이동을 정해요)</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(['video', 'journal', 'quiz'] as const).map((k) => {
          const on = type === k;
          const label = k === 'video' ? '🎬 영상 제출' : k === 'journal' ? '📓 연습 일지' : '🧠 상식 퀴즈';
          return (
            <Pressable key={k} onPress={() => setType(k)} style={{ borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ fontFamily: font.b, fontSize: 13, color: on ? color.blue : color.sub }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Label>제목</Label>
      <TextInput value={title} onChangeText={setTitle} placeholder="예: 연기 영상 1개 제출" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>설명(선택)</Label>
      <TextInput value={sub} onChangeText={setSub} placeholder="예: 오늘 연습을 영상으로 남겨요" placeholderTextColor={color.faint} style={inputStyle} />
      <Label>표시 보상 (+N 👏)</Label>
      <TextInput value={reward} onChangeText={setReward} keyboardType="number-pad" style={inputStyle} />
      <SaveBtn busy={busy} onPress={save} label={item ? '수정 저장' : '저장'} />
    </View>
  );
}
