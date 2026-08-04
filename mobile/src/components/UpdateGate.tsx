// 앱 버전 게이트 모달 — 런치·포그라운드 복귀 시 버전 확인.
//  · 설치버전 < minVersion  → 강제(닫기 불가, 업데이트만)
//  · 설치버전 < latestVersion → 권장(닫기 가능, "나중에")
// 백엔드 설정이 기본값이면(min=0.0.0, latest=현재버전) 아무것도 안 뜬다.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, Linking, Platform, AppState } from 'react-native';
import { color, font, radius } from '../theme/tokens';
import {
  fetchAppConfig,
  updateLevel,
  CURRENT_VERSION,
  type AppVersionConfig,
  type UpdateLevel,
} from '../services/appConfig';

export function UpdateGate() {
  const [cfg, setCfg] = useState<AppVersionConfig | null>(null);
  const [level, setLevel] = useState<UpdateLevel>('none');
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);

  const check = async () => {
    const now = Date.now();
    if (now - lastCheck.current < 60_000) return; // 1분 throttle
    lastCheck.current = now;
    const c = await fetchAppConfig();
    if (!c) return;
    const lv = updateLevel(c);
    setCfg(c);
    setLevel(lv);
    if (lv === 'hard') setDismissed(false); // 강제는 항상 다시 띄움
  };

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);

  const hard = level === 'hard';
  const visible = level !== 'none' && !(level === 'soft' && dismissed);
  if (!visible || !cfg) return null;

  const storeUrl = Platform.OS === 'ios' ? cfg.iosUrl : cfg.androidUrl;
  const openStore = () => {
    if (storeUrl) Linking.openURL(storeUrl).catch(() => {});
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!hard) setDismissed(true); }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={{ backgroundColor: color.white, borderRadius: radius.modal, padding: 24 }}>
          <Text style={{ fontFamily: font.xb, fontSize: 19, color: color.ink, marginBottom: 8 }}>
            {hard ? '업데이트가 필요해요' : '새 버전이 나왔어요'}
          </Text>
          <Text style={{ fontFamily: font.r, fontSize: 14.5, lineHeight: 22, color: color.sub }}>
            {cfg.message?.trim()
              ? cfg.message
              : hard
                ? '계속 사용하려면 최신 버전으로 업데이트해주세요.'
                : '더 좋아진 새 버전으로 업데이트할 수 있어요.'}
          </Text>
          <Text style={{ fontFamily: font.r, fontSize: 12, color: color.faint, marginTop: 10 }}>
            현재 버전 {CURRENT_VERSION}
          </Text>

          <View style={{ marginTop: 20, gap: 8 }}>
            <Pressable
              onPress={openStore}
              disabled={!storeUrl}
              style={{
                backgroundColor: storeUrl ? color.blue : color.line,
                borderRadius: radius.button,
                paddingVertical: 15,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: font.b, fontSize: 16, color: storeUrl ? color.white : color.sub2 }}>
                {Platform.OS === 'ios' ? 'App Store에서 업데이트' : 'Play 스토어에서 업데이트'}
              </Text>
            </Pressable>

            {!hard && (
              <Pressable onPress={() => setDismissed(true)} style={{ paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ fontFamily: font.sb, fontSize: 15, color: color.sub2 }}>나중에</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
