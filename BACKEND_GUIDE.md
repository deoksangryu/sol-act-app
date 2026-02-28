# Muse Academy Backend Development Guide

본 문서는 `Muse Academy` 웹/모바일 하이브리드 애플리케이션의 프론트엔드 구조를 기반으로 백엔드 API 및 데이터베이스 설계를 돕기 위해 작성되었습니다.

---

## 1. 기술 스택 및 아키텍처 개요

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Current Data Flow:** 클라이언트 상태(State) 및 Mock Data 사용 중
- **Required Backend:** RESTful API (또는 GraphQL), WebSocket (채팅용), DB (RDBMS 권장), File Storage (S3 등)

---

## 2. 데이터 모델 (Data Models)

`types.ts`에 정의된 인터페이스를 기반으로 한 DB 스키마 제안입니다.

### 2.1 Users (사용자)
- **Role:** `STUDENT` | `TEACHER`
- **Fields:**
  - `id` (PK)
  - `email` (Unique, Login ID)
  - `password_hash` (보안 저장)
  - `name`
  - `role` (Enum)
  - `avatar_url`

### 2.2 Classes (클래스)
- **Relationships:** Teacher(1) -> Classes(N), Classes(N) <-> Students(M)
- **Fields:**
  - `id` (PK)
  - `name`
  - `description`
  - `schedule` (Text e.g., "월/수 18:00")
  - `teacher_id` (FK -> Users)

### 2.3 ClassMembers (중간 테이블)
- 다대다 관계 해소용 (Students <-> Classes)
- `class_id` (FK), `student_id` (FK)

### 2.4 Assignments (과제)
- **Fields:**
  - `id` (PK)
  - `title`
  - `description`
  - `due_date` (Date/Timestamp)
  - `student_id` (FK -> Users) *개별 할당 방식인 경우*
  - `status` (`pending`, `submitted`, `graded`)
  - `submission_text`
  - `submission_file_url`
  - `grade`
  - `feedback`
  - `ai_analysis` (Text/JSON)

### 2.5 DietLogs (식단)
- **Fields:**
  - `id` (PK)
  - `student_id` (FK -> Users)
  - `date` (Timestamp)
  - `meal_type` (`breakfast`, `lunch`, `dinner`, `snack`)
  - `description`
  - `calories` (Integer)
  - `ai_advice` (Text)
  - `image_url`

### 2.6 QnA (질의응답)
- **Questions:**
  - `id`, `title`, `content`, `author_id`, `created_at`, `views`
- **Answers:**
  - `id`, `question_id` (FK), `content`, `author_id` (Null if AI), `is_ai` (Boolean), `created_at`

### 2.7 ChatMessages (채팅)
- **Fields:**
  - `id` (PK)
  - `class_id` (FK -> Classes)
  - `sender_id` (FK -> Users)
  - `content`
  - `created_at`

---

## 3. API 명세 제안 (API Specification)

프론트엔드 로직에 맞춰 필요한 REST API 엔드포인트입니다.

### Authentication
- `POST /api/auth/login`: JWT 토큰 발급
- `POST /api/auth/logout`
- `GET /api/auth/me`: 현재 로그인한 사용자 정보 (Role 포함)

### Dashboard
- `GET /api/dashboard/stats`: 진행 중 과제 수, 오늘의 칼로리 등 요약 정보

### Assignments
- `GET /api/assignments`: (Student) 본인 과제, (Teacher) 전체/반별 과제
- `POST /api/assignments`: (Teacher/Student) 과제 생성
- `GET /api/assignments/:id`
- `PUT /api/assignments/:id/submit`: (Student) 과제 제출 (Multipart/form-data for files)
- `POST /api/assignments/:id/grade`: (Teacher) 채점 및 피드백
- `POST /api/assignments/:id/analyze`: (System) AI 분석 요청 트리거

### Diet
- `GET /api/diet`: 날짜 범위(Month) 쿼리 (`?startDate=...&endDate=...`)
- `POST /api/diet`: 식단 기록 (이미지 업로드 포함)
  - **참고:** 현재 프론트엔드는 Base64 이미지를 AI에 직접 보내고 있으나, 백엔드에서는 이미지를 S3 등에 업로드하고 URL을 저장하는 구조로 변경 권장.

### QnA
- `GET /api/qna`
- `POST /api/qna`
- `POST /api/qna/:id/answers`: 답변 등록 (AI 답변은 백엔드 서비스에서 처리 후 DB 저장 권장)

### Classes (Teacher Only)
- `GET /api/classes`
- `POST /api/classes`
- `PUT /api/classes/:id`
- `DELETE /api/classes/:id`
- `POST /api/classes/:id/invite`: 학생 초대

### Chat
- **HTTP:**
  - `GET /api/chat/:classId/messages`: 이전 대화 내역 로딩 (Pagination)
- **WebSocket (Socket.io / SSE):**
  - Event: `join_room` (classId)
  - Event: `send_message`
  - Event: `receive_message`

---

## 4. AI 서비스 통합 (Gemini API)

현재 프론트엔드(`services/gemini.ts`)에서 API Key를 노출하며 직접 호출하고 있습니다. 보안을 위해 **백엔드 Proxy 처리**가 필수적입니다.

### 변경 전략
1. **Frontend:** 이미지를 Base64 또는 FormData로 백엔드에 전송.
2. **Backend:**
   - 이미지를 임시 저장 또는 Buffer로 변환.
   - Google Gemini SDK(Server-side)를 사용하여 분석 요청.
   - 분석 결과(JSON 등)를 DB에 저장하고 클라이언트에 응답.

### 필요한 AI Endpoints
- `POST /api/ai/diet-analysis`: 식단 이미지/텍스트 분석 -> 칼로리 및 조언 반환
- `POST /api/ai/monologue-analysis`: 독백 텍스트 분석 -> 피드백 반환
- `POST /api/ai/tutor`: QnA 답변 생성

---

## 5. 파일 처리 (File Handling)

- **식단 이미지 / 과제 영상:**
  - 현재는 Mock URL 또는 Base64를 사용 중입니다.
  - 백엔드에서는 **Object Storage (AWS S3, Google Cloud Storage, Azure Blob)** 연동이 필요합니다.
  - Flow:
    1. 프론트엔드에서 파일 업로드 (`POST /api/upload`)
    2. 백엔드에서 스토리지 저장 후 URL 반환
    3. 해당 URL을 게시글/과제 제출 데이터에 포함하여 DB 저장

---

## 6. 개발 우선순위 (Priority)

1. **DB 설계 및 Auth API:** 사용자 로그인 및 역할 분리가 되어야 다른 기능 테스트 가능.
2. **Assignments & Diet API:** 핵심 기능이며 데이터 구조가 잡혀있음.
3. **Image Upload:** 식단 및 과제 제출을 위해 필수.
4. **Chat (WebSocket):** 별도의 서버 또는 소켓 로직 구현 필요.
5. **AI Migration:** 클라이언트 사이드 호출을 서버 사이드로 이관.
