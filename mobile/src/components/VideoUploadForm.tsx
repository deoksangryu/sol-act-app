import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { ChipSelect, Cta } from './kit';
import { Icon } from './Icon';
import { color, font } from '../theme/tokens';
import { portfolioApi, submissionsApi } from '../services/api';
import { pickMediaMulti, captureVideo, type PickedMedia } from '../services/upload';
import { useUploads } from '../services/UploadContext';

const VIDEO_CATS = [
  { key: 'acting', label: '자유연기' }, { key: 'monologue', label: '독백' }, { key: 'musical', label: '뮤지컬 넘버' },
  { key: 'dance', label: '자유무용' }, { key: 'basics', label: '발성 연습' },
];

const inp = { borderWidth: 1, borderColor: color.inputLine, borderRadius: 14, padding: 12, fontFamily: font.r, fontSize: 14, color: color.ink } as const;

// 영상 선택/촬영 → 제목·카테고리 → 그 자리에서 업로드(네이티브 백그라운드). 제출 화면·영상 화면 공용.
export function VideoUploadForm({ onUploaded }: { onUploaded?: () => void }) {
  const { upload } = useUploads();
  const [medias, setMedias] = useState<PickedMedia[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [mode, setMode] = useState<'individual' | 'single'>('individual');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    try { const r = await pickMediaMulti('video'); if (r.length) setMedias(r); }
    catch (e: any) { Alert.alert('안내', e?.message || '선택하지 못했어요'); }
  };
  const capture = async () => {
    try { const r = await captureVideo(); if (r) setMedias((prev) => [...prev, r]); }
    catch (e: any) { Alert.alert('안내', e?.message || '촬영하지 못했어요'); }
  };

  const ready = medias.length > 0 && !!cat && !!title.trim();
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const t = title.trim();
      const single = medias.length > 1 && mode === 'single';
      if (single) {
        const p = await portfolioApi.create({ title: t, description: desc.trim() || t, category: cat!, videoUrl: '', uploadMode: 'single', totalVideos: medias.length } as any);
        for (let i = 0; i < medias.length; i++) {
          await upload(`${t} ${i + 1}`, medias[i], { subfolder: 'portfolios', targetType: i === 0 ? 'portfolio' : 'portfolio_video', targetId: p.id });
        }
      } else {
        for (let i = 0; i < medias.length; i++) {
          const label = medias.length > 1 ? `${t} ${i + 1}` : t;
          const p = await portfolioApi.create({ title: label, description: desc.trim() || label, category: cat!, videoUrl: '', ...(medias.length > 1 ? { practiceGroup: t } : {}) } as any);
          await upload(label, medias[i], { subfolder: 'portfolios', targetType: 'portfolio', targetId: p.id });
        }
      }
      // 통합 인박스에도 반영(선생님 알림). 업로드는 백그라운드로 이어지고, 도착 시 서버가 영상 URL 패치.
      submissionsApi.submit('video', t).catch(() => {});
      setMedias([]); setTitle(''); setDesc(''); setCat(null); setMode('individual');
      Alert.alert('업로드 시작', '영상을 올리고 있어요 · 앱을 닫아도 백그라운드로 계속돼요 · +15 👏');
      onUploaded?.();
    } catch (e: any) { Alert.alert('실패', e?.message || '올리지 못했어요'); }
    finally { setBusy(false); }
  };

  const label = { fontFamily: font.b, fontSize: 12.5, color: color.sub2, marginTop: 14, marginBottom: 7 } as const;

  return (
    <View>
      {/* 선택 / 촬영 */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={pick} style={({ pressed }) => [{ flex: 1, backgroundColor: medias.length ? color.successBg : color.surf, borderRadius: 14, paddingVertical: 20, alignItems: 'center', gap: 6 }, pressed && { opacity: 0.85 }]}>
          <Icon name={medias.length ? 'circle-check' : 'photo'} size={26} color={medias.length ? color.success : color.sub} />
          <Text style={{ fontFamily: font.sb, fontSize: 13, color: medias.length ? color.success : color.sub }}>{medias.length ? `${medias.length}개 선택됨` : '앨범에서 선택'}</Text>
        </Pressable>
        <Pressable onPress={capture} style={({ pressed }) => [{ flex: 1, backgroundColor: color.surf, borderRadius: 14, paddingVertical: 20, alignItems: 'center', gap: 6 }, pressed && { opacity: 0.85 }]}>
          <Icon name="video" size={26} color={color.sub} />
          <Text style={{ fontFamily: font.sb, fontSize: 13, color: color.sub }}>지금 촬영</Text>
        </Pressable>
      </View>
      {medias.length > 0 && (
        <Pressable onPress={() => setMedias([])} hitSlop={6} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
          <Text style={{ fontFamily: font.m, fontSize: 12, color: color.sub2 }}>선택 초기화</Text>
        </Pressable>
      )}

      {medias.length > 1 && (
        <>
          <Text style={label}>업로드 방식</Text>
          <ChipSelect items={[{ key: 'individual', label: '각각 따로' }, { key: 'single', label: '하나로 묶기' }]} value={mode} onChange={(v) => setMode(v)} />
        </>
      )}

      <Text style={label}>제목</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="예: 자유연기 3차" placeholderTextColor={color.faint} style={inp} />

      <Text style={label}>카테고리</Text>
      <ChipSelect wrap items={VIDEO_CATS} value={cat} onChange={setCat} />

      <Text style={label}>설명 (선택)</Text>
      <TextInput value={desc} onChangeText={setDesc} placeholder="예: 복식호흡 중점 연습" placeholderTextColor={color.faint} style={inp} />

      <View style={{ marginTop: 18 }}>
        <Cta label={medias.length > 1 ? `${medias.length}개 올리기` : '영상 올리기'} onPress={submit} disabled={!ready} loading={busy} />
      </View>
      <Text style={{ fontFamily: font.r, fontSize: 12, color: color.sub2, textAlign: 'center', marginTop: 10 }}>올리면 앱을 닫아도 백그라운드로 업로드돼요 · +15 👏</Text>
    </View>
  );
}
