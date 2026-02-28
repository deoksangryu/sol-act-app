# Muse Academy Backend Implementation Plan

프론트엔드 코드 분석을 기반으로 한 상세 백엔드 구현 계획

---

## 📊 프론트엔드 분석 요약

### 현재 상태
- **프레임워크**: React 19.2.0 + TypeScript 5.8.2
- **상태 관리**: LocalStorage 기반 Mock 데이터
- **AI 통합**: Gemini API (프론트엔드에서 직접 호출 - 보안 위험)
- **인증**: Mock 로그인 (보안 없음)
- **파일 처리**: Base64 인코딩 (이미지)
- **실시간**: 없음 (LocalStorage 기반 시뮬레이션)

### 주요 컴포넌트 분석
- **Assignments.tsx** (24KB) - 가장 복잡, 과제 관리 + AI 분석
- **Diet.tsx** (23KB) - 식단 추적 + 이미지 업로드 + AI 칼로리 분석
- **Chat.tsx** (19KB) - 반별 채팅 (WebSocket 필요)
- **QnA.tsx** (12KB) - Q&A + AI 튜터
- **Dashboard.tsx** - 통계 대시보드
- **Classes.tsx** - 반 관리 (CRUD)
- **Notices.tsx** - 공지사항
- **Users.tsx** - 사용자 관리 (Staff 전용)

---

## 🗄️ 데이터베이스 스키마

### 1. users (사용자)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'TEACHER', 'DIRECTOR')),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 2. classes (반)
```sql
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_classes_teacher ON classes(teacher_id);
```

### 3. class_members (반-학생 중간 테이블)
```sql
CREATE TABLE class_members (
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, student_id)
);

CREATE INDEX idx_class_members_student ON class_members(student_id);
```

### 4. assignments (과제)
```sql
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    due_date TIMESTAMP NOT NULL,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded')),
    submission_text TEXT,
    submission_file_url TEXT,
    grade VARCHAR(10),
    feedback TEXT,
    ai_analysis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignments_student ON assignments(student_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
```

### 5. diet_logs (식단 기록)
```sql
CREATE TABLE diet_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    description TEXT NOT NULL,
    calories INTEGER,
    ai_advice TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diet_logs_student_date ON diet_logs(student_id, date);
```

### 6. questions (질문)
```sql
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_author ON questions(author_id);
CREATE INDEX idx_questions_created ON questions(created_at DESC);
```

### 7. answers (답변)
```sql
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_ai BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_answers_question ON answers(question_id);
```

### 8. chat_messages (채팅)
```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_class ON chat_messages(class_id, created_at DESC);
```

### 9. notices (공지사항)
```sql
CREATE TABLE notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_important BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notices_created ON notices(created_at DESC);
CREATE INDEX idx_notices_important ON notices(is_important);
```

### 10. notifications (알림)
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'success', 'warning')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
```

---

## 🚀 API 엔드포인트 명세

### 1. Authentication (인증)

#### POST /api/auth/register
회원가입
```json
Request:
{
  "email": "actor@muse.com",
  "password": "password123",
  "name": "김배우",
  "role": "STUDENT"
}

Response: 201
{
  "user": {
    "id": "uuid",
    "email": "actor@muse.com",
    "name": "김배우",
    "role": "STUDENT"
  },
  "token": "jwt_token_here"
}
```

#### POST /api/auth/login
로그인
```json
Request:
{
  "email": "actor@muse.com",
  "password": "password123"
}

Response: 200
{
  "user": {
    "id": "uuid",
    "email": "actor@muse.com",
    "name": "김배우",
    "role": "STUDENT",
    "avatar": "https://..."
  },
  "token": "jwt_token_here"
}
```

#### GET /api/auth/me
현재 사용자 정보
```
Headers: Authorization: Bearer <token>

Response: 200
{
  "id": "uuid",
  "email": "actor@muse.com",
  "name": "김배우",
  "role": "STUDENT",
  "avatar": "https://..."
}
```

---

### 2. Dashboard (대시보드)

#### GET /api/dashboard/stats
통계 데이터
```
Headers: Authorization: Bearer <token>

Response: 200
{
  "pendingAssignments": 3,
  "todayCalories": 1850,
  "newNotices": 2,
  "dday": 45  // 학생만
}
```

---

### 3. Assignments (과제)

#### GET /api/assignments
과제 목록
```
Headers: Authorization: Bearer <token>
Query: ?status=pending&startDate=2024-01-01&endDate=2024-12-31

Response: 200
[
  {
    "id": "uuid",
    "title": "독백 연습 - 햄릿",
    "description": "To be or not to be...",
    "dueDate": "2024-12-25T23:59:59Z",
    "studentId": "uuid",
    "studentName": "김배우",
    "status": "pending",
    "submissionText": null,
    "submissionFileUrl": null,
    "feedback": null,
    "aiAnalysis": null,
    "grade": null
  }
]
```

#### POST /api/assignments
과제 생성 (Teacher)
```json
Request:
{
  "title": "독백 연습",
  "description": "햄릿 3막 1장",
  "dueDate": "2024-12-25T23:59:59Z",
  "studentId": "uuid"
}

Response: 201
{
  "id": "uuid",
  "title": "독백 연습",
  ...
}
```

#### PUT /api/assignments/:id/submit
과제 제출 (Student)
```json
Request:
{
  "submissionText": "To be or not to be...",
  "submissionFileUrl": "https://s3.../video.mp4"  // optional
}

Response: 200
{
  "id": "uuid",
  "status": "submitted",
  ...
}
```

#### POST /api/assignments/:id/ai-analyze
AI 대사 분석
```json
Request:
{
  "text": "To be or not to be..."
}

Response: 200
{
  "analysis": "감정선: 고뇌와 번민이 잘 드러납니다...\n호흡: 더 깊은 호흡으로...\n개선점: ..."
}
```

#### POST /api/assignments/:id/grade
채점 (Teacher)
```json
Request:
{
  "grade": "A+",
  "feedback": "감정 표현이 훌륭했습니다."
}

Response: 200
{
  "id": "uuid",
  "status": "graded",
  "grade": "A+",
  "feedback": "..."
}
```

---

### 4. Diet (식단)

#### GET /api/diet
식단 기록 조회
```
Headers: Authorization: Bearer <token>
Query: ?startDate=2024-12-01&endDate=2024-12-31&studentId=uuid

Response: 200
[
  {
    "id": "uuid",
    "studentId": "uuid",
    "studentName": "김배우",
    "date": "2024-12-22",
    "mealType": "breakfast",
    "description": "계란 2개, 토스트",
    "calories": 350,
    "aiAdvice": "단백질이 충분합니다...",
    "imageUrl": "https://s3.../meal.jpg"
  }
]
```

#### POST /api/diet
식단 기록 + 이미지 업로드
```
Headers:
  Authorization: Bearer <token>
  Content-Type: multipart/form-data

Body:
  date: "2024-12-22"
  mealType: "lunch"
  description: "치킨 샐러드"
  image: <file>  // optional

Response: 201
{
  "id": "uuid",
  "calories": 450,  // AI 추정
  "aiAdvice": "샐러드는 훌륭한 선택입니다...",
  "imageUrl": "https://s3.../uploaded.jpg"
}
```

#### POST /api/diet/:id/ai-analyze
AI 재분석 요청
```json
Response: 200
{
  "calories": 450,
  "advice": "업데이트된 조언..."
}
```

---

### 5. QnA (질의응답)

#### GET /api/qna
질문 목록
```
Response: 200
[
  {
    "id": "uuid",
    "title": "오디션 준비 방법",
    "content": "첫 오디션인데...",
    "authorId": "uuid",
    "authorName": "김배우",
    "date": "2024-12-22T10:00:00Z",
    "views": 15,
    "answers": [...]
  }
]
```

#### POST /api/qna
질문 작성
```json
Request:
{
  "title": "오디션 준비",
  "content": "조언 부탁드립니다"
}

Response: 201
{
  "id": "uuid",
  "title": "...",
  "views": 0
}
```

#### GET /api/qna/:id
질문 상세 (조회수 증가)
```
Response: 200
{
  "id": "uuid",
  "title": "...",
  "views": 16,  // +1
  "answers": [
    {
      "id": "uuid",
      "content": "답변 내용",
      "authorName": "박선생",
      "authorRole": "TEACHER",
      "isAi": false,
      "date": "..."
    }
  ]
}
```

#### POST /api/qna/:id/answers
답변 작성
```json
Request:
{
  "content": "제 경험으로는..."
}

Response: 201
{
  "id": "uuid",
  "content": "...",
  "isAi": false
}
```

#### POST /api/qna/:id/ai-answer
AI 튜터 답변 생성
```
Response: 201
{
  "id": "uuid",
  "content": "AI가 생성한 따뜻한 답변...",
  "isAi": true,
  "authorName": "AI 튜터"
}
```

---

### 6. Classes (반 관리)

#### GET /api/classes
반 목록 (역할별 필터)
```
Response: 200
[
  {
    "id": "uuid",
    "name": "고급반",
    "description": "심화 연기 과정",
    "teacherId": "uuid",
    "studentIds": ["uuid1", "uuid2"],
    "schedule": "월/수 18:00"
  }
]
```

#### POST /api/classes
반 생성 (Teacher)
```json
Request:
{
  "name": "고급반",
  "description": "...",
  "schedule": "월/수 18:00",
  "studentIds": ["uuid1", "uuid2"]
}

Response: 201
{
  "id": "uuid",
  ...
}
```

#### PUT /api/classes/:id
반 수정
```json
Request:
{
  "name": "최고급반",
  "studentIds": ["uuid1", "uuid2", "uuid3"]
}
```

#### DELETE /api/classes/:id
반 삭제

#### POST /api/classes/:id/members
학생 추가
```json
Request:
{
  "studentId": "uuid"
}
```

---

### 7. Chat (채팅)

#### GET /api/chat/:classId/messages
이전 메시지 조회
```
Query: ?limit=50&offset=0

Response: 200
[
  {
    "id": "uuid",
    "classId": "uuid",
    "senderId": "uuid",
    "senderName": "김배우",
    "senderRole": "STUDENT",
    "content": "안녕하세요!",
    "timestamp": "2024-12-22T10:00:00Z",
    "avatar": "https://..."
  }
]
```

#### WebSocket /ws/chat/:classId
실시간 메시징
```
Events:
- Client → Server: send_message
  {
    "content": "메시지 내용"
  }

- Server → Client: receive_message
  {
    "id": "uuid",
    "senderId": "uuid",
    "senderName": "김배우",
    "content": "메시지 내용",
    "timestamp": "..."
  }
```

---

### 8. Notices (공지사항)

#### GET /api/notices
공지 목록
```
Response: 200
[
  {
    "id": "uuid",
    "title": "수업 일정 변경",
    "content": "...",
    "author": "박선생",
    "date": "2024-12-22",
    "important": true
  }
]
```

#### POST /api/notices
공지 작성 (Teacher/Director)
```json
Request:
{
  "title": "공지",
  "content": "내용",
  "important": false
}
```

---

### 9. Users (사용자 관리)

#### GET /api/users
사용자 목록
```
Query: ?role=STUDENT

Response: 200
[
  {
    "id": "uuid",
    "name": "김배우",
    "role": "STUDENT",
    "email": "actor@muse.com",
    "avatar": "https://..."
  }
]
```

---

### 10. Notifications (알림)

#### GET /api/notifications
알림 목록
```
Response: 200
[
  {
    "id": "uuid",
    "type": "info",
    "message": "새 과제가 등록되었습니다",
    "read": false,
    "date": "..."
  }
]
```

#### PUT /api/notifications/:id/read
읽음 처리

#### PUT /api/notifications/read-all
전체 읽음 처리

---

## 🤖 AI 서비스 통합

### 1. 대사 분석 (Assignments)
```python
# services/gemini_service.py
async def analyze_monologue(text: str) -> str:
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    prompt = f"""
    다음 연기 대사를 분석해주세요:

    {text}

    다음 항목을 포함하여 한국어로 피드백해주세요:
    1. 감정선 (어떤 감정이 드러나는지)
    2. 호흡 및 어조 (리듬감, 강약)
    3. 개선할 점 (더 나은 표현 방법)
    """
    response = await model.generate_content_async(prompt)
    return response.text
```

### 2. 식단 분석 (Diet)
```python
async def analyze_diet(image_data: bytes, description: str) -> dict:
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    prompt = f"""
    이미지 속 음식을 분석하여 JSON 형식으로 응답해주세요:

    설명: {description}

    {{
      "calories": 예상 칼로리 (정수),
      "advice": "배우를 위한 영양 조언 (한국어)"
    }}
    """
    response = await model.generate_content_async([
        prompt,
        {"mime_type": "image/jpeg", "data": image_data}
    ])
    return json.loads(response.text)
```

### 3. AI 튜터 (QnA)
```python
async def ask_ai_tutor(question: str) -> str:
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    prompt = f"""
    당신은 연기 학원의 따뜻한 AI 멘토입니다.

    학생 질문: {question}

    다음을 고려하여 한국어로 답변해주세요:
    - 연기 기법, 오디션, 진로 등
    - 따뜻하고 격려하는 톤
    - 구체적이고 실용적인 조언
    """
    response = await model.generate_content_async(prompt)
    return response.text
```

---

## 🔐 인증 및 권한

### JWT 토큰 구조
```json
{
  "sub": "user_uuid",
  "email": "actor@muse.com",
  "role": "STUDENT",
  "exp": 1735123456
}
```

### 권한 매트릭스

| 기능 | STUDENT | TEACHER | DIRECTOR |
|------|---------|---------|----------|
| 과제 제출 | ✅ | ❌ | ❌ |
| 과제 채점 | ❌ | ✅ | ✅ |
| 과제 생성 | ❌ | ✅ | ✅ |
| 식단 기록 | ✅ | ❌ | ❌ |
| 식단 조회 (타인) | ❌ | ✅ | ✅ |
| 반 생성 | ❌ | ✅ | ✅ |
| 사용자 관리 | ❌ | ❌ | ✅ |
| 공지 작성 | ❌ | ✅ | ✅ |

---

## 📦 파일 업로드 전략

### S3 업로드 플로우
```
1. 클라이언트 → 백엔드: multipart/form-data
2. 백엔드: 파일 검증 (타입, 크기)
3. 백엔드 → S3: boto3로 업로드
4. S3 → 백엔드: 공개 URL 반환
5. 백엔드 → DB: URL 저장
6. 백엔드 → 클라이언트: URL 응답
```

### 지원 파일 타입
- **이미지**: JPG, PNG (식단, 프로필)
- **비디오**: MP4, MOV (과제 제출)
- **최대 크기**: 50MB

---

## 🚀 개발 우선순위

### Phase 1: 기반 (1주)
- [x] 프로젝트 구조 생성
- [ ] PostgreSQL 설정
- [ ] SQLAlchemy 모델 작성
- [ ] 인증 API (JWT)
- [ ] 미들웨어 (권한 검증)

### Phase 2: 주요 기능 (2주)
- [ ] 과제 API (CRUD + 제출 + 채점)
- [ ] 식단 API (CRUD + 이미지 업로드)
- [ ] 반 관리 API
- [ ] 공지사항 API
- [ ] 사용자 관리 API

### Phase 3: AI 통합 (1주)
- [ ] Gemini API 통합 (백엔드)
- [ ] 대사 분석 서비스
- [ ] 식단 분석 서비스
- [ ] AI 튜터 서비스
- [ ] S3 파일 업로드

### Phase 4: 실시간 (1주)
- [ ] WebSocket 채팅
- [ ] 실시간 알림
- [ ] Q&A API

### Phase 5: 최적화 (선택)
- [ ] Redis 캐싱
- [ ] API Rate Limiting
- [ ] 로깅 & 모니터링
- [ ] 테스트 코드 작성

---

## 🔧 환경 변수

### backend/.env
```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/muse_academy

# JWT
SECRET_KEY=super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Gemini AI
GEMINI_API_KEY=your_api_key_here

# AWS S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=muse-academy-files
S3_REGION=ap-northeast-2

# CORS
CORS_ORIGINS=https://sol-manager.ngrok.app,http://localhost:3000
```

---

## 📝 다음 단계

1. **PostgreSQL 설치 및 설정**
2. **SQLAlchemy 모델 작성** (위 스키마 기반)
3. **Alembic 마이그레이션 설정**
4. **인증 API 구현** (회원가입, 로그인)
5. **프론트엔드 연동 테스트**

---

**최종 업데이트**: 2024-12-22
**작성자**: Claude (AI Assistant)
**프로젝트 상태**: 백엔드 기반 구조 완료, API 구현 대기 중
