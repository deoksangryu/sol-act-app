import { useEffect, useState } from 'react';

/** 값이 delay(ms) 동안 안정되면 그 값을 반환 — 서버사이드 검색 입력을 디바운스해 키 입력마다 요청하지 않도록. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
