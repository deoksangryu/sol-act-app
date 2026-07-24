import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Scroll, BackHeader } from '../components/kit';
import { Card } from '../components/gamify';
import { color, font, radius, space } from '../theme/tokens';
import { mockTestApi, usersApi } from '../services/api';
import { UserRole } from '../types';

// 원장 모의테스트: 목록 + 인라인 생성(제목·날짜·참여학생 선택[탭 순서=순번]). 항목 탭 → 상세.
export function MockTestAdminScreen() {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [selected, setSelected] = useState<string[]>([]); // 선택 순서 = 순번
  const [saving, setSaving] = useState(false);

  const { data: tests, isLoading } = useQuery({ queryKey: ['mockTests', 'list'], queryFn: () => mockTestApi.list(), staleTime: 15000 });
  const { data: users } = useQuery({ queryKey: ['users', 'all'], queryFn: () => usersApi.list(), staleTime: 60000 });
  const students = (users ?? []).filter((u) => u.role === UserRole.STUDENT);

  const toggle = (uid: string) => setSelected((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));

  const create = async () => {
    if (!title.trim()) { Alert.alert('안내', '제목을 입력해주세요.'); return; }
    if (selected.length === 0) { Alert.alert('안내', '참여 학생을 1명 이상 선택해주세요.'); return; }
    if (date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) { Alert.alert('안내', '날짜는 YYYY-MM-DD 형식으로 입력해주세요.'); return; }
    setSaving(true);
    try {
      await mockTestApi.create(title.trim(), date.trim() || null, selected, desc.trim() || undefined);
      await qc.invalidateQueries({ queryKey: ['mockTests', 'list'] });
      setCreating(false); setTitle(''); setDate(''); setDesc(''); setSelected([]);
      Alert.alert('완료', '모의테스트를 만들었어요.');
    } catch (e: any) {
      Alert.alert('실패', e?.message || '만들지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  const input = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: color.ink, fontFamily: font.m, backgroundColor: color.white } as const;

  return (
    <Screen edges={['top']}>
      <BackHeader title="모의테스트" onBack={() => nav.goBack()} />
      <Scroll contentStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: space.screenX, gap: 12, marginTop: 8 }}>
          <Pressable onPress={() => setCreating((v) => !v)} style={{ backgroundColor: creating ? color.surf : color.blue, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center' }}>
            <Text style={{ fontFamily: font.b, fontSize: 14, color: creating ? color.ink : color.white }}>{creating ? '닫기' : '＋ 새 모의테스트 만들기'}</Text>
          </Pressable>

          {creating && (
            <Card style={{ padding: 16, gap: 10 }}>
              <TextInput value={title} onChangeText={setTitle} placeholder="제목 (예: 10월 모의테스트)" placeholderTextColor={color.faint} style={input} />
              <TextInput value={date} onChangeText={setDate} placeholder="날짜 YYYY-MM-DD (선택)" placeholderTextColor={color.faint} style={input} />
              <TextInput value={desc} onChangeText={setDesc} placeholder="안내 문구 (선택)" placeholderTextColor={color.faint} style={[input, { minHeight: 60, textAlignVertical: 'top' }]} multiline />
              <Text style={{ fontFamily: font.b, fontSize: 13, color: color.sub, marginTop: 4 }}>참여 학생 · 탭한 순서가 순번이 돼요</Text>
              <View style={{ gap: 6 }}>
                {students.map((s) => {
                  const idx = selected.indexOf(s.id);
                  const on = idx >= 0;
                  return (
                    <Pressable key={s.id} onPress={() => toggle(s.id)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13 }}>
                      <Text style={{ fontFamily: font.sb, fontSize: 14, color: color.ink }}>{s.name}</Text>
                      {on && <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 12, color: color.white }}>{idx + 1}</Text></View>}
                    </Pressable>
                  );
                })}
                {students.length === 0 && <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub }}>학생 목록을 불러오는 중…</Text>}
              </View>
              <Pressable onPress={create} disabled={saving} style={{ backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 13, alignItems: 'center', marginTop: 4 }}>
                {saving ? <ActivityIndicator color={color.white} /> : <Text style={{ fontFamily: font.b, fontSize: 14, color: color.white }}>만들기 ({selected.length}명)</Text>}
              </Pressable>
            </Card>
          )}

          {isLoading && <ActivityIndicator style={{ marginTop: 16 }} color={color.blue} />}
          {(tests ?? []).map((mt) => (
            <Pressable key={mt.id} onPress={() => nav.navigate('mockTestDetail', { id: mt.id })}>
              <Card style={{ padding: 16 }}>
                <Text style={{ fontFamily: font.b, fontSize: 15.5, color: color.ink }}>{mt.title}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 12.5, color: color.sub, marginTop: 3 }}>
                  {mt.testDate || '날짜 미정'} · 학생 {mt.entryCount ?? 0}명 · 음원 {mt.submittedCount ?? 0}/{mt.entryCount ?? 0}
                </Text>
              </Card>
            </Pressable>
          ))}
          {!isLoading && (tests ?? []).length === 0 && (
            <Card style={{ padding: 20, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 14, color: color.sub }}>아직 만든 모의테스트가 없어요</Text></Card>
          )}
        </View>
      </Scroll>
    </Screen>
  );
}
