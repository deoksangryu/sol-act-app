import { API_URL } from '../config';
import { getToken, setToken, clearToken, getUserIdFromToken } from './storage';
import type { User, Plan, ClassInfo, Lesson, LessonJournal, JournalComment, AttendanceRecord, Notice, Notification, PortfolioItem, PortfolioComment, PracticeCurrent, PracticeScriptView, FeedCard, DietLog, WeightLog, StudentWeightSummary, Track, MusicDownloadRequest } from '../types';

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
    // 로그인 요청 자체의 401 = 잘못된 자격증명(세션 만료가 아님). 세션만료 전환 없이 안내만.
    if (path.includes('/auth/login')) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
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
    // FastAPI 422는 detail이 [{loc,msg,type}, …] 배열, 그 외에도 객체일 수 있음 → 읽을 수 있는 문자열로 변환("[object Object]" 방지)
    const d = (err as { detail?: unknown }).detail;
    let msg = '요청을 처리하지 못했습니다.';
    if (typeof d === 'string' && d.trim()) msg = d;
    else if (Array.isArray(d) && d.length) msg = (d[0] as any)?.msg || (d[0] as any)?.message || msg;
    else if (d && typeof d === 'object') msg = (d as any).msg || (d as any).message || msg;
    // Pydantic가 붙이는 "Value error, "/"Assertion error, " 접두사 제거 → 사용자에겐 한글 문장만 노출
    msg = msg.replace(/^(Value error|Assertion error),\s*/, '');
    throw new Error(msg);
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
    if (res?.accessToken) { await setToken(res.accessToken); _sessionExpiredScheduled = false; } // 재로그인 시 세션만료 플래그 리셋(이후 401 처리 복구)
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
  /** 본인 계정·데이터 영구 삭제(복구 불가) — 앱스토어 인앱 계정삭제 요건 */
  deleteAccount(): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/api/users/me', { method: 'DELETE' });
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

// === 학생 연습 일지 (portfolios/journals) ===
export const practiceJournalApi = {
  create(data: { title: string; content: string; attachmentUrl?: string }): Promise<any> {
    return apiRequest('/api/portfolios/journals', { method: 'POST', body: JSON.stringify(toSnake(data)) });
  },
  list(params?: { studentId?: string }): Promise<any[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    const qs = q.toString();
    return apiRequest<any[]>(`/api/portfolios/journals${qs ? '?' + qs : ''}`);
  },
};

// === Diet (식단 / 체중) ===
export const dietApi = {
  list(params?: { studentId?: string; date?: string; mealType?: string; search?: string; skip?: number; limit?: number }): Promise<DietLog[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.date) q.set('date', params.date);
    if (params?.mealType) q.set('meal_type', params.mealType);
    if (params?.search) q.set('search', params.search);
    if (params?.skip != null) q.set('skip', String(params.skip));
    if (params?.limit != null) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiRequest<DietLog[]>(`/api/diet${qs ? '?' + qs : ''}`);
  },
  create(data: Partial<DietLog>): Promise<DietLog> {
    return apiRequest<DietLog>('/api/diet', { method: 'POST', body: JSON.stringify(toSnake(data)) });
  },
  update(id: string, data: Partial<DietLog>): Promise<DietLog> {
    return apiRequest<DietLog>(`/api/diet/${id}`, { method: 'PUT', body: JSON.stringify(toSnake(data)) });
  },
  delete(id: string): Promise<void> {
    return apiRequest<void>(`/api/diet/${id}`, { method: 'DELETE' });
  },
  listWeight(params?: { studentId?: string; days?: number }): Promise<WeightLog[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.days) q.set('days', String(params.days));
    const qs = q.toString();
    return apiRequest<WeightLog[]>(`/api/diet/weight${qs ? '?' + qs : ''}`);
  },
  createWeight(data: { weight: number; date: string; memo?: string; bodyFat?: number; muscleMass?: number; visceralFat?: number }): Promise<WeightLog> {
    return apiRequest<WeightLog>('/api/diet/weight', { method: 'POST', body: JSON.stringify(toSnake(data)) });
  },
  deleteWeight(id: string): Promise<void> {
    return apiRequest<void>(`/api/diet/weight/${id}`, { method: 'DELETE' });
  },
  weightStudents(): Promise<StudentWeightSummary[]> {
    return apiRequest<StudentWeightSummary[]>('/api/diet/weight/students');
  },
};

// === Music ===
export const musicApi = {
  listTracks(params?: { search?: string; skip?: number; limit?: number }): Promise<Track[]> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.skip != null) q.set('skip', String(params.skip));
    if (params?.limit != null) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiRequest<Track[]>(`/api/music/tracks${qs ? '?' + qs : ''}`);
  },
  getTrack(id: string): Promise<Track> {
    return apiRequest<Track>(`/api/music/tracks/${id}`);
  },
  listRequests(params?: { status?: string }): Promise<MusicDownloadRequest[]> {
    const q = params?.status ? `?status=${params.status}` : '';
    return apiRequest<MusicDownloadRequest[]>(`/api/music/requests${q}`);
  },
  createRequest(data: { trackId: string; purpose: string }): Promise<MusicDownloadRequest> {
    return apiRequest<MusicDownloadRequest>('/api/music/requests', { method: 'POST', body: JSON.stringify(toSnake(data)) });
  },
  respondRequest(id: string, data: { status: 'approved' | 'rejected'; responseNote?: string }): Promise<MusicDownloadRequest> {
    return apiRequest<MusicDownloadRequest>(`/api/music/requests/${id}`, { method: 'PUT', body: JSON.stringify(toSnake(data)) });
  },
};

// === Gamification (박수·커튼콜) — v2 ===
export interface GamificationMe {
  clapsBalance: number;
  clapsToday: number;
  dailyCap: number;
  streakDays: number;
  streakLongest: number;
  freezes: number;
}
export const gamificationApi = {
  me(): Promise<GamificationMe> {
    return apiRequest<GamificationMe>('/api/gamification/me');
  },
  award(reason: string, amount: number, ref?: string): Promise<{ granted: number; clapsToday: number; clapsBalance: number; streakDays: number }> {
    return apiRequest('/api/gamification/award', { method: 'POST', body: JSON.stringify(ref ? { reason, amount, ref } : { reason, amount }) });
  },
};

// === Submissions (통합 인박스 + 리드타임) — v2 ===
export type SubmissionKind = 'recording' | 'video' | 'journal' | 'diet' | 'interview';
export interface InboxOpen { id: string; student: string; studentId?: string; kind: SubmissionKind; title: string; note?: string | null; ago: string; createdAt?: string }
export interface InboxDone { id: string; student: string; studentId?: string; kind: SubmissionKind; title: string; lead: string }
export interface Inbox { count: number; open: InboxOpen[]; doneToday: InboxDone[] }
export interface MySubmission { id: string; kind: SubmissionKind; title: string; status: 'open' | 'done'; feedback?: string | null; ago: string; feedbackAgo?: string | null; createdAt?: string }
export const submissionsApi = {
  submit(kind: SubmissionKind, title: string, note?: string): Promise<{ id: string; granted: number; streakDays: number }> {
    return apiRequest('/api/submissions/submit', { method: 'POST', body: jsonBody({ kind, title, note }) });
  },
  inbox(): Promise<Inbox> { return apiRequest<Inbox>('/api/submissions/inbox'); },
  inboxCount(): Promise<{ count: number }> { return apiRequest('/api/submissions/inbox/count'); },
  mine(): Promise<MySubmission[]> { return apiRequest<MySubmission[]>('/api/submissions/mine'); },
  feedback(id: string, feedback: string): Promise<{ id: string; status: string; lead: string }> {
    return apiRequest(`/api/submissions/${id}/feedback`, { method: 'POST', body: jsonBody({ feedback }) });
  },
};

// === Achievements (갈채 뱃지) — v2 ===
export interface BadgeView { code: string; title: string; sub: string; icon: string; owned: boolean }
export interface BadgeSet { badges: BadgeView[]; ownedCount: number; total: number }
export const achievementsApi = {
  me(): Promise<BadgeSet> { return apiRequest<BadgeSet>('/api/achievements/me'); },
  student(id: string): Promise<BadgeSet> { return apiRequest<BadgeSet>(`/api/achievements/student/${id}`); },
  grant(studentId: string, code = 'growth'): Promise<{ ok: boolean; already: boolean }> {
    return apiRequest('/api/achievements/grant', { method: 'POST', body: jsonBody({ studentId, code }) });
  },
};

// === Practice Sessions (연습 타이머) — v2 ===
export const sessionsApi = {
  log(seconds: number, source: 'timer' | 'music' = 'timer', ref?: string): Promise<{ granted: number; monthSeconds: number }> {
    return apiRequest('/api/sessions/log', { method: 'POST', body: jsonBody({ seconds, source, ref }) });
  },
  summary(): Promise<{ monthSeconds: number; lastMonthSeconds: number }> {
    return apiRequest('/api/sessions/summary');
  },
  today(): Promise<{ todaySeconds: number }> {
    return apiRequest('/api/sessions/today');
  },
};

// === Exam Schedule (D-day) — v2 ===
export interface ExamView { id: string; title: string; examDate?: string | null; note?: string | null; dday?: number | null }
export const examsApi = {
  list(): Promise<ExamView[]> { return apiRequest<ExamView[]>('/api/exams/list'); },
  dday(): Promise<{ exam: ExamView | null }> { return apiRequest('/api/exams/dday'); },
  create(title: string, examDate: string, note?: string): Promise<ExamView> {
    return apiRequest('/api/exams/create', { method: 'POST', body: jsonBody({ title, examDate, note }) });
  },
  remove(id: string): Promise<{ ok: boolean }> { return apiRequest(`/api/exams/${id}`, { method: 'DELETE' }); },
};

// === Learn Content (배움) — v2 ===
export interface QuizView { id: string; category: string; question: string; options: string[] }
export interface QuizToday { question: QuizView | null; answered: boolean; chosenIndex?: number; correct?: boolean; answerIndex?: number; explanation?: string | null }
export interface ReadingView { id: string; title: string; sub?: string | null; minutes: number }
export interface MediaView { id: string; title: string; sub?: string | null; url?: string | null; duration?: string | null }
export interface InterviewView { id: string; question: string; category?: string | null }
export const contentApi = {
  quizToday(): Promise<QuizToday> { return apiRequest<QuizToday>('/api/content/quiz/today'); },
  quizAnswer(questionId: string, chosenIndex: number): Promise<{ correct: boolean; answerIndex: number; explanation?: string | null; granted: number }> {
    return apiRequest('/api/content/quiz/answer', { method: 'POST', body: jsonBody({ questionId, chosenIndex }) });
  },
  reading(): Promise<ReadingView[]> { return apiRequest<ReadingView[]>('/api/content/reading'); },
  media(): Promise<MediaView[]> { return apiRequest<MediaView[]>('/api/content/media'); },
  watchMedia(id: string): Promise<{ granted: number }> { return apiRequest(`/api/content/media/${id}/watch`, { method: 'POST' }); },
  interviewRandom(): Promise<{ question: InterviewView | null }> { return apiRequest('/api/content/interview/random'); },
};

// === Routines (오늘의 루틴) — v2 ===
export interface RoutineView { id: string; title: string; sub?: string | null; reward: number; done: boolean }
export interface RoutineToday { items: RoutineView[]; doneCount: number; total: number }
export const routinesApi = {
  today(): Promise<RoutineToday> { return apiRequest<RoutineToday>('/api/routines/today'); },
  check(id: string): Promise<{ granted: number; doneCount: number }> {
    return apiRequest(`/api/routines/${id}/check`, { method: 'POST' });
  },
};

// === AI 면접 질의응답 첨삭 — v3 ===
export interface AiReviseResult { ok: boolean; revised: string; feedback: string[]; summary: string }

// === AI 상대역 대사 생성 ===
// 학생 대사(고정) 사이의 '상대 등장' 자리를 AI가 채운다. 상대 대사는 성별×나이 맞춤 TTS 오디오(audioUrl)로 미리 합성됨.
export interface SceneTurn { speaker: '나' | '상대'; text?: string; hint?: string; audioUrl?: string; sec?: number }
export interface ScenePartnerResult { ok: boolean; turns: SceneTurn[]; voice?: string; message?: string; limit?: number; remaining?: number; sceneId?: string }
export interface SavedSceneSummary { id: string; title: string; partnerHint?: string | null; voice?: string | null; lineCount: number; createdAt?: string | null }
export interface SavedScene { id: string; title: string; partnerHint?: string | null; voice?: string | null; turns: SceneTurn[] }
export interface SceneQuota { limit: number; used: number; remaining: number }

export const aiApi = {
  interviewRevise(question: string, answer: string): Promise<AiReviseResult> {
    return apiRequest('/api/ai/interview-revise', { method: 'POST', body: jsonBody({ question, answer }) });
  },
  scenePartner(turns: SceneTurn[], partner = ''): Promise<ScenePartnerResult> {
    return apiRequest('/api/ai/scene-partner', { method: 'POST', body: jsonBody({ turns, partner }) });
  },
};

// 저장된 장면 라이브러리(불러오기=크레딧 0) + 하루 생성 제한
export const sceneApi = {
  list(): Promise<SavedSceneSummary[]> { return apiRequest('/api/ai/scenes'); },
  get(id: string): Promise<SavedScene> { return apiRequest(`/api/ai/scenes/${id}`); },
  remove(id: string): Promise<{ ok: boolean }> { return apiRequest(`/api/ai/scenes/${id}`, { method: 'DELETE' }); },
  quota(): Promise<SceneQuota> { return apiRequest('/api/ai/scene-quota'); },
  getLimit(): Promise<{ limit: number }> { return apiRequest('/api/ai/scene-limit'); },
  setLimit(limit: number): Promise<{ limit: number }> { return apiRequest('/api/ai/scene-limit', { method: 'PUT', body: jsonBody({ limit }) }); },
};

// === 모의테스트 — v3 (백엔드 완료. 프론트 화면은 후속) ===
export interface MockTestSummary {
  id: string; title: string; testDate?: string | null; description?: string | null;
  status: string; entryCount?: number; submittedCount?: number;
}
export interface MockTestEntryView {
  id: string; studentId: string; studentName: string; sortOrder: number;
  audioUrl?: string | null; status: string; audioSubmittedAt?: string | null;
}
export interface MockTestVideoView { id: string; studentId?: string; studentName?: string; videoUrl: string; thumbnailUrl?: string | null }
export interface MockTestDetail extends MockTestSummary { entries: MockTestEntryView[]; videos: MockTestVideoView[] }
export interface MyMockTest {
  id: string; title: string; testDate?: string | null; description?: string | null; status: string;
  myOrder: number; myAudioUrl?: string | null; myStatus: string; myVideoCount: number;
}
export const mockTestApi = {
  // 원장
  list(): Promise<MockTestSummary[]> { return apiRequest('/api/mock-tests'); },
  create(title: string, testDate: string | null, studentIds: string[], description?: string): Promise<MockTestDetail> {
    return apiRequest('/api/mock-tests', { method: 'POST', body: jsonBody({ title, testDate, studentIds, description }) });
  },
  detail(id: string): Promise<MockTestDetail> { return apiRequest(`/api/mock-tests/${id}`); },
  reorder(id: string, studentIds: string[]): Promise<{ ok: boolean }> {
    return apiRequest(`/api/mock-tests/${id}/order`, { method: 'PATCH', body: jsonBody({ studentIds }) });
  },
  announce(id: string): Promise<{ ok: boolean; notified: number }> {
    return apiRequest(`/api/mock-tests/${id}/announce`, { method: 'POST' });
  },
  remove(id: string): Promise<{ ok: boolean }> { return apiRequest(`/api/mock-tests/${id}`, { method: 'DELETE' }); },
  // 학생
  mine(): Promise<MyMockTest[]> { return apiRequest('/api/mock-tests/student/mine'); },
  myVideos(id: string): Promise<MockTestVideoView[]> { return apiRequest(`/api/mock-tests/${id}/my-videos`); },
};

// === Dashboard (원장/강사 현황) — v2 ===
export interface DashClass { id: string; name: string; members: number; open: number; submissionsWeek: number }
export interface DashAttention { name: string; reason: string }
export interface DashStats {
  studentsTotal: number; curtaincallToday: number; pendingFeedback: number;
  leadtimeMedianHours: number | null; journalRate: number;
  attention: DashAttention[]; classes: DashClass[];
}
export interface RosterRow { id: string; name: string; streak: number; weekSubmissions: number; slump: boolean }
export const dashboardApi = {
  stats(): Promise<DashStats> { return apiRequest<DashStats>('/api/dashboard/stats'); },
  roster(): Promise<RosterRow[]> { return apiRequest<RosterRow[]>('/api/dashboard/roster'); },
};

// === Exchange (박수 교환소) — v2 ===
export interface ExchangeItemView { id: string; name: string; description?: string | null; cost: number; icon?: string | null; kind: string }
export interface ExchangeOrderView { id: string; itemName: string; cost: number; status: string; createdAt?: string | null }
export const exchangeApi = {
  items(): Promise<{ balance: number; items: ExchangeItemView[] }> { return apiRequest('/api/exchange/items'); },
  redeem(itemId: string): Promise<{ ok: boolean; balance: number }> {
    return apiRequest('/api/exchange/redeem', { method: 'POST', body: jsonBody({ itemId }) });
  },
  orders(): Promise<ExchangeOrderView[]> { return apiRequest<ExchangeOrderView[]>('/api/exchange/orders'); },
};
