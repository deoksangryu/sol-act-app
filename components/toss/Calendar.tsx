import React from 'react';
import { TOSS } from '../../services/category';

// 요일 라벨
const CAL_WD = ['일', '월', '화', '수', '목', '금', '토'];

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 월 캘린더(접기/펴기 + 날짜 선택). 수업(수업 날짜)·과제(마감일) 등에서 공용.
 * Classes의 LessonCalendar에서 추출 — 데이터 의존을 marked(Set<날짜문자열>)로 일반화.
 */
export const MiniCalendar: React.FC<{
  marked: Set<string>;            // 점 표시할 날짜(YYYY-MM-DD)
  selected: string | null;
  onSelect: (d: string | null) => void;
  open: boolean;
  onToggle: () => void;
  month: Date;
  onMonth: (d: Date) => void;
  toggleLabel?: string;           // 접힌 상태 버튼 라벨(기본 '캘린더')
}> = ({ marked, selected, onSelect, open, onToggle, month, onMonth, toggleLabel = '캘린더' }) => {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const today = todayStr();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  return (
    <div style={{ padding: '4px 14px 2px' }}>
      {/* 헤더: 월 이동 + 접기/펴기 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => onMonth(new Date(y, m - 1, 1))} style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', display: 'flex' }} aria-label="이전 달">
            <i className="ti ti-chevron-left" style={{ fontSize: 18, color: TOSS.sub }} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: TOSS.ink, minWidth: 86, textAlign: 'center' }}>{y}년 {m + 1}월</span>
          <button onClick={() => onMonth(new Date(y, m + 1, 1))} style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', display: 'flex' }} aria-label="다음 달">
            <i className="ti ti-chevron-right" style={{ fontSize: 18, color: TOSS.sub }} />
          </button>
        </div>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', padding: '6px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, color: TOSS.sub, fontWeight: 500 }}>
          {open ? '접기' : toggleLabel}
          <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 16, color: TOSS.sub }} />
        </button>
      </div>

      {open && (
        <div style={{ padding: '4px 2px 6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 2 }}>
            {CAL_WD.map((w, i) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: i === 0 ? TOSS.danger : i === 6 ? TOSS.blue : TOSS.sub, padding: '4px 0' }}>{w}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const ds = fmt(d);
              const has = marked.has(ds);
              const isToday = ds === today;
              const isSel = ds === selected;
              return (
                <button key={ds} onClick={() => onSelect(isSel ? null : ds)}
                  style={{ background: 'none', border: 'none', padding: '3px 0', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: isSel || isToday ? 700 : 400,
                    background: isSel ? TOSS.blue : 'transparent',
                    color: isSel ? '#fff' : isToday ? TOSS.blue : TOSS.ink,
                  }}>{d}</span>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: has && !isSel ? TOSS.blue : 'transparent' }} />
                </button>
              );
            })}
          </div>
          {selected && (
            <button onClick={() => onSelect(null)} style={{ width: '100%', marginTop: 4, background: 'none', border: 'none', padding: 6, fontSize: 13, color: TOSS.blue, fontWeight: 600, cursor: 'pointer' }}>전체 보기</button>
          )}
        </div>
      )}
    </div>
  );
};
