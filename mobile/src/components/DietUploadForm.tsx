import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { Cta } from './kit';
import { Icon } from './Icon';
import { color, font } from '../theme/tokens';
import { dietApi, resolveFileUrl } from '../services/api';
import { pickMedia, captureImage } from '../services/upload';
import { useUploads } from '../services/UploadContext';
import { todayStr } from '../lib/date';

const MEAL_TYPES = [{ key: 'breakfast', label: '아침' }, { key: 'lunch', label: '점심' }, { key: 'dinner', label: '저녁' }, { key: 'snack', label: '간식' }];
const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: 14, padding: 12, fontFamily: font.r, fontSize: 14, color: color.ink } as const;

// 식단: 사진 선택/촬영 + 끼니 + 메모 → 그 자리에서 저장. 제출 화면·식단 화면 공용.
export function DietUploadForm({ studentId, onSaved }: { studentId: string; onSaved?: () => void }) {
  const { upload } = useUploads();
  const [mealType, setMealType] = useState('dinner');
  const [desc, setDesc] = useState('');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const addPhoto = async (fromCamera: boolean) => {
    setPicking(true);
    try {
      const media = fromCamera ? await captureImage() : await pickMedia('image');
      if (media) { const r = await upload('식단 사진', media, { subfolder: 'diet' }); setImgUrl(r.url); }
    } catch (e: any) { Alert.alert('실패', e?.message || '사진을 올리지 못했어요'); }
    finally { setPicking(false); }
  };

  const save = async () => {
    if (!desc.trim() || busy) return;
    setBusy(true);
    try {
      await dietApi.create({ studentId, mealType: mealType as any, description: desc.trim(), date: todayStr(), ...(imgUrl ? { imageUrl: imgUrl } : {}) });
      setDesc(''); setImgUrl(null); setMealType('dinner');
      Alert.alert('저장 완료', '식단을 기록했어요 · 담당 선생님·원장님이 볼 수 있어요');
      onSaved?.();
    } catch (e: any) { Alert.alert('실패', e?.message || '올리지 못했어요'); }
    finally { setBusy(false); }
  };

  const label = { fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginTop: 14, marginBottom: 7 } as const;

  return (
    <View>
      {/* 사진 */}
      {imgUrl ? (
        <View>
          <Image source={{ uri: resolveFileUrl(imgUrl) }} style={{ width: '100%', height: 160, borderRadius: 14, backgroundColor: color.surf }} resizeMode="cover" />
          <Pressable onPress={() => setImgUrl(null)} hitSlop={6} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
            <Text style={{ fontFamily: font.m, fontSize: 12, color: color.sub2 }}>사진 지우기</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => addPhoto(false)} disabled={picking} style={({ pressed }) => [{ flex: 1, backgroundColor: color.surf, borderRadius: 14, paddingVertical: 20, alignItems: 'center', gap: 6 }, pressed && { opacity: 0.85 }]}>
            {picking ? <ActivityIndicator color={color.sub} /> : <><Icon name="photo" size={26} color={color.sub} /><Text style={{ fontFamily: font.sb, fontSize: 13, color: color.sub }}>앨범에서 선택</Text></>}
          </Pressable>
          <Pressable onPress={() => addPhoto(true)} disabled={picking} style={({ pressed }) => [{ flex: 1, backgroundColor: color.surf, borderRadius: 14, paddingVertical: 20, alignItems: 'center', gap: 6 }, pressed && { opacity: 0.85 }]}>
            <Icon name="camera" size={26} color={color.sub} /><Text style={{ fontFamily: font.sb, fontSize: 13, color: color.sub }}>지금 촬영</Text>
          </Pressable>
        </View>
      )}

      <Text style={label}>어떤 끼니예요?</Text>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        {MEAL_TYPES.map((o) => {
          const on = mealType === o.key;
          return (
            <Pressable key={o.key} onPress={() => setMealType(o.key)} style={{ flex: 1, borderWidth: 1.5, borderColor: on ? color.blue : color.inputLine, backgroundColor: on ? color.blueBg : color.white, borderRadius: 11, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontFamily: font.sb, fontSize: 14, color: on ? color.blue : color.sub }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={label}>메모</Text>
      <TextInput value={desc} onChangeText={setDesc} placeholder="예: 닭가슴살 샐러드" placeholderTextColor={color.faint} style={inp} />

      <View style={{ marginTop: 18 }}>
        <Cta label="식단 저장" onPress={save} disabled={!desc.trim()} loading={busy} />
      </View>
      <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center', marginTop: 10 }}>식단은 담당 선생님·원장님만 볼 수 있어요</Text>
    </View>
  );
}
