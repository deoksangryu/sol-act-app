import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color as tokens } from '../theme/tokens';

// Tabler 아이콘 이름 → MaterialCommunityIcons (임시 매핑).
// TODO(디자인 정합): 실제 Tabler Icons 웹폰트를 번들해 정확히 재현.
const MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  'arrow-left': 'arrow-left',
  'chevron-right': 'chevron-right',
  'chevron-left': 'chevron-left',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'message': 'message-outline',
  'flame': 'fire',
  'trash': 'trash-can-outline',
  'lock': 'lock-outline',
  'checklist': 'format-list-checks',
  'player-play': 'play',
  'alert-triangle': 'alert-outline',
  'cloud-off': 'cloud-off-outline',
  'masks-theater-big': 'drama-masks',
  'circle-check': 'check-circle-outline',
  'scale': 'scale-bathroom',
  'bowl': 'bowl-mix',
  'soup': 'pot-steam-outline',
  'tools-kitchen-2': 'silverware-fork-knife',
  'camera': 'camera-outline',
  'music': 'music',
  'player-pause': 'pause',
  'home': 'home-variant',
  'timer': 'timer-outline',
  'microphone': 'microphone',
  'book': 'book-open-variant',
  'inbox': 'inbox',
  'notebook': 'notebook-outline',
  'account-group': 'account-group',
  'chart-box': 'chart-box-outline',
  'calendar': 'calendar-blank',
  'flame-2': 'fire',
  'mood-smile': 'emoticon-happy-outline',
  'mood-neutral': 'emoticon-neutral-outline',
  'mood-sad': 'emoticon-sad-outline',
  'search': 'magnify',
  'x': 'close',
  'check': 'check',
  'plus': 'plus',
  'dots': 'dots-horizontal',
  'school': 'school',
  'calendar-check': 'calendar-check',
  'video': 'video',
  'masks-theater': 'drama-masks',
  'salad': 'food-variant',
  'headphones': 'headphones',
  'bell': 'bell-outline',
  'speakerphone': 'bullhorn-outline',
  'user': 'account',
  'settings': 'cog-outline',
  'logout': 'logout',
  'photo': 'image-outline',
};

export function Icon({
  name,
  size = 22,
  color = tokens.ink,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const glyph = MAP[name] ?? 'help-circle-outline';
  return <MaterialCommunityIcons name={glyph} size={size} color={color} />;
}
