import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, font } from '../theme/tokens';
import { useUploads } from '../services/UploadContext';

/** 전역 업로드 진행 HUD (하단 탭바 위에 떠 있음) */
export function UploadIndicator() {
  const { uploads } = useUploads();
  const insets = useSafeAreaInsets();
  if (uploads.length === 0) return null;
  const u = uploads[0];
  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 70, backgroundColor: color.ink, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: color.white, fontSize: 13, fontFamily: font.sb }} numberOfLines={1}>
          {u.label}{uploads.length > 1 ? ` 외 ${uploads.length - 1}건` : ''} 업로드 중
        </Text>
        <Text style={{ color: '#7CC0FF', fontSize: 13, fontFamily: font.b }}>{u.progress}%</Text>
      </View>
      <View style={{ height: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
        <View style={{ width: `${u.progress}%`, height: '100%', backgroundColor: color.blue }} />
      </View>
    </View>
  );
}
