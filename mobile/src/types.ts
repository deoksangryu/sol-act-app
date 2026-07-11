// Core domain types (ported from web app types.ts). Expand per-screen as needed.
// NOTE: the API client camelCases all server keys, so snake fields like
// `enrolled_class_ids` arrive as `enrolledClassIds`.

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  DIRECTOR = 'director', // 학원주/원장
}

export enum Subject {
  ACTING = 'acting',
  MUSICAL = 'musical',
  DANCE = 'dance',
}

export const SUBJECT_LABELS: Record<Subject, string> = {
  [Subject.ACTING]: '연기',
  [Subject.MUSICAL]: '뮤지컬',
  [Subject.DANCE]: '무용',
};

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
  email: string;
  height?: number; // 키 cm (프로필)
  // 배정된 반 — 학생이고 빈 배열이면 '반배정 대기'(서비스 차단). 없으면 게이트 미적용(백엔드 403 위임).
  enrolledClassIds?: string[];
}

export interface ScheduleSlot {
  day: string; // '월'..'일'
  startTime: string;
  endTime: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  description?: string;
  subject?: Subject;
  subjectTeachers?: Partial<Record<Subject, string>>;
  studentIds: string[];
  schedule?: ScheduleSlot[] | string;
}

// 6탭 하단바 id (역할별 콘텐츠 분기는 각 탭 내부에서).
export type TabId = 'classes' | 'plan' | 'video' | 'practice' | 'diet' | 'music';

// === 학습 계획(주간/하루) ===
export interface PlanItem {
  id: string;
  content: string;
  done: boolean;
  sortOrder: number;
}

export interface Plan {
  id: string;
  studentId: string;
  studentName: string;
  planType: 'daily' | 'weekly';
  planDate: string; // YYYY-MM-DD (weekly = 그 주 월요일)
  teacherComment?: string;
  items: PlanItem[];
  totalCount: number;
  doneCount: number;
  progress: number; // 0~100
  createdAt: string;
  updatedAt: string;
}

// === 수업 / 일지 / 출결 ===
export interface Lesson {
  id: string;
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  location: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  subject: Subject;
  memo?: string;
  teacherId: string;
  teacherName: string;
  isPrivate: boolean;
  privateStudentIds?: string[];
  requestId?: string;
}

export interface MediaItem {
  url: string;
  name: string;
  thumbnail?: string;
}

export interface JournalComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface LessonJournal {
  id: string;
  lessonId: string;
  authorId: string;
  authorName: string;
  journalType: 'teacher' | 'student';
  content: string;
  objectives?: string;
  nextPlan?: string;
  mediaUrls?: MediaItem[];
  comments?: JournalComment[];
  date: string;
}

export interface AttendanceRecord {
  id: string;
  lessonId: string;
  studentId: string;
  studentName: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  note?: string;
}

// === 공지 / 알림 ===
export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  important: boolean;
  classId?: string;
  targetClassIds?: string[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning';
  message: string;
  date: string;
  read: boolean;
}

// === 포트폴리오(연기영상) ===
export interface PortfolioComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestampSec?: number;
  date: string;
}

export interface PortfolioItem {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  uploadStatus?: 'ready' | 'uploading' | 'failed';
  category: string;
  tags: string[];
  practiceGroup?: string;
  practiceScriptId?: string;
  videoDuration?: number;
  comments: PortfolioComment[];
  videos?: any[];
  attachments?: any[];
  date: string;
}

// === 영상 피드 카드 ===
export interface FeedCard {
  key: string;
  kind: 'group' | 'single';
  title: string;
  studentId: string;
  studentName: string;
  count: number;
  pendingFeedback: number;
  coverThumbnail?: string;
  date: string;
  uploadStatus?: 'ready' | 'uploading' | 'failed';
  portfolio?: PortfolioItem;
}

// === 제시대사 ===
export interface PracticeLine { speaker: string; text: string }
export interface PracticeScriptView { id: string; type: string; script: PracticeLine[] }
export interface PracticePerformance {
  portfolioId: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  uploadStatus: 'ready' | 'uploading' | 'failed';
  commentCount: number;
  hasFeedback: boolean;
}
export interface PracticeCurrent {
  current: PracticeScriptView | null;
  performance: PracticePerformance | null;
  canDrawNew: boolean;
  cooldownSecondsRemaining: number;
  nextDrawAt: string | null;
  drawnAt: string | null;
  totalScripts: number;
  seenCount: number;
  exhausted: boolean;
}
