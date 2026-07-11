import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Scroll, BackHeader, SectionLabel, Avatar, Cta, InfoBox } from '../components/kit';
import { color, radius, space } from '../theme/tokens';
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
    if (curPw.length < 1 || newPw.length < 4) { Alert.alert('안내', '새 비밀번호는 4자 이상이어야 해요.'); return; }
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

  const input = { borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: color.ink } as const;

  return (
    <Screen edges={['top']}>
      <BackHeader title="내 정보" onBack={() => nav.goBack()} />
      <Scroll contentStyle={{ paddingBottom: 32 }}>
        {/* 프로필 요약 */}
        <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
          <Avatar name={user.name} size={72} uri={user.avatar ? resolveFileUrl(user.avatar) : undefined} />
          <Pressable onPress={changeAvatar} disabled={avatarBusy} hitSlop={6}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: color.blue }}>{avatarBusy ? '변경 중…' : '사진 변경'}</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: color.ink, marginTop: 2 }}>{user.name}</Text>
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
          <TextInput value={newPw} onChangeText={setNewPw} placeholder="새 비밀번호 (4자 이상)" placeholderTextColor={color.faint} secureTextEntry style={input} />
          <Cta label="비밀번호 변경" onPress={changePw} loading={busy} disabled={!curPw || !newPw} />
        </View>

        <View style={{ paddingHorizontal: space.screenX, marginTop: 18 }}>
          <InfoBox tone="info">푸시 알림 설정은 다음 단계(네이티브 모듈)에서 추가됩니다.</InfoBox>
        </View>

        <View style={{ paddingHorizontal: space.screenX, marginTop: 18 }}>
          <Pressable onPress={doLogout} style={{ paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: color.inputLine, borderRadius: radius.card }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: color.danger }}>로그아웃</Text>
          </Pressable>
        </View>
      </Scroll>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: color.line }}>
      <Text style={{ fontSize: 14, color: color.sub }}>{k}</Text>
      <Text style={{ fontSize: 14, color: color.ink, fontWeight: '500' }}>{v}</Text>
    </View>
  );
}
