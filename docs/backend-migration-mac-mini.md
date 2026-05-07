# 백엔드 Mac mini 이관 가이드

> 대상: 새 Mac mini 에서 작업하는 에이전트 (Claude Code 등)
> 목적: 기존 사용자에게 **무중단(또는 최소 중단, 5~10분 이내)** 으로 SOL-ACT 백엔드를 이전 Mac → 새 Mac mini 로 옮긴다.
> 전제: 새 Mac은 macOS 이며, 외장 SSD 와 ngrok 예약 도메인은 한 대만 사용 가능하다.

---

## 0. 핵심 원칙 (반드시 숙지)

이 시스템은 다음 자원이 **단 하나뿐** 이며 둘 이상의 머신에서 동시에 사용할 수 없다.

| 자원 | 단일성 이유 |
|------|------------|
| ngrok 예약 도메인 `sol-backend.ngrok.dev` | 한 ngrok 계정/세션만 점유 가능. 두 곳에서 시작하면 뒤늦은 쪽이 거부됨. |
| ngrok 예약 도메인 `sol-manager.ngrok.app` | 동일 |
| 외장 SSD `/Volumes/SAMSUNG/sol-act-uploads` | 물리적 디스크. USB-C 로 한 머신에만 연결. |
| SQLite DB `backend/sol_act.db` | 실시간 쓰기 발생. 두 곳에서 동시에 열면 데이터 분기. |
| `.env` 의 `SECRET_KEY`, `VAPID_*` | 변경하면 기존 JWT 무효화 / 푸시 구독 무효화 → **절대 새로 만들지 말 것**. |

따라서 이관은 "기존 머신에서 서비스 중지 → 자원 이동 → 새 머신에서 서비스 시작" 의 **순차 컷오버** 로 진행한다.

---

## 1. 사전 점검 (이관 작업 시작 전)

### 1.1 새 Mac mini 에서 확인할 것

```bash
# macOS 버전
sw_vers

# 디스크 여유 공간 (최소 30GB 권장: SSD 백업용)
df -h /

# 인터넷 연결
ping -c 2 ngrok.com
```

### 1.2 기존 Mac 에서 확인할 것 (참고용)

```bash
# 현재 동작 중인 프로세스
ps aux | grep -E "uvicorn|ngrok|vite" | grep -v grep

# ngrok 도메인 확인
cat /Users/deryu/Documents/Sol-Act/muse-academy/ngrok.yml

# 외장 SSD 마운트 확인
ls /Volumes/SAMSUNG/sol-act-uploads | head

# DB 크기, 외장 SSD 용량
ls -lh /Users/deryu/Documents/Sol-Act/muse-academy/backend/sol_act.db
du -sh /Volumes/SAMSUNG/sol-act-uploads
```

`ngrok.yml` 에 정의된 도메인 (현재 시점):
- 프론트엔드: `sol-manager.ngrok.app` → :3001
- 백엔드: `sol-backend.ngrok.dev` → :8000

---

## 2. 새 Mac mini 사전 환경 구축 (서비스 중단 없이 가능)

> 이 단계는 기존 서버를 그대로 돌리며 미리 해두면 된다. 컷오버 시간을 짧게 만들기 위함.

### 2.1 Homebrew 설치

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 설치 후 PATH 적용 (Apple Silicon Mac mini 의 경우)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 2.2 필수 패키지 설치

```bash
brew install python@3.11 ffmpeg ngrok node git
```

설치 후 버전 확인 (기존 머신과 같은 메이저 버전이면 충분):

```bash
python3 --version    # 3.11.x  (기존이 3.9.6 이지만 3.11 도 호환)
ffmpeg -version | head -1
ngrok version
node --version
```

> **주의**: ffmpeg 는 반드시 시스템에 설치되어 있어야 한다. 백엔드의 영상 압축이 `ffmpeg` 셸 호출에 의존한다 ([backend/app/services/file_upload.py](../backend/app/services/file_upload.py)).

### 2.3 저장소 클론

```bash
mkdir -p ~/Documents/Sol-Act
cd ~/Documents/Sol-Act
git clone <기존 저장소 URL> muse-academy
cd muse-academy
```

> 만약 기존 머신에만 있는 미커밋 변경 사항이 있다면, 클론 대신 기존 저장소를 그대로 복사해도 된다 (`rsync` 권장):
> ```bash
> # 기존 Mac 에서 (네트워크 공유 또는 외장 디스크 경유)
> rsync -avz --exclude 'venv' --exclude 'node_modules' --exclude '__pycache__' \
>   --exclude 'logs' \
>   ~/Documents/Sol-Act/muse-academy/ <대상>:/Users/deryu/Documents/Sol-Act/muse-academy/
> ```

### 2.4 Python 가상환경 + 의존성

```bash
cd ~/Documents/Sol-Act/muse-academy/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

### 2.5 프론트엔드 빌드 의존성 (선택)

> 프로덕션은 정적 파일을 ngrok 으로 노출하므로 dev server 가 굳이 필요하진 않지만 [start-dev.sh](../start-dev.sh) 흐름을 그대로 쓰려면 설치한다.

```bash
cd ~/Documents/Sol-Act/muse-academy
npm install
```

### 2.6 ngrok 인증 (도메인 점유는 컷오버 단계에서만)

```bash
# 기존 머신에서 사용 중인 ngrok 계정의 authtoken 을 그대로 사용해야 함
# (그래야 같은 예약 도메인을 쓸 수 있다)
ngrok config add-authtoken <AUTHTOKEN>
```

`<AUTHTOKEN>` 은 https://dashboard.ngrok.com/get-started/your-authtoken 에서 확인한다. 기존 Mac 의 `~/Library/Application Support/ngrok/ngrok.yml` 에서도 추출 가능.

### 2.7 외장 SSD 라벨 확인

`.env` 의 `EXTERNAL_DRIVE_NAME` 값은 **마운트 경로 `/Volumes/<이름>` 의 `<이름>` 과 정확히 일치** 해야 한다 (현재 `SAMSUNG`).

새 Mac mini 에 SSD 를 시험 삼아 꽂아보면 자동으로 `/Volumes/SAMSUNG` 에 마운트되는지 확인할 수 있다 (확인 후 즉시 빼서 기존 Mac 으로 돌려놓을 것).

---

## 3. 컷오버 (실제 서비스 이전 — 이 단계에서만 다운타임 발생)

> 이 단계는 **사용자 트래픽이 적은 시간** 에 진행한다 (예: 새벽). 예상 소요 5~10분.
> 가능하면 사전에 학생/선생님께 "심야 서버 점검" 공지.

### 3.1 [기존 Mac] 서비스 정상 중지

```bash
# start-dev.sh 가 실행 중인 터미널에서 Ctrl+C
# 또는 명시적으로 종료:
pkill -f "uvicorn app.main:app"
pkill -f "ngrok start"
pkill -f "vite"

# 종료 확인
ps aux | grep -E "uvicorn|ngrok|vite" | grep -v grep
# 출력이 비어 있어야 함
```

이렇게 해야 ngrok 도메인이 풀려서 새 Mac mini 가 점유할 수 있다.

### 3.2 [기존 Mac] DB / .env / ngrok 설정 백업

```bash
cd ~/Documents/Sol-Act/muse-academy

# 작업용 임시 폴더
MIG=/tmp/sol-act-migration
mkdir -p $MIG

# SQLite DB (서비스가 멈춰있어야 안전)
cp backend/sol_act.db $MIG/sol_act.db

# .env (시크릿 — 외부 노출 금지)
cp backend/.env $MIG/backend.env

# ngrok 설정 (있다면)
[ -f ~/Library/Application\ Support/ngrok/ngrok.yml ] && \
  cp ~/Library/Application\ Support/ngrok/ngrok.yml $MIG/ngrok-global.yml
cp ngrok.yml $MIG/ngrok-project.yml 2>/dev/null || true

# VAPID 키가 별도 파일이라면 (현재는 .env 에 있으므로 보통 불필요)
[ -f backend/vapid_private_key.pem ] && cp backend/vapid_private_key.pem $MIG/

# 무결성 체크용 해시
shasum -a 256 $MIG/* > $MIG/checksums.txt
ls -la $MIG/
```

### 3.3 [기존 Mac] 외장 SSD 안전 분리

```bash
# 1) Finder 의 사이드바에서 SAMSUNG 옆 ⏏ 버튼 클릭
# 또는 터미널:
diskutil unmount /Volumes/SAMSUNG

# 2) 마운트 해제 확인
ls /Volumes/   # SAMSUNG 이 사라져야 함

# 3) USB 케이블을 물리적으로 분리
```

> **절대 마운트된 상태로 케이블을 뽑지 말 것** — fseventsd / Spotlight 가 쓰던 파일이 손상될 수 있다.

### 3.4 백업 파일을 새 Mac mini 로 전송

선호하는 방법 하나만 선택:

**방법 A: USB 메모리/외장 디스크 (가장 안전)**
```bash
# /tmp/sol-act-migration 폴더 통째로 복사
```

**방법 B: 같은 LAN 의 scp**
```bash
# 기존 Mac 에서:
scp -r /tmp/sol-act-migration deryu@<mac-mini-ip>:/tmp/
```

**방법 C: AirDrop** — 폴더 통째로 전송 가능.

### 3.5 [새 Mac mini] 백업 파일 복원

```bash
cd ~/Documents/Sol-Act/muse-academy
MIG=/tmp/sol-act-migration  # 또는 복사된 경로

# 무결성 검증
cd $MIG && shasum -a 256 -c checksums.txt
# 모든 줄 끝에 "OK" 가 떠야 함
cd -

# 1) DB 복원
cp $MIG/sol_act.db backend/sol_act.db
ls -lh backend/sol_act.db   # 사이즈가 백업과 일치해야 함

# 2) .env 복원
cp $MIG/backend.env backend/.env
chmod 600 backend/.env
cat backend/.env | grep -E "EXTERNAL_DRIVE_NAME|VAPID|SECRET_KEY" | sed 's/=.*/=***/'
# 키 항목들이 모두 채워져 있는지 마스킹 출력으로 확인

# 3) ngrok 프로젝트 설정 (저장소에 들어있으면 이미 동일하므로 보통 불필요)
diff $MIG/ngrok-project.yml ngrok.yml || cp $MIG/ngrok-project.yml ngrok.yml
```

### 3.6 [새 Mac mini] 외장 SSD 연결

```bash
# USB-C 로 SSD 를 새 Mac mini 에 꽂는다.
# 자동으로 /Volumes/SAMSUNG 에 마운트되는지 확인
ls /Volumes/SAMSUNG/sol-act-uploads | head

# 디스크 사용량이 기존(약 6.5GB)과 비슷한지 확인
du -sh /Volumes/SAMSUNG/sol-act-uploads
```

만약 마운트 이름이 `SAMSUNG 1` 등으로 다르게 나오면 (이전 동일 라벨 디스크 캐시가 남아있는 경우):
```bash
# 해당 디스크 식별
diskutil list

# 라벨 변경 (선택) — 또는 .env 의 EXTERNAL_DRIVE_NAME 을 새 라벨로 변경
diskutil rename "/Volumes/SAMSUNG 1" SAMSUNG
```

### 3.7 [새 Mac mini] 백엔드 단독 기동 테스트 (ngrok 없이)

```bash
cd ~/Documents/Sol-Act/muse-academy/backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

다른 터미널에서:
```bash
curl -i http://127.0.0.1:8000/docs       # 200 OK
curl -i http://127.0.0.1:8000/api/health 2>/dev/null || \
  curl -i http://127.0.0.1:8000/         # 라우트 응답 확인
```

서버 로그에서 다음을 확인:
- `EXTERNAL_DRIVE_NAME` 으로 외장 SSD 가 인식되는지 ([backend/app/services/file_upload.py](../backend/app/services/file_upload.py) `_resolve_upload_dir`)
- DB 마이그레이션이 정상인지 (alembic 자동 실행 또는 sqlite 파일 그대로 동작)

문제 없으면 Ctrl+C 로 종료하고 다음 단계로.

### 3.8 [새 Mac mini] ngrok + 백엔드 정식 기동

```bash
cd ~/Documents/Sol-Act/muse-academy
./start-dev.sh
```

기동 후 다음을 외부에서 (휴대전화 셀룰러 등 외부망) 확인:
```bash
curl -i https://sol-backend.ngrok.dev/docs
curl -i https://sol-manager.ngrok.app/
```

둘 다 200 응답이면 컷오버 성공.

---

## 4. 사후 검증 (서비스 정상화 확인)

### 4.1 기능 스모크 테스트

다음을 **실제 학생 계정으로** 검증:

1. **로그인** — 기존 토큰이 유효해야 함 (SECRET_KEY 동일하므로 OK).
2. **포트폴리오 영상 재생** — 기존 업로드 파일이 외장 SSD 에서 서빙되는지.
3. **새 영상 업로드** (chunked) — `/api/upload/chunked/init` → `/chunked/{id}` → `/complete` 흐름이 정상 작동하는지.
4. **푸시 알림** — 기존 PWA/모바일 앱에서 푸시가 수신되는지 (VAPID 키 동일하므로 기존 구독이 유효).
5. **모바일 앱 (Capacitor APK / iOS 빌드)** — 앱은 `https://sol-manager.com` 또는 `https://sol-manager.ngrok.app` 으로 접근하므로 도메인이 같으면 자동으로 새 서버를 가리킨다.

### 4.2 로그 모니터링

```bash
tail -f ~/Documents/Sol-Act/muse-academy/backend/logs/backend_$(date +%Y%m%d)*.log
```

다음 패턴이 보이면 정상:
- `Uvicorn running on http://0.0.0.0:8000`
- `Started server process`

다음 패턴은 즉시 조사:
- `External drive ... not found` → SSD 마운트/`EXTERNAL_DRIVE_NAME` 불일치
- `database is locked` → DB 권한/동시 접속 문제
- `401 Unauthorized` 가 광범위 → SECRET_KEY 변경 의심

### 4.3 sleep 방지

Mac mini 가 절전으로 들어가면 서비스가 끊어진다. `start-dev.sh` 가 `caffeinate` 를 쓰지 않으므로 별도 처리:

```bash
# 시스템 환경설정 → 에너지 절약 → "디스플레이가 꺼지면 컴퓨터가 자동으로 잠자기 못함"
# 또는 CLI:
sudo pmset -a sleep 0 displaysleep 0 disksleep 0
```

또는 ​start-dev.sh 를 `caffeinate -dims ./start-dev.sh` 로 감싸서 실행한다.

---

## 5. 롤백 플랜 (문제 발생 시 기존 Mac 으로 복귀)

새 Mac mini 에서 치명적 문제가 발견되면:

```bash
# [새 Mac mini] 서비스 중지
pkill -f "uvicorn|ngrok|vite"

# [새 Mac mini] SSD 안전 분리
diskutil unmount /Volumes/SAMSUNG
# 케이블 분리

# [기존 Mac] SSD 다시 연결
# [기존 Mac] start-dev.sh 재실행
cd ~/Documents/Sol-Act/muse-academy && ./start-dev.sh
```

> **중요**: 새 Mac mini 에서 운영 시간 동안 새 업로드/DB 변경이 발생했다면, 그 변경분을 기존 Mac 으로 다시 옮겨야 한다 (DB 파일 복사 + SSD 는 이미 물리적으로 이동). 따라서 컷오버 후 **첫 1시간은 새 머신을 면밀히 관찰** 한 뒤 안정 판정을 내릴 것.

---

## 6. 정리 (이관 완료 확정 후, 24시간 이상 안정 운영 후)

### 6.1 기존 Mac 정리

- 기존 Mac 의 `start-dev.sh` 가 자동 실행되지 않도록 launchd / cron / 시작 항목에서 제거.
- 기존 Mac 의 `backend/.env` 에서 시크릿 보존이 불필요하면 안전 삭제 (`shred` 또는 디스크 암호화 보장 후 `rm`).
- 기존 Mac 의 `backend/sol_act.db` 는 "최후 백업" 으로 보관해도 좋지만, 절대 다시 띄우지 말 것.

### 6.2 외부 의존성 갱신

다음 위치에 기록된 도메인이 여전히 동일한지 (변경 안 됐다면 작업 없음) 확인:

- [capacitor.config.ts](../capacitor.config.ts) — `server.url`
- [services/api.ts](../services/api.ts) — API base URL
- 학생 / 선생님께 배포된 모바일 앱 — 도메인이 같으므로 재배포 불요

### 6.3 백업 임시 폴더 삭제

```bash
# 양쪽 머신 모두
rm -rf /tmp/sol-act-migration
```

`.env` 와 DB 가 평문으로 들어있으므로 반드시 삭제.

---

## 7. 참고: 절대 하지 말아야 할 것

| 행동 | 결과 |
|------|------|
| 새 Mac mini 에서 `generate_vapid_keys.py` 재실행 | 모든 기존 푸시 구독 무효화 — 사용자가 수동 재구독해야 함 |
| `.env` 의 `SECRET_KEY` 새로 생성 | 모든 기존 JWT 토큰 즉시 만료 — 모든 사용자 강제 로그아웃 |
| 두 머신에서 ngrok 동시 실행 | 도메인 충돌, 서비스 불안정 |
| 서비스 가동 중 SSD 핫스왑 | 진행 중인 업로드 파일 손상 + DB 파일이 SSD 에 있다면 파손 |
| `git pull` 후 alembic 미적용 | 스키마 불일치로 500 에러 — 새 Mac 환경 구축 시 `alembic upgrade head` 실행 필수 (변경 마이그레이션이 있는 경우) |

---

## 8. 빠른 참조 — 컷오버 체크리스트

```
[기존 Mac]
  □ 서비스 중지 (uvicorn / ngrok / vite 모두 종료)
  □ sol_act.db 백업
  □ .env 백업
  □ ngrok.yml 백업
  □ 외장 SSD 마운트 해제 → 케이블 분리

[전송]
  □ 백업 폴더를 새 Mac mini 로 전송 (USB/scp/AirDrop)
  □ 무결성 해시 검증

[새 Mac mini — 사전 준비 완료 가정]
  □ Homebrew, python@3.11, ffmpeg, ngrok, node, git 설치됨
  □ 저장소 클론, venv 생성, pip install 완료
  □ ngrok authtoken 등록됨

[새 Mac mini — 컷오버 실행]
  □ sol_act.db 복원
  □ .env 복원 (chmod 600)
  □ 외장 SSD 연결 → /Volumes/SAMSUNG 자동 마운트 확인
  □ uvicorn 단독 기동 → /docs 200 응답 확인
  □ ./start-dev.sh 실행
  □ 외부망에서 https://sol-backend.ngrok.dev/docs 200 응답 확인
  □ 학생 계정으로 로그인/영상 재생/업로드/푸시 검증
  □ pmset 으로 절전 차단

[24h 안정 후]
  □ 기존 Mac 자동 시작 항목 제거
  □ 임시 백업 폴더 삭제 (양쪽)
```
