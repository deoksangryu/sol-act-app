import { useQuery } from '@tanstack/react-query';
import { usersApi, classApi } from './api';
import type { User, ClassInfo } from '../types';

/** 앱 전역 참조 데이터(전체 유저·반) — React Query 캐시 공유(web AppContext 대응) */
export function useAppData(): { allUsers: User[]; classes: ClassInfo[] } {
  const { data: allUsers = [] } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list(), staleTime: 5 * 60 * 1000 });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: () => classApi.list(), staleTime: 5 * 60 * 1000 });
  return { allUsers, classes };
}
