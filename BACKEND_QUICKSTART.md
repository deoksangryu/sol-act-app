# 백엔드 빠른 시작 가이드

## ✅ 완료된 작업

1. **데이터베이스 모델** - SQLAlchemy 모델 8개 생성
   - User, Assignment, DietLog, Question, Answer, ClassInfo, ChatMessage, Notification, Notice

2. **Pydantic 스키마** - API 요청/응답 스키마
   - 각 모델에 대한 Create, Update, Response 스키마

3. **인증 시스템** - JWT 기반 인증
   - 회원가입 (`/api/auth/register`)
   - 로그인 (`/api/auth/login`)
   - OAuth2 호환 로그인 (`/api/auth/login/oauth`)

---

## 🚀 백엔드 시작하기

### 1. 가상환경 활성화

```bash
cd /Users/deryu/Documents/Sol-Act/muse-academy/backend
source venv/bin/activate
```

### 2. 의존성 확인

```bash
pip install -r requirements.txt
```

### 3. 환경 변수 확인

`.env` 파일이 이미 생성되어 있습니다:
```bash
cat .env
```

중요 설정:
- `GEMINI_API_KEY`: Gemini AI API 키 (설정 완료)
- `DATABASE_URL`: PostgreSQL 연결 문자열
- `SECRET_KEY`: JWT 암호화 키

### 4. 데이터베이스 설정

#### PostgreSQL 설치 및 시작 (Mac)

```bash
# PostgreSQL 설치
brew install postgresql@14

# PostgreSQL 시작
brew services start postgresql@14

# 데이터베이스 생성
createdb muse_academy
```

#### .env 파일의 DATABASE_URL 확인

```env
DATABASE_URL=postgresql://user:password@localhost:5432/muse_academy
```

실제 PostgreSQL 사용자 정보로 변경:
```env
DATABASE_URL=postgresql://deryu:@localhost:5432/muse_academy
```

### 5. 초기 데이터 생성

```bash
python seed_data.py
```

출력 예시:
```
🚀 Muse Academy Database Seeder
==================================================
🌱 Seeding users...
✅ Created 7 users

📝 Test Credentials (all passwords: password123):
--------------------------------------------------
STUDENT    | student@muse.com     | 김배우
STUDENT    | lee@muse.com         | 이연기
STUDENT    | choi@muse.com        | 최무대
STUDENT    | park@muse.com        | 박감정
TEACHER    | teacher@muse.com     | 박선생
TEACHER    | dance@muse.com       | 김무용
DIRECTOR   | director@muse.com    | 최원장

✨ Seeding complete!
```

### 6. 서버 시작

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

또는 모든 서비스 한 번에 시작:
```bash
cd ..  # muse-academy 디렉토리로 이동
./start-dev.sh
```

---

## 🌐 API 엔드포인트

### 로컬 접속

- **API 문서 (Swagger)**: http://localhost:8000/docs
- **API 문서 (ReDoc)**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

### ngrok 공개 도메인

- **API 문서**: https://sol-backend.ngrok.dev/docs
- **API Root**: https://sol-backend.ngrok.dev/

---

## 🧪 API 테스트

### 1. Swagger UI에서 테스트

1. http://localhost:8000/docs 접속
2. `POST /api/auth/login` 엔드포인트 확장
3. "Try it out" 클릭
4. Request body 입력:
```json
{
  "email": "student@muse.com",
  "password": "password123"
}
```
5. "Execute" 클릭
6. Response에서 `access_token` 복사
7. 페이지 상단 "Authorize" 버튼 클릭
8. `Bearer <token>` 형식으로 입력

### 2. curl로 테스트

**회원가입:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newstudent@muse.com",
    "name": "신입생",
    "password": "password123",
    "role": "student"
  }'
```

**로그인:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@muse.com",
    "password": "password123"
  }'
```

---

## 📊 데이터베이스 구조

### Users
- `id`: s1, t1, d1 등
- `email`: 이메일 (unique)
- `hashed_password`: bcrypt 해시
- `name`: 사용자 이름
- `role`: STUDENT | TEACHER | DIRECTOR
- `avatar`: 프로필 이미지 URL

### Assignments (과제)
- 학생별 과제
- 제출 상태: pending | submitted | graded
- AI 피드백 저장

### DietLog (식단)
- 학생별 식사 기록
- meal_type: breakfast | lunch | dinner | snack
- AI 칼로리 분석 결과

### Questions & Answers (Q&A)
- 질문-답변 관계
- AI 답변 지원

### ClassInfo (수업)
- 선생님-학생 다대다 관계
- 수업 스케줄

### ChatMessage (채팅)
- 수업별 그룹 채팅
- 실시간 메시지

---

## 🐛 문제 해결

### PostgreSQL 연결 실패

```bash
# PostgreSQL 상태 확인
brew services list

# PostgreSQL 재시작
brew services restart postgresql@14

# 데이터베이스 목록 확인
psql -l
```

### "relation does not exist" 오류

테이블이 생성되지 않았습니다:
```bash
# Python 셸에서 테이블 생성
python -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"
```

### 시드 데이터 재생성

```bash
# 데이터베이스 초기화
dropdb muse_academy
createdb muse_academy

# 테이블 및 시드 데이터 재생성
python -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"
python seed_data.py
```

---

## 📝 다음 단계

1. ✅ 인증 시스템 (완료)
2. ⏳ 나머지 API 라우터 구현
   - Assignments
   - Diet
   - Q&A
   - Classes
   - Chat
   - Notifications
3. ⏳ 프론트엔드-백엔드 연동
4. ⏳ WebSocket 채팅 구현
5. ⏳ Gemini AI 통합

---

## 🎯 현재 상태

- ✅ 데이터베이스 모델 설계 완료
- ✅ 인증 API 구현 완료
- ✅ Pydantic 스키마 완료
- ✅ 시드 데이터 스크립트 완료
- ⏳ 나머지 CRUD API 구현 대기

**백엔드 진행률**: 40%
