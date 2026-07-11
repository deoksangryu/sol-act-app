export const pad = (n: number) => String(n).padStart(2, '0');
export const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => fmt(new Date());

/** YYYY-MM-DD → 그 주 월요일 */
export function weekStartStr(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return fmt(dt);
}

/** 월요일 → 그 주 월~일 7일 */
export function weekDates(monday: string): string[] {
  const [y, m, d] = monday.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(base);
    x.setDate(base.getDate() + i);
    return fmt(x);
  });
}

/** YYYY-MM-DD → 'M월 D일' */
export function fmtKDate(ds: string): string {
  const [, m, d] = ds.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** 오늘 기준 N일 후/전 (YYYY-MM-DD) */
export function dayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmt(d);
}

/** ISO/날짜 → 'MM/DD' */
export const md = (iso: string) => (iso || '').slice(5, 10).replace('-', '/');
