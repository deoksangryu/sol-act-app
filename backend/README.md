# Muse Academy Backend

Python FastAPI 기반 백엔드 서버

## 🚀 빠른 시작

### 1. 가상환경 생성 및 활성화

```bash
# Python 3.11+ 권장
python3 -m venv venv

# Mac/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정

```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일을 편집하여 실제 값 입력
# - GEMINI_API_KEY: Google AI Studio에서 발급
# - DATABASE_URL: PostgreSQL 연결 문자열
# - SECRET_KEY: JWT 암호화 키 (랜덤 문자열)
```

### 4. 서버 실행

```bash
# 개발 모드 (핫 리로드)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 프로덕션 모드
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 5. ngrok 터널링

```bash
# 별도 터미널에서 실행
ngrok start backend --config ../ngrok.yml
```

## 📚 API 문서

서버 실행 후 자동 생성된 문서 확인:

- **Swagger UI**: https://sol-backend.ngrok.dev/docs
- **ReDoc**: https://sol-backend.ngrok.dev/redoc

## 🗂️ 프로젝트 구조

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 앱 엔트리포인트
│   ├── config.py            # 환경 설정
│   ├── database.py          # DB 연결 설정
│   ├── routers/             # API 엔드포인트
│   ├── services/            # 비즈니스 로직
│   ├── models/              # SQLAlchemy 모델
│   ├── schemas/             # Pydantic 스키마
│   ├── middleware/          # 미들웨어
│   └── utils/               # 유틸리티 함수
├── alembic/                 # DB 마이그레이션
├── tests/                   # 테스트 코드
├── requirements.txt         # Python 의존성
└── .env                     # 환경 변수 (Git 제외)
```

## 🔧 개발 가이드

### DB 마이그레이션 (Alembic)

```bash
# 초기 설정
alembic init alembic

# 마이그레이션 생성
alembic revision --autogenerate -m "Create users table"

# 마이그레이션 적용
alembic upgrade head

# 롤백
alembic downgrade -1
```

### 테스트 실행

```bash
pytest tests/
```

## 🌐 ngrok 도메인

- **백엔드 API**: https://sol-backend.ngrok.dev
- **프론트엔드**: https://sol-manager.ngrok.app
