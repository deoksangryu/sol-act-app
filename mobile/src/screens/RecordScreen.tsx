import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Screen } from '../components/kit';
import { Icon } from '../components/Icon';
import { color, font, radius, space } from '../theme/tokens';
import { portfolioApi, submissionsApi } from '../services/api';
import { useUploads } from '../services/UploadContext';

const kstMD = () => { const d = new Date(Date.now() + 9 * 3600 * 1000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const fmt = (ms: number) => { const s = Math.floor((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// 연기 녹음 — expo-audio로 녹음 → 포트폴리오 생성 후 업로드(선생님 피드백 흐름에 합류).
export function RecordScreen() {
  const nav = useNavigation<any>();
  const { upload } = useUploads();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const [title, setTitle] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await requestRecordingPermissionsAsync();
        setGranted(p.granted);
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      } catch { setGranted(false); }
    })();
  }, []);

  const isRec = recState.isRecording;

  const start = async () => {
    try { await recorder.prepareToRecordAsync(); recorder.record(); setUri(null); }
    catch (e: any) { Alert.alert('녹음 실패', e?.message || '마이크를 시작하지 못했어요'); }
  };
  const stop = async () => {
    try { await recorder.stop(); setUri((recorder as any).uri ?? recState.url ?? null); }
    catch (e: any) { Alert.alert('중지 실패', e?.message || '녹음을 멈추지 못했어요'); }
  };
  const doSubmit = async () => {
    if (!uri) return;
    setBusy(true);
    try {
      const t = title.trim() || `연기 녹음 ${kstMD()}`;
      const p = await portfolioApi.create({ title: t, description: t, category: 'basics', videoUrl: '' } as any);
      await upload(t, { uri, filename: `recording_${Date.now()}.m4a`, mimeType: 'audio/m4a' }, { subfolder: 'portfolios', targetType: 'portfolio', targetId: p.id });
      // 통합 인박스에도 제출로 반영(+15 · 선생님 알림)
      submissionsApi.submit('recording', t).catch(() => {});
      Alert.alert('제출 완료', '녹음을 선생님께 제출했어요 · +15 👏');
      nav.goBack();
    } catch (e: any) { Alert.alert('제출 실패', e?.message || '제출하지 못했어요'); setBusy(false); }
  };

  return (
    <Screen bg={color.bg} edges={['top']}>
      <View style={{ paddingHorizontal: space.screenX, paddingTop: 18, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8}><Icon name="chevron-left" size={26} color={color.ink} /></Pressable>
        <Text style={{ fontFamily: font.xb, fontSize: 21, color: color.ink }}>연기 녹음</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.screenX }}>
        <Text style={{ fontFamily: font.xb, fontSize: 42, letterSpacing: -0.6, color: color.ink }}>{fmt(recState.durationMillis)}</Text>
        <Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2, marginTop: 6, textAlign: 'center' }}>
          {isRec ? '녹음 중… 다시 눌러 멈춰요' : uri ? '녹음 완료 — 제출하거나 다시 녹음하세요' : '버튼을 눌러 녹음을 시작하세요'}
        </Text>
        {granted === false && <Text style={{ fontFamily: font.m, fontSize: 12, color: color.danger, marginTop: 8 }}>마이크 권한이 필요해요 (설정에서 허용)</Text>}

        <Pressable onPress={isRec ? stop : start} disabled={granted === false} style={{ marginTop: 30, width: 88, height: 88, borderRadius: 44, backgroundColor: isRec ? color.danger : color.purple, alignItems: 'center', justifyContent: 'center', opacity: granted === false ? 0.4 : 1 }}>
          <Icon name="microphone" size={36} color={color.white} />
        </Pressable>

        {!!uri && !isRec && (
          <View style={{ alignSelf: 'stretch', marginTop: 34 }}>
            <TextInput value={title} onChangeText={setTitle} placeholder="제목 (예: 니나 독백)" placeholderTextColor={color.faint} style={{ borderWidth: 1, borderColor: color.inputLine, borderRadius: 14, padding: 13, fontFamily: font.r, fontSize: 15, color: color.ink, backgroundColor: color.white }} />
            <Pressable onPress={doSubmit} disabled={busy} style={{ marginTop: 12, backgroundColor: color.blue, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ fontFamily: font.b, fontSize: 15, color: color.white }}>{busy ? '제출 중…' : '선생님께 제출하기'}</Text>
            </Pressable>
            <Pressable onPress={start} style={{ marginTop: 10, alignItems: 'center' }}><Text style={{ fontFamily: font.m, fontSize: 13, color: color.sub2 }}>다시 녹음</Text></Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}
