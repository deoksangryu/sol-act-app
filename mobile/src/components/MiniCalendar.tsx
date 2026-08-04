import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { color, radius, space, font } from '../theme/tokens';
import { Icon } from './Icon';
import { fmt, fmtKDate, todayStr } from '../lib/date';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export interface MiniCalendarProps {
  marked: Set<string>;
  selected: string;
  onSelect: (d: string) => void;
  open: boolean;
  onToggle: () => void;
  month: Date;
  onMonth: (d: Date) => void;
  toggleLabel?: string;
}

/** 접이식 미니 캘린더 (7열 · 30×30 원형 셀 · marked 점 · 일요일 danger) */
export function MiniCalendar({ marked, selected, onSelect, open, onToggle, month, onMonth, toggleLabel = '캘린더' }: MiniCalendarProps) {
  const today = todayStr();

  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = first.getDay(); // 0=일
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const arr: Array<string | null> = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(fmt(new Date(y, m, d)));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [month]);

  return (
    <View style={{ paddingHorizontal: space.screenX, paddingBottom: 6 }}>
      {/* 헤더: 선택 날짜 + 펼치기 토글 */}
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: font.sb, color: color.ink }}>
          {toggleLabel} · {fmtKDate(selected)}
        </Text>
        <Icon name={open ? 'chevron-left' : 'chevron-right'} size={18} color={color.sub} />
      </Pressable>

      {open && (
        <View style={{ backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: radius.card, padding: 10 }}>
          {/* 월 네비게이션 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 }}>
            <Pressable onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} hitSlop={8}>
              <Icon name="chevron-left" size={20} color={color.sub} />
            </Pressable>
            <Text style={{ fontSize: 15, fontFamily: font.b, color: color.ink }}>
              {month.getFullYear()}년 {month.getMonth() + 1}월
            </Text>
            <Pressable onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} hitSlop={8}>
              <Icon name="chevron-right" size={20} color={color.sub} />
            </Pressable>
          </View>

          {/* 요일 헤더 */}
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w, i) => (
              <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: i === 0 ? color.danger : color.sub, marginBottom: 4 }}>
                {w}
              </Text>
            ))}
          </View>

          {/* 날짜 그리드 */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((ds, idx) => {
              if (!ds) return <View key={`e${idx}`} style={{ width: `${100 / 7}%`, height: 38 }} />;
              const isSel = ds === selected;
              const isToday = ds === today;
              const isMarked = marked.has(ds);
              const isSun = idx % 7 === 0;
              const dayNum = Number(ds.split('-')[2]);
              return (
                <Pressable key={ds} onPress={() => onSelect(ds)} style={{ width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: isSel ? color.blue : 'transparent' }}>
                    <Text style={{ fontSize: 13, fontFamily: isSel || isToday ? font.b : font.r, color: isSel ? color.white : isToday ? color.blue : isSun ? color.danger : color.ink }}>
                      {dayNum}
                    </Text>
                  </View>
                  <View style={{ width: 5, height: 5, borderRadius: radius.pill, marginTop: 1, backgroundColor: isMarked && !isSel ? color.blue : 'transparent' }} />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
