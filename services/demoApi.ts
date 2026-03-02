/**
 * Demo mode API — returns mock data without any backend connection.
 * Activated by VITE_DEMO_MODE=true in .env
 */
import type {
  User, ClassInfo, Lesson, LessonJournal, AttendanceRecord,
  Assignment, DietLog, Evaluation, Question, Answer,
  ChatMessage, Notice, Notification, PortfolioItem, PortfolioComment,
  CompetitionEvent, PrivateLessonRequest,
} from '../types';
import {
  DEMO_USERS, DEMO_CLASSES, DEMO_LESSONS, DEMO_ASSIGNMENTS,
  DEMO_DIETS, DEMO_NOTICES, DEMO_NOTIFICATIONS, DEMO_QUESTIONS,
  DEMO_EVALUATIONS, DEMO_PORTFOLIOS, DEMO_AUDITIONS,
  DEMO_PRIVATE_REQUESTS, DEMO_CHAT_MESSAGES, DEMO_ACCOUNTS,
} from './mockData';

// Simulate network delay
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

let currentUser: User | null = null;

// ── In-memory mutable stores (so demo actions persist during session) ──
let assignments = [...DEMO_ASSIGNMENTS];
let lessons = [...DEMO_LESSONS];
let diets = [...DEMO_DIETS];
let notices = [...DEMO_NOTICES];
let notifications = [...DEMO_NOTIFICATIONS];
let questions = [...DEMO_QUESTIONS];
let portfolios = [...DEMO_PORTFOLIOS];
let messages = [...DEMO_CHAT_MESSAGES];
let privateRequests = [...DEMO_PRIVATE_REQUESTS];
let nextId = 100;
const genId = (prefix: string) => `${prefix}${++nextId}`;

export const demoAuthApi = {
  async login(email: string, _password: string) {
    await delay();
    const account = Object.values(DEMO_ACCOUNTS).find(a => a.email === email);
    if (!account) throw new Error('데모 계정을 찾을 수 없습니다. (student@muse.com / teacher@muse.com / director@muse.com)');
    currentUser = account.user;
    return { accessToken: 'demo-token', tokenType: 'bearer', user: account.user };
  },
  async register(data: any) {
    await delay();
    const user: User = { id: genId('u'), name: data.name, email: data.email, role: data.role, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}` };
    DEMO_USERS.push(user);
    return user;
  },
};

export const demoUserApi = {
  async list() { await delay(100); return [...DEMO_USERS]; },
  async get(id: string) { await delay(100); return DEMO_USERS.find(u => u.id === id)!; },
  async update(id: string, data: Partial<User>) {
    await delay();
    const u = DEMO_USERS.find(u => u.id === id);
    if (u) Object.assign(u, data);
    return u!;
  },
  async changePassword() { await delay(); return { message: '비밀번호가 변경되었습니다.' }; },
};

export const demoClassApi = {
  async list() { await delay(100); return [...DEMO_CLASSES]; },
  async get(id: string) { await delay(100); return DEMO_CLASSES.find(c => c.id === id)!; },
  async create(data: any) { await delay(); const c = { id: genId('cls'), ...data, studentIds: [] }; DEMO_CLASSES.push(c); return c; },
  async update(id: string, data: any) { await delay(); const c = DEMO_CLASSES.find(c => c.id === id); if (c) Object.assign(c, data); return c!; },
  async delete(id: string) { await delay(); const i = DEMO_CLASSES.findIndex(c => c.id === id); if (i >= 0) DEMO_CLASSES.splice(i, 1); },
  async addStudent(classId: string, studentId: string) { await delay(); const c = DEMO_CLASSES.find(c => c.id === classId); if (c) c.studentIds.push(studentId); return c!; },
  async removeStudent(classId: string, studentId: string) { await delay(); const c = DEMO_CLASSES.find(c => c.id === classId); if (c) c.studentIds = c.studentIds.filter(id => id !== studentId); return c!; },
};

export const demoLessonApi = {
  async list() { await delay(100); return [...lessons]; },
  async get(id: string) { await delay(100); return lessons.find(l => l.id === id)!; },
  async create(data: any) { await delay(); const l = { id: genId('lsn'), ...data, createdAt: new Date().toISOString() } as any; lessons.push(l); return l; },
  async update(id: string, data: any) { await delay(); const l = lessons.find(l => l.id === id); if (l) Object.assign(l, data); return l!; },
  async complete(id: string) { await delay(); const l = lessons.find(l => l.id === id); if (l) l.status = 'completed' as any; return l!; },
  async cancel(id: string) { await delay(); const l = lessons.find(l => l.id === id); if (l) l.status = 'cancelled' as any; return l!; },
  async delete(id: string) { await delay(); lessons = lessons.filter(l => l.id !== id); },
  async createBulk(data: any) { await delay(); return []; },
};

export const demoAssignmentApi = {
  async list(params?: any) { await delay(100); let result = [...assignments]; if (params?.studentId) result = result.filter(a => a.studentId === params.studentId); if (params?.assignedBy) result = result.filter(a => (a as any).assignedBy === params.assignedBy); return result; },
  async get(id: string) { await delay(100); return assignments.find(a => a.id === id)!; },
  async create(data: any) { await delay(); const a = { id: genId('asgn'), ...data, status: 'pending' } as any; assignments.push(a); return a; },
  async update(id: string, data: any) { await delay(); const a = assignments.find(a => a.id === id); if (a) Object.assign(a, data); return a!; },
  async submit(id: string, data: any) { await delay(); const a = assignments.find(a => a.id === id); if (a) { a.status = 'submitted' as any; Object.assign(a, data); } return a!; },
  async grade(id: string, data: any) { await delay(); const a = assignments.find(a => a.id === id); if (a) { a.status = 'graded' as any; Object.assign(a, data); } return a!; },
  async analyze(id: string) { await delay(500); return { analysis: '이 독백은 감정의 깊이가 잘 표현되어 있습니다. 특히 중반부의 감정 전환이 인상적입니다.' }; },
  async delete(id: string) { await delay(); assignments = assignments.filter(a => a.id !== id); },
};

export const demoDietApi = {
  async list(_params?: any) { await delay(100); return [...diets]; },
  async create(data: any) { await delay(); const d = { id: genId('diet'), ...data, studentName: currentUser?.name || '' } as any; diets.push(d); return d; },
  async update(id: string, data: any) { await delay(); const d = diets.find(d => d.id === id); if (d) Object.assign(d, data); return d!; },
  async delete(id: string) { await delay(); diets = diets.filter(d => d.id !== id); },
  async analyze(data: any) { await delay(500); return { calories: Math.floor(Math.random() * 500 + 200), advice: '성대 건강에 좋은 식단입니다!' }; },
};

export const demoNoticeApi = {
  async list() { await delay(100); return [...notices]; },
  async create(data: any) { await delay(); const n = { id: genId('ntc'), ...data, date: new Date().toISOString() } as any; notices.unshift(n); return n; },
  async update(id: string, data: any) { await delay(); const n = notices.find(n => n.id === id); if (n) Object.assign(n, data); return n!; },
  async delete(id: string) { await delay(); notices = notices.filter(n => n.id !== id); },
};

export const demoNotificationApi = {
  async list() { await delay(100); return [...notifications]; },
  async markRead(id: string) { await delay(); const n = notifications.find(n => n.id === id); if (n) n.read = true; return n!; },
  async markAllRead() { await delay(); notifications.forEach(n => n.read = true); },
};

const demoJournals: any[] = [
  { id: 'jrn001', lessonId: 'lsn003', authorId: 't1', authorName: '최선생', journalType: 'teacher', content: '오늘 햄릿 독백 발표를 진행했습니다. 김배우 학생의 감정 표현이 눈에 띄게 좋아졌고, 이연기 학생은 발성에 좀 더 집중이 필요합니다.', objectives: '독백 발표 및 피드백', nextPlan: '다음 시간에는 2인 장면 연기를 진행할 예정입니다.', date: yesterday },
  { id: 'jrn002', lessonId: 'lsn003', authorId: 's1', authorName: '김배우', journalType: 'student', content: '선생님의 피드백 덕분에 감정 전환 부분이 많이 좋아진 것 같습니다. 호흡 조절에 더 신경 써야겠습니다.', date: yesterday },
  { id: 'jrn003', lessonId: 'lsn001', authorId: 't1', authorName: '최선생', journalType: 'teacher', content: '오늘 수업에서는 즉흥 연기와 감정 표현 훈련을 진행했습니다.', objectives: '즉흥 연기 훈련', date: today },
];

export const demoJournalApi = {
  async list(params?: any) { await delay(100); let result = [...demoJournals]; if (params?.lessonId) result = result.filter(j => j.lessonId === params.lessonId); if (params?.authorId) result = result.filter(j => j.authorId === params.authorId); return result; },
  async create(data: any) { await delay(); return { id: genId('jrn'), ...data, authorName: currentUser?.name || '', date: new Date().toISOString() } as any; },
  async update(id: string, data: any) { await delay(); return { id, ...data } as any; },
  async getAiFeedback(id: string) { await delay(500); return { aiFeedback: '수업 내용이 체계적으로 잘 정리되어 있습니다. 다음 시간에는 감정 표현에 더 집중해보세요.' }; },
};

export const demoAttendanceApi = {
  async list(_params?: any) { await delay(100); return [] as AttendanceRecord[]; },
  async create(data: any) { await delay(); return { id: genId('att'), ...data } as any; },
  async update(id: string, data: any) { await delay(); return { id, ...data } as any; },
  async bulkCreate(data: any) { await delay(); return []; },
  async getStats(_params?: any) { await delay(); return []; },
};

export const demoQnaApi = {
  async listQuestions() { await delay(100); return [...questions]; },
  async getQuestion(id: string) { await delay(100); const q = questions.find(q => q.id === id); if (q) q.views++; return q!; },
  async createQuestion(data: any) { await delay(); const q = { id: genId('q'), ...data, authorId: currentUser?.id || '', authorName: currentUser?.name || '', views: 0, answers: [], date: new Date().toISOString() } as any; questions.unshift(q); return q; },
  async createAnswer(questionId: string, data: any) { await delay(); const a = { id: genId('ans'), content: data.content, authorName: currentUser?.name || '', authorRole: currentUser?.role || '', isAi: false, date: new Date().toISOString() } as any; const q = questions.find(q => q.id === questionId); q?.answers.push(a); return a; },
  async getAiAnswer(questionId: string) { await delay(800); const a = { id: genId('ans'), content: 'AI 튜터: 좋은 질문이에요! 연기에서 가장 중요한 것은 진정성입니다.', authorName: 'AI 튜터', authorRole: 'AI', isAi: true, date: new Date().toISOString() } as any; const q = questions.find(q => q.id === questionId); q?.answers.push(a); return a; },
  async deleteQuestion(id: string) { await delay(); questions = questions.filter(q => q.id !== id); },
  async deleteAnswer(id: string) { await delay(); questions.forEach(q => { q.answers = q.answers.filter((a: any) => a.id !== id); }); },
};

export const demoEvaluationApi = {
  async list(_params?: any) { await delay(100); return [...DEMO_EVALUATIONS]; },
  async get(id: string) { await delay(100); return DEMO_EVALUATIONS.find(e => e.id === id)!; },
  async create(data: any) { await delay(); const e = { id: genId('eval'), ...data, date: new Date().toISOString() } as any; DEMO_EVALUATIONS.push(e); return e; },
  async update(id: string, data: any) { await delay(); const e = DEMO_EVALUATIONS.find(e => e.id === id); if (e) Object.assign(e, data); return e!; },
  async delete(id: string) { await delay(); },
  async getReport(studentId: string) { await delay(500); return { studentId, studentName: '김배우', evaluations: DEMO_EVALUATIONS, aiReport: '전반적으로 성장세가 뚜렷합니다.' }; },
  async getAiSummary(id: string) { await delay(500); return { aiSummary: '표현력이 뛰어나며 지속적인 성장이 관찰됩니다.' }; },
};

export const demoPortfolioApi = {
  async list(_params?: any) { await delay(100); return [...portfolios]; },
  async get(id: string) { await delay(100); return portfolios.find(p => p.id === id)!; },
  async create(data: any) { await delay(); const p = { id: genId('ptf'), ...data, studentId: currentUser?.id || '', studentName: currentUser?.name || '', comments: [], date: new Date().toISOString() } as any; portfolios.push(p); return p; },
  async update(id: string, data: any) { await delay(); const p = portfolios.find(p => p.id === id); if (p) Object.assign(p, data); return p!; },
  async addComment(portfolioId: string, content: string, timestampSec?: number) { await delay(); const c = { id: genId('pcmt'), authorId: currentUser?.id || '', authorName: currentUser?.name || '', content, timestampSec, date: new Date().toISOString() } as any; const p = portfolios.find(p => p.id === portfolioId); p?.comments.push(c); return c; },
  async getAiFeedback(id: string) { await delay(500); return { aiFeedback: '감정 전달이 자연스럽고 대사의 리듬감이 좋습니다.' }; },
  async delete(id: string) { await delay(); portfolios = portfolios.filter(p => p.id !== id); },
  async listPracticeGroups(studentId?: string) { await delay(100); const groups: Record<string, any> = {}; portfolios.filter(p => p.practiceGroup && (!studentId || p.studentId === studentId)).forEach(p => { if (!groups[p.practiceGroup!]) groups[p.practiceGroup!] = { groupName: p.practiceGroup, items: [] }; groups[p.practiceGroup!].items.push(p); }); return Object.values(groups); },
};

export const demoAuditionApi = {
  async list(_params?: any) { await delay(100); return [...DEMO_AUDITIONS]; },
  async get(id: string) { await delay(100); return DEMO_AUDITIONS.find(a => a.id === id)!; },
  async create(data: any) { await delay(); const a = { id: genId('aud'), ...data, checklist: [], createdAt: new Date().toISOString() } as any; DEMO_AUDITIONS.push(a); return a; },
  async update(id: string, data: any) { await delay(); const a = DEMO_AUDITIONS.find(a => a.id === id); if (a) Object.assign(a, data); return a!; },
  async delete(id: string) { await delay(); },
  async addChecklist(auditionId: string, data: any) { await delay(); return { id: genId('achk'), ...data, completed: false }; },
  async updateChecklist(auditionId: string, checklistId: string, data: any) { await delay(); return { id: checklistId, ...data }; },
  async deleteChecklist(auditionId: string, checklistId: string) { await delay(); },
  async generateTips(id: string) { await delay(500); return { tips: '1. 자신감 있는 자세로 입장하세요\n2. 대사를 완벽히 암기하세요\n3. 감정에 충실하세요' }; },
};

export const demoChatApi = {
  async list(classId: string) { await delay(100); return messages.filter(m => m.classId === classId); },
  async send(data: any) { await delay(); const m = { id: genId('msg'), ...data, senderId: currentUser?.id || '', senderName: currentUser?.name || '', senderRole: currentUser?.role || '', avatar: currentUser?.avatar || '', timestamp: new Date().toISOString() } as any; messages.push(m); return m; },
  async lastMessages(classIds: string[]) { await delay(100); const result: Record<string, any> = {}; classIds.forEach(cid => { const last = messages.filter(m => m.classId === cid).pop(); if (last) result[cid] = last; }); return result; },
  async markRead(_classId: string) { await delay(); },
  async unreadCounts(_classIds: string[]) { await delay(100); return {} as Record<string, number>; },
};

export const demoPrivateLessonApi = {
  async list(_params?: any) { await delay(100); return [...privateRequests]; },
  async create(data: any) { await delay(); const r = { id: genId('plr'), ...data, status: 'pending', createdAt: new Date().toISOString() } as any; privateRequests.push(r); return r; },
  async respond(id: string, data: any) { await delay(); const r = privateRequests.find(r => r.id === id); if (r) { r.status = data.status; } return r!; },
  async delete(id: string) { await delay(); privateRequests = privateRequests.filter(r => r.id !== id); },
};

export const demoUploadApi = {
  upload(_file: File, onProgress?: (pct: number) => void): Promise<{ url: string; filename: string }> {
    return new Promise(resolve => {
      let pct = 0;
      const interval = setInterval(() => {
        pct += 20;
        onProgress?.(Math.min(pct, 100));
        if (pct >= 100) {
          clearInterval(interval);
          resolve({ url: '/demo/uploaded-file.mp4', filename: 'demo-file.mp4' });
        }
      }, 200);
    });
  },
};
