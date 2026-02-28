# React → Angular Migration Guide

Muse Academy 프론트엔드를 기능과 디자인을 보존하며 Angular로 마이그레이션하는 가이드

---

## 🎯 마이그레이션 가능 여부

**결론: ✅ 완전히 가능합니다!**

### 가능한 이유
1. **UI/UX 100% 재현 가능** - Tailwind CSS 그대로 사용
2. **TypeScript 공유** - types.ts 파일 그대로 사용
3. **컴포넌트 구조 유사** - React → Angular Component 1:1 매핑
4. **서비스 레이어 재사용** - services/gemini.ts → Angular Service
5. **상태 관리 단순** - LocalStorage 기반 (RxJS로 전환)

### Angular 장점 (현재 React 대비)
- ✅ **강력한 타입 안정성** - Strict TypeScript 강제
- ✅ **의존성 주입** - 서비스 관리 용이
- ✅ **RxJS Observable** - 비동기 처리 강력
- ✅ **Built-in 폼 검증** - Reactive Forms
- ✅ **CLI 도구 우수** - 스캐폴딩, 빌드 최적화

---

## 📊 현재 React 코드 분석

### 컴포넌트 목록 (12개)
1. **Login.tsx** - 로그인 UI
2. **Dashboard.tsx** - 대시보드
3. **Assignments.tsx** (24KB) - 과제 관리 (가장 복잡)
4. **Diet.tsx** (23KB) - 식단 관리
5. **Chat.tsx** (19KB) - 채팅
6. **QnA.tsx** (12KB) - Q&A
7. **Classes.tsx** - 반 관리
8. **Notices.tsx** - 공지사항
9. **Users.tsx** - 사용자 관리
10. **Sidebar.tsx** - 데스크톱 네비게이션
11. **MobileNav.tsx** - 모바일 네비게이션
12. **Notifications.tsx** - 알림

### 서비스 (1개)
- **services/gemini.ts** - AI 서비스 (3개 함수)

### 타입 정의
- **types.ts** - 모든 인터페이스 (101줄)

---

## 🏗️ Angular 프로젝트 구조

```
muse-academy-angular/
├── src/
│   ├── app/
│   │   ├── core/                    # 싱글톤 서비스
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── gemini.service.ts
│   │   │   │   └── storage.service.ts
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts
│   │   │   └── interceptors/
│   │   │       └── auth.interceptor.ts
│   │   │
│   │   ├── shared/                  # 공유 모듈
│   │   │   ├── models/
│   │   │   │   └── types.ts         # React의 types.ts 그대로
│   │   │   ├── components/
│   │   │   │   ├── sidebar/
│   │   │   │   ├── mobile-nav/
│   │   │   │   └── notifications/
│   │   │   └── pipes/
│   │   │       └── date-format.pipe.ts
│   │   │
│   │   ├── features/                # 기능별 모듈
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   ├── login.component.ts
│   │   │   │   │   ├── login.component.html
│   │   │   │   │   └── login.component.scss
│   │   │   │   └── auth.module.ts
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.component.ts
│   │   │   │   └── dashboard.module.ts
│   │   │   │
│   │   │   ├── assignments/
│   │   │   │   ├── assignments.component.ts
│   │   │   │   ├── assignment-calendar/
│   │   │   │   ├── assignment-detail/
│   │   │   │   └── assignments.module.ts
│   │   │   │
│   │   │   ├── diet/
│   │   │   │   ├── diet.component.ts
│   │   │   │   ├── diet-calendar/
│   │   │   │   └── diet.module.ts
│   │   │   │
│   │   │   ├── chat/
│   │   │   ├── qna/
│   │   │   ├── classes/
│   │   │   ├── notices/
│   │   │   └── users/
│   │   │
│   │   ├── app.component.ts         # React의 App.tsx
│   │   ├── app.routes.ts            # 라우팅
│   │   └── app.config.ts
│   │
│   ├── assets/
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   └── styles.scss                  # Tailwind CSS
│
├── angular.json
├── tsconfig.json
├── package.json
└── tailwind.config.js               # React와 동일
```

---

## 🔄 컴포넌트 변환 매핑

### React → Angular 변환 패턴

#### **1. Login Component 예시**

**React (Login.tsx)**
```typescript
import React, { useState } from 'react';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [stage, setStage] = useState<'role' | 'credentials'>('role');
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    const user = { id, name: '김배우', role, ... };
    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* JSX */}
    </div>
  );
};
```

**Angular (login.component.ts)**
```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { User, UserRole } from '@shared/models/types';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  stage: 'role' | 'credentials' = 'role';
  role: UserRole = UserRole.STUDENT;
  id = '';
  password = '';

  UserRole = UserRole; // 템플릿에서 사용

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  handleSubmit() {
    const user: User = { id: this.id, name: '김배우', role: this.role, ... };
    this.authService.login(user);
    this.router.navigate(['/dashboard']);
  }
}
```

**Angular (login.component.html)**
```html
<div class="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
  <!-- Tailwind 클래스 그대로 사용 -->
  <div *ngIf="stage === 'role'">
    <button (click)="role = UserRole.STUDENT"
            [class.bg-orange-500]="role === UserRole.STUDENT">
      학생
    </button>
  </div>

  <div *ngIf="stage === 'credentials'">
    <input [(ngModel)]="id" type="text" placeholder="아이디">
    <input [(ngModel)]="password" type="password" placeholder="비밀번호">
    <button (click)="handleSubmit()">로그인</button>
  </div>
</div>
```

---

#### **2. Assignments Component 예시 (복잡한 케이스)**

**React → Angular 변환 포인트**

| React | Angular | 비고 |
|-------|---------|------|
| `useState` | 클래스 속성 | `assignments: Assignment[] = []` |
| `useEffect` | `ngOnInit`, `ngOnChanges` | 라이프사이클 훅 |
| `localStorage` | `StorageService` | 서비스로 추상화 |
| `props` | `@Input()` | 부모→자식 데이터 전달 |
| `callback` | `@Output() EventEmitter` | 자식→부모 이벤트 |
| Conditional Render | `*ngIf`, `*ngFor` | Angular 디렉티브 |

**Angular Service (storage.service.ts)**
```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Assignment } from '@shared/models/types';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private assignmentsSubject = new BehaviorSubject<Assignment[]>([]);
  assignments$: Observable<Assignment[]> = this.assignmentsSubject.asObservable();

  constructor() {
    this.loadAssignments();
  }

  private loadAssignments() {
    const saved = localStorage.getItem('muse_assignments');
    const data = saved ? JSON.parse(saved) : MOCK_ASSIGNMENTS;
    this.assignmentsSubject.next(data);
  }

  updateAssignments(assignments: Assignment[]) {
    localStorage.setItem('muse_assignments', JSON.stringify(assignments));
    this.assignmentsSubject.next(assignments);
  }

  getAssignments(): Assignment[] {
    return this.assignmentsSubject.value;
  }
}
```

**Angular Component (assignments.component.ts)**
```typescript
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { StorageService } from '@core/services/storage.service';
import { GeminiService } from '@core/services/gemini.service';
import { Assignment, User } from '@shared/models/types';

@Component({
  selector: 'app-assignments',
  templateUrl: './assignments.component.html',
  styleUrls: ['./assignments.component.scss']
})
export class AssignmentsComponent implements OnInit {
  assignments$: Observable<Assignment[]>;
  selectedAssignment: Assignment | null = null;
  submissionText = '';
  isAnalyzing = false;
  viewMode: 'list' | 'calendar' = 'calendar';

  constructor(
    private storageService: StorageService,
    private geminiService: GeminiService
  ) {
    this.assignments$ = this.storageService.assignments$;
  }

  ngOnInit() {
    // 초기화 로직
  }

  async requestAiAnalysis(text: string) {
    this.isAnalyzing = true;
    try {
      const analysis = await this.geminiService.analyzeMonologue(text);
      // 업데이트 로직
    } catch (error) {
      console.error(error);
    } finally {
      this.isAnalyzing = false;
    }
  }
}
```

---

#### **3. Gemini Service 변환**

**React (services/gemini.ts)**
```typescript
import { GoogleGenerativeAI } from '@google/genai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeMonologue(text: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

**Angular (core/services/gemini.service.ts)**
```typescript
import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/genai';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(environment.geminiApiKey);
  }

  async analyzeMonologue(text: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const prompt = `다음 연기 대사를 분석해주세요: ${text}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async analyzeDiet(imageData: string, description: string): Promise<{ calories: number, advice: string }> {
    // 구현
  }

  async askAiTutor(question: string): Promise<string> {
    // 구현
  }
}
```

---

## 🚀 마이그레이션 단계별 계획

### Phase 1: 프로젝트 설정 (1일)

#### 1-1. Angular CLI 설치
```bash
npm install -g @angular/cli@17
```

#### 1-2. 새 프로젝트 생성
```bash
cd /Users/deryu/Documents/Sol-Act/
ng new muse-academy-angular --standalone=false --routing --style=scss
cd muse-academy-angular
```

#### 1-3. Tailwind CSS 설정
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init

# tailwind.config.js (React와 동일)
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

# styles.scss에 추가
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### 1-4. 필수 패키지 설치
```bash
npm install @google/genai
npm install rxjs
```

#### 1-5. types.ts 복사
```bash
cp ../muse-academy/types.ts src/app/shared/models/types.ts
```

---

### Phase 2: 코어 모듈 구현 (2일)

#### 2-1. AuthService
```bash
ng generate service core/services/auth
```

#### 2-2. StorageService
```bash
ng generate service core/services/storage
```

#### 2-3. GeminiService
```bash
ng generate service core/services/gemini
```

#### 2-4. AuthGuard
```bash
ng generate guard core/guards/auth
```

---

### Phase 3: 공유 컴포넌트 (2일)

#### 3-1. Sidebar
```bash
ng generate component shared/components/sidebar
```

#### 3-2. MobileNav
```bash
ng generate component shared/components/mobile-nav
```

#### 3-3. Notifications
```bash
ng generate component shared/components/notifications
```

---

### Phase 4: 기능 모듈 구현 (1주)

#### 4-1. Auth Module
```bash
ng generate module features/auth --routing
ng generate component features/auth/login
```

#### 4-2. Dashboard Module
```bash
ng generate module features/dashboard --routing
ng generate component features/dashboard
```

#### 4-3. Assignments Module (가장 복잡)
```bash
ng generate module features/assignments --routing
ng generate component features/assignments
ng generate component features/assignments/assignment-calendar
ng generate component features/assignments/assignment-detail
```

#### 4-4. Diet Module
```bash
ng generate module features/diet --routing
ng generate component features/diet
ng generate component features/diet/diet-calendar
```

#### 4-5. 나머지 모듈
- Chat, QnA, Classes, Notices, Users

---

### Phase 5: 라우팅 설정 (1일)

**app.routes.ts**
```typescript
import { Routes } from '@angular/router';
import { AuthGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule) },
  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule) },
      { path: 'assignments', loadChildren: () => import('./features/assignments/assignments.module').then(m => m.AssignmentsModule) },
      { path: 'diet', loadChildren: () => import('./features/diet/diet.module').then(m => m.DietModule) },
      // ...
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
```

---

### Phase 6: 스타일 마이그레이션 (1일)

- React의 Tailwind 클래스를 Angular 템플릿에 그대로 복사
- `className` → `class`
- 조건부 클래스: `[class.active]="isActive"`

---

### Phase 7: 테스트 & 디버깅 (2일)

- 각 컴포넌트 기능 테스트
- LocalStorage 동기화 확인
- AI 서비스 통합 테스트
- 반응형 디자인 확인

---

## 📝 주요 변환 패턴 치트시트

| React | Angular | 예시 |
|-------|---------|------|
| `useState(val)` | 클래스 속성 | `count = 0;` |
| `useEffect(() => {}, [])` | `ngOnInit()` | 초기화 |
| `useEffect(() => {}, [dep])` | `ngOnChanges()` | 의존성 변경 감지 |
| `props.value` | `@Input() value` | 부모→자식 |
| `onClick={handler}` | `(click)="handler()"` | 이벤트 |
| `{condition && <div>}` | `<div *ngIf="condition">` | 조건부 렌더링 |
| `{list.map(item => ...)}` | `<div *ngFor="let item of list">` | 리스트 렌더링 |
| `className={...}` | `[class.active]="..."` | 동적 클래스 |
| `localStorage` | `StorageService` | 서비스화 |
| Context API | Service + RxJS | 전역 상태 |

---

## 🎨 디자인 보존 방법

### Tailwind CSS 100% 재사용
```html
<!-- React -->
<div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">

<!-- Angular (동일) -->
<div class="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
```

### 반응형 디자인
- React의 조건부 렌더링 → Angular `*ngIf`
- 모바일/데스크톱 분기 동일하게 구현

---

## 🔧 환경 변수 설정

**environments/environment.ts**
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://sol-backend.ngrok.dev',
  geminiApiKey: 'YOUR_API_KEY'
};
```

**environments/environment.prod.ts**
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://sol-backend.ngrok.dev',
  geminiApiKey: 'YOUR_API_KEY'
};
```

---

## ⚙️ npm 설치 문제 해결

### 현재 에러 원인
```
npm error code EACCES
npm error Your cache folder contains root-owned files
```

### 해결 방법
```bash
# 1. npm 캐시 소유권 수정
sudo chown -R 501:20 "/Users/deryu/.npm"

# 2. 캐시 정리
npm cache clean --force

# 3. 재시도
npm install
```

---

## 🏆 마이그레이션 vs 병행 개발

### Option 1: 완전 마이그레이션 (추천)
- **장점**: 단일 코드베이스, Angular 생태계 활용
- **단점**: 초기 작업 시간 소요 (약 2주)
- **적합**: 장기 프로젝트, 팀이 Angular 선호

### Option 2: React 수정 후 사용
- **장점**: 즉시 사용 가능
- **단점**: React 불편함 지속
- **적합**: 빠른 프로토타입, 단기 프로젝트

### Option 3: 병행 개발
- **프론트엔드**: Angular로 새로 구축
- **백엔드**: FastAPI 먼저 완성
- **연동**: 백엔드 API가 준비되면 Angular 프론트 연결
- **적합**: 백엔드 우선 개발, 점진적 마이그레이션

---

## 💡 최종 추천

### 상황 분석
1. ✅ Angular 경험 있음 (익숙함)
2. ❌ React npm 설치 실패 (당장 불편)
3. ✅ 백엔드 구현 계획 수립됨
4. ✅ 프론트엔드 미완성 (마이그레이션 부담 적음)

### 추천: **병행 개발 (Option 3)**

**이유:**
1. **백엔드 먼저 완성** - FastAPI로 API 구축
2. **Angular 프론트 새로 시작** - 익숙한 도구 사용
3. **React는 참고용** - UI/기능 레퍼런스로 활용
4. **점진적 마이그레이션** - 모듈 단위로 이동 가능

**타임라인:**
- Week 1-2: 백엔드 인증 + 주요 API
- Week 3-4: Angular 프로젝트 셋업 + 로그인/대시보드
- Week 5-6: 과제/식단 모듈 구현
- Week 7-8: 채팅/QnA 완성 + 통합 테스트

---

## 🚀 다음 단계

### 지금 바로 할 수 있는 일:

#### 1. npm 문제 해결
```bash
sudo chown -R 501:20 "/Users/deryu/.npm"
npm cache clean --force
```

#### 2. Angular 프로젝트 생성
```bash
cd /Users/deryu/Documents/Sol-Act/
ng new muse-academy-angular --routing --style=scss
```

#### 3. 백엔드 계속 개발
- BACKEND_IMPLEMENTATION.md 계획대로 진행
- API 완성되면 Angular 연동

---

어떤 방향으로 진행하시겠습니까?

**A) Angular 마이그레이션 즉시 시작**
**B) React npm 문제 해결 후 계속**
**C) 백엔드 먼저 완성, 프론트는 나중에**

말씀해주시면 선택하신 방향으로 바로 도와드리겠습니다!
