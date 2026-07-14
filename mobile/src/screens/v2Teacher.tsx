import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { Screen } from '../components/kit';
import { Section, Card } from '../components/gamify';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={{ width: 44, height: 26, borderRadius: 99, backgroundColor: on ? color.blue : '#D1D6DB', justifyContent: 'center', padding: 3 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color.white, alignSelf: on ? 'flex-end' : 'flex-start' }} />
    </Pressable>
  );
}

// ── 수업일지 ──
export function TeacherLogScreen() {
  const [content, setContent] = useState('『갈매기』 4막 니나 독백 지도. 전체적으로 감정선 이해도가 올라옴. 다음 시간 상대역 리액션 연습 예정.');
  const [memo, setMemo] = useState('오늘 마지막 대사에서 눈빛이 정말 좋았어. 그 감각 기억해두자.');
  const [send, setSend] = useState(true);
  const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: 14, padding: 12, fontFamily: font.r, fontSize: 14, color: color.ink, textAlignVertical: 'top' as const };
  return (
    <Screen bg={color.bg} edges={['top']}>
      <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginBottom: 3 }}>수업일지</Text>
          <Text style={{ fontFamily: font.xb, fontSize: 21, letterSpacing: -0.4, color: color.ink }}>7월 14일 · 입시반 A</Text>
        </View>
        <Pressable onPress={() => Alert.alert('복제', '어제 일지를 복제했어요')} style={{ backgroundColor: color.surf, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 }}>
          <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub }}>지난 일지 복제</Text>
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <Card style={{ padding: 20 }}>
            <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginBottom: 7 }}>수업 내용</Text>
            <TextInput value={content} onChangeText={setContent} multiline style={[inp, { minHeight: 90 }]} placeholder="오늘 수업 내용 — 이것만 써도 저장돼요" placeholderTextColor={color.faint} />

            <Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginTop: 14, marginBottom: 7 }}>개별 메모 <Text style={{ fontFamily: font.r }}>(선택)</Text></Text>
            <View style={{ backgroundColor: color.surf, borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 11, backgroundColor: color.blueBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="account" size={16} color={color.blue} /></View>
                <Text style={{ fontFamily: font.b, fontSize: 14, color: color.ink, flex: 1 }}>한지우</Text>
                <Text style={{ fontFamily: font.m, fontSize: 11.5, color: color.sub2 }}>학생에게 보내기</Text>
                <Toggle on={send} onToggle={() => setSend((v) => !v)} />
              </View>
              <TextInput value={memo} onChangeText={setMemo} multiline style={[inp, { backgroundColor: color.white, minHeight: 50 }]} />
            </View>
            <Pressable onPress={() => Alert.alert('학생 태그', '학생 태그 추가 (프로토타입)')} style={{ alignSelf: 'flex-start', marginTop: 10, backgroundColor: color.surf, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub }}>＋ 학생 태그 추가</Text></Pressable>

            <Pressable onPress={() => Alert.alert('저장', '일지 저장 · 한지우님에게 한 마디 전달됨')} style={{ marginTop: 16, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>일지 저장</Text></Pressable>
            <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center', marginTop: 10 }}>'보내기'가 켜진 메모는 학생에게 "선생님의 한 마디"로 전달돼요</Text>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ── 학생 ──
export function TeacherStudentsScreen() {
  const grant = (nm: string) => Alert.alert('성장상', `${nm}님에게 🌟 성장상 뱃지를 수여했어요`);
  return (
    <Screen bg={color.bg} edges={['top']}>
      <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6 }}>
        <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginBottom: 3 }}>입시반 A · 8명</Text>
        <Text style={{ fontFamily: font.xb, fontSize: 21, letterSpacing: -0.4, color: color.ink }}>학생</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: space.screenX, marginTop: 8 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: color.blueBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="account" size={20} color={color.blue} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>한지우 <Text style={{ fontFamily: font.b, fontSize: 11, color: color.amber }}>🔥7</Text></Text>
                <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>이번 주 연습 4시간 12분 · 제출 5건</Text>
              </View>
              <Pressable onPress={() => grant('한지우')} style={{ backgroundColor: color.surf, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub }}>🌟 수여</Text></Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderTopWidth: 1, borderTopColor: color.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: color.dangerBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="account" size={20} color={color.danger} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>이도현 <Text style={{ fontFamily: font.b, fontSize: 11, color: color.danger }}>3일 미접속</Text></Text>
                <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>슬럼프 감지 · 가벼운 미션 제안됨</Text>
              </View>
              <Icon name="chevron-right" size={18} color={color.faint} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderTopWidth: 1, borderTopColor: color.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: color.successBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="account" size={20} color={color.success} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.ink }}>박서연 <Text style={{ fontFamily: font.b, fontSize: 11, color: color.amber }}>🔥21</Text></Text>
                <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, marginTop: 2 }}>이번 주 연습 6시간 40분 · 제출 8건</Text>
              </View>
              <Pressable onPress={() => grant('박서연')} style={{ backgroundColor: color.surf, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ fontFamily: font.b, fontSize: 12.5, color: color.sub }}>🌟 수여</Text></Pressable>
            </View>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
