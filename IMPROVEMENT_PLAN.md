# Muse Academy 개선 계획서

## 1단계: 데이터 접근 권한 보안 (Critical)

학생이 다른 학생/선생님의 데이터를 API 직접 호출로 열람할 수 있는 보안 결함.
프론트엔드 필터링만 있고 백엔드 필터링이 누락된 경우가 대부분.

### 1-1. 수업일지 (Journals) — 학생에게 선생님 일지 노출

- **파일**: `backend/app/routers/journals.py:35-64`
- **현재**: 학생 쿼리에 필터 없음. 선생님이 작성한 일지(objectives, next_plan 포함)가 학생에게 노출
- **수정**:
  - 학생: 본인이 작성한 일지만 조회 (`author_id == current_user.id`)
  - 또는 학생 작성 일지 + 본인 수업의 선생님 일지 중 objectives/next_plan 필드 제외
  - GET `/{id}` 엔드포인트에도 접근 제어 추가

### 1-2. 평가 (Evaluations) — 학생이 다른 학생 평가 열람 가능

- **파일**: `backend/app/routers/evaluations.py:43-74`
- **현재**: 선생님만 필터링됨. 학생은 전체 평가 목록 조회 가능
- **수정**: 학생은 `student_id == current_user.id` 필터 추가
- **프론트엔드**: Growth.tsx:155-158에서 이미 필터링하지만 백엔드 보호 필수

### 1-3. 과제 (Assignments) — 학생이 다른 학생 제출물 열람 가능

- **파일**: `backend/app/routers/assignments.py:39-63`
- **현재**: 선생님만 필터링됨. 학생은 전체 과제 조회 가능
- **수정**: 학생은 `student_id == current_user.id` 필터 추가
- GET `/{id}` 엔드포인트에도 본인 과제인지 확인 필요

### 1-4. 포트폴리오 (Portfolios) — 학생이 다른 학생 포트폴리오 열람 가능

- **파일**: `backend/app/routers/portfolios.py:75-99`
- **현재**: 선생님만 필터링됨. 학생은 전체 포트폴리오 조회 가능
- **수정**: 학생은 `student_id == current_user.id` 필터 추가
- 댓글 작성도 본인 포트폴리오 또는 담당 선생님/원장만 허용
- practice_groups 엔드포인트도 동일 필터 적용

### 1-5. 출결 (Attendance) — 전체 출결 기록 무제한 조회

- **파일**: `backend/app/routers/attendance.py:33-46`
- **현재**: 역할 기반 필터 없음. 모든 사용자가 모든 출결 조회 가능
- **수정**:
  - 학생: 본인 출결만 (`student_id == current_user.id`)
  - 선생님: 담당 클래스 학생만 (`get_teacher_student_ids()`)
  - stats 엔드포인트(50-91)도 동일 적용

### 1-6. 공지 (Notices) — 클래스 공지 접근 검증 없음

- **파일**: `backend/app/routers/notices.py:15-25`
- **현재**: `?class_id=X` 파라미터로 아무 클래스 공지 조회 가능
- **수정**: 요청자가 해당 클래스 소속인지 `validate_class_access()` 검증

---

## 2단계: 백엔드 성능/안정성 (High)

### 2-1. N+1 쿼리 최적화

- **파일**: `backend/app/services/notification_service.py:254-300`
- **문제**: `get_teacher_class_ids()`, `get_teacher_student_ids()`, `get_teacher_ids_for_student()` 모두 전체 클래스를 로드 후 파이썬에서 필터
- **수정**: JSON 필드 내 값 검색을 SQL 레벨에서 처리 (SQLite JSON 함수 또는 like 쿼리)
- **영향**: 채팅, 일지, 수업, 출결 등 거의 모든 엔드포인트에서 호출됨

### 2-2. Admin 라우터 최적화

- **파일**: `backend/app/routers/admin.py:46-72`
- **문제**: 학생별로 전체 클래스를 반복 탐색 (O(students * classes))
- **수정**: JOIN 쿼리로 변환하거나 클래스별 학생 맵 사전 구축

### 2-3. DB 인덱스 추가

- **파일**: 전체 `backend/app/models/`
- **대상 컬럼**:
  - `lesson.date`, `lesson.class_id`, `lesson.teacher_id`
  - `assignment.student_id`, `assignment.assigned_by`
  - `portfolio.student_id`
  - `attendance.lesson_id`, `attendance.student_id`
  - `evaluation.student_id`, `evaluation.class_id`
- **방법**: Alembic 마이그레이션으로 `index=True` 추가
- **주의**: 기존 데이터 영향 없음 (인덱스 추가만)

### 2-4. WebSocket 예외 처리

- **파일**: `backend/app/routers/ws.py:51-95`
- **문제**: 잘못된 JSON 수신 시 예외로 연결 크래시
- **수정**: `websocket.receive_json()` 주변에 try-except 추가, 에러 메시지 반환

### 2-5. WebSocket 토큰 만료 검증

- **파일**: `backend/app/routers/ws.py:16-21`
- **문제**: JWT 디코드만 하고 만료 검증 안 함
- **수정**: `jwt.decode()` 시 `options={"verify_exp": True}` 확인

---

## 3단계: 데이터 무결성 (High)

### 3-1. 초대코드 중복 생성 방지

- **파일**: `backend/app/routers/auth.py:232-237`
- **문제**: 동시 요청 시 동일 코드 생성 가능 (check-then-insert race condition)
- **수정**: DB unique constraint + retry 로직

### 3-2. 개인레슨 승인 트랜잭션

- **파일**: `backend/app/routers/private_lessons.py:113-135`
- **문제**: 상태 변경 + 수업 생성이 원자적이지 않음
- **수정**: `db.begin_nested()` 또는 명시적 트랜잭션 사용

### 3-3. 출결 중복 생성 경합

- **파일**: `backend/app/routers/attendance.py:114-138`
- **문제**: 중복 체크 후 생성 사이에 다른 요청이 끼어들 수 있음
- **수정**: DB unique constraint (lesson_id + student_id) + upsert 패턴

### 3-4. 과제 상태 전이 검증

- **파일**: `backend/app/routers/assignments.py`
- **문제**: 아무 상태에서 아무 상태로 변경 가능
- **수정**: 허용 전이 맵 정의 (pending -> submitted -> graded)

---

## 4단계: 프론트엔드 UX 개선 (Medium)

### 4-1. 대시보드 로딩 상태

- **파일**: `components/Dashboard.tsx:29-107`
- **문제**: 로딩 중 통계 카드가 0으로 표시 — 데이터 없는 것처럼 보임
- **수정**: 로딩 중 스켈레톤 UI 또는 스피너 표시

### 4-2. 폼 필수 항목 표시

- **파일**: 전체 모달 폼 (Assignments, Growth, Lessons 등)
- **문제**: 필수 항목 표시 없음, 버튼 비활성화 사유 불명
- **수정**: 필수 필드에 * 표시, 제출 시 인라인 에러 메시지

### 4-3. 날짜 포맷 통일

- **파일**: 전체 컴포넌트
- **문제**: YYYY-MM-DD, "3월 5일", locale 기본값 혼재
- **수정**: `services/dateUtils.ts`에 공통 포맷 함수 추가, 전체 교체

### 4-4. 에러 메시지 구체화

- **파일**: 전체 컴포넌트 (131개 toast 호출)
- **문제**: "실패했습니다" 일괄 — 원인 구분 불가
- **수정**:
  - 네트워크 오류: "인터넷 연결을 확인해주세요"
  - 권한 오류: "접근 권한이 없습니다"
  - 검증 오류: 서버 반환 메시지 표시
  - api.ts의 apiRequest에서 에러 타입별 분기

### 4-5. 업로드 진행 상태 영속화

- **파일**: `components/Growth.tsx:241-292`
- **문제**: 페이지 이동 시 업로드 상태 유실
- **수정**: 업로드 상태를 App 레벨로 끌어올리거나 글로벌 스토어 사용
- 업로드 중 알림 배너를 App.tsx에 표시

### 4-6. 포트폴리오 등록 폼 간소화

- **파일**: `components/Growth.tsx:1037-1116`
- **문제**: 카테고리, 태그, 연습시리즈, 설명 등 선택사항이 많아 학생 부담
- **수정**:
  - 기본 폼: 제목 + 영상 파일만 (2개 필드)
  - "상세 설정" 접기/펼치기로 카테고리, 태그, 시리즈, 설명 숨김
  - 카테고리 기본값 '기타' 자동 선택

### 4-7. 오프라인/연결 끊김 표시

- **파일**: `App.tsx`
- **문제**: 인터넷 끊겨도 표시 없음
- **수정**: `navigator.onLine` + `online/offline` 이벤트로 상단 배너 표시

### 4-8. 모달 닫기 동작 통일

- **파일**: 전체 모달 컴포넌트
- **문제**: X 버튼, 배경 클릭, 취소 버튼 — 컴포넌트마다 다름
- **수정**: 공통 Modal 래퍼 컴포넌트 생성, 배경 클릭 + ESC 키 + X 버튼 통일

---

## 5단계: 백엔드 보안 강화 (Medium)

### 5-1. 로그인 Rate Limiting

- **파일**: `backend/app/routers/auth.py:70-88`
- **문제**: 무차별 대입 공격에 취약
- **수정**: slowapi 또는 커스텀 미들웨어로 IP당 분당 10회 제한

### 5-2. 파일 업로드 사전 검증

- **파일**: `backend/app/services/file_upload.py`, `backend/app/routers/upload.py`
- **문제**: 파일 크기를 스트리밍 중에만 체크, 실패 시 고아 파일 잔류
- **수정**:
  - Content-Length 헤더 사전 체크
  - DB 커밋 실패 시 파일 삭제 롤백
  - 영상 압축 실패 시 원본 유지

### 5-3. 채팅 메시지 입력 검증

- **파일**: `backend/app/routers/chat.py:127-139`
- **문제**: 메시지 내용이 검증 없이 저장됨
- **수정**: HTML 태그 제거 (bleach 또는 strip_tags), 최대 길이 제한

---

## 6단계: 서비스/타입 안전성 (Medium)

### 6-1. API 타입 안전성

- **파일**: `services/api.ts`
- **문제**: 다수의 `data: any` 파라미터 (라인 259, 265, 280, 343 등)
- **수정**: 각 엔드포인트별 Request 타입 정의 후 적용

### 6-2. 토큰 만료 처리

- **파일**: `services/api.ts:114-117`, `services/useWebSocket.ts:43`
- **문제**: 401 시 하드 리로드 — 작성 중 폼 데이터 유실
- **수정**: 로그인 페이지로 리다이렉트 + 미저장 데이터 경고

### 6-3. WebSocket 하트비트

- **파일**: `services/useWebSocket.ts`
- **문제**: 끊긴 연결 감지 불가
- **수정**: 30초 간격 ping 전송, 응답 없으면 재연결

### 6-4. State 관리 개선

- **파일**: `App.tsx`, 전체 컴포넌트
- **문제**: allUsers, classes를 모든 컴포넌트에 prop drilling
- **수정**: React Context 도입 (UserContext, ClassContext)
- **우선순위**: 낮음 — 기능에는 영향 없음

---

## 7단계: 코드 품질/일관성 (Low)

### 7-1. 페이지네이션

- **파일**: 전체 list 엔드포인트
- **문제**: 모든 데이터를 한번에 로드
- **수정**: `?page=1&limit=20` 파라미터 추가 (데이터가 많아지면)

### 7-2. 접근성 (a11y)

- **파일**: 전체 컴포넌트
- **문제**: aria-label 0개, htmlFor 미연결, 키보드 네비게이션 미지원
- **수정**: 아이콘 버튼에 aria-label, 폼 라벨에 htmlFor, 모달에 focus trap

### 7-3. UI 일관성

- 버튼 스타일, 상태 뱃지 색상, input focus 스타일 통일
- 공통 컴포넌트 (Button, Badge, Input) 추출

### 7-4. 빌드 설정

- `vite.config.ts`: GEMINI_API_KEY 빌드 노출 검토
- `tsconfig.json`: strict 모드 활성화 검토
- 테스트 프레임워크 도입 (vitest)

---

## 실행 우선순위

| 단계 | 내용 | 예상 작업량 | DB 마이그레이션 |
|------|------|------------|----------------|
| 1단계 | 데이터 접근 권한 | 백엔드 6개 파일 수정 | 없음 |
| 2단계 | 성능/안정성 | 백엔드 4개 파일 수정 | 인덱스 추가 |
| 3단계 | 데이터 무결성 | 백엔드 4개 파일 수정 | unique constraint |
| 4단계 | UX 개선 | 프론트 8개 파일 수정 | 없음 |
| 5단계 | 보안 강화 | 백엔드 3개 파일 수정 | 없음 |
| 6단계 | 타입/서비스 | 프론트 3개 파일 수정 | 없음 |
| 7단계 | 코드 품질 | 전체 | 없음 |

## 참고: 정상 구현 확인된 영역

- 식단 (Diet): 역할별 필터 정상
- 채팅 (Chat): validate_class_access 적용 완료
- 개인레슨 (Private Lessons): 역할별 스코핑 정상
- 초대코드: 원장 전용 정상
- 사용자 삭제: 원장 전용 + 본인 삭제 방지 정상
