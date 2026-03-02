/**
 * Mock data for demo mode (VITE_DEMO_MODE=true).
 * Provides realistic sample data so the frontend works without a backend.
 */
import type {
  User, ClassInfo, Lesson, LessonJournal, AttendanceRecord,
  Assignment, DietLog, Evaluation, Question, Answer,
  ChatMessage, Notice, Notification, PortfolioItem, CompetitionEvent,
  PrivateLessonRequest,
} from '../types';
import { UserRole, Subject } from '../types';

// ── Users ──
export const DEMO_USERS: User[] = [
  { id: 's1', name: '김배우', email: 'student@muse.com', role: UserRole.STUDENT, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=s1' },
  { id: 's2', name: '이연기', email: 'lee@muse.com', role: UserRole.STUDENT, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=s2' },
  { id: 's3', name: '박무대', email: 'park@muse.com', role: UserRole.STUDENT, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=s3' },
  { id: 't1', name: '최선생', email: 'teacher@muse.com', role: UserRole.TEACHER, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=t1' },
  { id: 't2', name: '정코치', email: 'coach@muse.com', role: UserRole.TEACHER, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=t2' },
  { id: 'd1', name: '한원장', email: 'director@muse.com', role: UserRole.DIRECTOR, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=d1' },
];

const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

// ── Classes ──
export const DEMO_CLASSES: ClassInfo[] = [
  { id: 'c1', name: '입시 A반', description: '연기 입시 심화반', subjectTeachers: { acting: 't1', musical: 't2' } as any, schedule: '월/수/금 18:00', studentIds: ['s1', 's2', 's3'] },
  { id: 'c2', name: '뮤지컬반', description: '뮤지컬 전문반', subjectTeachers: { musical: 't2' } as any, schedule: '화/목 17:00', studentIds: ['s1', 's3'] },
];

// ── Lessons ──
export const DEMO_LESSONS: Lesson[] = [
  { id: 'lsn001', classId: 'c1', className: '입시 A반', date: today, startTime: '18:00', endTime: '20:00', location: '연습실 A', status: 'scheduled', subject: Subject.ACTING, teacherId: 't1', teacherName: '최선생', isPrivate: false },
  { id: 'lsn002', classId: 'c2', className: '뮤지컬반', date: today, startTime: '17:00', endTime: '19:00', location: '연습실 B', status: 'scheduled', subject: Subject.MUSICAL, teacherId: 't2', teacherName: '정코치', isPrivate: false },
  { id: 'lsn003', classId: 'c1', className: '입시 A반', date: yesterday, startTime: '18:00', endTime: '20:00', location: '연습실 A', status: 'completed', subject: Subject.ACTING, teacherId: 't1', teacherName: '최선생', isPrivate: false },
  { id: 'lsn004', classId: null as any, className: '개인 레슨', date: tomorrow, startTime: '10:00', endTime: '11:00', location: '개인 연습실', status: 'scheduled', subject: Subject.ACTING, teacherId: 't1', teacherName: '최선생', isPrivate: true, privateStudentIds: ['s1'] },
];

// ── Assignments ──
export const DEMO_ASSIGNMENTS: Assignment[] = [
  { id: 'asgn001', title: '햄릿 독백 연습', description: '셰익스피어 햄릿 3막 1장 독백을 녹화하여 제출하세요.', dueDate: tomorrow + 'T23:59:00', studentId: 's1', studentName: '김배우', status: 'pending' },
  { id: 'asgn002', title: '감정 표현 연습', description: '기쁨, 슬픔, 분노, 공포 4가지 감정을 각 30초씩 연기하세요.', dueDate: today + 'T23:59:00', studentId: 's1', studentName: '김배우', status: 'submitted', submissionText: '4가지 감정 연기 영상을 제출합니다.' },
  { id: 'asgn003', title: '뮤지컬 넘버 연습', description: 'Les Miserables - On My Own 연습 녹음본 제출', dueDate: yesterday + 'T23:59:00', studentId: 's1', studentName: '김배우', status: 'graded', grade: 'A', feedback: '감정 전달이 훌륭합니다. 고음 부분 안정감이 더 필요해요.' },
];

// ── Diet ──
export const DEMO_DIETS: DietLog[] = [
  { id: 'diet001', studentId: 's1', studentName: '김배우', date: today + 'T08:30:00', mealType: 'breakfast', description: '통밀빵 토스트, 삶은 계란 2개, 우유', calories: 450, aiAdvice: '단백질이 풍부한 아침이네요! 성대 건강에 좋습니다.' },
  { id: 'diet002', studentId: 's1', studentName: '김배우', date: today + 'T12:30:00', mealType: 'lunch', description: '닭가슴살 샐러드, 현미밥', calories: 520, aiAdvice: '균형 잡힌 점심입니다. 공연 전 에너지 보충에 적합해요.' },
  { id: 'diet003', studentId: 's1', studentName: '김배우', date: yesterday + 'T19:00:00', mealType: 'dinner', description: '연어 스테이크, 야채 볶음, 된장국', calories: 680 },
];

// ── Notices ──
export const DEMO_NOTICES: Notice[] = [
  { id: 'ntc001', title: '3월 정기 발표회 안내', content: '3월 28일 토요일 오후 2시, 대강당에서 정기 발표회가 열립니다.', author: '한원장', important: true, date: today },
  { id: 'ntc002', title: '연습실 이용 시간 변경', content: '3월부터 연습실 이용 시간이 오전 9시~오후 10시로 변경됩니다.', author: '최선생', important: false, date: yesterday },
];

// ── Notifications ──
export const DEMO_NOTIFICATIONS: Notification[] = [
  { id: 'noti001', type: 'info', message: '새 수업이 등록되었습니다. (오늘 18:00)', read: false, date: today + 'T09:00:00' },
  { id: 'noti002', type: 'success', message: '과제 "감정 표현 연습"이 채점되었습니다.', read: false, date: yesterday + 'T15:00:00' },
  { id: 'noti003', type: 'info', message: '3월 정기 발표회 공지가 등록되었습니다.', read: true, date: yesterday + 'T10:00:00' },
];

// ── Questions ──
export const DEMO_QUESTIONS: Question[] = [
  { id: 'q001', title: '오디션 자기소개는 어떻게 준비하나요?', content: '다음 주 대학 입시 오디션이 있는데, 자기소개를 어떻게 구성하면 좋을까요?', authorId: 's1', authorName: '김배우', views: 12, date: yesterday, answers: [
    { id: 'ans001', content: '자기소개는 1분 이내로, 자신만의 강점과 연기 경험을 중심으로 구성하세요.', authorName: '최선생', authorRole: UserRole.TEACHER, isAi: false, date: yesterday },
  ]},
  { id: 'q002', title: '감정 전환이 잘 안될 때 어떻게 하나요?', content: '연기 중 감정 전환이 매끄럽지 않아서 고민입니다.', authorId: 's2', authorName: '이연기', views: 8, date: yesterday, answers: [] },
];

// ── Evaluations ──
export const DEMO_EVALUATIONS: Evaluation[] = [
  { id: 'eval001', studentId: 's1', studentName: '김배우', evaluatorId: 't1', evaluatorName: '최선생', classId: 'c1', className: '입시 A반', subject: Subject.ACTING, period: '2025년 1학기', scores: { acting: 4, expression: 5, creativity: 4, teamwork: 3, effort: 5 }, comment: '감정 표현이 풍부하고 성실한 학생입니다.', date: yesterday },
];

// ── Portfolios ──
export const DEMO_PORTFOLIOS: PortfolioItem[] = [
  { id: 'ptf001', studentId: 's1', studentName: '김배우', title: '햄릿 독백 - To be or not to be', description: '셰익스피어 햄릿 3막 1장 독백 연습', videoUrl: '', category: 'monologue', tags: ['셰익스피어', '비극', '입시'], comments: [], date: yesterday, practiceGroup: '햄릿 독백' },
  { id: 'ptf002', studentId: 's1', studentName: '김배우', title: '햄릿 독백 - 2차 연습', description: '선생님 피드백 반영 후 재촬영', videoUrl: '', category: 'monologue', tags: ['셰익스피어', '비극', '입시'], comments: [
    { id: 'pcmt001', authorId: 't1', authorName: '최선생', content: '감정 전환이 좋아졌어요! 3:42 부분 호흡 조절에 신경 쓰세요.', timestampSec: 222, date: today },
  ], date: today, practiceGroup: '햄릿 독백' },
];

// ── Auditions / Competition Events ──
export const DEMO_AUDITIONS: CompetitionEvent[] = [
  { id: 'aud001', title: '서울예대 수시 오디션', description: '2025학년도 서울예술대학교 수시 실기 오디션', date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] + 'T10:00:00', location: '서울예대 실기고사장', status: 'upcoming', creatorId: 't1', checklist: [
    { id: 'achk001', text: '자기소개 대본 준비', completed: true },
    { id: 'achk002', text: '독백 2편 암기', completed: true },
    { id: 'achk003', text: '의상 준비', completed: false },
    { id: 'achk004', text: '리허설 1회', completed: false },
  ]},
];

// ── Private Lesson Requests ──
export const DEMO_PRIVATE_REQUESTS: PrivateLessonRequest[] = [
  { id: 'plr001', studentId: 's1', studentName: '김배우', teacherId: 't1', teacherName: '최선생', subject: Subject.ACTING, preferredDate: tomorrow, preferredStartTime: '14:00', preferredEndTime: '15:00', reason: '오디션 전 개인 지도가 필요합니다.', status: 'pending', createdAt: today },
];

// ── Demo login accounts ──
export const DEMO_ACCOUNTS = {
  student: { email: 'student@muse.com', password: 'demo', user: DEMO_USERS[0] },
  teacher: { email: 'teacher@muse.com', password: 'demo', user: DEMO_USERS[3] },
  director: { email: 'director@muse.com', password: 'demo', user: DEMO_USERS[5] },
};

// ── Chat messages ──
export const DEMO_CHAT_MESSAGES: ChatMessage[] = [
  { id: 'msg001', classId: 'c1', senderId: 't1', senderName: '최선생', senderRole: UserRole.TEACHER, avatar: DEMO_USERS[3].avatar, content: '내일 수업 시간에 독백 발표가 있습니다. 준비해오세요!', timestamp: yesterday + 'T16:00:00' },
  { id: 'msg002', classId: 'c1', senderId: 's1', senderName: '김배우', senderRole: UserRole.STUDENT, avatar: DEMO_USERS[0].avatar, content: '네, 알겠습니다! 열심히 준비하겠습니다.', timestamp: yesterday + 'T16:05:00' },
  { id: 'msg003', classId: 'c1', senderId: 's2', senderName: '이연기', senderRole: UserRole.STUDENT, avatar: DEMO_USERS[1].avatar, content: '저도 준비하고 있어요!', timestamp: yesterday + 'T16:10:00' },
];
