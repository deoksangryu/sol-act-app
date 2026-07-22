import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Screen, Cta } from '../components/kit';
import { color, text, radius, font } from '../theme/tokens';
import { useAuth } from '../AuthContext';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      await login(email.trim(), pw);
    } catch (e: any) {
      setErr(e?.message ?? '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 12 }}>
          <View style={{ marginBottom: 12 }}>
            <Text style={text.wordmark}>SOL-ACT</Text>
            <Text style={{ fontFamily: font.m, fontSize: 13.5, color: color.sub2, marginTop: 6 }}>연기 배우의 성장 기록</Text>
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="이메일"
            placeholderTextColor={color.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles_input}
          />
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="비밀번호"
            placeholderTextColor={color.faint}
            secureTextEntry
            style={styles_input}
          />

          {!!err && <Text style={{ color: color.danger, fontSize: 13 }}>{err}</Text>}

          <View style={{ marginTop: 6 }}>
            <Cta label="로그인" onPress={submit} loading={loading} disabled={!email || !pw} />
          </View>
          <Text style={{ fontFamily: font.r, fontSize: 12.5, color: color.sub2, textAlign: 'center', marginTop: 14 }}>비밀번호를 잊으셨나요? 학원에 문의해주세요</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles_input = {
  height: 50,
  borderWidth: 1,
  borderColor: color.inputLine,
  borderRadius: radius.card,
  paddingHorizontal: 14,
  fontSize: 15,
  color: color.ink,
} as const;
