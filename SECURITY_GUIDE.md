# 🔐 보안 가이드 - ngrok 토큰 및 API 키 관리

---

## ⚠️ 중요: Git에 절대 포함하지 말아야 할 파일

다음 파일들은 **절대 Git에 커밋하지 마세요**:
- `ngrok_token.md`
- `gemini_api_key.md`
- `backend/gemini_api_key.md`
- `.env`
- `backend/.env`

이미 `.gitignore`에 추가되어 있으므로, **새로 커밋하지 않으면 안전**합니다.

---

## 🚨 이미 Git에 커밋한 경우

### 1. 즉시 토큰 무효화
```bash
# ngrok 대시보드에서 토큰 재발급
# https://dashboard.ngrok.com/tunnels/authtokens
```

### 2. Git 히스토리에서 제거
```bash
# 파일을 히스토리에서 완전 제거 (신중하게 사용)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch ngrok_token.md" \
  --prune-empty --tag-name-filter cat -- --all

# 또는 BFG Repo-Cleaner 사용 (더 안전)
bfg --delete-files ngrok_token.md
```

### 3. 강제 푸시
```bash
git push origin --force --all
```

---

## ✅ 안전한 토큰 관리 방법

### **방법 1: ngrok CLI로 글로벌 설정 (추천)**

#### 컴퓨터 A (현재 Mac)
```bash
# 토큰 설정 (한 번만)
ngrok config add-authtoken 2wSH9o2UWqpCwUqcSpb8luGO2yo_3Vp29jaUBCcq1RtBnku5t

# 설정 확인
ngrok config check
# 저장 위치: ~/.config/ngrok/ngrok.yml
```

#### 컴퓨터 B (다른 컴퓨터)
```bash
# 같은 토큰 설정
ngrok config add-authtoken 2wSH9o2UWqpCwUqcSpb8luGO2yo_3Vp29jaUBCcq1RtBnku5t
```

**장점**:
- ✅ 프로젝트 디렉토리에 토큰 파일 불필요
- ✅ 여러 프로젝트에서 같은 토큰 재사용
- ✅ Git에 포함될 위험 없음

---

### **방법 2: 환경 변수 사용**

#### .bashrc 또는 .zshrc에 추가
```bash
# Mac/Linux
echo 'export NGROK_AUTHTOKEN="2wSH9o2UWqpCwUqcSpb8luGO2yo_3Vp29jaUBCcq1RtBnku5t"' >> ~/.zshrc
source ~/.zshrc

# Windows (PowerShell)
[System.Environment]::SetEnvironmentVariable('NGROK_AUTHTOKEN', '2wSH9o2UWqpCwUqcSpb8luGO2yo_3Vp29jaUBCcq1RtBnku5t', 'User')
```

#### ngrok.yml에서 환경 변수 참조
```yaml
version: 2
authtoken: ${NGROK_AUTHTOKEN}

tunnels:
  frontend:
    domain: sol-manager.ngrok.app
    addr: 3000
```

---

### **방법 3: 로컬 설정 파일 (공유 안 함)**

#### ngrok.local.yml 생성 (.gitignore에 이미 추가됨)
```bash
# 프로젝트 루트에 생성
cat > ngrok.local.yml << EOF
version: 2
authtoken: 2wSH9o2UWqpCwUqcSpb8luGO2yo_3Vp29jaUBCcq1RtBnku5t

tunnels:
  frontend:
    domain: sol-manager.ngrok.app
    addr: 3000
  backend:
    domain: sol-backend.ngrok.dev
    addr: 8000
EOF

# 사용
ngrok start --all --config ngrok.local.yml
```

#### .gitignore에 추가
```
ngrok.local.yml
ngrok.*.yml
```

---

## 📦 다른 컴퓨터에서 프로젝트 실행하기

### **Step 1: 레포지토리 클론**
```bash
git clone https://github.com/yourname/muse-academy.git
cd muse-academy
```

### **Step 2: ngrok 토큰 설정 (각 컴퓨터마다 1회)**
```bash
# 방법 1: CLI 설정 (추천)
ngrok config add-authtoken YOUR_TOKEN

# 방법 2: 환경 변수
export NGROK_AUTHTOKEN="YOUR_TOKEN"
```

### **Step 3: 환경 변수 파일 생성**

#### 프론트엔드 .env
```bash
cp .env.example .env
# 편집기로 열어서 API 키 입력
```

#### 백엔드 .env
```bash
cd backend
cp .env.example .env
# 편집기로 열어서 필요한 값 입력
```

### **Step 4: 의존성 설치**
```bash
# 프론트엔드
npm install

# 백엔드
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### **Step 5: 실행**
```bash
# 프로젝트 루트에서
./start-dev.sh
```

---

## 🔑 API 키 공유 방법

### **팀원과 안전하게 공유하기**

#### ❌ 하지 말 것
- Git에 커밋
- 공개 채팅에 복사
- 스크린샷에 포함

#### ✅ 권장 방법

**방법 1: 암호화된 메신저**
- Signal, Telegram Secret Chat
- 일회성으로 전송 후 삭제

**방법 2: 비밀번호 관리자**
- 1Password, Bitwarden 팀 금고
- 접근 권한 관리 가능

**방법 3: .env 파일 암호화**
```bash
# GPG로 암호화
gpg -c .env  # → .env.gpg 생성
git add .env.gpg

# 복호화 (팀원)
gpg -d .env.gpg > .env
```

**방법 4: GitHub Secrets (CI/CD용)**
- Repository → Settings → Secrets
- Actions에서만 접근 가능

---

## 🛡️ 토큰 보안 체크리스트

### **정기 점검 (월 1회)**
- [ ] ngrok 대시보드에서 활성 세션 확인
- [ ] 의심스러운 접속 로그 검토
- [ ] 불필요한 도메인 삭제

### **토큰 재발급 시기**
- ✅ Git에 실수로 커밋한 경우
- ✅ 팀원 퇴사 시
- ✅ 의심스러운 활동 감지 시
- ✅ 6개월 주기로 정기 교체

### **재발급 방법**
1. https://dashboard.ngrok.com/tunnels/authtokens
2. 기존 토큰 삭제
3. 새 토큰 생성
4. 모든 컴퓨터에 재설정
   ```bash
   ngrok config add-authtoken NEW_TOKEN
   ```

---

## 📊 현재 프로젝트 보안 상태

### ✅ 안전하게 설정됨
- `.gitignore`에 모든 시크릿 파일 추가됨
- `ngrok.yml`에 실제 토큰 없음 (주석으로만 설명)
- 환경 변수 예시 파일 제공 (`.env.example`)

### ⚠️ 주의 필요
- `ngrok_token.md` 파일 존재 (Git에는 추가 안 됨)
- `backend/gemini_api_key.md` 파일 존재

### 🔧 권장 조치
```bash
# 1. Git 상태 확인
git status

# 2. 만약 ngrok_token.md가 staged 상태라면
git reset HEAD ngrok_token.md

# 3. 로컬에만 보관하거나 삭제
# (ngrok config add-authtoken으로 설정했다면 파일 불필요)
rm ngrok_token.md
rm backend/gemini_api_key.md  # API key도 .env에만 관리
```

---

## 🎯 결론

### **다른 컴퓨터에서 실행하려면:**

1. **토큰 파일 공유하지 마세요!**
2. **각 컴퓨터에서 개별적으로 설정:**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```
3. **환경 변수 파일만 로컬에서 생성:**
   ```bash
   cp .env.example .env
   # 편집기로 열어서 API 키 입력
   ```

### **이렇게 하면:**
- ✅ Git 레포지토리는 깔끔하게 유지
- ✅ 보안 위험 제거
- ✅ 팀원도 같은 방식으로 설정 가능
- ✅ 토큰이 노출되어도 재발급 후 즉시 무효화

---

## 🆘 긴급 상황 대응

### 토큰이 GitHub에 푸시된 경우
1. **즉시** ngrok 대시보드에서 토큰 삭제
2. 새 토큰 발급
3. Git 히스토리 정리 (위 참고)
4. 팀원에게 알림

### API 키가 노출된 경우
1. Google AI Studio에서 키 삭제
2. 새 키 발급
3. 모든 `.env` 파일 업데이트

---

**기억하세요**: 시크릿은 Git에 포함하지 않고, 각 환경에서 개별 설정하는 것이 가장 안전합니다! 🔒
