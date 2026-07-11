import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Screen, Cta } from '../components/kit';
import { color, text, radius } from '../theme/tokens';
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
          <Text style={[text.wordmark, { marginBottom: 12 }]}>SOL-ACT</Text>

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
