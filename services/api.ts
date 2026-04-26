import type {
  User, ClassInfo, Lesson, LessonJournal, AttendanceRecord,
  Assignment, DietLog, Evaluation, Question, Answer,
  ChatMessage, Notice, Notification, PortfolioItem, PortfolioComment,
  CompetitionEvent, ChecklistItem, PrivateLessonRequest,
} from '../types';

// --- Config ---
export const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
export const DEMO_MODE = (import.meta as any).env?.VITE_DEMO_MODE === 'true';

// Prevent duplicate session-expired redirects
let _sessionExpiredScheduled = false;

// Demo mode: re-export mock APIs (overrides real APIs at bottom of file)
import {
  demoAuthApi, demoUserApi, demoClassApi, demoLessonApi, demoAssignmentApi,
  demoDietApi, demoNoticeApi, demoNotificationApi, demoJournalApi,
  demoAttendanceApi, demoQnaApi, demoEvaluationApi, demoPortfolioApi,
  demoAuditionApi, demoChatApi, demoPrivateLessonApi, demoUploadApi,
} from './demoApi';

// --- Token Management ---
const TOKEN_KEY = 'sol_act_token';
const USER_KEY = 'sol_act_user';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearAuth(): void {
  _sessionExpiredScheduled = false;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getSavedUser(): User | null {
  const s = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}
export function saveUser(user: User): void {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// --- snake_case <-> camelCase conversion ---
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
function convertKeys(obj: unknown, converter: (s: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((v) => convertKeys(v, converter));
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [converter(k), convertKeys(v, converter)])
    );
  }
  return obj;
}
function toCamel(obj: unknown): unknown { return convertKeys(obj, snakeToCamel); }
function toSnake(obj: unknown): unknown { return convertKeys(obj, camelToSnake); }

// Map createdAt → date for types that frontend expects 'date'
function withDateAlias<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(withDateAlias) as T;
  if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (o.createdAt && !o.date) o.date = o.createdAt;
    return o as T;
  }
  return obj;
}

// Map portfolio: tags string → array, comments date alias
function mapPortfolio(raw: Record<string, unknown>): PortfolioItem {
  return {
    ...(raw as unknown as PortfolioItem),
    tags: typeof raw.tags === 'string' ? (raw.tags ? raw.tags.split(',').map((t: string) => t.trim()) : []) : ((raw.tags as string[]) || []),
    comments: ((raw.comments as Record<string, unknown>[]) || []).map(withDateAlias) as unknown as PortfolioComment[],
    date: (raw.createdAt as string) || (raw.date as string),
  };
}

// Resolve a file URL: relative paths (/uploads/...) get API_URL prepended,
// absolute URLs (http/https) are returned as-is.
export function resolveFileUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

// --- Fetch wrapper ---
async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Do NOT add trailing slashes — 307 redirects strip auth headers in cross-origin (ngrok)
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearAuth();
    // Soft handling: warn before redirect to avoid losing unsaved work
    if (!_sessionExpiredScheduled) {
      _sessionExpiredScheduled = true;
      window.dispatchEvent(new CustomEvent('session-expired'));
      setTimeout(() => window.location.reload(), 3000);
    }
    throw new Error('세션이 만료되었습니다. 3초 후 로그인 화면으로 이동합니다.');
  }
  if (!response.ok) {
    if (!navigator.onLine) {
      throw new Error('인터넷 연결을 확인해주세요.');
    }
    if (response.status === 403) {
      throw new Error('접근 권한이 없습니다.');
    }
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || '요청을 처리하지 못했습니다.');
  }

  const data = await response.json();
  return toCamel(data) as T;
}

// --- Auth API ---
export const authApi = {
  async login(email: string, password: string): Promise<{ accessToken: string; user: User }> {
    const res = await apiRequest<{ accessToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.accessToken);
    saveUser(res.user);
    return res;
  },

  async register(data: { name: string; email: string; password: string; role: string; inviteCode: string }) {
    return apiRequest<{ accessToken: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: data.name, email: data.email, password: data.password, role: data.role, invite_code: data.inviteCode }),
    });
  },

  async verifyCode(code: string): Promise<{ valid: boolean; role: string }> {
    return apiRequest('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async findEmail(name: string): Promise<{ results: { email: string; role: string }[] }> {
    return apiRequest('/api/auth/find-email', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async resetPassword(email: string, name: string): Promise<{ tempPassword: string }> {
    return apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  },

  async createInviteCodes(data: { role: string; count: number; memo?: string }): Promise<{ code: string; role: string }[]> {
    return apiRequest('/api/auth/invite-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listInviteCodes(unusedOnly = false): Promise<{ code: string; role: string; used: boolean; usedBy?: string; memo?: string; createdAt?: string }[]> {
    return apiRequest(`/api/auth/invite-codes?unused_only=${unusedOnly}`);
  },
};

// --- User API ---
export const userApi = {
  list(role?: string): Promise<User[]> {
    const q = role ? `?role=${role}` : '';
    return apiRequest(`/api/users${q}`);
  },
  get(id: string): Promise<User> {
    return apiRequest(`/api/users/${id}`);
  },
  update(id: string, data: Partial<User>): Promise<User> {
    return apiRequest(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return apiRequest('/api/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/users/${id}`, { method: 'DELETE' });
  },
};

// --- Class API ---
export const classApi = {
  list(params?: { teacherId?: string; studentId?: string }): Promise<ClassInfo[]> {
    const q = new URLSearchParams();
    if (params?.teacherId) q.set('teacher_id', params.teacherId);
    if (params?.studentId) q.set('student_id', params.studentId);
    const qs = q.toString();
    return apiRequest(`/api/classes${qs ? '?' + qs : ''}`);
  },
  get(id: string): Promise<ClassInfo> {
    return apiRequest(`/api/classes/${id}`);
  },
  create(data: Partial<ClassInfo>): Promise<ClassInfo> {
    return apiRequest('/api/classes', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  update(id: string, data: Partial<ClassInfo>): Promise<ClassInfo> {
    return apiRequest(`/api/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/classes/${id}`, { method: 'DELETE' });
  },
  addStudent(classId: string, studentId: string): Promise<ClassInfo> {
    return apiRequest(`/api/classes/${classId}/students`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    });
  },
  removeStudent(classId: string, studentId: string): Promise<ClassInfo> {
    return apiRequest(`/api/classes/${classId}/students/${studentId}`, { method: 'DELETE' });
  },
};

// --- Lesson API ---
export const lessonApi = {
  list(params?: { classId?: string; teacherId?: string; dateFrom?: string; dateTo?: string; status?: string }): Promise<Lesson[]> {
    const q = new URLSearchParams();
    if (params?.classId) q.set('class_id', params.classId);
    if (params?.teacherId) q.set('teacher_id', params.teacherId);
    if (params?.dateFrom) q.set('date_from', params.dateFrom);
    if (params?.dateTo) q.set('date_to', params.dateTo);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return apiRequest(`/api/lessons${qs ? '?' + qs : ''}`);
  },
  get(id: string): Promise<Lesson> {
    return apiRequest(`/api/lessons/${id}`);
  },
  create(data: Partial<Lesson>): Promise<Lesson> {
    return apiRequest('/api/lessons', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  update(id: string, data: Partial<Lesson>): Promise<Lesson> {
    return apiRequest(`/api/lessons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  cancel(id: string): Promise<Lesson> {
    return apiRequest(`/api/lessons/${id}/cancel`, { method: 'PUT' });
  },
  complete(id: string): Promise<Lesson> {
    return apiRequest(`/api/lessons/${id}/complete`, { method: 'PUT' });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/lessons/${id}`, { method: 'DELETE' });
  },
  createBulk(data: Partial<Lesson> | Partial<Lesson>[]): Promise<Lesson[]> {
    return apiRequest('/api/lessons/bulk', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
};

// --- Attendance API ---
export const attendanceApi = {
  list(params?: { lessonId?: string; studentId?: string }): Promise<AttendanceRecord[]> {
    const q = new URLSearchParams();
    if (params?.lessonId) q.set('lesson_id', params.lessonId);
    if (params?.studentId) q.set('student_id', params.studentId);
    const qs = q.toString();
    return apiRequest(`/api/attendance${qs ? '?' + qs : ''}`);
  },
  create(data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    return apiRequest('/api/attendance', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  bulkCreate(lessonId: string, records: { studentId: string; status: string; note?: string }[]): Promise<AttendanceRecord[]> {
    return apiRequest('/api/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({
        lesson_id: lessonId,
        records: records.map(r => toSnake(r)),
      }),
    });
  },
  update(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    return apiRequest(`/api/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  getStats(params?: { studentId?: string; classId?: string; dateFrom?: string; dateTo?: string }): Promise<Record<string, unknown>[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.classId) q.set('class_id', params.classId);
    if (params?.dateFrom) q.set('date_from', params.dateFrom);
    if (params?.dateTo) q.set('date_to', params.dateTo);
    const qs = q.toString();
    return apiRequest(`/api/attendance/stats${qs ? '?' + qs : ''}`);
  },
};

// --- Journal API ---
function mapJournal(raw: Record<string, unknown>): LessonJournal {
  return { ...(raw as unknown as LessonJournal), date: (raw.lessonDate as string) || (raw.createdAt as string) || (raw.date as string) };
}

export const journalApi = {
  async list(params?: { lessonId?: string; authorId?: string }): Promise<LessonJournal[]> {
    const q = new URLSearchParams();
    if (params?.lessonId) q.set('lesson_id', params.lessonId);
    if (params?.authorId) q.set('author_id', params.authorId);
    const qs = q.toString();
    const data = await apiRequest<Record<string, unknown>[]>(`/api/journals${qs ? '?' + qs : ''}`);
    return data.map(mapJournal);
  },
  async create(data: Partial<LessonJournal>): Promise<LessonJournal> {
    const res = await apiRequest<Record<string, unknown>>('/api/journals', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
    return mapJournal(res);
  },
  async update(id: string, data: Partial<LessonJournal>): Promise<LessonJournal> {
    const res = await apiRequest<Record<string, unknown>>(`/api/journals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
    return mapJournal(res);
  },
  async get(id: string): Promise<LessonJournal> {
    const res = await apiRequest<Record<string, unknown>>(`/api/journals/${id}`);
    return mapJournal(res);
  },
  getAiFeedback(id: string): Promise<{ aiFeedback: string }> {
    return apiRequest(`/api/journals/${id}/ai-feedback`, { method: 'POST' });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/journals/${id}`, { method: 'DELETE' });
  },
};

// --- Assignment API ---
export const assignmentApi = {
  list(params?: { studentId?: string; assignedBy?: string; status?: string }): Promise<Assignment[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.assignedBy) q.set('assigned_by', params.assignedBy);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return apiRequest(`/api/assignments${qs ? '?' + qs : ''}`);
  },
  get(id: string): Promise<Assignment> {
    return apiRequest(`/api/assignments/${id}`);
  },
  create(data: Partial<Assignment>): Promise<Assignment[]> {
    return apiRequest('/api/assignments', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  update(id: string, data: Partial<Assignment>): Promise<Assignment> {
    return apiRequest(`/api/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  submit(id: string, data: { submissionText: string; submissionFileUrl?: string }): Promise<Assignment> {
    return apiRequest(`/api/assignments/${id}/submit`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  patchFile(id: string, fileUrl: string): Promise<Assignment> {
    return apiRequest(`/api/assignments/${id}/file?file_url=${encodeURIComponent(fileUrl)}`, { method: 'PATCH' });
  },
  grade(id: string, data: { grade: string; feedback: string }): Promise<Assignment> {
    return apiRequest(`/api/assignments/${id}/grade`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  analyze(id: string): Promise<{ aiAnalysis: string }> {
    return apiRequest(`/api/assignments/${id}/analyze`, { method: 'POST' });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/assignments/${id}`, { method: 'DELETE' });
  },
};

// --- Diet API ---
export const dietApi = {
  list(params?: { studentId?: string; date?: string }): Promise<DietLog[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.date) q.set('date', params.date);
    const qs = q.toString();
    return apiRequest(`/api/diet${qs ? '?' + qs : ''}`);
  },
  create(data: Partial<DietLog>): Promise<DietLog> {
    return apiRequest('/api/diet', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  update(id: string, data: Partial<DietLog>): Promise<DietLog> {
    return apiRequest(`/api/diet/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  analyze(data: { description: string; imageBase64?: string }): Promise<{ calories: number; advice: string }> {
    return apiRequest('/api/diet/analyze', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/diet/${id}`, { method: 'DELETE' });
  },
  // Weight logs
  listWeight(params?: { studentId?: string; days?: number }): Promise<Record<string, unknown>[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.days) q.set('days', String(params.days));
    const qs = q.toString();
    return apiRequest(`/api/diet/weight${qs ? '?' + qs : ''}`);
  },
  createWeight(data: { weight: number; date: string; memo?: string; body_fat?: number; muscle_mass?: number; visceral_fat?: number }): Promise<Record<string, unknown>> {
    return apiRequest('/api/diet/weight', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  deleteWeight(id: string): Promise<void> {
    return apiRequest(`/api/diet/weight/${id}`, { method: 'DELETE' });
  },
};

// --- Evaluation API ---
export const evaluationApi = {
  async list(params?: { studentId?: string; classId?: string; subject?: string; period?: string }): Promise<Evaluation[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.classId) q.set('class_id', params.classId);
    if (params?.subject) q.set('subject', params.subject);
    if (params?.period) q.set('period', params.period);
    const qs = q.toString();
    const data = await apiRequest<Evaluation[]>(`/api/evaluations${qs ? '?' + qs : ''}`);
    return data.map(withDateAlias);
  },
  async get(id: string): Promise<Evaluation> {
    const data = await apiRequest<Evaluation>(`/api/evaluations/${id}`);
    return withDateAlias(data);
  },
  async create(data: Partial<Evaluation>): Promise<Evaluation> {
    const res = await apiRequest<Evaluation>('/api/evaluations', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
    return withDateAlias(res);
  },
  async update(id: string, data: Partial<Evaluation>): Promise<Evaluation> {
    const res = await apiRequest<Evaluation>(`/api/evaluations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
    return withDateAlias(res);
  },
  getReport(studentId: string): Promise<Record<string, unknown>> {
    return apiRequest(`/api/evaluations/report/${studentId}`);
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/evaluations/${id}`, { method: 'DELETE' });
  },
  getAiSummary(id: string): Promise<{ aiSummary: string }> {
    return apiRequest(`/api/evaluations/${id}/ai-summary`, { method: 'POST' });
  },
};

// --- Chat API ---
export const chatApi = {
  list(classId: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    return apiRequest(`/api/chat/messages?class_id=${classId}&limit=${limit}&offset=${offset}`);
  },
  send(data: { classId: string; senderId: string; content: string }): Promise<ChatMessage> {
    return apiRequest('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  lastMessages(classIds: string[]): Promise<Record<string, ChatMessage>> {
    return apiRequest(`/api/chat/last-messages?class_ids=${classIds.join(',')}`);
  },
  markRead(classId: string): Promise<void> {
    return apiRequest(`/api/chat/mark-read?class_id=${classId}`, { method: 'PUT' });
  },
  unreadCounts(classIds: string[]): Promise<Record<string, number>> {
    return apiRequest(`/api/chat/unread-counts?class_ids=${classIds.join(',')}`);
  },
};

// --- Q&A API ---
function mapQuestion(raw: Record<string, unknown>): Question {
  return { ...(raw as unknown as Question), date: (raw.createdAt as string) || (raw.date as string), answers: ((raw.answers as Record<string, unknown>[]) || []).map(mapAnswer) };
}
function mapAnswer(raw: Record<string, unknown>): Answer {
  return { ...(raw as unknown as Answer), date: (raw.createdAt as string) || (raw.date as string) };
}

export const qnaApi = {
  async listQuestions(): Promise<Question[]> {
    const data = await apiRequest<Record<string, unknown>[]>('/api/qna/questions');
    return data.map(mapQuestion);
  },
  async getQuestion(id: string): Promise<Question> {
    const data = await apiRequest<Record<string, unknown>>(`/api/qna/questions/${id}`);
    return mapQuestion(data);
  },
  async createQuestion(data: { title: string; content: string }): Promise<Question> {
    const res = await apiRequest<Record<string, unknown>>('/api/qna/questions', {
      method: 'POST',
      body: JSON.stringify({ title: data.title, content: data.content }),
    });
    return mapQuestion(res);
  },
  async createAnswer(questionId: string, data: { content: string }): Promise<Answer> {
    const res = await apiRequest<Record<string, unknown>>(`/api/qna/questions/${questionId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ content: data.content }),
    });
    return mapAnswer(res);
  },
  async getAiAnswer(questionId: string): Promise<Answer> {
    const res = await apiRequest<Record<string, unknown>>(`/api/qna/questions/${questionId}/answers/ai`, { method: 'POST' });
    return mapAnswer(res);
  },
  deleteQuestion(id: string): Promise<void> {
    return apiRequest(`/api/qna/questions/${id}`, { method: 'DELETE' });
  },
  deleteAnswer(answerId: string): Promise<void> {
    return apiRequest(`/api/qna/answers/${answerId}`, { method: 'DELETE' });
  },
};

// --- Notice API ---
export const noticeApi = {
  async list(): Promise<Notice[]> {
    const data = await apiRequest<Notice[]>('/api/notices');
    return data.map(withDateAlias);
  },
  async get(id: string): Promise<Notice> {
    const data = await apiRequest<Notice>(`/api/notices/${id}`);
    return withDateAlias(data);
  },
  create(data: Partial<Notice> & Record<string, unknown>): Promise<Notice> {
    return apiRequest('/api/notices', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  update(id: string, data: Partial<Notice> & Record<string, unknown>): Promise<Notice> {
    return apiRequest(`/api/notices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/notices/${id}`, { method: 'DELETE' });
  },
};

// --- Notification API ---
export const notificationApi = {
  async list(): Promise<Notification[]> {
    const data = await apiRequest<Notification[]>('/api/notifications');
    return data.map(withDateAlias);
  },
  create(data: Partial<Notification>): Promise<Notification> {
    return apiRequest('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  markRead(id: string): Promise<Notification> {
    return apiRequest(`/api/notifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ read: true }),
    });
  },
  markAllRead(): Promise<void> {
    return apiRequest('/api/notifications/mark-all-read', { method: 'PUT' });
  },
};

// --- Portfolio API ---
export const portfolioApi = {
  async list(params?: { studentId?: string; category?: string }): Promise<PortfolioItem[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.category) q.set('category', params.category);
    const qs = q.toString();
    const data = await apiRequest<Record<string, unknown>[]>(`/api/portfolios${qs ? '?' + qs : ''}`);
    return data.map(mapPortfolio);
  },
  async get(id: string): Promise<PortfolioItem> {
    const data = await apiRequest<Record<string, unknown>>(`/api/portfolios/${id}`);
    return mapPortfolio(data);
  },
  async create(data: Partial<PortfolioItem> & { uploadMode?: string; totalVideos?: number; videoIndex?: number }): Promise<PortfolioItem> {
    // Convert tags array to comma-separated string for backend
    const payload: Record<string, unknown> = { ...data };
    if (Array.isArray(payload.tags)) payload.tags = (payload.tags as string[]).join(',');
    const res = await apiRequest<Record<string, unknown>>('/api/portfolios', {
      method: 'POST',
      body: JSON.stringify(toSnake(payload)),
    });
    return mapPortfolio(res);
  },
  async update(id: string, data: Partial<PortfolioItem>): Promise<PortfolioItem> {
    const payload: Record<string, unknown> = { ...data };
    if (Array.isArray(payload.tags)) payload.tags = (payload.tags as string[]).join(',');
    const res = await apiRequest<Record<string, unknown>>(`/api/portfolios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(payload)),
    });
    return mapPortfolio(res);
  },
  async addComment(portfolioId: string, content: string, timestampSec?: number): Promise<PortfolioComment> {
    const body: Record<string, unknown> = { content };
    if (timestampSec != null) body.timestamp_sec = timestampSec;
    const res = await apiRequest<PortfolioComment>(`/api/portfolios/${portfolioId}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return withDateAlias(res);
  },
  async listPracticeGroups(studentId?: string): Promise<{ groupName: string; items: PortfolioItem[] }[]> {
    const q = studentId ? `?student_id=${studentId}` : '';
    const data = await apiRequest<Record<string, unknown>[]>(`/api/portfolios/practice-groups${q}`);
    return data.map(g => ({
      groupName: g.groupName as string,
      items: ((g.items as Record<string, unknown>[]) || []).map(mapPortfolio),
    }));
  },
  getAiFeedback(id: string): Promise<{ aiFeedback: string }> {
    return apiRequest(`/api/portfolios/${id}/ai-feedback`, { method: 'POST' });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/portfolios/${id}`, { method: 'DELETE' });
  },
  async listJournals(studentId?: string): Promise<Record<string, unknown>[]> {
    const q = studentId ? `?student_id=${studentId}` : '';
    return apiRequest(`/api/portfolios/journals${q}`);
  },
  async createJournal(title: string, content: string, attachmentUrl?: string): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { title, content };
    if (attachmentUrl) body.attachment_url = attachmentUrl;
    return apiRequest('/api/portfolios/journals', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async updateJournal(journalId: string, data: { title?: string; content?: string; attachment_url?: string }): Promise<Record<string, unknown>> {
    return apiRequest(`/api/portfolios/journals/${journalId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteJournal(journalId: string): Promise<void> {
    return apiRequest(`/api/portfolios/journals/${journalId}`, { method: 'DELETE' });
  },
  async addVideo(portfolioId: string, videoUrl: string): Promise<Record<string, unknown>> {
    return apiRequest(`/api/portfolios/${portfolioId}/videos?video_url=${encodeURIComponent(videoUrl)}`, {
      method: 'POST',
    });
  },
  deleteVideo(portfolioId: string, videoId: string): Promise<void> {
    return apiRequest(`/api/portfolios/${portfolioId}/videos/${videoId}`, { method: 'DELETE' });
  },
  async addAttachment(portfolioId: string, fileUrl: string, fileName: string, fileSize?: number): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({ file_url: fileUrl, file_name: fileName });
    if (fileSize) params.set('file_size', String(fileSize));
    return apiRequest(`/api/portfolios/${portfolioId}/attachments?${params}`, { method: 'POST' });
  },
  deleteAttachment(portfolioId: string, attachmentId: string): Promise<void> {
    return apiRequest(`/api/portfolios/${portfolioId}/attachments/${attachmentId}`, { method: 'DELETE' });
  },
};

// --- Audition API ---
// Map backend audition response to frontend CompetitionEvent
function mapAudition(raw: Record<string, unknown>): CompetitionEvent {
  return {
    ...(raw as unknown as CompetitionEvent),
    registrationStart: (raw.registrationStart as string) || (raw.registration_start as string) || undefined,
    registrationEnd: (raw.registrationEnd as string) || (raw.registration_end as string) || undefined,
    checklist: ((raw.checklists as Record<string, unknown>[]) || (raw.checklist as Record<string, unknown>[]) || []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      text: (c.content as string) || (c.text as string) || '',
      completed: (c.isChecked as boolean) ?? (c.completed as boolean) ?? false,
    })),
  };
}
function mapChecklistItem(raw: Record<string, unknown>): ChecklistItem {
  return { id: raw.id as string, text: (raw.content as string) || (raw.text as string) || '', completed: (raw.isChecked as boolean) ?? (raw.completed as boolean) ?? false };
}

export const auditionApi = {
  async list(params?: { creatorId?: string; classId?: string; status?: string }): Promise<CompetitionEvent[]> {
    const q = new URLSearchParams();
    if (params?.creatorId) q.set('creator_id', params.creatorId);
    if (params?.classId) q.set('class_id', params.classId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    const data = await apiRequest<Record<string, unknown>[]>(`/api/auditions/${qs ? '?' + qs : ''}`);
    return data.map(mapAudition);
  },
  async get(id: string): Promise<CompetitionEvent> {
    const data = await apiRequest<Record<string, unknown>>(`/api/auditions/${id}`);
    return mapAudition(data);
  },
  async create(data: Partial<CompetitionEvent> & Record<string, unknown>): Promise<CompetitionEvent> {
    const res = await apiRequest<Record<string, unknown>>('/api/auditions/', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
    return mapAudition(res);
  },
  async update(id: string, data: Partial<CompetitionEvent>): Promise<CompetitionEvent> {
    const res = await apiRequest<Record<string, unknown>>(`/api/auditions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
    return mapAudition(res);
  },
  async addChecklist(auditionId: string, data: { content: string }): Promise<ChecklistItem> {
    const res = await apiRequest<Record<string, unknown>>(`/api/auditions/${auditionId}/checklists`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return mapChecklistItem(res);
  },
  async updateChecklist(auditionId: string, checklistId: string, data: { completed?: boolean; text?: string; sortOrder?: number }): Promise<ChecklistItem> {
    // Map frontend field names to backend: completed→is_checked, text→content
    const backendData: Record<string, unknown> = {};
    if (data.completed !== undefined) backendData.is_checked = data.completed;
    if (data.text !== undefined) backendData.content = data.text;
    if (data.sortOrder !== undefined) backendData.sort_order = data.sortOrder;
    const res = await apiRequest<Record<string, unknown>>(`/api/auditions/${auditionId}/checklists/${checklistId}`, {
      method: 'PUT',
      body: JSON.stringify(backendData),
    });
    return mapChecklistItem(res);
  },
  generateTips(id: string): Promise<{ tips: string }> {
    return apiRequest(`/api/auditions/${id}/generate-tips`, { method: 'POST' });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/auditions/${id}`, { method: 'DELETE' });
  },
};

// --- Private Lesson API ---
export const privateLessonApi = {
  list(params?: { studentId?: string; teacherId?: string; status?: string }): Promise<PrivateLessonRequest[]> {
    const q = new URLSearchParams();
    if (params?.studentId) q.set('student_id', params.studentId);
    if (params?.teacherId) q.set('teacher_id', params.teacherId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return apiRequest(`/api/private-lessons${qs ? '?' + qs : ''}`);
  },
  create(data: Partial<PrivateLessonRequest>): Promise<PrivateLessonRequest> {
    return apiRequest('/api/private-lessons', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  respond(id: string, data: { status: string; responseNote?: string }): Promise<PrivateLessonRequest> {
    return apiRequest(`/api/private-lessons/${id}/respond`, {
      method: 'PUT',
      body: JSON.stringify(toSnake(data)),
    });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/private-lessons/${id}`, { method: 'DELETE' });
  },
};

// --- Upload API ---

// Threshold for switching to chunked upload — low threshold to avoid single upload crashes on mobile
const CHUNKED_THRESHOLD = 1 * 1024 * 1024;
// Initial chunk size: 2MB, adapts up to 8MB based on speed
const INITIAL_CHUNK_SIZE = 2 * 1024 * 1024;
const MAX_CHUNK_SIZE = 8 * 1024 * 1024;
// Parallel chunk uploads (reduced for large files to avoid mobile OOM)
const PARALLEL_CHUNKS = 5;
const LARGE_FILE_PARALLEL = 3; // for files > 100MB
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;
// localStorage key for resumable uploads
const UPLOAD_STATE_KEY = 'sol_act_pending_upload';

// Upload phase for UI display
export type UploadPhase = 'client_compressing' | 'uploading' | 'compressing';
export type UploadPhaseCallback = (phase: UploadPhase, pct: number) => void;

// Client-side compression threshold (100MB+)
const CLIENT_COMPRESS_THRESHOLD = 100 * 1024 * 1024;

// Wake Lock: prevent screen sleep during upload (critical for mobile)
let _wakeLock: any = null;
async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      _wakeLock = await (navigator as any).wakeLock.request('screen');
    }
  } catch { /* Wake Lock not supported or denied */ }
}
function releaseWakeLock() {
  if (_wakeLock) {
    _wakeLock.release().catch(() => {});
    _wakeLock = null;
  }
}

function notifySW(type: string, data?: Record<string, unknown>) {
  navigator.serviceWorker?.controller?.postMessage({ type, ...data });
}

export const uploadApi = {
  /**
   * Upload a file with automatic video compression and resumable chunked upload.
   *
   * For video files > 30MB:
   *   1. Compress in browser (720p, ~80% size reduction)
   *   2. Upload compressed file in 2MB chunks with resume support
   *
   * @param onPhase - optional callback for phase+progress: ('compressing', 0-100) then ('uploading', 0-100)
   */
  upload(
    file: File,
    onProgress?: (pct: number) => void,
    subfolder?: string,
    targetType?: string,
    targetId?: string,
    onPhase?: UploadPhaseCallback,
  ): Promise<{ url: string; filename: string; thumbnailUrl?: string }> & { abort: () => void } {
    // Client-side file size pre-validation
    const VIDEO_EXTS = ['.mp4', '.mov', '.webm'];
    const dotIdx = file.name.lastIndexOf('.');
    const ext = dotIdx >= 0 ? file.name.toLowerCase().slice(dotIdx) : '';
    const isVideo = VIDEO_EXTS.includes(ext);
    // Video: no size limit (server compresses after upload). Docs: 50MB
    if (!isVideo && file.size > 50 * 1024 * 1024) {
      const err = Promise.reject(new Error('파일이 너무 큽니다. 최대 50MB까지 업로드 가능합니다.')) as any;
      err.abort = () => {};
      return err;
    }

    let aborted = false;
    let innerAbort: (() => void) | null = null;
    const promise = (async () => {
      let fileToUpload = file;

      // Client-side compression for large videos (100MB+)
      if (isVideo && file.size > CLIENT_COMPRESS_THRESHOLD) {
        try {
          const { compressVideo, isCompressionSupported } = await import('./videoCompress');
          if (isCompressionSupported()) {
            onPhase?.('client_compressing', 0);
            fileToUpload = await compressVideo(file, (phase, pct) => {
              if (phase === 'loading') {
                onPhase?.('client_compressing', Math.round(pct * 0.1)); // 0~10%
              } else {
                onPhase?.('client_compressing', 10 + Math.round(pct * 0.9)); // 10~100%
              }
            });
          }
        } catch {
          // Compression failed — continue with original file
          fileToUpload = file;
        }
      }

      if (aborted) throw new Error('업로드가 취소되었습니다.');

      // Upload phase
      onPhase?.('uploading', 0);
      const wrappedProgress = (pct: number) => {
        onProgress?.(pct);
        onPhase?.('uploading', pct);
      };

      let uploadPromise;
      if (fileToUpload.size > CHUNKED_THRESHOLD) {
        uploadPromise = _chunkedUpload(fileToUpload, wrappedProgress, subfolder, targetType, targetId);
      } else {
        uploadPromise = _singleUpload(fileToUpload, wrappedProgress, subfolder, targetType, targetId);
      }
      innerAbort = uploadPromise.abort;
      if (aborted) { uploadPromise.abort(); throw new Error('업로드가 취소되었습니다.'); }
      return uploadPromise;
    })();

    (promise as any).abort = () => { aborted = true; innerAbort?.(); };
    return promise as Promise<{ url: string; filename: string; thumbnailUrl?: string }> & { abort: () => void };
  },

  /** Check if there's a pending upload that can be resumed */
  getPendingUpload(): { filename: string; targetType?: string; targetId?: string } | null {
    try {
      const raw = localStorage.getItem(UPLOAD_STATE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      return { filename: state.filename, targetType: state.targetType, targetId: state.targetId };
    } catch { return null; }
  },

  /** Clear pending upload state (e.g., user dismisses resume prompt) */
  clearPendingUpload() {
    localStorage.removeItem(UPLOAD_STATE_KEY);
  },
};

function _singleUpload(
  file: File,
  onProgress?: (pct: number) => void,
  subfolder?: string,
  targetType?: string,
  targetId?: string,
): Promise<{ url: string; filename: string; thumbnailUrl?: string }> & { abort: () => void } {
  let xhrRef: XMLHttpRequest | null = null;
  acquireWakeLock();

  const promise = new Promise<{ url: string; filename: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef = xhr;
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    if (subfolder) params.set('subfolder', subfolder);
    if (targetType) params.set('target_type', targetType);
    if (targetId) params.set('target_id', targetId);
    const uploadUrl = `${API_URL}/api/upload?${params.toString()}`;
    xhr.open('POST', uploadUrl);

    xhr.timeout = 5 * 60 * 1000;

    const token = getToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      releaseWakeLock();
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve(toCamel(data) as { url: string; filename: string; thumbnailUrl?: string });
      } else if (xhr.status === 401) {
        clearAuth();
        if (!_sessionExpiredScheduled) {
          _sessionExpiredScheduled = true;
          window.dispatchEvent(new CustomEvent('session-expired'));
          setTimeout(() => window.location.reload(), 3000);
        }
        reject(new Error('세션이 만료되었습니다. 3초 후 로그인 화면으로 이동합니다.'));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || '업로드에 실패했습니다.'));
        } catch {
          reject(new Error('업로드에 실패했습니다.'));
        }
      }
    };

    xhr.onerror = () => { releaseWakeLock(); reject(new Error('네트워크 오류로 업로드에 실패했습니다.')); };
    xhr.ontimeout = () => { releaseWakeLock(); reject(new Error('업로드 시간이 초과되었습니다. 다시 시도해주세요.')); };
    xhr.onabort = () => { releaseWakeLock(); reject(new Error('업로드가 취소되었습니다.')); };
    xhr.send(formData);
  });

  (promise as any).abort = () => xhrRef?.abort();
  return promise as Promise<{ url: string; filename: string }> & { abort: () => void };
}

function _chunkedUpload(
  file: File,
  onProgress?: (pct: number) => void,
  subfolder?: string,
  targetType?: string,
  targetId?: string,
): Promise<{ url: string; filename: string; thumbnailUrl?: string }> & { abort: () => void } {
  let aborted = false;

  const promise = (async () => {
    await acquireWakeLock();
    notifySW('upload_start', { id: file.name, label: file.name });

    // Check for resumable upload
    let uploadId: string;
    let startChunk = 0;
    const savedState = _loadUploadState(file, subfolder, targetType, targetId);

    if (savedState) {
      // Resume from saved state
      uploadId = savedState.uploadId;
      startChunk = savedState.chunkIndex;
      console.log(`Resuming upload ${uploadId} from chunk ${startChunk}`);
    } else {
      // 1. Init new session
      const initRes = await apiRequest<{ uploadId: string }>('/api/upload/chunked/init', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          total_size: file.size,
          subfolder: subfolder || 'assignments',
          target_type: targetType || null,
          target_id: targetId || null,
        }),
      });
      uploadId = initRes.uploadId;
    }

    // 2. Send chunks with adaptive sizing (byte-offset based to avoid index*size miscalculation)
    let chunkSize = INITIAL_CHUNK_SIZE;
    let bytesSent = savedState?.bytesSent ?? 0;
    let chunkIdx = startChunk;
    const uploadStartTime = Date.now();
    let firstBatchDone = false;

    const sendChunkAt = async (offset: number, idx: number): Promise<number> => {
      if (aborted) throw new Error('업로드가 취소되었습니다.');
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end);
      const size = end - offset;

      const formData = new FormData();
      formData.append('file', chunk, `chunk_${idx}`);

      const token = getToken();
      const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let retries = 0;
      const MAX_RETRIES = 5;
      while (true) {
        try {
          const res = await fetch(`${API_URL}/api/upload/chunked/${uploadId}`, {
            method: 'POST',
            headers,
            body: formData,
          });
          if (res.status === 401) {
            clearAuth();
            throw new Error('세션이 만료되었습니다.');
          }
          if (res.status === 404) {
            _clearUploadState();
            throw new Error('업로드 세션이 만료되었습니다. 다시 시도해주세요.');
          }
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: '업로드에 실패했습니다.' }));
            throw new Error(err.detail || '업로드에 실패했습니다.');
          }
          break;
        } catch (e: any) {
          retries++;
          if (retries >= MAX_RETRIES || aborted || e.message?.includes('세션') || e.message?.includes('만료')) throw e;
          await new Promise(r => setTimeout(r, Math.min(retries * 1000 * retries, 8000) + Math.random() * 500));
        }
      }

      bytesSent += size;
      _saveUploadState({
        uploadId,
        filename: file.name,
        fileSize: file.size,
        chunkIndex: idx + 1,
        bytesSent,
        subfolder: subfolder || 'assignments',
        targetType,
        targetId,
        timestamp: Date.now(),
      });
      if (onProgress) {
        onProgress(Math.round((bytesSent / file.size) * 95));
      }
      notifySW('upload_progress');
      return size;
    };

    // Send chunks in parallel batches with adaptive sizing
    while (bytesSent < file.size) {
      if (aborted) throw new Error('업로드가 취소되었습니다.');

      // Adapt chunk size after first batch based on measured speed
      if (firstBatchDone && chunkSize === INITIAL_CHUNK_SIZE) {
        const elapsed = (Date.now() - uploadStartTime) / 1000;
        if (elapsed > 0) {
          const speedMbps = (bytesSent * 8) / (elapsed * 1_000_000);
          if (speedMbps > 25) chunkSize = MAX_CHUNK_SIZE;
          else if (speedMbps > 10) chunkSize = 5 * 1024 * 1024;
        }
      }

      // Build batch with correct byte offsets (fewer parallel for large files)
      const parallel = file.size > LARGE_FILE_THRESHOLD ? LARGE_FILE_PARALLEL : PARALLEL_CHUNKS;
      const batch = [];
      let batchOffset = bytesSent;
      for (let j = 0; j < parallel && batchOffset < file.size; j++) {
        const offset = batchOffset;
        const idx = chunkIdx++;
        batch.push(sendChunkAt(offset, idx));
        batchOffset += chunkSize;
      }
      await Promise.all(batch);
      firstBatchDone = true;
    }

    // 3. Complete
    const result = await apiRequest<{ url: string; filename: string; thumbnailUrl?: string }>(
      `/api/upload/chunked/${uploadId}/complete`,
      { method: 'POST' },
    );
    if (onProgress) onProgress(100);

    // Clear saved state on success
    _clearUploadState();
    notifySW('upload_complete');
    releaseWakeLock();
    return result;
  })().catch((e) => {
    notifySW('upload_complete');
    releaseWakeLock();
    throw e;
  });

  (promise as any).abort = () => {
    aborted = true;
    _clearUploadState();
  };
  return promise as Promise<{ url: string; filename: string; thumbnailUrl?: string }> & { abort: () => void };
}

// --- Upload state persistence for resume ---

interface UploadState {
  uploadId: string;
  filename: string;
  fileSize: number;
  chunkIndex: number;
  bytesSent: number;
  subfolder: string;
  targetType?: string;
  targetId?: string;
  timestamp: number;
}

function _saveUploadState(state: UploadState) {
  try {
    localStorage.setItem(UPLOAD_STATE_KEY, JSON.stringify(state));
  } catch { /* localStorage full or unavailable */ }
}

function _loadUploadState(
  file: File,
  subfolder?: string,
  targetType?: string,
  targetId?: string,
): UploadState | null {
  try {
    const raw = localStorage.getItem(UPLOAD_STATE_KEY);
    if (!raw) return null;
    const state: UploadState = JSON.parse(raw);

    // Validate: same file + same target, not too old (1 hour max)
    if (
      state.filename !== file.name ||
      state.fileSize !== file.size ||
      state.subfolder !== (subfolder || 'assignments') ||
      state.targetType !== targetType ||
      state.targetId !== targetId ||
      Date.now() - state.timestamp > 2 * 60 * 60 * 1000
    ) {
      _clearUploadState();
      return null;
    }

    return state;
  } catch {
    _clearUploadState();
    return null;
  }
}

function _clearUploadState() {
  try { localStorage.removeItem(UPLOAD_STATE_KEY); } catch {}
}

// --- Push Notification API ---
export const pushApi = {
  getVapidPublicKey(): Promise<{ publicKey: string }> {
    return apiRequest('/api/push/vapid-public-key');
  },
  subscribe(endpoint: string, p256dh: string, auth: string): Promise<{ ok: boolean }> {
    return apiRequest('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint, p256dh, auth }),
    });
  },
  unsubscribe(endpoint: string, p256dh: string, auth: string): Promise<{ ok: boolean }> {
    return apiRequest('/api/push/unsubscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint, p256dh, auth }),
    });
  },
};

export const praiseStickerApi = {
  list(recipientId?: string): Promise<import('../types').PraiseSticker[]> {
    const params = recipientId ? `?recipient_id=${recipientId}` : '';
    return apiRequest(`/api/praise-stickers/${params}`);
  },
  create(data: { recipientId: string; emoji: string; message: string }): Promise<import('../types').PraiseSticker> {
    return apiRequest('/api/praise-stickers/', {
      method: 'POST',
      body: JSON.stringify(toSnake(data)),
    });
  },
  delete(id: string): Promise<void> {
    return apiRequest(`/api/praise-stickers/${id}`, { method: 'DELETE' });
  },
};

/**
 * Register the browser for Web Push notifications.
 * Safe to call multiple times — no-ops if already subscribed or not supported.
 *
 * On auto-login: only subscribes if permission is already 'granted' (no popup).
 * From settings page: call with requestPermission=true to show the permission prompt
 * (must be triggered by user gesture on iOS).
 */
export async function registerPushSubscription(requestPermission = false): Promise<void> {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    if (requestPermission) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    } else {
      if (Notification.permission !== 'granted') return;
    }

    const reg = await navigator.serviceWorker.ready;

    const { publicKey } = await pushApi.getVapidPublicKey();
    if (!publicKey) return;

    // Convert VAPID public key from URL-safe base64 to Uint8Array
    const rawKey = atob(publicKey.replace(/-/g, '+').replace(/_/g, '/'));
    const applicationServerKey = new Uint8Array(rawKey.length);
    for (let i = 0; i < rawKey.length; i++) {
      applicationServerKey[i] = rawKey.charCodeAt(i);
    }

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const subJson = subscription.toJSON();
    if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
      await pushApi.subscribe(subJson.endpoint, subJson.keys.p256dh, subJson.keys.auth);
    }
  } catch (err) {
    console.warn('Push subscription failed:', err);
  }
}

/**
 * Unregister push subscription from server (call on logout).
 */
export async function unregisterPushSubscription(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return;
    const subJson = subscription.toJSON();
    if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
      await pushApi.unsubscribe(subJson.endpoint, subJson.keys.p256dh, subJson.keys.auth);
    }
    await subscription.unsubscribe();
  } catch (err) {
    console.warn('Push unsubscription failed:', err);
  }
}

// ── Demo mode override ──
if (DEMO_MODE) {
  Object.assign(authApi, demoAuthApi);
  Object.assign(userApi, demoUserApi);
  Object.assign(classApi, demoClassApi);
  Object.assign(lessonApi, demoLessonApi);
  Object.assign(assignmentApi, demoAssignmentApi);
  Object.assign(dietApi, demoDietApi);
  Object.assign(noticeApi, demoNoticeApi);
  Object.assign(notificationApi, demoNotificationApi);
  Object.assign(journalApi, demoJournalApi);
  Object.assign(attendanceApi, demoAttendanceApi);
  Object.assign(qnaApi, demoQnaApi);
  Object.assign(evaluationApi, demoEvaluationApi);
  Object.assign(portfolioApi, demoPortfolioApi);
  Object.assign(auditionApi, demoAuditionApi);
  Object.assign(chatApi, demoChatApi);
  Object.assign(privateLessonApi, demoPrivateLessonApi);
  Object.assign(uploadApi, demoUploadApi);
  console.log('%c[SOL-ACT] Demo mode active — using mock data', 'color: #F59E0B; font-weight: bold;');
}
