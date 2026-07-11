import { API_URL } from '../config';
import { getToken, setToken, clearToken, getUserIdFromToken } from './storage';
import type { User, Plan, ClassInfo, Lesson, LessonJournal, JournalComment, AttendanceRecord, Notice, Notification, PortfolioItem, PortfolioComment, PracticeCurrent, PracticeScriptView, FeedCard } from '../types';

export { API_URL };

// 401 발생 시 앱 루트가 로그인으로 전환하도록 등록하는 핸들러.
let _sessionExpiredHandler: (() => void) | null = null;
let _sessionExpiredScheduled = false;
export function setSessionExpiredHandler(fn: () => void) {
  _sessionExpiredHandler = fn;
}

// --- snake_case <-> camelCase ---
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
function convertKeys(obj: unknown, conv: (s: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((v) => convertKeys(v, conv));
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [conv(k), convertKeys(v, conv)]),
    );
  }
  return obj;
}
export function toCamel<T = any>(obj: unknown): T { return convertKeys(obj, snakeToCamel) as T; }
export function toSnake(obj: unknown): unknown { return convertKeys(obj, camelToSnake); }

/** 상대 경로(/uploads/…, /music-files/…)에 API_URL을 붙여 절대 URL로 */
export function resolveFileUrl(url?: string | null): string {
  if (!url) return '';
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

/** createdAt → date 별칭(프론트가 date를 기대하는 타입용) */
function withDateAlias<T>(o: T): T {
  const a = o as any;
  if (a && typeof a === 'object' && a.createdAt && !a.date) a.date = a.createdAt;
  return o;
}

// --- Fetch 래퍼 ---
// 주의: 트레일링 슬래시 금지(ngrok에서 307이 auth 헤더를 벗김).
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('인터넷 연결을 확인해주세요.');
  }

  if (response.status === 401) {
    await clearToken();
    if (!_sessionExpiredScheduled) {
      _sessionExpiredScheduled = true;
      _sessionExpiredHandler?.();
    }
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }
  if (!response.ok) {
    if (response.status === 403) throw new Error('접근 권한이 없습니다.');
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((err as { detail?: string }).detail || '요청을 처리하지 못했습니다.');
  }

  const data = await response.json().catch(() => null);
  return toCamel<T>(data);
}

function jsonBody(data: unknown): string {
  return JSON.stringify(toSnake(data));
}

// === Auth ===
export const authApi = {
  async login(email: string, password: string): Promise<any> {
    const res = await apiRequest<any>('/api/auth/login', {
      method: 'POST',
      body: jsonBody({ email, password }),
    });
    if (res?.accessToken) await setToken(res.accessToken);
    return res;
  },
  register(data: { name: string; email: string; password: string; inviteCode?: string }): Promise<any> {
    return apiRequest('/api/auth/register', { method: 'POST', body: jsonBody(data) });
  },
};

// === Users ===
export const usersApi = {
  get(id: string): Promise<User> {
    return apiRequest<User>(`/api/users/${id}`);
  },
  list(): Promise<User[]> {
    return apiRequest<User[]>('/api/users');
  },
  update(id: string, data: Partial<User>): Promise<User> {
    return apiRequest<User>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(toSnake(data)) });
  },
  changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/api/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },
  /** 현재 토큰의 sub로 본인 조회(백엔드에 GET /me 없음 → id 조회) */
  async getMe(): Promise<User | null> {
    const id = getUserIdFromToken();
    if (!id) return null;
    return this.get(id);
  },
};

// === Badges (하단 6탭 카운트) ===
export const badgesApi = {
  get(): Promise<Record<string, number>> {
    return apiRequest<Record<string, number>>('/api/badges');
  },
};

// === Plans (학습 계획) ===
export const planApi = {
  list(params?: { studentId?: string; type?: 'daily' | 'weekly'; from?: string; to?: string; skip?: number; limit?: number }): Promise<Plan[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.type) q.set('type', params.type);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.skip != null) q.set('skip', String(params.skip));
    if (params?.limit != null) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiRequest<Plan[]>(`/api/plans${qs ? '?' + qs : ''}`);
  },
  get(id: string): Promise<Plan> {
    return apiRequest<Plan>(`/api/plans/${id}`);
  },
  create(data: { studentId: string; planType: 'daily' | 'weekly'; planDate: string; items?: { content: string; sortOrder?: number }[] }): Promise<Plan> {
    return apiRequest<Plan>('/api/plans', { method: 'POST', body: JSON.stringify(toSnake(data)) });
  },
  update(id: string, data: { items?: { id?: string; content: string; done?: boolean; sortOrder?: number }[]; teacherComment?: string }): Promise<Plan> {
    return apiRequest<Plan>(`/api/plans/${id}`, { method: 'PUT', body: JSON.stringify(toSnake(data)) });
  },
  toggleItem(itemId: string, done: boolean): Promise<Plan> {
    return apiRequest<Plan>(`/api/plans/items/${itemId}/toggle`, { method: 'PATCH', body: JSON.stringify({ done }) });
  },
  delete(id: string): Promise<void> {
    return apiRequest<void>(`/api/plans/${id}`, { method: 'DELETE' });
  },
};

// === Classes ===
export const classApi = {
  list(params?: { teacherId?: string; studentId?: string }): Promise<ClassInfo[]> {
    const q = new URLSearchParams();
    if (params?.teacherId) q.set('teacher_id', params.teacherId);
    if (params?.studentId) q.set('student_id', params.studentId);
    const qs = q.toString();
    return apiRequest<ClassInfo[]>(`/api/classes${qs ? '?' + qs : ''}`);
  },
  get(id: string): Promise<ClassInfo> {
    return apiRequest<ClassInfo>(`/api/classes/${id}`);
  },
};

// === Lessons ===
export const lessonApi = {
  list(params?: { classId?: string; teacherId?: string; dateFrom?: string; dateTo?: string; status?: string }): Promise<Lesson[]> {
    const q = new URLSearchParams();
    if (params?.classId) q.set('class_id', params.classId);
    if (params?.teacherId) q.set('teacher_id', params.teacherId);
    if (params?.dateFrom) q.set('date_from', params.dateFrom);
    if (params?.dateTo) q.set('date_to', params.dateTo);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return apiRequest<Lesson[]>(`/api/lessons${qs ? '?' + qs : ''}`);
  },
  get(id: string): Promise<Lesson> {
    return apiRequest<Lesson>(`/api/lessons/${id}`);
  },
  complete(id: string): Promise<Lesson> {
    return apiRequest<Lesson>(`/api/lessons/${id}/complete`, { method: 'PUT' });
  },
  cancel(id: string): Promise<Lesson> {
    return apiRequest<Lesson>(`/api/lessons/${id}/cancel`, { method: 'PUT' });
  },
};

// === Attendance ===
export const attendanceApi = {
  list(params?: { lessonId?: string; studentId?: string; dateFrom?: string; dateTo?: string }): Promise<AttendanceRecord[]> {
    const q = new URLSearchParams();
    if (params?.lessonId) q.set('lesson_id', params.lessonId);
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.dateFrom) q.set('date_from', params.dateFrom);
    if (params?.dateTo) q.set('date_to', params.dateTo);
    const qs = q.toString();
    return apiRequest<AttendanceRecord[]>(`/api/attendance${qs ? '?' + qs : ''}`);
  },
  create(data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    return apiRequest<AttendanceRecord>('/api/attendance', { method: 'POST', body: JSON.stringify(toSnake(data)) });
  },
  bulkCreate(lessonId: string, records: { studentId: string; status: string; note?: string }[]): Promise<AttendanceRecord[]> {
    return apiRequest<AttendanceRecord[]>('/api/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({ lesson_id: lessonId, records: records.map((r) => toSnake(r)) }),
    });
  },
};

// === Journals ===
function mapJournal(raw: Record<string, any>): LessonJournal {
  return { ...(raw as LessonJournal), date: raw.lessonDate || raw.createdAt || raw.date };
}
export const journalApi = {
  async list(params?: { lessonId?: string; authorId?: string; dateFrom?: string; dateTo?: string }): Promise<LessonJournal[]> {
    const q = new URLSearchParams();
    if (params?.lessonId) q.set('lesson_id', params.lessonId);
    if (params?.authorId) q.set('author_id', params.authorId);
    if (params?.dateFrom) q.set('date_from', params.dateFrom);
    if (params?.dateTo) q.set('date_to', params.dateTo);
    const qs = q.toString();
    const data = await apiRequest<Record<string, any>[]>(`/api/journals${qs ? '?' + qs : ''}`);
    return data.map(mapJournal);
  },
  async create(data: Partial<LessonJournal>): Promise<LessonJournal> {
    return mapJournal(await apiRequest<Record<string, any>>('/api/journals', { method: 'POST', body: JSON.stringify(toSnake(data)) }));
  },
  async update(id: string, data: Partial<LessonJournal>): Promise<LessonJournal> {
    return mapJournal(await apiRequest<Record<string, any>>(`/api/journals/${id}`, { method: 'PUT', body: JSON.stringify(toSnake(data)) }));
  },
  addComment(journalId: string, content: string): Promise<JournalComment> {
    return apiRequest<JournalComment>(`/api/journals/${journalId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
  },
  deleteComment(journalId: string, commentId: string): Promise<void> {
    return apiRequest<void>(`/api/journals/${journalId}/comments/${commentId}`, { method: 'DELETE' });
  },
};

// === Notices (공지) ===
export const noticeApi = {
  async list(): Promise<Notice[]> {
    const data = await apiRequest<Notice[]>('/api/notices');
    return data.map(withDateAlias);
  },
  create(data: Partial<Notice> & Record<string, unknown>): Promise<Notice> {
    return apiRequest<Notice>('/api/notices', { method: 'POST', body: JSON.stringify(toSnake(data)) });
  },
  update(id: string, data: Partial<Notice> & Record<string, unknown>): Promise<Notice> {
    return apiRequest<Notice>(`/api/notices/${id}`, { method: 'PUT', body: JSON.stringify(toSnake(data)) });
  },
  delete(id: string): Promise<void> {
    return apiRequest<void>(`/api/notices/${id}`, { method: 'DELETE' });
  },
};

// === Notifications (알림) ===
export const notificationApi = {
  async list(): Promise<Notification[]> {
    const data = await apiRequest<Notification[]>('/api/notifications');
    return data.map(withDateAlias);
  },
  markRead(id: string): Promise<Notification> {
    return apiRequest<Notification>(`/api/notifications/${id}`, { method: 'PUT', body: JSON.stringify({ read: true }) });
  },
  markAllRead(): Promise<void> {
    return apiRequest<void>('/api/notifications/mark-all-read', { method: 'PUT' });
  },
};

// === Practice (제시대사) ===
export const practiceApi = {
  current(): Promise<PracticeCurrent> {
    return apiRequest<PracticeCurrent>('/api/practice/current');
  },
  draw(): Promise<PracticeCurrent> {
    return apiRequest<PracticeCurrent>('/api/practice/draw', { method: 'POST' });
  },
  requestMore(): Promise<{ ok: boolean; already: boolean }> {
    return apiRequest<{ ok: boolean; already: boolean }>('/api/practice/request-more', { method: 'POST' });
  },
  getScript(scriptId: string): Promise<PracticeScriptView> {
    return apiRequest<PracticeScriptView>(`/api/practice/script/${scriptId}`);
  },
};

// === Portfolios (연기영상) ===
function mapPortfolio(raw: any): PortfolioItem {
  return {
    ...raw,
    tags: typeof raw.tags === 'string' ? (raw.tags ? raw.tags.split(',').map((t: string) => t.trim()) : []) : (raw.tags || []),
    comments: (raw.comments || []).map(withDateAlias),
    date: raw.createdAt || raw.date,
  };
}
export const portfolioApi = {
  async list(params?: { studentId?: string; category?: string; search?: string; practiceGroup?: string; skip?: number; limit?: number }): Promise<PortfolioItem[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.category) q.set('category', params.category);
    if (params?.search) q.set('search', params.search);
    if (params?.practiceGroup) q.set('practice_group', params.practiceGroup);
    if (params?.skip != null) q.set('skip', String(params.skip));
    if (params?.limit != null) q.set('limit', String(params.limit));
    const qs = q.toString();
    const data = await apiRequest<any[]>(`/api/portfolios${qs ? '?' + qs : ''}`);
    return data.map(mapPortfolio);
  },
  async get(id: string): Promise<PortfolioItem> {
    return mapPortfolio(await apiRequest<any>(`/api/portfolios/${id}`));
  },
  async create(data: Partial<PortfolioItem> & { practiceScriptId?: string }): Promise<PortfolioItem> {
    return mapPortfolio(await apiRequest<any>('/api/portfolios', { method: 'POST', body: JSON.stringify(toSnake(data)) }));
  },
  addComment(portfolioId: string, content: string, timestampSec?: number): Promise<PortfolioComment> {
    const body = timestampSec != null ? { content, timestamp_sec: timestampSec } : { content };
    return apiRequest<PortfolioComment>(`/api/portfolios/${portfolioId}/comments`, { method: 'POST', body: JSON.stringify(body) });
  },
  async listFeed(params?: { studentId?: string; category?: string; search?: string; skip?: number; limit?: number }): Promise<FeedCard[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.category) q.set('category', params.category);
    if (params?.search) q.set('search', params.search);
    if (params?.skip != null) q.set('skip', String(params.skip));
    if (params?.limit != null) q.set('limit', String(params.limit));
    const qs = q.toString();
    const data = await apiRequest<any[]>(`/api/portfolios/feed${qs ? '?' + qs : ''}`);
    return data.map((c) => ({
      key: c.key, kind: c.kind, title: c.title, studentId: c.studentId, studentName: c.studentName,
      count: c.count, pendingFeedback: c.pendingFeedback ?? 0, coverThumbnail: c.coverThumbnail || undefined,
      date: c.latestDate || '', uploadStatus: c.uploadStatus, portfolio: c.portfolio ? mapPortfolio(c.portfolio) : undefined,
    }));
  },
  async update(id: string, data: Partial<PortfolioItem>): Promise<PortfolioItem> {
    return mapPortfolio(await apiRequest<any>(`/api/portfolios/${id}`, { method: 'PUT', body: JSON.stringify(toSnake(data)) }));
  },
  delete(id: string): Promise<void> {
    return apiRequest<void>(`/api/portfolios/${id}`, { method: 'DELETE' });
  },
  deleteVideo(portfolioId: string, videoId: string): Promise<void> {
    return apiRequest<void>(`/api/portfolios/${portfolioId}/videos/${videoId}`, { method: 'DELETE' });
  },
};
