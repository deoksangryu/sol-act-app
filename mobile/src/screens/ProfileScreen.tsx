import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Scroll, BackHeader, SectionLabel, Avatar, Cta, InfoBox } from '../components/kit';
import { color, radius, space, font } from '../theme/tokens';
import { usersApi, resolveFileUrl } from '../services/api';
import { pickMedia } from '../services/upload';
import { useUploads } from '../services/UploadContext';
import { useAuth } from '../AuthContext';
import { UserRole } from '../types';

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.STUDENT]: '수강생',
  [UserRole.TEACHER]: '선생님',
  [UserRole.DIRECTOR]: '원장',
};

export function ProfileScreen() {
  const nav = useNavigation<any>();
  const { user, logout, refresh } = useAuth();
  const { upload } = useUploads();
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  if (!user) return null;

  const changeAvatar = async () => {
    try {
      const media = await pickMedia('image', { allowsEditing: true, aspect: [1, 1] });
      if (!media) return;
      setAvatarBusy(true);
      const r = await upload('프로필 사진', media, { subfolder: 'avatars' });
      await usersApi.update(user.id, { avatar: r.url });
      await refresh();
    } catch (e: any) { Alert.alert('실패', e?.message || '사진을 변경하지 못했어요'); }
    finally { setAvatarBusy(false); }
  };

  const changePw = async () => {
    if (busy) return; // 연타 더블서밋 방어(busy 세팅 전 재진입 차단)
    // 백엔드 정책(app/schemas/user.py validate_password_rules)과 동일하게 클라에서 먼저 검증 — 서버 왕복 전 명확한 안내.
    if (curPw.length < 1) { Alert.alert('안내', '현재 비밀번호를 입력해주세요.'); return; }
    if (newPw.length < 8 || !/[A-Za-z]/.test(newPw) || !/\d/.test(newPw) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPw)) {
      Alert.alert('안내', '새 비밀번호는 8자 이상이며 영문·숫자·특수문자를 각각 포함해야 해요.'); return;
    }
    setBusy(true);
    try {
      await usersApi.changePassword(curPw, newPw);
      setCurPw(''); setNewPw('');
      Alert.alert('완료', '비밀번호를 변경했어요.');
    } catch (e: any) { Alert.alert('실패', e?.message || '변경하지 못했어요'); }
    finally { setBusy(false); }
  };

  const doLogout = () => {
    Alert.alert('로그아웃', '로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // 계정 삭제(복구 불가) — 실수 방지 위해 2단계 확인.
  const doDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '계정과 모든 데이터(영상·기록·박수 등)가 영구 삭제되며 복구할 수 없어요. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive', onPress: () => {
            Alert.alert('정말 삭제할까요?', '이 작업은 되돌릴 수 없습니다.', [
              { text: '취소', style: 'cancel' },
              {
                text: '계정 영구 삭제', style: 'destructive', onPress: async () => {
                  if (busy) return;
                  setBusy(true);
                  try { await usersApi.deleteAccount(); logout(); }
                  catch (e: any) { Alert.alert('실패', e?.message || '계정을 삭제하지 못했어요'); }
                  finally { setBusy(false); }
                },
              },
            ]);
          },
        },
      ]
    );
  };

  const input = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: color.ink } as const;

  return (
    <Screen edges={['top']}>
      <BackHeader title="내 정보" onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
      <Scroll contentStyle={{ paddingBottom: 32 }}>
        {/* 프로필 요약 */}
        <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
          <Avatar name={user.name} size={72} uri={user.avatar ? resolveFileUrl(user.avatar) : undefined} />
          <Pressable onPress={changeAvatar} disabled={avatarBusy} hitSlop={6}>
            <Text style={{ fontSize: 13, fontFamily: font.sb, color: color.blue }}>{avatarBusy ? '변경 중…' : '사진 변경'}</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontFamily: font.b, color: color.ink, marginTop: 2 }}>{user.name}</Text>
          <Text style={{ fontSize: 13, color: color.sub }}>{ROLE_LABEL[user.role]} · {user.email}</Text>
        </View>

        <SectionLabel>기본 정보</SectionLabel>
        <View style={{ paddingHorizontal: space.screenX, gap: 6 }}>
          <Row k="이름" v={user.name} />
          <Row k="이메일" v={user.email} />
          <Row k="역할" v={ROLE_LABEL[user.role]} />
          {user.role === UserRole.STUDENT && user.height != null && <Row k="키" v={`${user.height} cm`} />}
        </View>

        <SectionLabel>비밀번호 변경</SectionLabel>
        <View style={{ paddingHorizontal: space.screenX, gap: 10 }}>
          <TextInput value={curPw} onChangeText={setCurPw} placeholder="현재 비밀번호" placeholderTextColor={color.faint} secureTextEntry style={input} />
          <TextInput value={newPw} onChangeText={setNewPw} placeholder="새 비밀번호 (8자+영문·숫자·특수문자)" placeholderTextColor={color.faint} secureTextEntry style={input} />
          <Cta label="비밀번호 변경" onPress={changePw} loading={busy} disabled={!curPw || !newPw} />
        </View>

        <View style={{ paddingHorizontal: space.screenX, marginTop: 18 }}>
          <InfoBox tone="info">푸시 알림은 곧 제공될 예정이에요.</InfoBox>
        </View>

        <View style={{ paddingHorizontal: space.screenX, marginTop: 18 }}>
          <Pressable onPress={doLogout} style={{ paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card }}>
            <Text style={{ fontSize: 15, fontFamily: font.sb, color: color.danger }}>로그아웃</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space.screenX, marginTop: 10, alignItems: 'center' }}>
          <Pressable onPress={doDeleteAccount} hitSlop={8} style={{ paddingVertical: 10 }}>
            <Text style={{ fontSize: 13, fontFamily: font.m, color: color.sub, textDecorationLine: 'underline' }}>계정 삭제</Text>
          </Pressable>
        </View>
      </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: color.line }}>
      <Text style={{ fontSize: 14, color: color.sub }}>{k}</Text>
      <Text style={{ fontSize: 14, color: color.ink, fontFamily: font.m }}>{v}</Text>
    </View>
  );
}
