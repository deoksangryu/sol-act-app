
export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  DIRECTOR = 'director' // 학원주/원장
}

export type ViewState = 'dashboard' | 'lessons' | 'assignments' | 'growth' | 'diet' | 'community' | 'academy';

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
  avatar: string;
  email: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  important: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  studentId: string;
  studentName: string;
  status: 'pending' | 'submitted' | 'graded';
  submissionText?: string;
  submissionFileUrl?: string; // Mock URL
  feedback?: string;
  aiAnalysis?: string;
  grade?: string;
}

export interface DietLog {
  id: string;
  studentId: string;
  studentName: string;
  date: string; // ISO date string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  calories?: number;
  aiAdvice?: string;
  imageUrl?: string;
}

export interface Answer {
  id: string;
  content: string;
  authorName: string;
  authorRole: UserRole | 'AI';
  date: string;
  isAi?: boolean;
}

export interface Question {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  date: string;
  answers: Answer[];
  views: number;
}

export interface ClassInfo {
  id: string;
  name: string;
  description: string;
  subjectTeachers: Partial<Record<Subject, string>>; // 과목별 담당 교사 ID
  studentIds: string[];
  schedule: string; // e.g. "Mon/Wed 14:00"
}

export interface ChatMessage {
  id: string;
  classId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: string;
  avatar: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning';
  message: string;
  date: string;
  read: boolean;
}

// === 수업 관련 ===

export interface Lesson {
  id: string;
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
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

export interface LessonJournal {
  id: string;
  lessonId: string;
  authorId: string;
  authorName: string;
  journalType: 'teacher' | 'student';
  content: string;
  objectives?: string;
  nextPlan?: string;
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

// === 성장 기록 관련 ===

export interface Evaluation {
  id: string;
  studentId: string;
  studentName: string;
  evaluatorId: string;
  evaluatorName: string;
  classId: string;
  className: string;
  subject: Subject;
  period: string; // 예: "2024년 1월"
  scores: {
    acting: number;      // 연기력 1-5
    expression: number;  // 표현력 1-5
    creativity: number;  // 창의성 1-5
    teamwork: number;    // 협동심 1-5
    effort: number;      // 성실도 1-5
  };
  comment: string;
  date: string;
}

export interface PrivateLessonRequest {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  subject: Subject;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  responseNote?: string;
  createdAt: string;
  respondedAt?: string;
}

export interface PortfolioComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  date: string;
}

export interface PortfolioItem {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  description: string;
  videoUrl: string;
  category: string; // 예: 독백, 장면연기, 뮤지컬
  tags: string[];
  comments: PortfolioComment[];
  date: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface CompetitionEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  description?: string;
  creatorId: string;
  checklist: ChecklistItem[];
  aiPrepTips?: string;
}
