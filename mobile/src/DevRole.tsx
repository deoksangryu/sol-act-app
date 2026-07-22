import React, { createContext, useContext, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font } from './theme/tokens';
import { UserRole } from './types';

// 개발 전용 역할 오버라이드 — 한 계정으로 3역할 화면을 즉시 전환해 검토.
// (__DEV__에서만 노출, 배포 빌드에선 숨김)
type Override = UserRole | null;
const Ctx = createContext<{ role: Override; setRole: (r: Override) => void }>({ role: null, setRole: () => {} });
export const useRoleOverride = () => useContext(Ctx);

export function DevRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Override>(null);
  return <Ctx.Provider value={{ role, setRole }}>{children}</Ctx.Provider>;
}

const CYCLE: Override[] = [null, UserRole.STUDENT, UserRole.TEACHER, UserRole.DIRECTOR];
const LABEL: Record<string, string> = { none: '실제', [UserRole.STUDENT]: '학생', [UserRole.TEACHER]: '선생님', [UserRole.DIRECTOR]: '원장' };

export function DevRoleSwitcher() {
  const { role, setRole } = useRoleOverride();
  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;
  const cycle = () => setRole(CYCLE[(CYCLE.indexOf(role) + 1) % CYCLE.length]);
  const label = LABEL[role ?? 'none'];
  return (
    <Pressable
      onPress={cycle}
      style={{ position: 'absolute', right: 12, bottom: insets.bottom + 74, backgroundColor: 'rgba(25,31,40,0.88)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, zIndex: 100, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 8 }}
    >
      <Text style={{ color: color.white, fontFamily: font.b, fontSize: 12.5 }}>👁 {label}</Text>
    </Pressable>
  );
}
