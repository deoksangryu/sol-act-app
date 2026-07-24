# SOL-ACT 신규 기능 플랜 — 모의테스트 · 운동습관 · AI 질의응답 첨삭

> 이 문서는 **초보자도 이해할 수 있게** 쓴 구현 계획서입니다. "무엇을 왜 만드는지 → 어떻게 만드는지(기존 코드 재사용) → 어떻게 테스트하는지 → 어떤 순서로" 순으로 읽으시면 됩니다. (승인 완료: 2026-07-23)

---

## 0. Context — 왜 이걸 만드나

원장님이 매달 **모의테스트**를 볼 때, 지금은 카톡으로 학생마다 개별 메시지로 음원을 받아 손으로 정리합니다. 시험 영상도 따로 나눠줘야 합니다. 이 반복 노동을 앱 안으로 옮기고, 나아가 **꾸준한 운동 습관**과 **AI 답변 첨삭**까지 학습 도구로 넣는 것이 목표입니다.

만들 기능은 3가지입니다(요청하신 "영상 개인별 배포"는 기능 1에 포함):
1. **모의테스트** — 원장이 시험을 만들고 학생 순번을 정함 → 학생이 음원 업로드 → 원장이 한곳에서 다운로드 → 원장이 학생별 시험영상 업로드 → 학생이 본인 영상 조회. 공지도 자동 발송.
2. **운동 습관 형성** — 학생이 매일 운동을 체크하고 연속기록·박수로 꾸준함을 유도.
3. **AI 질의응답 첨삭** — 학생이 면접(입시 질의응답) 답변을 쓰면 AI가 더 나은 답변 + 개선점을 돌려줌.

**핵심 원칙**: 새 코드를 최소화하고 **이미 있는 구조를 재사용**합니다. 이 앱은 이미 갖췄습니다 — 파일/청크 업로드+DB패치, 원장 권한체크, 반배정 게이트, 알림 배치발송, 공지 타겟팅, 포인트·연속기록(streak)·뱃지, 루틴 체크인.

---

## 0-1. 배포 경로 (초보자 필독 — 바꾸면 어떻게 반영되나)

| 바꾸는 곳 | 예 | 어떻게 반영되나 |
|---|---|---|
| 🟢 **백엔드(Python)** | 새 API, DB 테이블, AI 로직 | 맥미니에서 `bash scripts/start.sh`로 **백엔드만 재시작**하면 끝. 앱 재빌드 불필요. |
| 🔴 **앱 화면(React Native)** | 새 화면·버튼·탭 | 화면(JS)을 **앱 안에 구워 넣습니다**(원격 로드 아님). 화면을 바꾸면 **새 빌드(AAB/iOS 아카이브) → 테스트 트랙 재업로드**가 필요. |

> ⚠️ 이 3개 기능은 **백엔드(재시작만) + 앱 화면(재빌드 필요)** 이 섞여 있습니다. **네이티브 모듈(업로드 엔진)은 무변경** → 화면 재빌드만 하면 됩니다.

---

## 기능 1: 모의테스트 (음원 수집 + 영상 배포 + 공지)

### 사용자 흐름
1. **원장**: "모의테스트 만들기" → 제목·날짜 → **참여 학생 선택 + 순번** → 저장 → (선택)**공지 발송**.
2. **학생**: 홈/알림에서 확인 → 본인 **음원 업로드**(mp3/m4a/wav).
3. **원장**: 상세에서 **학생별 음원을 순번대로 나열 + 다운로드**.
4. 시험 후 **원장**: 학생별 **시험 영상 업로드**.
5. **학생**: "내 모의테스트 영상"에서 **본인 영상만 조회·재생**.

### 재사용하는 기존 코드
- 원장 전용 생성·삭제: `backend/app/routers/exams.py:57-76`.
- 순번(sort_order): `backend/app/models/portfolio.py:41-42`(PortfolioVideo.sort_order).
- 파일 업로드+DB패치: `backend/app/routers/upload.py`의 `_patch_target_file()`. `target_type`에 `mock_test_audio`/`mock_test_video` 추가.
- 오디오 확장자: `file_upload.py:48-50`에 `.mp3/.m4a/.wav` 이미 허용.
- 다운로드 서빙: `main.py` `/uploads/`(경로우회 가드 포함).
- 공지: `backend/app/routers/notices.py:76-127`, 알림: `notify_users()`.

### 새로 만드는 것 — 백엔드 🟢
`backend/app/models/mock_test.py`(신규): `MockTest`, `MockTestEntry`(sort_order·audio_url·status), `MockTestVideo`(원장 업로드, 여러 개).
`backend/app/routers/mock_tests.py`(신규): 원장(생성/목록/상세/공지/영상업로드/순번), 학생(내 목록/음원업로드/내 영상). `main.py` 등록(학생 접근분 GATE). `upload.py._patch_target_file()`에 분기 추가.
> 모두 **새 테이블** → `create_all`이 자동 생성(기존 데이터 무접촉, 동의 불필요). 백엔드 재시작 시 반영.

### 새로 만드는 것 — 앱 화면 🔴
원장: `MockTestAdminScreen`/`MockTestCreateScreen`/`MockTestDetailScreen`. 학생: `MockTestScreen`. 재사용 UI: kit.tsx·gamify.tsx, 업로드 nativeUpload.ts/UploadContext. `api.ts`에 `mockTestApi`.

---

## 기능 2: 운동 습관 형성

### 재사용 (약 90%)
루틴 체크인(`routers/routines.py`), 포인트·연속(`services/gamify.py::record_action`), 뱃지(`achievements.py:24-34`), UI `ClapCheckRow`(gamify.tsx:118-151), `routinesApi`.

### 새로 만드는 것 — 백엔드 🟢 (작음)
- `RoutineItem`에 **`category` 컬럼 추가**("routine"/"exercise"). `create_all`은 기존 테이블 컬럼 자동추가 불가 → **ALTER 1줄 필요, 데이터 변경이라 사용자 동의 후**.
- `GET /api/routines/today?category=exercise` 필터, 운동 기본항목 시드, 운동 뱃지(`exercise7`/`exercise30`).

### 새로 만드는 것 — 앱 화면 🔴 (작음)
학생 화면에 "운동" 섹션(`ClapCheckRow` + 연속기록). `routinesApi.today('exercise')`.

---

## 기능 3: AI 질의응답 첨삭

### 재사용
`services/ai.py`(placeholder, 함수 시그니처 존재), `config.py:20-21` GEMINI_API_KEY, `requirements.txt:18` google-generativeai 설치됨, `content.py:141` 면접질문, qna `Answer.is_ai`, 프론트 `v2Student.tsx:208` 질의응답 섹션.

### 새로 만드는 것 — 백엔드 🟢
`ai.py`에 `revise_interview_answer(question, answer)->{revised, feedback, score}`(Gemini 1.5 Flash, 무료티어, 키없음/실패 폴백). 라우터 `POST /api/ai/interview-revise`(입력길이·빈도 제한).

### 새로 만드는 것 — 앱 화면 🔴
"배움" 질의응답에 "AI 답변 첨삭" 화면(질문→답변입력→결과 카드).

### ⚠️ 개인정보·스토어 (반드시)
학생 답변을 **Google(Gemini)로 전송** = 제3자. 게시된 방침 4항에 "AI 분석… 현재 비활성" 기재됨 → **기능 켜면 "활성"으로 갱신 + Play 데이터안전/App Privacy 라벨 반영**. 키는 `.env`(gitignore)에만.

---

## E2E 테스트 계획 (에뮬 3계정·실시간·전 기능)

에뮬 3대(학생5554·교사5556·원장5558) + 백엔드 가동. 역할 간 실시간 왕복 검증(WS `useDataRefresh`).

| # | 기능 | 시나리오 | 성공 기준 |
|---|---|---|---|
| 1 | 모의테스트 생성·공지 | 원장 생성+순번→공지 | 학생 홈/알림 라이브 공지, DB 생성 |
| 2 | 학생 음원 업로드 | 학생 mp3→원장 다운로드 | Entry.audio_url, 순번 정렬, 재생 |
| 3 | 원장 영상 배포 | 원장 영상→학생 재생 | MockTestVideo, 본인 것만(타학생 차단) |
| 4 | 운동 습관 | 학생 체크→박수·연속·뱃지 | RoutineCompletion, PointLedger, Streak |
| 5 | AI 첨삭 | 답변입력→결과 | Gemini 응답, 폴백, 응답시간 |
| 6 | 회귀 | 기존 기능 | 안 깨짐 |

**PII**: 실제 학생 PII 캡처/덤프 안 함 — 테스트 계정 화면만.

---

## 구현 순서
1. 백엔드1(🟢): 모의테스트 모델·라우터+upload패치+운동 category/시드/뱃지 → 동의 후 DB, curl 검증.
2. 백엔드2(🟢): AI 함수+라우터(키는 사용자가 .env에).
3. 앱 화면(🔴): 원장/학생 모의테스트→운동→AI, tsc 통과.
4. 빌드: 한 번에 AAB(versionCode+1)+iOS 아카이브→재업로드.
5. E2E: 3에뮬 실시간.
6. AI 켜면 방침·데이터안전 갱신.

> 프로덕션 백엔드는 사용자가 직접 재시작. DB 컬럼 추가는 동의 후. 커밋은 단계마다.

---

## 사용자 체크리스트
- [ ] Gemini API 키(무료, aistudio.google.com) → `backend/.env` `GEMINI_API_KEY=...`
- [ ] 운동 기본항목 확정(스트레칭·유산소·근력 + 보상)
- [ ] `RoutineItem.category` ALTER 동의(무손실)
- [ ] 모의테스트 순번: 수동 vs 자동
- [ ] AI 켤 때 방침·데이터라벨 갱신 인지

---

## 검증
백엔드=격리(포트8001+throwaway DB) curl. 타입=`npx tsc --noEmit`. 빌드=bundleRelease/Xcode Archive. E2E=3에뮬.

## 규모
큰것=모의테스트, 중간=AI첨삭, 작은것=운동. 셋 다 네이티브 무변경(화면 재빌드만).
