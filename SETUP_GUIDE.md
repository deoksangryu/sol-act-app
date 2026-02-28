# Muse Academy 설정 가이드

ngrok Hobby 티어를 활용한 프론트엔드 + 백엔드 통합 개발 환경

---

## 📋 사전 준비

### 1. 필수 소프트웨어 설치

- **Node.js** 20+ (프론트엔드)
- **Python** 3.11+ (백엔드)
- **PostgreSQL** 16+ (데이터베이스)
- **ngrok** (터널링 서비스)

### 2. ngrok 설정

```bash
# ngrok 계정 로그인 후 authtoken 설정
ngrok config add-authtoken YOUR_AUTH_TOKEN

# 확보된 도메인 확인
# - sol-backend.ngrok.dev (백엔드)
# - sol-manager.ngrok.app (프론트엔드)
```

### 3. API Key 발급

- **Gemini API Key**: https://aistudio.google.com/app/apikey

---

## 🚀 초기 설정

### Step 1: 프론트엔드 설정

```bash
# 프로젝트 루트에서
npm install

# 환경 변수 설정
cp .env.example .env

# .env 파일 편집
# GEMINI_API_KEY=실제_API_키_입력
# VITE_API_URL=https://sol-backend.ngrok.dev
```

### Step 2: 백엔드 설정

```bash
# 백엔드 디렉토리로 이동
cd backend

# Python 가상환경 생성
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env

# .env 파일 편집 (아래 참고)
```

**backend/.env 예시:**
```env
# Database (로컬 PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/muse_academy

# JWT
SECRET_KEY=super-secret-key-change-this-to-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Gemini API
GEMINI_API_KEY=실제_API_키_입력

# CORS (ngrok 도메인)
CORS_ORIGINS=https://sol-manager.ngrok.app,http://localhost:3000
```

### Step 3: 데이터베이스 생성

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE muse_academy;

# 종료
\q
```

---

## 🎯 실행 방법

### 방법 1: 자동 스크립트 (추천)

```bash
# 프로젝트 루트에서
./start-dev.sh
```

이 스크립트는 자동으로:
1. 백엔드 서버 시작 (포트 8000)
2. 프론트엔드 서버 시작 (포트 3000)
3. ngrok 터널 2개 시작

### 방법 2: 수동 실행

#### Terminal 1: 백엔드
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Terminal 2: 프론트엔드
```bash
npm run dev
```

#### Terminal 3: ngrok
```bash
ngrok start --all --config ngrok.yml
```

---

## 🌐 접속 URL

설정이 완료되면 다음 URL로 접속 가능:

| 서비스 | URL | 설명 |
|--------|-----|------|
| **프론트엔드** | https://sol-manager.ngrok.app | React 앱 |
| **백엔드 API** | https://sol-backend.ngrok.dev | FastAPI 서버 |
| **API 문서** | https://sol-backend.ngrok.dev/docs | Swagger UI |
| **ReDoc** | https://sol-backend.ngrok.dev/redoc | 대체 문서 |
| **ngrok 대시보드** | http://localhost:4040 | 요청 로그 확인 |

---

## 🔧 ngrok.yml 설정 확인

프로젝트 루트의 `ngrok.yml` 파일:

```yaml
version: 2
authtoken: YOUR_NGROK_AUTH_TOKEN

tunnels:
  frontend:
    proto: http
    addr: 3000
    domain: sol-manager.ngrok.app
    inspect: true

  backend:
    proto: http
    addr: 8000
    domain: sol-backend.ngrok.dev
    inspect: true
```

**중요**: `YOUR_NGROK_AUTH_TOKEN`을 실제 토큰으로 교체하거나, 다음 명령으로 자동 설정:
```bash
ngrok config add-authtoken YOUR_TOKEN
```

---

## ✅ 동작 확인

### 1. 백엔드 Health Check
```bash
curl https://sol-backend.ngrok.dev/health
# 응답: {"status":"healthy","service":"muse-academy-backend"}
```

### 2. 프론트엔드 접속
브라우저에서 `https://sol-manager.ngrok.app` 접속

### 3. API 문서 확인
`https://sol-backend.ngrok.dev/docs`에서 Swagger UI 확인

### 4. CORS 테스트
프론트엔드에서 백엔드 API 호출 시 CORS 에러 없어야 함

---

## 🐛 문제 해결

### ngrok 경고 메시지 (ERR_NGROK_*)
**증상**: 브라우저에서 ngrok 경고 페이지
**해결**: 백엔드에 이미 우회 헤더 추가됨 (`ngrok-skip-browser-warning`)

### CORS 에러
**증상**: `Access-Control-Allow-Origin` 에러
**해결**: `backend/app/config.py`에서 `CORS_ORIGINS`에 프론트 URL 추가 확인

### 백엔드 실행 실패
**증상**: `ModuleNotFoundError: No module named 'fastapi'`
**해결**:
```bash
cd backend
source venv/bin/activate  # 가상환경 활성화 확인
pip install -r requirements.txt
```

### 데이터베이스 연결 실패
**증상**: `could not connect to server`
**해결**:
1. PostgreSQL 실행 확인: `pg_ctl status`
2. DATABASE_URL 확인
3. 데이터베이스 존재 확인: `psql -l`

### ngrok 터널 연결 실패
**증상**: `ERR_NGROK_108: tunnel not found`
**해결**:
1. 도메인 예약 확인: https://dashboard.ngrok.com/domains
2. authtoken 설정 확인: `ngrok config check`

---

## 📦 프로젝트 구조

```
muse-academy/
├── backend/              # Python FastAPI 백엔드
│   ├── app/
│   │   ├── main.py       # 앱 엔트리포인트
│   │   ├── config.py     # 설정
│   │   ├── database.py   # DB 연결
│   │   ├── routers/      # API 라우터
│   │   ├── services/     # 비즈니스 로직
│   │   ├── models/       # DB 모델
│   │   └── schemas/      # Pydantic 스키마
│   ├── requirements.txt
│   └── .env
│
├── components/           # React 컴포넌트
├── services/            # 프론트엔드 서비스
├── types.ts             # TypeScript 타입
├── App.tsx              # React 앱
├── package.json
├── vite.config.ts
├── ngrok.yml            # ngrok 설정
├── .env                 # 프론트엔드 환경변수
└── start-dev.sh         # 개발 서버 시작 스크립트
```

---

## 🔐 보안 주의사항

### Git에 포함하지 말 것
- `.env` 파일 (이미 .gitignore에 추가됨)
- `backend/.env`
- `ngrok.yml` (authtoken 포함 시)
- API 키가 포함된 모든 파일

### 배포 전 체크리스트
- [ ] `SECRET_KEY` 변경 (랜덤 문자열)
- [ ] `DEBUG=False` 설정
- [ ] 프로덕션 DB 사용
- [ ] CORS_ORIGINS 프로덕션 도메인만 허용
- [ ] API rate limiting 적용

---

## 📚 다음 단계

1. **인증 시스템 구현** - JWT 로그인/회원가입
2. **과제 API 구현** - CRUD + 제출/채점
3. **식단 API 구현** - 이미지 업로드 + AI 분석
4. **WebSocket 채팅** - 실시간 메시징
5. **프로덕션 배포** - AWS/DigitalOcean/Render

---

## 🆘 도움말

- **Backend README**: [backend/README.md](backend/README.md)
- **Frontend README**: [README.md](README.md)
- **Backend Guide**: [BACKEND_GUIDE.md](BACKEND_GUIDE.md)
- **ngrok Docs**: https://ngrok.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
