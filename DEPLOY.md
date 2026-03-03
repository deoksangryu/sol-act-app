# SOL-ACT 배포 가이드

## 아키텍처

```
사용자 (sol-manager.com)
    ↓ 정적 파일
GitHub Pages (프론트엔드)
    ↓ API 요청 (VITE_API_URL)
ngrok 터널 (sol-manager.app.server.ngrok-free.dev)
    ↓
로컬 PC (FastAPI 백엔드 + SQLite)
```

- **프론트엔드**: GitHub Pages에서 서빙 (push 시 자동 배포)
- **백엔드**: 로컬 PC에서 실행, ngrok으로 외부 접속
- **데이터**: 로컬 PC의 `sol_act.db` (SQLite)

---

## 최초 설정 (1회)

### 1. 레포 클론 + 환경 설정

```bash
git clone https://github.com/deoksangryu/sol-act-app.git
cd sol-act-app
bash scripts/setup.sh
```

setup.sh가 자동으로:
- Python/Node.js 확인
- npm install (프론트엔드)
- pip install (백엔드)
- `backend/.env` 생성 (SECRET_KEY 자동 생성)
- DB 테이블 생성 + 시드 데이터 삽입

### 2. GitHub Secret 설정

**https://github.com/deoksangryu/sol-act-app/settings/secrets/actions**

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://sol-manager.app.server.ngrok-free.dev` |

### 3. 프론트엔드 배포 트리거

GitHub Actions 탭 → "Deploy to GitHub Pages" → **Run workflow** 클릭

---

## 일상 운영

### 서비스 시작

```bash
cd sol-act-app
bash scripts/start.sh
```

실행 결과:
```
╔══════════════════════════════════════════════╗
║            SOL-ACT 서비스 실행 중!           ║
╚══════════════════════════════════════════════╝

  백엔드 (로컬):  http://localhost:8000
  API 문서:       http://localhost:8000/docs
  백엔드 (외부):  https://sol-manager.app.server.ngrok-free.dev
```

### 서비스 종료

```bash
bash scripts/stop.sh
```

또는 start.sh 실행 중인 터미널에서 `Ctrl+C`

---

## 주요 계정

### 시드 데이터 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|---------|
| 원장 | director@muse.com | password123 |
| 선생님 | teacher@muse.com | password123 |
| 학생 | student@muse.com | password123 |

### 데모 모드 계정 (프론트만 테스트)

로컬에서 `VITE_DEMO_MODE=true npx vite` 실행 시:

| 역할 | 이메일 | 비밀번호 |
|------|--------|---------|
| 원장 | director@muse.com | demo |
| 선생님 | teacher@muse.com | demo |
| 학생 | student@muse.com | demo |

---

## 자주 묻는 질문

### PC를 끄면 서비스가 중단되나요?
네. 백엔드가 로컬에서 실행되므로 PC가 꺼지면 API 접속이 불가합니다.
프론트엔드(sol-manager.com)는 접속 가능하지만 데이터 로드가 실패합니다.

### ngrok URL이 바뀌면?
1. `backend/.env`는 변경 불필요 (백엔드는 로컬이므로)
2. GitHub Secret의 `VITE_API_URL`을 새 URL로 업데이트
3. Actions 탭에서 워크플로우 재실행

### 다른 PC로 옮기려면?
1. 새 PC에서 `git clone` + `bash scripts/setup.sh`
2. 기존 PC의 `backend/sol_act.db`를 새 PC로 복사 (데이터 이전)
3. `bash scripts/start.sh`로 실행

### Gemini AI를 사용하려면?
`backend/.env`에 추가:
```
GEMINI_API_KEY=your_api_key_here
```
https://aistudio.google.com/app/apikey 에서 키 발급

### 프론트엔드를 수정하면?
main 브랜치에 push하면 GitHub Actions가 자동으로 빌드+배포합니다.

### 백엔드를 수정하면?
`--reload` 옵션으로 실행 중이므로 파일 저장만 하면 자동 반영됩니다.

---

## 파일 구조

```
sol-act-app/
├── scripts/
│   ├── setup.sh          # 최초 설정
│   ├── start.sh          # 서비스 시작
│   └── stop.sh           # 서비스 종료
├── backend/
│   ├── app/              # FastAPI 백엔드
│   ├── tests/            # 174개 테스트
│   ├── requirements.txt  # Python 의존성
│   ├── .env              # 환경변수 (git 미포함)
│   └── sol_act.db        # SQLite DB (git 미포함)
├── components/           # React 컴포넌트
├── services/             # API 클라이언트, WebSocket
├── .github/workflows/    # GitHub Actions 배포
└── package.json          # Node.js 의존성
```
