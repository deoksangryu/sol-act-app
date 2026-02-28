# Muse Academy - 전체 프로젝트 설정 가이드

연기 입시 학원 관리 시스템 (React + FastAPI + PostgreSQL)

---

## 📋 시스템 요구사항

- **Node.js**: 18.x 이상
- **Python**: 3.11 이상
- **PostgreSQL**: 14.x 이상
- **ngrok**: Hobby 티어 이상 (고정 도메인 사용)

---

## 🚀 빠른 시작

### 1. 프로젝트 클론 및 이동

```bash
cd /Users/deryu/Documents/Sol-Act/muse-academy
```

### 2. 프론트엔드 설정

```bash
# 의존성 설치
npm install --legacy-peer-deps

# 개발 서버 실행 (포트 3001에서 자동 실행)
npm run dev
```

**접속**: http://localhost:3001

### 3. 백엔드 설정

```bash
cd backend

# 가상환경 생성
python3 -m venv venv

# 가상환경 활성화
source venv/bin/activate  # Mac/Linux
# 또는
venv\Scripts\activate  # Windows

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 확인 (.env 파일이 이미 생성되어 있음)
cat .env

# 개발 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**API 문서**: http://localhost:8000/docs

### 4. PostgreSQL 데이터베이스 설정

```bash
# PostgreSQL 설치 (Mac)
brew install postgresql@14
brew services start postgresql@14

# 데이터베이스 생성
createdb muse_academy

# 마이그레이션 실행
cd backend
alembic upgrade head
```

### 5. ngrok 터널링 설정

```bash
# ngrok 인증 (최초 1회만)
ngrok config add-authtoken YOUR_NGROK_TOKEN

# 모든 서비스 한 번에 시작
./start-dev.sh
```

**또는 수동 시작:**
```bash
ngrok start --all --config ngrok.yml
```

---

## 🌐 접속 URL

### 로컬 개발

- **프론트엔드**: http://localhost:3001
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs
- **ngrok 대시보드**: http://localhost:4040

### ngrok 공개 도메인

- **프론트엔드**: https://sol-manager.ngrok.app
- **백엔드 API**: https://sol-backend.ngrok.dev
- **API 문서**: https://sol-backend.ngrok.dev/docs

---

## 📁 프로젝트 구조

```
muse-academy/
├── components/              # React 컴포넌트
│   ├── Login.tsx           # 로그인 (완료)
│   ├── Dashboard.tsx       # 대시보드
│   ├── Assignments.tsx     # 과제 관리
│   ├── Diet.tsx            # 식단 관리
│   ├── Chat.tsx            # 채팅
│   ├── QnA.tsx             # 질문과 답변
│   ├── Classes.tsx         # 수업 관리
│   ├── Notices.tsx         # 공지사항
│   └── Users.tsx           # 사용자 관리
│
├── services/               # 프론트엔드 서비스
│   ├── storage.ts          # LocalStorage 관리
│   └── gemini.ts           # Gemini AI 연동
│
├── types/                  # TypeScript 타입 정의
│   └── index.ts
│
├── backend/                # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py         # FastAPI 앱 엔트리포인트
│   │   ├── config.py       # 환경 설정
│   │   ├── database.py     # DB 연결
│   │   ├── routers/        # API 엔드포인트
│   │   ├── services/       # 비즈니스 로직
│   │   ├── models/         # SQLAlchemy 모델
│   │   └── schemas/        # Pydantic 스키마
│   ├── alembic/            # DB 마이그레이션
│   ├── requirements.txt    # Python 의존성
│   └── .env                # 환경 변수 (Git 제외)
│
├── ngrok.yml               # ngrok 설정
├── start-dev.sh            # 통합 개발 서버 시작 스크립트
├── package.json            # Node.js 의존성
└── README.md               # 프로젝트 소개
```

---

## 🔑 주요 기능

### 1. 사용자 역할 (Role-based Access)

- **STUDENT**: 수강생 (과제, 식단, 채팅, Q&A)
- **TEACHER**: 선생님 (과제 채점, 수업 관리, 공지사항)
- **DIRECTOR**: 원장 (전체 관리, 사용자 관리)

### 2. AI 기능 (Gemini API)

- **독백/대사 분석**: 학생이 제출한 연기 대본 AI 피드백
- **식단 이미지 분석**: 음식 사진에서 칼로리 자동 계산
- **AI 튜터**: Q&A에서 학생 질문에 자동 답변

### 3. 상태 관리

- **LocalStorage**: 브라우저 로컬 저장 (Mock 데이터)
- **추후 구현**: PostgreSQL + FastAPI 연동

---

## 🔧 개발 워크플로우

### 1. 모든 서비스 한 번에 시작

```bash
./start-dev.sh
```

이 스크립트는 다음을 자동으로 실행합니다:
1. FastAPI 백엔드 (포트 8000)
2. React 프론트엔드 (포트 3001)
3. ngrok 터널링 (양쪽 모두)

### 2. 개별 서비스 시작

**프론트엔드만:**
```bash
npm run dev
```

**백엔드만:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**ngrok만:**
```bash
ngrok start --all --config ngrok.yml
```

---

## 🧪 테스트 로그인

### Mock 인증 정보

**학생:**
- ID: 아무거나 입력
- 비밀번호: 아무거나 입력
- 역할: Student 버튼 클릭

**선생님:**
- ID: 아무거나 입력 (director 제외)
- 비밀번호: 아무거나 입력
- 역할: Teacher 버튼 클릭

**원장:**
- ID: `director`
- 비밀번호: 아무거나 입력
- 역할: Teacher 버튼 클릭 → 자동으로 DIRECTOR 승격

---

## 📊 데이터베이스 마이그레이션

```bash
cd backend

# 마이그레이션 파일 생성
alembic revision --autogenerate -m "설명"

# 마이그레이션 적용
alembic upgrade head

# 이전 버전으로 롤백
alembic downgrade -1

# 마이그레이션 히스토리 확인
alembic history
```

---

## 🐛 트러블슈팅

### 프론트엔드

**npm install 실패:**
```bash
# npm 캐시 정리
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
npm install --legacy-peer-deps
```

**포트 3000 사용 중:**
- Vite가 자동으로 3001 포트 사용
- ngrok.yml 설정도 3001로 맞춤

### 백엔드

**가상환경 활성화 안 됨:**
```bash
# 가상환경 재생성
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**PostgreSQL 연결 실패:**
```bash
# PostgreSQL 상태 확인
brew services list

# 재시작
brew services restart postgresql@14

# 데이터베이스 존재 확인
psql -l
```

### ngrok

**도메인 연결 실패:**
```bash
# 토큰 재설정
ngrok config add-authtoken YOUR_TOKEN

# ngrok 설정 확인
ngrok config check

# ngrok 버전 확인 (3.x 이상 필요)
ngrok version
```

**inspect 페이지 안 보임:**
- http://localhost:4040 접속
- 여러 터널 실행 시 포트가 4041, 4042로 증가

---

## 🔒 보안 주의사항

### Git에 커밋하지 말아야 할 파일

```
backend/.env
backend/gemini_api_key.md
ngrok_token.md
*.pyc
__pycache__/
venv/
node_modules/
.DS_Store
```

### API 키 관리

- **Gemini API**: backend/.env의 GEMINI_API_KEY
- **ngrok Token**: `ngrok config add-authtoken` 사용 (파일 저장 금지)
- **PostgreSQL 비밀번호**: .env에만 저장

---

## 📚 추가 문서

- [Backend README](backend/README.md) - 백엔드 상세 가이드
- [API 문서](https://sol-backend.ngrok.dev/docs) - Swagger UI
- [React + Vite 공식 문서](https://vitejs.dev)
- [FastAPI 공식 문서](https://fastapi.tiangolo.com)

---

## 🎯 다음 단계

1. ✅ React 프론트엔드 실행 (완료)
2. ✅ FastAPI 백엔드 구조 설정 (완료)
3. ⏳ 백엔드 API 엔드포인트 구현
4. ⏳ 프론트엔드-백엔드 연동
5. ⏳ PostgreSQL 데이터 마이그레이션
6. ⏳ 인증/인가 시스템 (JWT)
7. ⏳ 파일 업로드 (AWS S3)
8. ⏳ WebSocket 채팅
9. ⏳ 프로덕션 배포

---

**현재 진행률**: 25% (프론트엔드 완성, 백엔드 구조 완성)
**다음 작업**: FastAPI 엔드포인트 구현
