import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader, ListRow, Tag, Empty, Cta, FlowTitle } from '../components/kit';
import { Icon } from '../components/Icon';
import { color, radius, space } from '../theme/tokens';
import { noticeApi } from '../services/api';
import { useDataRefresh } from '../services/ws';
import { useAppData } from '../services/appData';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';
import type { Notice, ClassInfo } from '../types';

const fmtDate = (s: string) => (s || '').slice(0, 10).replace(/-/g, '.');

export function NoticesScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const canWrite = user?.role === UserRole.DIRECTOR;
  const { classes } = useAppData();
  const qc = useQueryClient();

  const { data: notices = [], isLoading } = useQuery({ queryKey: ['notices'], queryFn: () => noticeApi.list() });
  useDataRefresh(['notices'], () => qc.invalidateQueries({ queryKey: ['notices'] }));

  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Notice | 'new' | null>(null);

  const targetLabel = (n: Notice) => {
    const ids = n.targetClassIds || [];
    if (!ids.length) return '전체';
    const names = classes.filter((c) => ids.includes(c.id)).map((c) => c.name);
    return names.length ? names.join(', ') : `${ids.length}개 반`;
  };

  if (editing) {
    return <NoticeForm authorName={user?.name || ''} classes={classes} notice={editing === 'new' ? null : editing}
      onBack={() => setEditing(null)}
      onDone={() => { setEditing(null); setOpenId(null); qc.invalidateQueries({ queryKey: ['notices'] }); }} />;
  }

  const open = openId ? notices.find((n) => n.id === openId) : null;
  if (open) {
    const del = () => {
      Alert.alert('공지 삭제', '이 공지를 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: async () => { try { await noticeApi.delete(open.id); setOpenId(null); qc.invalidateQueries({ queryKey: ['notices'] }); } catch (e: any) { Alert.alert('실패', e?.message || '삭제하지 못했어요'); } } },
      ]);
    };
    return (
      <Screen edges={['top']}>
        <BackHeader title="공지" onBack={() => setOpenId(null)} right={canWrite ? <Pressable onPress={() => setEditing(open)} hitSlop={6}><Text style={{ fontSize: 13, fontWeight: '600', color: color.blue }}>수정</Text></Pressable> : undefined} />
        <Scroll contentStyle={{ paddingHorizontal: space.screenX, paddingBottom: 24 }}>
          {open.important && <View style={{ marginTop: 8 }}><Tag label="중요" tone="pending" /></View>}
          <Text style={{ fontSize: 21, fontWeight: '700', lineHeight: 28, letterSpacing: -0.42, color: color.ink, marginTop: open.important ? 10 : 8 }}>{open.title}</Text>
          <Text style={{ fontSize: 13, color: color.sub, marginTop: 6 }}>{open.author} · 대상 {targetLabel(open)} · {fmtDate(open.date)}</Text>
          <Text style={{ fontSize: 15, lineHeight: 27, color: color.ink, marginTop: 16 }}>{open.content}</Text>
          {canWrite && (
            <Pressable onPress={del} style={{ marginTop: 24 }} hitSlop={6}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: color.warn }}>이 공지 삭제하기</Text>
            </Pressable>
          )}
        </Scroll>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <BackHeader title="공지사항" onBack={() => nav.goBack()} right={canWrite ? <Pressable onPress={() => setEditing('new')} hitSlop={6}><Text style={{ fontSize: 14, fontWeight: '600', color: color.blue }}>작성</Text></Pressable> : undefined} />
      <Scroll contentStyle={{ paddingBottom: 24 }}>
        {isLoading ? <Empty>불러오는 중…</Empty> : notices.length === 0 ? <Empty>아직 공지사항이 없어요</Empty> : notices.map((n) => (
          <ListRow key={n.id} showChevron={false}
            left={<View style={{ width: 44, height: 44, borderRadius: radius.chip, backgroundColor: n.important ? color.warnBg : color.surf, alignItems: 'center', justifyContent: 'center' }}><Icon name="speakerphone" size={21} color={n.important ? color.warn : color.sub} /></View>}
            title={n.title} sub={`${targetLabel(n)} · ${fmtDate(n.date)}`}
            right={n.important ? <Tag label="중요" tone="pending" /> : undefined}
            onPress={() => setOpenId(n.id)} />
        ))}
      </Scroll>
    </Screen>
  );
}

function NoticeForm({ authorName, classes, notice, onBack, onDone }: { authorName: string; classes: ClassInfo[]; notice: Notice | null; onBack: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(notice?.title || '');
  const [content, setContent] = useState(notice?.content || '');
  const [important, setImportant] = useState(notice?.important || false);
  const [selected, setSelected] = useState<string[]>(notice?.targetClassIds || []);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), important, targetClassIds: selected };
      if (notice) await noticeApi.update(notice.id, payload);
      else await noticeApi.create({ ...payload, author: authorName });
      onDone();
    } catch (e: any) { Alert.alert('저장 실패', e?.message || '저장하지 못했어요'); }
    finally { setBusy(false); }
  };

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ backgroundColor: on ? color.ink : color.white, borderWidth: 1, borderColor: on ? color.ink : color.inputLine, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '500', color: on ? color.white : color.sub }}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <BackHeader title={notice ? '공지 수정' : '새 공지'} onBack={onBack} />
      <Scroll contentStyle={{ padding: space.screenX }}>
        <FlowTitle>{notice ? '공지를\n수정해요' : '무엇을\n알릴까요?'}</FlowTitle>
        <TextInput value={title} onChangeText={setTitle} placeholder="제목" placeholderTextColor={color.faint}
          style={{ marginTop: 16, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: color.ink }} />
        <TextInput value={content} onChangeText={setContent} placeholder="공지 내용을 적어요" placeholderTextColor={color.faint} multiline
          style={{ marginTop: 10, minHeight: 140, borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, padding: 12, fontSize: 15, color: color.ink, textAlignVertical: 'top' }} />

        <Text style={{ fontSize: 13, fontWeight: '500', color: color.sub, marginTop: 16, marginBottom: 8 }}>받는 대상</Text>
        <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
          {chip('전체', selected.length === 0, () => setSelected([]))}
          {classes.map((c) => chip(c.name, selected.includes(c.id), () => setSelected((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])))}
        </View>
        <Text style={{ fontSize: 12, color: color.sub, marginTop: 8 }}>{selected.length === 0 ? '전체 학생에게 알림이 가요' : `${selected.length}개 반 학생에게만 알림이 가요`}</Text>

        <Pressable onPress={() => setImportant((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <View style={{ width: 22, height: 22, borderRadius: radius.tag, borderWidth: 1.5, borderColor: important ? color.warn : color.inputLine, backgroundColor: important ? color.warn : color.white, alignItems: 'center', justifyContent: 'center' }}>
            {important && <Icon name="check" size={14} color={color.white} />}
          </View>
          <Text style={{ fontSize: 14, color: color.ink }}>중요 공지로 표시</Text>
        </Pressable>
      </Scroll>
      <View style={{ paddingHorizontal: space.screenX, paddingBottom: 16 }}>
        <Cta label={notice ? '수정 저장하기' : '공지 올리기'} onPress={submit} disabled={!title.trim() || !content.trim()} loading={busy} />
      </View>
    </Screen>
  );
}
