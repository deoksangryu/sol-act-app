
export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  DIRECTOR = 'director' // 학원주/원장
}

// v8 프로토타입 5탭 IA + 보조 화면. (레거시 값은 숨김 기능 복원용으로 유지)
// 학생은 'video' 대신 'practice'(제시대사) 탭을 본다(역할별 분기 — MobileNav).
export type ViewState =
  | 'classes' | 'assignments' | 'video' | 'practice' | 'diet' | 'music' | 'profile'
  | 'dashboard' | 'lessons' | 'growth' | 'community' | 'academy';

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

// 제시대사 연습 — 학생 노출은 대사(script)와 형식만. 상황·감정·연기포인트는 숨김(직접 분석).
export interface PracticeLine {
  speaker: string;
  text: string;
}
export interface PracticeScriptView {
  id: string;
  type: string;            // 독백 / 2인대사 / 보고읽기 / 지정연기
  script: PracticeLine[];
}
// 현재 제시대사에 학생이 올린 연기영상(선택) — 업로드/피드백 상태
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
  performance: PracticePerformance | null;   // 현재 대사에 올린 연기영상(없으면 null)
  canDrawNew: boolean;
  cooldownSecondsRemaining: number;
  nextDrawAt: string | null;
  drawnAt: string | null;
  totalScripts: number;
  seenCount: number;
  exhausted: boolean;       // 전부 소진 → '더 요청하기' 노출
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  email: string;
  height?: number;   // 키 cm (프로필)
  enrolled_class_ids?: string[];   // 배정된 반 — 학생이고 빈 배열이면 '반배정 대기'(서비스 차단)
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  important: boolean;
  classId?: string;
  targetClassIds?: string[];   // 대상 반들 / 없거나 [] = 전체 공지
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  studentId: string;
  studentName: string;
  status: 'pending' | 'submitted' | 'graded';
  attachmentUrl?: string;
  submissionText?: string;
  submissionFileUrl?: string; // Mock URL
  feedback?: string;
  aiAnalysis?: string;
  grade?: string;
  assignedBy?: string;
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
  teacherComment?: string;
  imageUrl?: string;
}

export interface Answer {
  id: string;
  content: string;
  authorId: string;
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

export interface ScheduleSlot {
  day: string;       // '월' | '화' | '수' | '목' | '금' | '토' | '일'
  startTime: string; // 'HH:mm'
  endTime: string;   // 'HH:mm'
}

export interface ClassInfo {
  id: string;
  name: string;
  description: string;
  subjectTeachers: Partial<Record<Subject, string>>; // 과목별 담당 교사 ID
  studentIds: string[];
  schedule: ScheduleSlot[] | string; // structured or legacy string
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
  timestampSec?: number;
  date: string;
}

export interface PortfolioVideoItem {
  id: string;
  portfolioId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  sortOrder: number;
  createdAt: string;
}

export interface PortfolioItem {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;   // 커버 영상 썸네일
  uploadStatus?: 'ready' | 'uploading' | 'failed';  // 백엔드 파생(없으면 클라가 생성나이로 추정)
  category: string;
  tags: string[];
  practiceGroup?: string;
  practiceScriptId?: string;   // 제시대사 연결(category=scripted)
  videoDuration?: number;
  comments: PortfolioComment[];
  videos?: PortfolioVideoItem[];
  attachments?: PortfolioAttachmentItem[];
  date: string;
}

// 영상 탭 피드 카드 — group(연습묶음) 또는 single(단일/묶기 1포트폴리오)
export interface FeedCard {
  key: string;
  kind: 'group' | 'single';
  title: string;
  studentId: string;
  studentName: string;
  count: number;
  pendingFeedback: number;    // ready인데 코멘트 0개인 멤버 수(피드백 필요)
  coverThumbnail?: string;
  date: string;               // 대표(최신) 생성일
  uploadStatus?: 'ready' | 'uploading' | 'failed';
  portfolio?: PortfolioItem;  // kind=single일 때만(상세 즉시 오픈)
}

export interface PortfolioAttachmentItem {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  createdAt: string;
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
  registrationStart?: string;  // 접수 시작일 (YYYY-MM-DD)
  registrationEnd?: string;    // 접수 마감일 (YYYY-MM-DD)
  checklist: ChecklistItem[];
  aiPrepTips?: string;
}

export interface PraiseSticker {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  emoji: string;
  message: string;
  createdAt: string;
}

// === 음악 (무용 음악 라이브러리) ===

export type MusicRequestStatus = 'pending' | 'approved' | 'rejected';

/** 학생 본인의 다운로드 요청 상태 (트랙 응답에 임베드) */
export interface MyMusicRequest {
  id: string;
  status: MusicRequestStatus;
  purpose: string;
  responseNote?: string | null;
  createdAt: string;
  respondedAt?: string | null;
}

export interface Track {
  id: string;
  title: string;
  category: string;       // 장르 (시네마틱 / 컨템포러리 / 국악퓨전 등)
  mood?: string | null;
  duration?: string | null; // "M:SS"
  fileUrl?: string | null;   // 학생에겐 null (정적 경로 비노출)
  streamUrl?: string | null; // 서명된 인앱 청취 스트림(전원)
  thumbnailUrl?: string | null;
  createdAt: string;
  myRequest?: MyMusicRequest | null; // 학생 관점
  pendingCount?: number;             // 선생님 관점: 승인 대기 수
}

export interface MusicDownloadRequest {
  id: string;
  trackId: string;
  trackTitle: string;
  studentId: string;
  studentName: string;
  purpose: string;
  status: MusicRequestStatus;
  responseNote?: string | null;
  createdAt: string;
  respondedAt?: string | null;
}

/** 음원 다운로드 요청 목적 칩 (SPEC 6-6) */
export const MUSIC_PURPOSES = ['자유무용 입시 연습', '워크숍 준비', '콩쿠르 준비', '수업 복습'] as const;
