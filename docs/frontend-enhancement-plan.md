# 프론트엔드 개선 계획서

> 작성일: 2026-03-22
> 상태: 미착수
> 대상 파일 수: ~12개
> DB 마이그레이션: 없음

---

## 목차

1. [Error Boundary 추가](#1-error-boundary-추가)
2. [폼 유효성 검사 강화](#2-폼-유효성-검사-강화)
3. [로딩 스켈레톤](#3-로딩-스켈레톤)
4. [출석 통계 시각화](#4-출석-통계-시각화)
5. [종합 평가 리포트](#5-종합-평가-리포트)
6. [개인레슨 요청 워크플로우 개선](#6-개인레슨-요청-워크플로우-개선)

---

## 1. Error Boundary 추가

### 현재 상태
- React Error Boundary 없음
- 컴포넌트 렌더링 에러 시 전체 앱이 흰 화면으로 크래시
- 에러 정보가 콘솔에만 표시됨

### 구현 방안

#### 1-1. ErrorBoundary 컴포넌트 생성
**새 파일:** `components/ErrorBoundary.tsx`

```tsx
// Class component (Error Boundary는 클래스 컴포넌트 필수)
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) → { hasError: true, error }
  componentDidCatch(error, errorInfo) → console.error + 선택적 에러 리포팅

  // Fallback UI:
  // - 에러 아이콘 + "문제가 발생했습니다" 메시지
  // - "다시 시도" 버튼 → state 리셋으로 재렌더링
  // - "홈으로" 버튼 → 대시보드로 이동
}
```

#### 1-2. App.tsx에 적용
**수정 파일:** `App.tsx`

```tsx
// 각 뷰를 ErrorBoundary로 감싸기
// key={currentView}로 뷰 전환 시 에러 상태 자동 리셋
<ErrorBoundary key={currentView}>
  {currentView === 'lessons' && <Lessons ... />}
  {currentView === 'growth' && <Growth ... />}
  ...
</ErrorBoundary>
```

**핵심 포인트:**
- `key` prop을 사용해 뷰 전환 시 ErrorBoundary 리셋
- 에러 발생해도 Sidebar/MobileNav는 정상 작동 유지
- 다른 뷰로 이동 가능

### 수정 파일
| 파일 | 변경 |
|------|------|
| `components/ErrorBoundary.tsx` | 신규 생성 |
| `App.tsx` | ErrorBoundary 래핑 |

---

## 2. 폼 유효성 검사 강화

### 현재 상태
- 대부분 `if (!field) return;` 가드 클라우스만 사용
- 사용자에게 "어떤 필드가 비었는지" 피드백 없음
- 유일하게 Password만 규칙별 실시간 검증 존재 (Login.tsx, ProfileSettings.tsx)

### 구현 방안

#### 2-1. useFormValidation 훅 생성
**새 파일:** `services/useFormValidation.ts`

```typescript
// 범용 폼 검증 훅
function useFormValidation<T>(rules: ValidationRules<T>) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const validate = (data: T): boolean → {
    // rules에 따라 검증, errors 상태 업데이트
    // 첫 번째 에러 필드에 포커스
    return isValid;
  };

  const clearError = (field: keyof T) → {
    // 개별 필드 에러 클리어 (onChange 시)
  };

  return { errors, validate, clearError };
}

// 규칙 예시
type ValidationRule = {
  required?: string;           // "수업 날짜를 선택해주세요"
  minLength?: [number, string]; // [10, "10자 이상 입력해주세요"]
  custom?: (value) => string | null;
};
```

#### 2-2. FormInput 컴포넌트 에러 표시 확장
**수정 파일:** `components/ui/FormInput.tsx`

```tsx
// 기존 props에 error 추가
interface FormInputProps {
  error?: string;  // 추가
  // ... 기존 props
}

// error가 있으면:
// - 테두리 빨간색 (border-red-400)
// - 아래에 에러 메시지 텍스트 (text-red-500 text-xs)
```

#### 2-3. 주요 폼에 검증 적용

**Lessons.tsx — 수업 생성 폼:**
| 필드 | 검증 규칙 | 에러 메시지 |
|------|----------|------------|
| classId | required | "클래스를 선택해주세요" |
| date | required | "수업 날짜를 선택해주세요" |
| subject | required | "과목을 선택해주세요" |
| startTime | required | "시작 시간을 입력해주세요" |

**Lessons.tsx — 개인레슨 신청:**
| 필드 | 검증 규칙 | 에러 메시지 |
|------|----------|------------|
| teacherId | required | "선생님을 선택해주세요" |
| subject | required | "과목을 선택해주세요" |
| date | required | "희망 날짜를 선택해주세요" |
| reason | required, minLength(5) | "신청 사유를 입력해주세요" |

**Growth.tsx — 평가 폼:**
| 필드 | 검증 규칙 | 에러 메시지 |
|------|----------|------------|
| studentId | required | "학생을 선택해주세요" |
| period | required | "평가 기간을 입력해주세요" |

**Classes.tsx — 클래스 생성:**
| 필드 | 검증 규칙 | 에러 메시지 |
|------|----------|------------|
| name | required | "클래스 이름을 입력해주세요" |
| teacherId | required | "담당 선생님을 선택해주세요" |
| subject | required | "과목을 선택해주세요" |

**Assignments.tsx — 과제 생성:**
| 필드 | 검증 규칙 | 에러 메시지 |
|------|----------|------------|
| title | required | "과제 제목을 입력해주세요" |
| description | required | "과제 내용을 입력해주세요" |
| dueDate | required | "마감일을 선택해주세요" |

### 적용 방식
- 기존 `if (!field) return;` 패턴을 `if (!validate(data)) return;`으로 교체
- 각 input의 onChange에서 `clearError(fieldName)` 호출 → 타이핑 시 에러 즉시 제거
- 라이브러리 추가 없음 (커스텀 훅으로 해결)

### 수정 파일
| 파일 | 변경 |
|------|------|
| `services/useFormValidation.ts` | 신규 생성 |
| `components/ui/FormInput.tsx` | error prop 추가 |
| `components/Lessons.tsx` | 수업 생성 + 개인레슨 폼 검증 |
| `components/Growth.tsx` | 평가 폼 검증 |
| `components/Classes.tsx` | 클래스 생성 폼 검증 |
| `components/Assignments.tsx` | 과제 생성 폼 검증 |

---

## 3. 로딩 스켈레톤

### 현재 상태
- 데이터 로딩 시 중앙 스피너만 표시
- 콘텐츠 로드 후 레이아웃 시프트 발생
- Dashboard 통계 카드만 `animate-pulse` 스켈레톤 부분 적용

### 구현 방안

#### 3-1. Skeleton 기본 컴포넌트
**새 파일:** `components/ui/Skeleton.tsx`

```tsx
// 기본 블록 스켈레톤
function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />;
}

// 카드형 스켈레톤 (수업, 과제, 포트폴리오 등에 재사용)
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />    {/* 제목 */}
      <Skeleton className="h-3 w-1/2" />    {/* 부제목 */}
      <Skeleton className="h-3 w-full" />   {/* 내용 */}
    </div>
  );
}

// 리스트형 스켈레톤
function SkeletonList({ count = 3 }: { count?: number }) {
  return Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />);
}
```

#### 3-2. 컴포넌트별 스켈레톤 적용

**Dashboard.tsx:**
- 통계 카드 4개: 이미 부분 적용 → 통일된 Skeleton 컴포넌트로 교체
- 오늘의 수업 섹션: SkeletonList(2)
- 다가오는 행사 섹션: SkeletonList(2)

**Lessons.tsx:**
- 캘린더 영역: 날짜 그리드 스켈레톤
- 수업 목록: SkeletonCard × 3

**Growth.tsx:**
- 포트폴리오 그리드: 카드형 스켈레톤 × 4 (2×2)
- 평가 목록: SkeletonCard × 2
- 타임라인 뷰: 타임라인 아이템 스켈레톤

**Assignments.tsx:**
- 과제 카드 목록: SkeletonCard × 3

**Diet.tsx:**
- 식단 기록 리스트: SkeletonCard × 3

#### 3-3. 적용 패턴

```tsx
// 기존
if (loading) return <div className="flex justify-center"><Spinner /></div>;

// 변경
if (loading) return (
  <div className="space-y-4 p-4">
    <SkeletonList count={3} />
  </div>
);
```

### 수정 파일
| 파일 | 변경 |
|------|------|
| `components/ui/Skeleton.tsx` | 신규 생성 |
| `components/Dashboard.tsx` | 스켈레톤 적용 |
| `components/Lessons.tsx` | 스켈레톤 적용 |
| `components/Growth.tsx` | 스켈레톤 적용 |
| `components/Assignments.tsx` | 스켈레톤 적용 |
| `components/Diet.tsx` | 스켈레톤 적용 |

---

## 4. 출석 통계 시각화

### 현재 상태
- 백엔드 `GET /api/attendance/stats` 존재 (출석/지각/결석/사유결석 카운트 + 출석률)
- 프론트엔드에서 이 API 미사용
- 출석은 수업별로만 기록/조회 가능

### 구현 방안

#### 4-1. Dashboard 출석률 위젯 추가
**수정 파일:** `components/Dashboard.tsx`

**학생 대시보드:**
- 기존 4개 통계 카드 중 "D-DAY" 카드 → 출석률 카드로 교체하거나 5번째 카드 추가
- 출석률 원형 게이지 표시 (CSS로 구현, 라이브러리 없음)

```
┌──────────────────┐
│   출석률  92%     │
│   ●●●●●●●●○○    │  ← CSS 원형 프로그레스
│   출석 23 지각 2   │
│   결석 1  사유 1   │
└──────────────────┘
```

**원장 대시보드:**
- 전체 학생 출석률 평균 표시
- 최근 7일 출석 현황 요약

#### 4-2. 출석 상세 뷰 (선생님/원장)

**Lessons.tsx 내 출석 통계 섹션** 또는 **별도 탭:**

- 기간 필터 (이번 주 / 이번 달 / 전체)
- 학생별 출석률 리스트

```
학생명    출석  지각  결석  출석률
김하은    12    1    0    100%
이서연    10    2    1    92%
...
```

- 클래스별 필터 드롭다운
- 출석률이 80% 미만인 학생 빨간색 하이라이트

#### 4-3. API 호출 추가

```typescript
// Dashboard에서
const stats = await attendanceApi.getStats({ studentId: user.id });
// → { total, present, late, absent, excused, attendanceRate }

// 선생님 뷰에서
const classStats = await attendanceApi.getStats({ classId, dateFrom, dateTo });
```

#### 4-4. 출석률 원형 게이지 (CSS Only)

```tsx
// conic-gradient로 원형 프로그레스
function AttendanceGauge({ rate }: { rate: number }) {
  const color = rate >= 90 ? '#22c55e' : rate >= 80 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{
      background: `conic-gradient(${color} ${rate}%, #e2e8f0 0)`,
      borderRadius: '50%',
    }}>
      <span>{rate}%</span>
    </div>
  );
}
```

### 수정 파일
| 파일 | 변경 |
|------|------|
| `components/Dashboard.tsx` | 출석률 위젯 추가 |
| `components/Lessons.tsx` | 출석 통계 섹션 추가 (선생님/원장) |

---

## 5. 종합 평가 리포트

### 현재 상태
- 백엔드 `GET /api/evaluations/report/{studentId}` 존재 (전체 평가 집계 + AI 종합 분석)
- 프론트엔드에서 이 API 미사용
- Growth.tsx에서 개별 평가만 리스트로 표시

### 구현 방안

#### 5-1. Growth.tsx에 "종합 리포트" 탭/섹션 추가
**수정 파일:** `components/Growth.tsx`

**선생님/원장 뷰:**
- 학생 선택 후 "종합 리포트 보기" 버튼
- 리포트 모달 또는 섹션 확장

**학생 뷰:**
- "나의 성장 리포트" 버튼 (본인 리포트)

#### 5-2. 리포트 UI 구성

```
┌─────────────────────────────────────┐
│  📊 종합 성장 리포트 — 김하은       │
├─────────────────────────────────────┤
│                                     │
│  [레이더 차트 / 막대 차트]          │
│  연기력 ████████░░  4.2             │
│  표현력 ███████░░░  3.8             │
│  창의성 ██████████  4.5             │
│  협동심 ████████░░  4.0             │
│  노력도 █████████░  4.3             │
│                                     │
│  ── 기간별 추이 ──                  │
│  2026년 1월: 평균 3.5               │
│  2026년 2월: 평균 3.9 (↑0.4)       │
│  2026년 3월: 평균 4.2 (↑0.3)       │
│                                     │
│  ── AI 종합 분석 ──                 │
│  "김하은 학생은 지난 3개월간...     │
│   특히 창의성 영역에서 뛰어난..."    │
│                                     │
└─────────────────────────────────────┘
```

#### 5-3. 점수 막대 차트 (CSS Only)

```tsx
function ScoreBar({ label, score, max = 5 }: Props) {
  const pct = (score / max) * 100;
  const color = score >= 4 ? 'bg-green-400' : score >= 3 ? 'bg-brand-400' : 'bg-red-400';
  return (
    <div>
      <span>{label}</span>
      <div className="h-3 bg-slate-100 rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{score.toFixed(1)}</span>
    </div>
  );
}
```

#### 5-4. 기간별 추이 표시

- 백엔드 리포트 응답에 평가 히스토리 포함
- 기간(period)별로 그룹화 → 평균 점수 계산
- 이전 대비 증감(↑↓) 표시
- 색상 코딩: 상승(초록), 하락(빨강), 유지(회색)

#### 5-5. AI 분석 영역

- 리포트 로드 시 백엔드가 AI 종합 분석 자동 생성
- 로딩 중 "AI가 분석 중입니다..." + 스켈레톤
- 분석 결과 카드형 표시 (배경색 구분)

### 수정 파일
| 파일 | 변경 |
|------|------|
| `components/Growth.tsx` | 종합 리포트 UI 추가 |

---

## 6. 개인레슨 요청 워크플로우 개선

### 현재 상태
- 학생: 개인레슨 신청 모달 존재 (선생님/과목/날짜/사유)
- 선생님: 승인/거절 패널 존재
- 승인 시 자동으로 수업 생성됨 (백엔드)

### 개선 포인트

#### 6-1. 학생 측 — 신청 후 상태 추적 강화
**수정 파일:** `components/Lessons.tsx`

현재: 상태 뱃지만 표시 (대기중/승인/거절)

개선:
```
┌──────────────────────────────────────┐
│ 🎭 개인레슨 신청 — 3/25(수) 14:00   │
│ 김선생님 · 연기                      │
│                                      │
│ 상태: ⏳ 대기중                      │
│ 신청일: 3/22                         │
│ 사유: "오디션 준비를 위한 집중..."    │
│                                      │
│ [신청 취소]                          │ ← 대기 중일 때만 노출
└──────────────────────────────────────┘
```

추가 기능:
- **신청 취소**: 대기 중 상태에서만 취소 가능 (백엔드에 DELETE 또는 PATCH 엔드포인트 필요 여부 확인)
- **거절 사유 표시**: 거절 시 선생님의 응답 메모를 명확하게 표시
- **승인 후 안내**: "수업이 생성되었습니다. 수업 목록에서 확인하세요" + 해당 날짜로 이동 링크

#### 6-2. 선생님 측 — 승인/거절 UX 개선
**수정 파일:** `components/Lessons.tsx`

현재: 패널에서 버튼 클릭으로 승인/거절

개선:
```
┌──────────────────────────────────────┐
│ 김하은 학생 · 연기                    │
│ 희망일시: 3/25(수) 14:00-15:00       │
│ 사유: "오디션 준비를 위한 집중..."     │
│                                      │
│ 수업 시간 조정:                      │
│ [3/25] [14:00] ~ [15:00]  [장소 ▼]  │ ← 승인 시 시간/장소 조정 가능
│                                      │
│ [거절]  [승인하고 수업 생성]          │
└──────────────────────────────────────┘
```

추가 기능:
- **시간 조정 후 승인**: 학생이 희망한 시간이 안 맞을 때 선생님이 조정 가능
- **장소 지정**: 승인 시 수업 장소 입력 필드
- **거절 시 대안 제시**: "이 시간은 어렵고, 3/26 같은 시간은 어떨까요?" 같은 메모 작성

#### 6-3. 알림 연동
- 승인 시: "개인레슨이 승인되었습니다. 3/25(수) 14:00" → 학생에게 알림
- 거절 시: "개인레슨 신청이 거절되었습니다." + 사유 → 학생에게 알림
- (이미 계획된 알림 시스템 보강과 연동)

### 수정 파일
| 파일 | 변경 |
|------|------|
| `components/Lessons.tsx` | 학생 신청 카드 + 선생님 승인 UX 개선 |

---

## 전체 수정 파일 요약

| # | 기능 | 파일 | 유형 |
|---|------|------|------|
| 1 | Error Boundary | `components/ErrorBoundary.tsx` | 신규 |
| 1 | Error Boundary | `App.tsx` | 수정 |
| 2 | 폼 검증 | `services/useFormValidation.ts` | 신규 |
| 2 | 폼 검증 | `components/ui/FormInput.tsx` | 수정 |
| 2 | 폼 검증 | `components/Lessons.tsx` | 수정 |
| 2 | 폼 검증 | `components/Growth.tsx` | 수정 |
| 2 | 폼 검증 | `components/Classes.tsx` | 수정 |
| 2 | 폼 검증 | `components/Assignments.tsx` | 수정 |
| 3 | 스켈레톤 | `components/ui/Skeleton.tsx` | 신규 |
| 3 | 스켈레톤 | `components/Dashboard.tsx` | 수정 |
| 3 | 스켈레톤 | `components/Lessons.tsx` | 수정 |
| 3 | 스켈레톤 | `components/Growth.tsx` | 수정 |
| 3 | 스켈레톤 | `components/Assignments.tsx` | 수정 |
| 3 | 스켈레톤 | `components/Diet.tsx` | 수정 |
| 4 | 출석 통계 | `components/Dashboard.tsx` | 수정 |
| 4 | 출석 통계 | `components/Lessons.tsx` | 수정 |
| 5 | 종합 리포트 | `components/Growth.tsx` | 수정 |
| 6 | 개인레슨 | `components/Lessons.tsx` | 수정 |

**신규 파일 3개**, **수정 파일 9개** (중복 제거)

---

## 권장 구현 순서

```
Phase A (기반)     : 1. Error Boundary → 3. 스켈레톤 → 2. 폼 검증
Phase B (데이터)   : 4. 출석 통계 → 5. 종합 리포트
Phase C (워크플로우): 6. 개인레슨 개선
```

- Phase A는 전체 앱의 안정성과 UX 기반을 다지는 작업
- Phase B는 기존 백엔드 API를 활용하는 데이터 표시 기능
- Phase C는 기존 워크플로우의 사용성 개선

각 Phase 내에서는 독립적으로 구현 가능하며, 순서는 유연하게 조정 가능합니다.
