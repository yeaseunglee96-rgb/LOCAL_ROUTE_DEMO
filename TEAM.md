# LOCAL ROUTE 6인 팀 구성안

| 항목 | 내용 |
| --- | --- |
| 문서 버전 | v1.0 |
| 작성일 | 2026-08-26 (수) |
| 대상 | LOCAL ROUTE 개발팀 6인 |
| 목적 | 웹과 앱을 동시에 완성하기 위한 역할 분담, 역할별 기술 스택, 담당 코드 범위, 인수인계 규칙을 정한다 |
| 확정 전제 | 앱은 **React Native + Expo 신규 구현**. 전담 역할 하나는 **인프라·배포·품질**에 배정 |

---

## 문서 표기 규칙

| 표기 | 의미 |
| --- | --- |
| **[코드 실측]** | 2026-08-26 기준 저장소를 직접 세어 확인한 값 |
| **[설계 제안]** | 이 문서에서 제안하는 구조·규칙. 팀 논의로 변경 가능 |
| **[위험]** | 놓치면 일정이나 출시를 막는 항목 |

---

## 1. 팀을 나누기 전에 — 지금 코드가 어디까지 와 있는가

역할 분배는 "어떤 일이 남았는가"에서 나와야 한다. 추측 대신 저장소를 직접 셌다.

### 1.1 전체 규모 [코드 실측]

| 영역 | 실측 |
| --- | --- |
| 저장소 구조 | npm workspaces 모노레포 (`server` + `web`) |
| 서버 소스 | **5,024줄** (routes 8개, services 15개, lib 2개, workers 2개) |
| 서버 API | **66개 엔드포인트** |
| 데이터 모델 | **26개** (Prisma) |
| 마이그레이션 | **27개** |
| 서버 테스트 | **12개 파일** (node:test + supertest) |
| 최적화 솔버 | **Python OR-Tools 9.14** · `server/solver/route_optimizer.py` 118줄 |
| 웹 소스 | **90개 파일** · TSX 5,787줄 + CSS 3,535줄 |
| 웹 컴포넌트 | **38개** |
| 웹 페이지 | **38개 파일** |
| 화면(라우트) | **44개** — 완료 23 · 부분 4 · 예정 17 |
| 앱(React Native) | **0% — 아직 시작 전** |
| CI | GitHub Actions 1개 (audit · 서버 테스트 · 서버/웹 빌드) |
| 컨테이너 | Dockerfile 2 · compose 2 · nginx.conf 1 |

### 1.2 서버 내부 구성 [코드 실측]

| 파일 | 줄 수 | 하는 일 |
| --- | ---: | --- |
| `routes/trips.ts` | 705 | 여행 생성·일정 조회·재최적화·경로·장소 |
| `services/schedule.ts` | 587 | 시간창 제약 스케줄링 |
| `services/kakao.ts` | 538 | 카카오 로컬·모빌리티·좌표 변환 |
| `services/recommend.ts` | 333 | 추천 점수 계산 |
| `services/reoptimize.ts` | 330 | 부분 재최적화·재계획 |
| `services/paceLearning.ts` | 246 | 사용자 이동 속도 학습 |
| `lib/tourapi.ts` | 175 | 한국관광공사 API |
| `services/generate.ts` | 163 | 생성 파이프라인 |
| `routes/community.ts` | 160 | 방문 인증·리뷰·로컬 프로필 |
| `routes/social.ts` | 156 | 스토리·팔로우·신고 |
| `services/optimizer.ts` | 146 | OR-Tools 솔버 호출 |
| `routes/experience.ts` | 132 | 축제·이벤트·기념품샵·날씨 |
| `routes/collaboration.ts` | 131 | 공동 편집·공유·초대 |
| `routes/commerce.ts` | 114 | 광고·예약 제휴 |
| `routes/account.ts` | 103 | 회원가입·로그인·프로필 |
| `services/navText.ts` | 49 | 현장 한국어 문장·택시 카드 |

### 1.3 웹 화면 현황 [코드 실측]

| 마일스톤 | 화면 수 | 완료 | 부분 | 예정 |
| --- | ---: | ---: | ---: | ---: |
| M1 웹 | 20 | 15 | 1 | 4 |
| M2 앱 | 14 | 6 | 3 | 5 |
| M3 심사 필수 | 7 | 0 | 0 | 7 |
| M4 후속 | 3 | 0 | 0 | 3 |
| **합계** | **44** | **23** | **4** | **17** |

### 1.4 여기서 나오는 결론

1. **백엔드 API는 거의 다 있다.** 66개 엔드포인트, 26개 모델이 동작한다. 새로 만들 API보다 **앱이 쓸 수 있게 다듬고 계약을 안정시키는 일**이 크다.
2. **웹은 절반을 넘겼다.** 44개 중 23개 완료. 남은 17개 중 7개는 스토어 심사 필수 화면(약관·정책·운영 콘솔)이다.
3. **앱은 0이다.** 여기가 가장 큰 미개척지이고, 사람이 가장 많이 필요한 곳이다.
4. **운영 준비가 비어 있다.** 아직 SQLite + 로컬 실행이다. 공개 배포와 스토어 심사를 하려면 PostgreSQL 전환과 클라우드 배포가 필요하다.
5. **엔진이 특수하다.** Python OR-Tools 솔버가 Node 서버에 물려 있다. 이건 일반 백엔드 업무와 성격이 다르다.

**그래서 6명을 이렇게 나눈다: 웹 1 · 앱 2 · 백엔드 2 · 인프라 1.**

---

## 2. 6인 팀 구성 한눈에 보기

| # | 코드 | 역할명 | 한 문장 | 주 기술 |
| --- | :-: | --- | --- | --- |
| 1 | **FE-W** | 웹 프론트엔드 & 디자인 시스템 | 웹 44개 화면을 완성하고, 앱이 그대로 따라 쓸 디자인 규격을 정한다 | React 18 · Vite 8 · react-router 7 · TypeScript |
| 2 | **APP-S** | 앱 · 셸과 계획/기록 흐름 | Expo 앱의 뼈대와 여행 전·후 화면을 만든다 | React Native · Expo · Expo Router |
| 3 | **APP-N** | 앱 · 여행 중 네이티브 기능 | 지도·내비, 카메라 OCR, 음성, 권한·푸시·딥링크를 네이티브로 구현한다 | Expo Modules · react-native-maps · 카메라/음성 |
| 4 | **BE-A** | 백엔드 코어 API | 인증·여행·일정·소셜·커머스 API와 클라이언트 계약을 책임진다 | Node · Express 4 · Prisma 5 · TypeScript |
| 5 | **BE-E** | 추천·최적화 엔진 & 데이터 | 추천 점수, OR-Tools 스케줄러, 페이스 학습, 스키마와 데이터 적재를 책임진다 | Python OR-Tools · Prisma · 외부 API |
| 6 | **OPS** | 인프라 · 배포 · 품질 | PostgreSQL 전환, 클라우드 배포, CI/CD, 앱 빌드·스토어, 품질 게이트를 책임진다 | Docker · Nginx · GitHub Actions · EAS |

### 2.1 조직도와 인계 관계

[[IMG:team6_structure|6인 팀 구조와 산출물 인계 관계|]]

### 2.2 인원 배분의 근거 [설계 제안]

| 영역 | 인원 | 왜 이만큼인가 |
| --- | :-: | --- |
| 웹 | 1 | 44개 중 23개가 이미 완료. 남은 17개는 대부분 정적 화면(약관·정책)이거나 기존 컴포넌트 재조합이다. 다만 **디자인 시스템 정의**라는 앱 전체에 영향을 주는 일을 함께 맡으므로 가볍지 않다. |
| 앱 | 2 | **0에서 시작**한다. 화면 수도 많지만, 진짜 부담은 네이티브 영역(권한·카메라·음성·지도·푸시·빌드·서명)이다. 성격이 완전히 달라 한 사람이 둘 다 하면 병목이 된다. |
| 백엔드 | 2 | API 66개는 유지·확장만으로도 한 사람 몫이다. 여기에 **Python OR-Tools 솔버**라는 이질적인 영역이 붙어 있어 분리한다. 데이터(스키마·적재)는 엔진 담당이 함께 맡는 것이 자연스럽다 — 추천 품질은 결국 데이터 품질이기 때문이다. |
| 인프라 | 1 | 지금 SQLite + 로컬 실행이라 **스토어 심사가 불가능**하다. PostgreSQL 전환, 배포, CI/CD, 앱 서명·스토어 등록은 한 사람이 끝까지 책임져야 중간에 끊기지 않는다. |

> **[설계 제안] 데이터 전담을 따로 두지 않은 이유**: 6명 중 하나를 데이터 수집·정제에 쓰면 앱이나 인프라가 얇아진다. 대신 BE-E가 데이터를 겸하고, **장소 데이터 확충은 전원이 참여하는 주간 작업**으로 돌린다(11.4절).

---

## 3. 역할별 상세

각 역할은 다음 8가지로 정의한다: 한 문장 정의 / 핵심 책임 / 기술 스택 / 담당 코드 / 다른 역할에 넘기는 것 / 첫 주 과제 / 완료 판정 기준 / 백업 담당.

---

### 3.1 FE-W — 웹 프론트엔드 & 디자인 시스템

| 구분 | 내용 |
| --- | --- |
| **한 문장 정의** | 웹 44개 화면을 완성하고, 앱 2명이 그대로 따라 쓸 수 있는 디자인 규격과 화면 명세를 만든다. |
| **백업 담당** | APP-S |

**핵심 책임**

1. **웹 화면 완성** — 남은 17개 화면(약관·정책·운영 콘솔·장소 상세·사용자 프로필 등) 구현
2. **페이지 트리 관리** — `web/src/routes/routeTree.ts`가 화면 정의의 단일 진실 공급원이다. 화면을 추가·변경할 때 반드시 여기부터 고친다
3. **디자인 시스템 정의** — 현재 CSS 3,535줄이 색·간격·글자 크기를 각 화면에서 개별 지정하고 있다. 이를 **토큰으로 추출**해 앱이 같은 값을 쓰게 한다 (6장)
4. **다국어(KO/EN)** — `i18n.ts`와 전역 언어 스위처
5. **접근성·반응형** — 375px부터 데스크톱까지, 키보드 이동과 스크린리더

**기술 스택**

| 항목 | 사용 | 비고 |
| --- | --- | --- |
| 프레임워크 | React 18.3 | |
| 빌드 | Vite 8.2 (rolldown) | 프로덕션 빌드 약 1.3초 |
| 라우팅 | react-router-dom 7 | 중첩 라우트 + `Outlet` |
| 언어 | TypeScript | `types.ts`가 BE와의 계약서 |
| 스타일 | CSS Variables + 순수 CSS | 프레임워크 없음. 토큰화가 과제 |
| 지도 | Kakao Maps JS SDK | `KakaoMap.tsx` |
| OCR | Tesseract.js | 브라우저에서 직접 인식 |
| 음성 | Web Speech API | 브라우저 내장 |

**담당 코드**

```
web/src/routes/          routeTree.ts · AppRouter.tsx · AppShell.tsx · paths.ts
web/src/pages/**         38개 페이지 파일
web/src/components/**    38개 컴포넌트
web/src/styles.css       2,645줄  ← 토큰 추출 대상
web/src/ux-overrides.css   890줄  ← 토큰 추출 후 정리 대상
web/src/i18n.ts          다국어
```

**다른 역할에 넘기는 것**

| 받는 사람 | 무엇을 | 언제 |
| --- | --- | --- |
| APP-S · APP-N | 디자인 토큰 파일 + 화면별 레이아웃 명세 | 1주차 종료 시점 |
| APP-S · APP-N | 화면 스크린샷 세트 (앱 구현 기준) | 화면 완료 시마다 |
| BE-A | 화면에 필요한 응답 필드 요청 | 상시 (`[TYPES]` PR) |

**첫 주 과제**

1. `styles.css`에서 색·간격·글자 크기·모서리 반경을 뽑아 `web/src/design/tokens.ts` 생성
2. 스토어 심사 필수 화면 3개(`/legal/terms`, `/legal/privacy`, `/legal/open-source`) 구현
3. 화면 44개 각각에 대해 "앱에도 필요한가 / 웹 전용인가" 판정해 `routeTree.ts`의 `platform` 갱신

**완료 판정 기준**

- `routeTree.ts`의 모든 노드가 `status: DONE` 또는 명시적으로 `M4_LATER`
- 375px에서 가로 스크롤이 생기는 화면 0개
- 디자인 토큰만 바꿔서 전체 색조를 바꿀 수 있는 상태

---

### 3.2 APP-S — 앱 · 셸과 계획/기록 흐름

| 구분 | 내용 |
| --- | --- |
| **한 문장 정의** | Expo 앱의 뼈대(네비게이션·인증·상태·API 연결)를 세우고, 여행 전(계획)과 여행 후(기록) 화면을 만든다. |
| **백업 담당** | FE-W |

**핵심 책임**

1. **앱 프로젝트 기반** — Expo 초기화, Expo Router 파일 트리, 하단 탭 네비게이션
2. **공유 코드 연결** — `packages/shared`의 타입·API 클라이언트를 앱에서 그대로 사용 (6장)
3. **여행 전 흐름** — 온보딩/언어 선택, 회원가입·로그인, 여행 조건 입력(3단계), 일정 생성 진행(SSE)
4. **여행 후 흐름** — 여행 기록(스토리) 작성·조회, 내 여행 목록, 추억 지도, 프로필·설정
5. **앱 상태 관리** — 로그인 세션 보관(SecureStore), 오프라인 시 동작

**기술 스택**

| 항목 | 사용 |
| --- | --- |
| 프레임워크 | React Native + Expo SDK |
| 라우팅 | Expo Router (파일 기반) |
| 저장소 | `expo-secure-store` (토큰), `AsyncStorage` (캐시) |
| 이미지 | `expo-image` |
| 폼 | React Hook Form 또는 순수 상태 (팀 합의) |
| 언어 | TypeScript |

**담당 코드 (신규 생성)**

```
mobile/app/_layout.tsx              전역 Provider · 인증 게이트
mobile/app/index.tsx                시작
mobile/app/welcome.tsx              첫 방문 소개·언어 선택
mobile/app/auth/                    로그인 · 회원가입
mobile/app/plan/                    여행 조건 3단계
mobile/app/generating/[tripId].tsx  생성 진행 (SSE)
mobile/app/trips/[tripId]/_layout   하단 탭 셸
mobile/app/trips/[tripId]/overview  여행 요약
mobile/app/stories/                 기록 작성·피드·상세
mobile/app/me/                      내 여행 · 설정
mobile/src/state/                   세션 · 언어 · 캐시
```

**첫 주 과제**

1. `mobile/` 워크스페이스 생성 + Expo Router 골격
2. `packages/shared`에서 `types.ts`·`client.ts`를 가져다 쓰는 구조 확정 (BE-A와 합의)
3. 로그인 → 여행 조건 입력 → 일정 생성 → 요약 확인까지 **한 줄기 흐름**을 시뮬레이터에서 완주

**완료 판정 기준**

- 실기기(Android·iOS)에서 크래시 없이 위 한 줄기 흐름 완주
- 네트워크를 끊었을 때 흰 화면이 아니라 안내가 뜬다

---

### 3.3 APP-N — 앱 · 여행 중 네이티브 기능

| 구분 | 내용 |
| --- | --- |
| **한 문장 정의** | 웹에서는 브라우저 API로 흉내 낸 기능들을 앱에서 진짜 네이티브로 구현하고, 권한·푸시·딥링크·지도를 책임진다. |
| **백업 담당** | OPS |

**왜 이 역할을 따로 두는가**

웹은 지금 이 기능들을 **브라우저 내장 API로 데모 수준**으로 구현했다. README에도 그렇게 적혀 있다.

| 기능 | 웹의 현재 구현 | 앱에서 해야 할 일 |
| --- | --- | --- |
| 메뉴판 번역 | Tesseract.js (브라우저 OCR) | 네이티브 카메라 + 온디바이스 OCR. 인식률·속도가 완전히 다르다 |
| 음성 통역 | Web Speech API | 네이티브 음성 인식·합성. iOS/Android 각각 다름 |
| 지도·내비 | Kakao Maps JS SDK | `react-native-maps` 또는 네이티브 SDK. 실시간 위치 추적 필요 |
| 방문 인증 | 브라우저 Geolocation | 백그라운드 위치 권한 · 정확도 관리 |

**핵심 책임**

1. **지도·내비게이션** — 경로 표시, 실시간 위치, 외부 지도 앱 딥링크(구글/애플/카카오)
2. **카메라·OCR** — 메뉴판 촬영 → 인식 → 번역·알레르기 배지
3. **음성** — 한국어↔외국어 양방향 통역, 현장 문장 TTS 재생
4. **권한 처리** — 위치·카메라·마이크·사진·알림. 각 권한에 **목적 문구**를 붙인다 (스토어 심사 필수)
5. **푸시 알림** — 일정 시작 알림, 날씨 경고
6. **딥링크** — 공유 링크(`/s/:slug`)와 초대 링크가 앱으로 열리게 한다 (iOS Universal Links · Android App Links)

**기술 스택**

| 항목 | 사용 |
| --- | --- |
| 지도 | `react-native-maps` 또는 Kakao 네이티브 SDK (1주차 결정) |
| 위치 | `expo-location` |
| 카메라 | `expo-camera` |
| OCR | 온디바이스 OCR 모듈 (`expo-mlkit` 계열 또는 커스텀) |
| 음성 | `expo-speech` (TTS) + 네이티브 음성 인식 |
| 푸시 | `expo-notifications` |
| 딥링크 | `expo-linking` + `associatedDomains` / `intentFilters` |

**담당 코드 (신규 생성)**

```
mobile/app/trips/[tripId]/schedule/   일정 · 날짜별
mobile/app/trips/[tripId]/navigate/   경로 상세 · 내비
mobile/app/trips/[tripId]/map.tsx     지도 전체
mobile/app/places/[placeId]/          장소 상세 · 현장 한국어
mobile/src/native/camera-ocr/         카메라 OCR
mobile/src/native/voice/              음성 인식·합성
mobile/src/native/location/           위치 추적 · 방문 인증
mobile/src/native/permissions/        권한 요청·목적 문구
```

**첫 주 과제**

1. 지도 방식 결정 (`react-native-maps` vs Kakao 네이티브 SDK) — **장단점 비교표를 만들어 팀에 공유**
2. 위치 권한 요청 → 현재 위치 표시 → 경로 폴리라인 그리기까지 실기기 확인
3. 권한 목적 문구 초안 작성 (OPS에게 전달, 스토어 등록에 사용)

**완료 판정 기준**

- 실기기에서 지도·카메라·음성·위치 4개 권한이 모두 정상 동작
- 권한을 **거부해도** 앱이 크래시 없이 대체 안내를 보여준다
- 공유 링크를 눌렀을 때 앱이 열린다 (양 OS)

> **[위험]** 이 역할이 가장 예측하기 어렵다. 네이티브 기능은 "되는 줄 알았는데 iOS에서만 안 되는" 일이 잦다. **1주차에 4개 권한을 전부 실기기에서 한 번씩 찔러보는 것**이 이 리스크를 가장 크게 줄인다.

---

### 3.4 BE-A — 백엔드 코어 API

| 구분 | 내용 |
| --- | --- |
| **한 문장 정의** | 66개 엔드포인트의 동작과 응답 계약을 책임지고, 웹과 앱이 같은 API를 안전하게 쓰게 만든다. |
| **백업 담당** | BE-E |

**핵심 책임**

1. **API 계약 관리** — `web/src/types.ts`와 서버 응답이 어긋나지 않게 유지. 앱이 붙으면 소비자가 둘로 늘어난다
2. **인증·세션** — 익명 세션과 이메일 계정 두 갈래. 앱에서는 토큰 보관 방식이 달라 검증이 필요하다
3. **여행·일정 API** — 생성 job, SSE 진행률, 부분 재최적화, 되돌리기, 순서 변경
4. **소셜·커머스** — 스토리, 팔로우, 신고·검토, 광고, 예약 제휴
5. **보안 미들웨어** — helmet · CORS · rate limit 운영값. 앱 추가 시 CORS와 rate limit 재조정 필요
6. **광고 신뢰 정책의 코드 강제** — 광고비가 추천 점수에 개입하지 못하게 API 단에서 막는다

**기술 스택**

| 항목 | 사용 | 버전 |
| --- | --- | --- |
| 런타임 | Node.js | 20 LTS 이상 (CI는 24) |
| 프레임워크 | Express | 4.21 |
| ORM | Prisma Client | 5.22 |
| 보안 | helmet / cors / express-rate-limit | 8.1 / 2.8 / 7.5 |
| 이벤트 | KafkaJS + DB Outbox | 2.2 |
| 테스트 | node:test + supertest | 내장 / 7.1 |
| 개발 실행 | tsx watch | |

**담당 코드**

```
server/src/index.ts               부트스트랩 · 미들웨어 · 라우터 마운트
server/src/routes/trips.ts        705줄
server/src/routes/community.ts    160줄
server/src/routes/social.ts       156줄
server/src/routes/experience.ts   132줄
server/src/routes/collaboration.ts 131줄
server/src/routes/commerce.ts     114줄
server/src/routes/account.ts      103줄
server/src/routes/analytics.ts     59줄
server/src/services/auth.ts · account.ts · community.ts · jobs.ts · ads.ts · events.ts
server/src/types.ts               응답 타입 정의
server/test/**                    12개 테스트 파일
```

**다른 역할에 넘기는 것**

| 받는 사람 | 무엇을 | 언제 |
| --- | --- | --- |
| FE-W · APP-S · APP-N | API 응답 타입 확정본 | 변경 시 즉시 (`[TYPES]` PR + 채널 공지) |
| APP-S | 앱용 인증 흐름 명세 (토큰 발급·갱신·만료) | 1주차 |
| OPS | 필요한 환경변수 목록 | 1주차 |

**첫 주 과제**

1. `web/src/types.ts`와 `server/src/types.ts`를 **`packages/shared`로 승격** (6장) — 앱 작업의 전제 조건이므로 최우선
2. 앱에서 호출할 때의 CORS·rate limit 정책 정리
3. 회원 인증 흐름 문서화 (앱은 쿠키가 아니라 토큰을 쓴다)

**완료 판정 기준**

- 웹·앱 양쪽에서 같은 클라이언트 코드로 API 호출이 성공
- `npm test --workspace server` 전체 통과
- API 계약이 바뀔 때 타입 오류로 즉시 드러난다

---

### 3.5 BE-E — 추천·최적화 엔진 & 데이터

| 구분 | 내용 |
| --- | --- |
| **한 문장 정의** | "왜 이 장소가, 왜 이 시간에 추천되는가"를 계산하는 엔진과, 그 계산의 재료가 되는 데이터를 책임진다. |
| **백업 담당** | BE-A |

**왜 코어 API와 나누는가**

이 영역은 **Python + 제약조건 최적화**라는 다른 기술 축을 쓴다. Express 라우터를 다루는 감각과 OR-Tools 모델을 세우는 감각은 다르다. 그리고 이 엔진이 서비스의 차별점이므로 전담이 필요하다.

**핵심 책임**

1. **추천 점수** — `recommend.ts` 333줄. 취향 적합도·로컬 점수·이동 효율·예산 적합도 등 가중치 축 설계
2. **일정 최적화** — `schedule.ts` 587줄 + Python OR-Tools 솔버. 운영시간·이동시간·예산 제약을 만족하는 시간표 생성
3. **부분 재최적화** — `reoptimize.ts` 330줄. 한 장소만 바꿔도 그 날짜만 다시 계산
4. **페이스 학습** — `paceLearning.ts` 246줄. 사용자의 실제 이동 속도를 학습해 다음 일정에 반영
5. **외부 데이터 연동** — 카카오 로컬·모빌리티(538줄), 한국관광공사 TourAPI(175줄), 날씨, 이미지 검색
6. **데이터 스키마와 적재** — Prisma 26개 모델, 27개 마이그레이션, 시드 스크립트 6종

**기술 스택**

| 항목 | 사용 |
| --- | --- |
| 최적화 | **Python 3.13 + OR-Tools 9.14** (`server/solver/route_optimizer.py`) |
| 폴백 | TypeScript 휴리스틱 스케줄러 (`schedule.ts`) |
| ORM·마이그레이션 | Prisma 5.22 |
| 외부 API | Kakao Local·Mobility, TourAPI, 기상청, 네이버/구글 이미지 검색 |
| 검증 | node:test (`optimizer.test.ts`, `schedule.test.ts`, `recommend.test.ts`, `pace.test.ts`) |

**담당 코드**

```
server/solver/route_optimizer.py     118줄 · OR-Tools
server/requirements-optimizer.txt    ortools==9.14.6206
server/src/services/schedule.ts      587줄
server/src/services/kakao.ts         538줄
server/src/services/recommend.ts     333줄
server/src/services/reoptimize.ts    330줄
server/src/services/paceLearning.ts  246줄
server/src/services/optimizer.ts     146줄
server/src/services/generate.ts      163줄
server/src/services/placeImages.ts   162줄
server/src/lib/tourapi.ts            175줄
server/prisma/schema.prisma          26개 모델
server/prisma/migrations/            27개
server/prisma/seed*.ts · ensure-*.ts · import-*.ts
```

**첫 주 과제**

1. **장소 데이터 확충 계획 수립** — 현재 데이터로 며칠짜리 일정까지 단조롭지 않게 만들 수 있는지 실측하고, 부족하면 TourAPI 적재 범위를 정한다
2. OR-Tools 솔버가 없을 때(휴리스틱 폴백)와 있을 때의 결과 차이를 측정해 문서화
3. OPS와 PostgreSQL 전환 시 깨질 수 있는 쿼리·타입 목록 작성

**완료 판정 기준**

- 같은 조건으로 3회 생성했을 때 결과가 안정적이고, 각 장소에 **추천 근거 문구**가 붙는다
- 예산·운영시간 제약을 어기는 일정이 생성되지 않는다
- 솔버 장애 시 휴리스틱 폴백으로 조용히 넘어간다

> **[설계 제안] 데이터 품질이 곧 추천 품질이다.** 아무리 좋은 최적화도 후보 장소가 부족하면 뻔한 일정을 낸다. BE-E는 알고리즘만큼 **데이터 커버리지**를 지표로 관리해야 한다.

---

### 3.6 OPS — 인프라 · 배포 · 품질

| 구분 | 내용 |
| --- | --- |
| **한 문장 정의** | 코드가 사용자에게 도달하는 모든 경로(DB·서버·도메인·빌드·스토어)와, 그 과정에서 품질이 무너지지 않게 하는 게이트를 책임진다. |
| **백업 담당** | BE-A |

**지금 상태에서 이 역할이 왜 전담인가 [위험]**

현재 서비스는 **SQLite + 로컬 실행**이다. 이 상태로는 다음이 전부 불가능하다.

- 공개 도메인 접속 → 스토어 심사 제출 불가
- 동시 사용자 처리 → 시연 중 여러 명이 동시에 누르면 쓰기 잠금
- 백업·복구 → 파일 하나 손상되면 전부 소실
- 실기기 앱 테스트 → 앱은 `localhost:4000`을 볼 수 없다. **공개 API가 없으면 앱 개발 자체가 막힌다**

마지막 항목이 특히 중요하다. **APP-S와 APP-N 두 사람의 작업이 OPS의 배포에 물려 있다.**

**핵심 책임**

1. **DB 전환** — SQLite → PostgreSQL 16. 27개 마이그레이션 전환과 검증
2. **클라우드 배포** — 컨테이너 기동, HTTPS 도메인, staging + production
3. **CI/CD** — 현재 CI는 검증만 한다. 배포까지 잇는다
4. **앱 빌드·서명** — EAS Build 프로필, Android 키스토어, iOS 인증서
5. **스토어 등록** — Play Console · App Store Connect 계정, 등록 정보, 심사 대응
6. **품질 게이트** — 머지 조건, 릴리스 체크리스트, 시나리오 테스트 관리
7. **시크릿 관리** — API 키 12종 이상을 저장소 밖에서 안전하게 주입

**기술 스택**

| 항목 | 사용 | 현재 상태 |
| --- | --- | --- |
| 컨테이너 | Docker + Compose | `server/Dockerfile`, `web/Dockerfile`, compose 2개 있음 |
| 웹 서버 | Nginx | `web/nginx.conf` 있음 · SPA fallback 적용됨 |
| DB | PostgreSQL 16 | **전환 필요** (현재 SQLite) |
| 캐시 | Redis 7 | 미도입 |
| CI | GitHub Actions | `.github/workflows/ci.yml` 있음 (검증만) |
| 앱 빌드 | Expo EAS Build / Submit | 미도입 |
| HTTPS | Let's Encrypt | 미도입 |

**담당 코드·설정**

```
docker-compose.yml · docker-compose.streaming.yml
server/Dockerfile · web/Dockerfile · web/nginx.conf
.github/workflows/ci.yml
scripts/dev.mjs      개발 실행 (서버+웹 동시)
scripts/doctor.mjs   환경 점검 (npm run doctor)
mobile/eas.json      앱 빌드 프로필 (신규)
mobile/app.json      번들 ID · 권한 문구 · 딥링크 (신규 · APP-N과 공동)
```

**첫 주 과제 (우선순위 순)**

1. **staging 환경 기동** — 앱 2명이 실기기 테스트를 시작하려면 이게 먼저다. 다른 모든 인프라 작업보다 앞선다
2. Google Play · Apple Developer 계정 개설 착수 — 승인 대기가 팀 통제 밖이므로 즉시 시작
3. PostgreSQL 전환 (BE-E와 함께)

**완료 판정 기준**

- 팀원 누구나 staging 주소로 앱·웹을 실기기에서 열 수 있다
- `main`에 머지하면 자동으로 staging에 반영된다
- DB 백업본으로 빈 DB를 복원해본 기록이 있다 — 해보지 않은 복구 절차는 없는 것과 같다

---

## 4. 역할 간 인터페이스 계약

6명이 병렬로 일하려면 "누가 무엇을 언제 넘기는가"가 명시돼야 한다. 아래가 지켜지지 않으면 뒷사람이 하루를 통째로 잃는다.

| 넘기는 사람 | 받는 사람 | 산출물 | 마감 | 형식 |
| --- | --- | --- | --- | --- |
| **BE-A** | APP-S · APP-N · FE-W | `packages/shared` 타입·API 클라이언트 | 1주차 3일차 | PR 머지 |
| **OPS** | APP-S · APP-N | staging 접속 주소 + 계정 | **1주차 3일차** | README 갱신 |
| **FE-W** | APP-S · APP-N | 디자인 토큰 + 화면 레이아웃 명세 | 1주차 종료 | `packages/shared/design/` |
| **APP-N** | OPS | 권한 목적 문구 (위치·카메라·마이크·사진·알림) | 1주차 종료 | 이슈 코멘트 |
| **BE-E** | OPS | PostgreSQL 전환 시 주의 쿼리·타입 목록 | 1주차 종료 | 이슈 |
| **OPS** | 전원 | 스토어 계정 개설 진행 상황 | 매주 | 채널 공지 |
| **APP-S** | OPS | 앱 아이콘·스플래시 원본 | 앱 첫 빌드 3일 전 | `mobile/assets/` |
| **BE-E** | BE-A | 추천 응답 스키마 변경 사전 통보 | 변경 전날 | `[TYPES]` PR |

**규칙 세 가지 [설계 제안]**

1. **마감을 못 지킬 것 같으면 마감 전날에 알린다.** 당일에 알리면 뒷사람의 하루가 사라진다.
2. **타입을 바꾸면 PR 제목에 `[TYPES]`를 붙이고 채널에 알린다.** 소비자가 웹·앱 둘이므로 조용한 변경은 반드시 사고가 된다.
3. **막히면 30분 안에 말한다.** 혼자 붙잡고 반나절을 쓰는 것이 6인 팀에서 가장 비싼 낭비다.

---

## 5. RACI

R = 실행 · A = 최종책임 · C = 자문 · I = 공유

| 작업 | FE-W | APP-S | APP-N | BE-A | BE-E | OPS |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| 웹 화면 구현 | **A/R** | C | I | C | I | I |
| 디자인 시스템·토큰 | **A/R** | R | R | I | I | I |
| 페이지 트리 관리 | **A/R** | C | C | I | I | I |
| 앱 프로젝트 기반·네비게이션 | C | **A/R** | R | I | I | C |
| 앱 계획·기록 화면 | C | **A/R** | C | C | I | I |
| 앱 지도·내비 | I | C | **A/R** | I | C | I |
| 카메라 OCR · 음성 | C | C | **A/R** | I | I | I |
| 권한·푸시·딥링크 | I | C | **A/R** | I | I | R |
| API 설계·계약 | C | C | C | **A/R** | C | I |
| 인증·세션 | C | R | I | **A/R** | I | C |
| 소셜·커머스 API | I | I | I | **A/R** | I | I |
| 추천 점수 | I | I | I | C | **A/R** | I |
| 일정 최적화 (OR-Tools) | I | I | I | C | **A/R** | C |
| 외부 API 연동 | I | I | C | C | **A/R** | C |
| DB 스키마·마이그레이션 | I | I | I | R | **A/R** | C |
| 데이터 적재·정제 | I | I | I | I | **A/R** | I |
| PostgreSQL 전환 | I | I | I | R | R | **A/R** |
| 클라우드 배포·HTTPS | I | I | I | C | I | **A/R** |
| CI/CD | I | I | I | C | C | **A/R** |
| 앱 빌드·서명 | I | C | R | I | I | **A/R** |
| 스토어 등록·심사 | I | C | R | I | I | **A/R** |
| 약관·개인정보 문서 | R | I | C | C | I | **A/R** |
| 품질 게이트·릴리스 판정 | R | R | R | R | R | **A/R** |

---

## 6. 웹과 앱을 함께 만드는 방법 — 공유 코드 구조

**이 장이 6인 체제의 핵심이다.** 웹과 앱을 따로 만들면 같은 코드를 두 번 쓰고, 두 배로 틀린다.

### 6.1 지금 구조의 문제

```
app/
├── server/          Express · Prisma
│   └── src/types.ts        ← 서버가 정의하는 타입
└── web/             React
    ├── src/types.ts        ← 웹이 다시 정의하는 타입 (수동 동기화)
    └── src/api/client.ts   ← API 호출 함수 35개+
```

여기에 `mobile/`을 그냥 추가하면 **타입 정의가 3벌, API 클라이언트가 2벌**이 된다. 한 곳만 고치고 다른 곳을 잊으면 런타임에서 터진다.

### 6.2 제안 구조 [설계 제안]

```
app/
├── packages/
│   └── shared/                    ← 신규. 웹·앱·서버가 공유
│       ├── src/types.ts           API 요청·응답 타입 (단일 진실 공급원)
│       ├── src/client.ts          fetch 기반 API 클라이언트
│       ├── src/i18n/              번역 문자열
│       ├── src/design/tokens.ts   색·간격·타이포 토큰
│       └── src/domain/            순수 계산 (거리·비용 합산·날짜 포맷)
├── server/
├── web/                           React (shared 사용)
└── mobile/                        React Native + Expo (shared 사용)
```

### 6.3 무엇을 공유하고 무엇을 공유하지 않는가

| 공유 가능 | 이유 |
| --- | --- |
| **타입 정의** | 서버 응답 모양은 플랫폼과 무관하다 |
| **API 클라이언트** | `fetch`는 React Native에도 있다. 그대로 동작한다 |
| **다국어 문자열** | 같은 문장을 두 번 번역할 이유가 없다 |
| **디자인 토큰** | 색·간격 값은 숫자다. 적용 방법만 다르다 |
| **순수 계산** | 거리·비용·날짜 계산에 DOM이 필요 없다 |

| 공유 불가 | 이유 |
| --- | --- |
| JSX 태그 | `<div>` ↔ `<View>` |
| 스타일 적용 | CSS ↔ StyleSheet |
| 라우터 API | react-router ↔ Expo Router |
| 브라우저 API | Tesseract.js·Web Speech ↔ 네이티브 모듈 |

> **경험칙**: 화면에 그리는 코드는 공유하지 말고, **화면에 그릴 내용을 만드는 코드는 전부 공유한다.**

### 6.4 이 구조가 팀 배분에 주는 효과

- **BE-A**가 타입 하나만 고치면 웹·앱이 동시에 컴파일 오류로 알아챈다
- **FE-W**가 정한 토큰을 앱 2명이 그대로 쓴다. 디자인이 갈라지지 않는다
- **APP-S**는 API 호출 코드를 새로 짤 필요가 없다. 화면에만 집중한다

### 6.5 도입 순서

| 순서 | 작업 | 담당 | 시점 |
| --- | --- | :-: | --- |
| 1 | `packages/shared` 워크스페이스 추가 | BE-A | 1주차 1~2일 |
| 2 | `web/src/types.ts` → `shared/src/types.ts` 이동, 웹은 재수출로 호환 | BE-A | 1주차 2일 |
| 3 | `web/src/api/client.ts` → `shared/src/client.ts` 이동 | BE-A | 1주차 3일 |
| 4 | 디자인 토큰 추출 | FE-W | 1주차 5일 |
| 5 | `mobile/`에서 shared 참조 확인 | APP-S | 1주차 5일 |

**[위험] 2·3번이 늦어지면 앱 2명이 놀게 된다.** BE-A의 1주차 최우선 과제인 이유다.

---

## 7. 화면 44개 담당 배분

`web/src/routes/routeTree.ts` 기준. 웹은 FE-W, 앱은 APP-S/APP-N이 같은 화면을 각자 플랫폼으로 만든다.

| 화면 묶음 | 화면 수 | 웹 담당 | 앱 담당 | 비고 |
| --- | ---: | :-: | :-: | --- |
| 시작·온보딩 (`/`, `/welcome`, `/onboarding`) | 3 | FE-W | APP-S | 온보딩은 앱 전용(권한 고지) |
| 인증 (`/auth/login`, `/auth/signup`) | 2 | FE-W | APP-S | 앱은 SecureStore 토큰 보관 |
| 여행 조건 입력 (`/plan/*`) | 5 | FE-W | APP-S | 웹 4단계 → 앱은 3단계 압축 검토 |
| 생성 진행 (`/generating/:tripId`) | 1 | FE-W | APP-S | SSE |
| 여행 대시보드 셸 (`/trips/:tripId`) | 1 | FE-W | APP-S | 웹=사이드바 / 앱=하단 탭 |
| 여행 요약 (`overview`) | 1 | FE-W | APP-S | |
| 일정·동선 (`schedule`, `schedule/:day`) | 2 | FE-W | **APP-N** | 지도가 붙어 네이티브 담당 |
| 경로 상세·내비 (`scheduleNavigate`) | 1 | FE-W | **APP-N** | 실시간 위치 |
| 지도 전체 (`map`) | 1 | FE-W | **APP-N** | |
| 로컬 탐색 (`discover`, `festivals`, `souvenirs`) | 3 | FE-W | APP-S | 8종 카테고리 아코디언 |
| 함께·기록 (`together`) | 1 | FE-W | APP-S | |
| 여행 준비 (`prep`) | 1 | FE-W | APP-S | 광고·예약·사투리 카드 |
| 공동 편집 (`collaborate`) | 1 | FE-W | APP-S | |
| 장소 상세 (`place`, `place.reviews`) | 2 | FE-W | **APP-N** | 현장 한국어·TTS |
| 스토리 (`stories`, `new`, `detail`) | 3 | FE-W | APP-S | 앱은 네이티브 카메라 |
| 사용자·내 정보 (`user`, `me/*`) | 4 | FE-W | APP-S | |
| 공유·초대 (`/s/:slug`, `/invite/:token`) | 2 | FE-W | APP-N | 딥링크 진입점 |
| 운영 콘솔 (`/admin/*`) | 4 | FE-W | — | **웹 전용** |
| 약관·정책 (`/legal/*`) | 4 | FE-W | APP-S | 심사 필수 |
| 404 | 1 | FE-W | APP-S | |
| **합계** | **44** | | | |

앱에 필요한 화면은 **약 40개**(운영 콘솔 4개 제외)이며, 그중 **7개가 APP-N의 네이티브 영역**이다.

---

## 8. API 66개 담당 배분

라우터 파일 단위로 나눈다. 파일 경계가 곧 소유권 경계여서 충돌이 가장 적다.

| 라우터 파일 | 엔드포인트 | 주 담당 | 대표 경로 |
| --- | ---: | :-: | --- |
| `routes/trips.ts` | 23 | **BE-A · BE-E 공동** | `/trips` `/trips/:id/itinerary` `/places` `/routes/directions` `/itineraries/:id/*/reoptimize` |
| `routes/social.ts` | 9 | BE-A | `/stories` `/users/:id/follow` `/moderation/*` |
| `routes/commerce.ts` | 8 | BE-A | `/ads` `/bookings/*` `/businesses/*` |
| `routes/collaboration.ts` | 7 | BE-A | `/itineraries/:id/share` `/s/:slug` `/collaboration/invites/*` |
| `routes/account.ts` | 5 | BE-A | `/auth/register` `/auth/login` `/auth/me` `/auth/logout` |
| `routes/community.ts` | 5 | BE-A | `/places/:id/reviews` `/places/:id/visits/verify` `/local-profile` |
| `routes/experience.ts` | 5 | **BE-E** | `/festivals` `/events` `/shops/souvenir` `/weather` |
| `routes/analytics.ts` | 3 | BE-A | `/analytics/kpis` `/events` `/events/catalog` |
| `index.ts` | 1 | OPS | `/health` |
| **합계** | **66** | | |

### 8.1 `trips.ts` 내부 분담

이 파일 하나에 23개가 몰려 있어 두 사람이 함께 쓴다. 경로 성격으로 나눈다.

| 갈래 | 주 담당 | 대표 경로 |
| --- | :-: | --- |
| 여행 생성·조회·설정 | BE-A | `POST /trips` · `GET /trips` · `GET /trips/:id/itinerary` · `PATCH /trips/:id/preferences` |
| 생성 job · SSE 진행률 | BE-A | `POST /trips/:id/itineraries:generate` · `GET /itinerary-jobs/:jobId/events` |
| 재최적화 · 재계획 · 순서 · 되돌리기 | **BE-E** | `/itineraries/:id/days/:d/reoptimize` · `/replan` · `/reorder` · `/undo` |
| 추천 부가 (대체 장소 · 코스 · 페이스 · 리듬) | **BE-E** | `/alternatives` · `/course-categories` · `/pace` · `/rhythm` |
| 장소 · 경로 · 검색 | **BE-E** | `/places` · `/places/:id/image` · `/locations/search` · `/routes/directions` · `/routes/taxi-card` |

**대략 BE-A 37개 · BE-E 28개 · OPS 1개.** 개수는 BE-A가 많지만 BE-E 쪽이 계산 밀도가 훨씬 높아 실제 부하는 비슷하다.

**규칙**: `trips.ts`를 고칠 때는 상대방을 리뷰어로 지정한다. 한 파일을 둘이 쓰는 유일한 예외이므로 규율이 필요하다.

---

## 9. 협업 규칙

### 9.1 브랜치와 PR

| 항목 | 규칙 |
| --- | --- |
| 기본 브랜치 | `main` 보호. 직접 푸시 금지 |
| 작업 브랜치 | `feat/<역할코드>-<주제>` 예: `feat/app-n-map-permission` |
| 머지 조건 | CI 통과 + 리뷰 1인 이상 |
| 리뷰 응답 | 15분 내. 지금 못 보면 "지금 못 본다"고 답한다 |
| 머지 시각 | 매일 18:00 이전. 이후 머지는 다음 날 아침으로 |
| 타입 변경 | PR 제목에 `[TYPES]` + 채널 공지 필수 |
| 커밋 메시지 | `type(scope): 한 줄 요약` + 빈 줄 + **왜 바꿨는지** |

### 9.2 코드 영역 소유권

충돌을 줄이려면 "이 파일은 누구 것인가"가 분명해야 한다.

| 경로 | 소유자 | 다른 사람이 손댈 때 |
| --- | :-: | --- |
| `web/src/**` | FE-W | PR에 FE-W 리뷰 필수 |
| `mobile/app/**` (계획·기록) | APP-S | APP-N과 상호 리뷰 |
| `mobile/src/native/**` | APP-N | APP-S와 상호 리뷰 |
| `server/src/routes/**` | BE-A | BE-E 리뷰 |
| `server/src/services/{recommend,schedule,reoptimize,optimizer,paceLearning}.ts` | BE-E | BE-A 리뷰 |
| `server/solver/**` | BE-E | 단독 |
| `server/prisma/schema.prisma` | BE-E | **BE-A + OPS 둘 다 리뷰** (마이그레이션은 되돌리기 어렵다) |
| `packages/shared/**` | BE-A | 변경 시 전원 공지 |
| `.github/`, `docker-compose*`, `Dockerfile`, `nginx.conf`, `scripts/` | OPS | 단독 |

### 9.3 정기 일정

| 시각 | 활동 | 규칙 |
| --- | --- | --- |
| 매일 10:00 | 데일리 15분 | ① 어제 한 것 ② 오늘 할 것 ③ **막힌 것**. 세 번째를 말하지 않는 것이 가장 큰 리스크 |
| 매일 18:00 | 데일리 데모 5분 | staging에서 **실제로 동작시켜** 보인다. 말이 아니라 화면으로 진척을 확인 |
| 주 1회 | 데이터 확충 1시간 | 전원이 장소 데이터를 검수·추가 (11.4절) |
| 주 1회 | 리스크 점검 | 10장 표를 갱신 |

### 9.4 품질 게이트

머지 전 CI가 자동으로 확인한다.

```bash
npm ci
npm run prisma:generate --workspace server
npx prisma migrate deploy         # server/
npm audit --audit-level=high
npm test --workspace server       # 12개 테스트 파일
npm run build --workspace server
npm run build --workspace web
```

여기에 추가할 항목 [설계 제안]

```bash
npx tsc -b web                    # 웹 타입 검사
npx tsc -b mobile                 # 앱 타입 검사 (앱 착수 후)
npm run doctor                    # 환경 점검 (로컬 전용)
```

---

## 10. 리스크와 대응

| ID | 리스크 | 영향 | 담당 | 대응 |
| --- | --- | :-: | :-: | --- |
| R-1 | **staging 지연으로 앱 2명이 대기** | 치명 | OPS | 1주차 3일차 마감을 최우선으로 고정. 늦어지면 임시 터널링으로라도 공개 엔드포인트 확보 |
| R-2 | **`packages/shared` 승격 지연** | 높음 | BE-A | 1주차 3일차 마감. 늦어지면 앱은 임시로 타입을 복사해 진행하고 나중에 교체 |
| R-3 | 네이티브 기능이 한쪽 OS에서만 동작 | 높음 | APP-N | 1주차에 4개 권한을 양 OS 실기기에서 전부 확인 |
| R-4 | 스토어 계정 개설·승인 지연 | 치명 | OPS | 첫날 착수. 승인은 팀이 통제할 수 없다 |
| R-5 | PostgreSQL 전환 시 일정 계산 결과 변형 | 높음 | OPS·BE-E | 전환 다음 날을 검증 전용으로 배정. 같은 조건 결과 대조표 작성 |
| R-6 | 장소 데이터 부족으로 일정이 단조로움 | 중간 | BE-E | 1주차에 커버리지 실측. 주간 데이터 확충 운영 |
| R-7 | 웹·앱 디자인이 갈라짐 | 중간 | FE-W | 디자인 토큰을 shared에 두고 양쪽이 같은 값을 참조 |
| R-8 | 외부 API 쿼터 초과 | 중간 | BE-E | 카카오·TourAPI 일일 한도 확인. Redis 캐시로 호출 절감 |
| R-9 | 팀원 부재 (질병·개인사정) | 높음 | 전원 | 모든 역할에 백업 지정(3장). 작업은 반드시 PR로 남긴다 |
| R-10 | 앱 서명 키 분실 | 치명 | OPS | EAS 관리 + 별도 이중 백업. 분실 시 앱 업데이트 영구 불가 |

---

## 11. 첫 2주 스프린트

### 11.1 1주차 — 기반 세우기

목표: **앱 2명이 막힘없이 일할 수 있는 상태를 만든다.**

| 담당 | 1~2일 | 3~4일 | 5일 |
| --- | --- | --- | --- |
| **OPS** | 스토어 계정 개설 착수 · 클라우드 VM·도메인 확보 | **staging 기동 (최우선)** | CI에 배포 연결 · `eas.json` 초안 |
| **BE-A** | `packages/shared` 워크스페이스 생성 | 타입·API 클라이언트 이동 | 앱용 인증 흐름 문서화 |
| **BE-E** | 데이터 커버리지 실측 · PG 전환 주의목록 | 솔버 vs 휴리스틱 결과 비교 | 데이터 확충 계획 확정 |
| **FE-W** | 디자인 토큰 추출 | 약관·정책 3개 화면 | 토큰·레이아웃 명세 인계 |
| **APP-S** | Expo 프로젝트 생성 · Router 골격 | shared 연결 · 인증 화면 | 조건 입력 → 생성 흐름 |
| **APP-N** | 지도 방식 비교·결정 | 위치 권한 → 현재 위치 → 경로 표시 | 권한 4종 실기기 확인 · 목적 문구 인계 |

**1주차 종료 판정**: 앱에서 로그인 → 여행 조건 입력 → 일정 생성 → 요약 확인이 **실기기에서** 한 번 완주된다.

### 11.2 2주차 — 화면 채우기

| 담당 | 주요 작업 |
| --- | --- |
| **OPS** | PostgreSQL 전환 · 백업/복구 리허설 · 첫 EAS 빌드 → 내부 테스트 트랙 업로드 |
| **BE-A** | 앱 트래픽 대응(CORS·rate limit) · 소셜/커머스 API 앱 대응 |
| **BE-E** | 데이터 적재 실행 · 추천 근거 문구 정비 · 재최적화 안정화 |
| **FE-W** | 운영 콘솔(신고 검토 큐) · 장소 상세 · 사용자 프로필 |
| **APP-S** | 로컬 탐색 · 여행 준비 · 기록(스토리) 화면 |
| **APP-N** | 일정·내비·지도 화면 · 카메라 OCR 1차 · 딥링크 |

**2주차 종료 판정**: 앱 주요 화면이 실기기에서 크래시 없이 동작하고, staging이 PostgreSQL 위에서 돈다.

### 11.3 3주차 이후 방향

- 3주차: 심사 필수 항목(약관 URL·계정 삭제·UGC 신고·권한 고지) 완비, TestFlight·비공개 테스트 배포
- 4주차: 스토어 등록 정보 작성, 심사 제출, 리젝 대응
- 이후: KPI 대시보드, 로컬 등급, 광고 콘솔(M4)

> **[위험] Google Play 신규 개인 개발자 계정은 테스터 12명이 14일 연속 참여하는 비공개 테스트를 마쳐야 프로덕션 신청이 가능하다.** 앱이 완성된 뒤에 시작하면 출시가 2~3주 밀린다. **첫 빌드가 나오는 즉시(2주차) 비공개 테스트를 시작**해야 한다. OPS의 R-4와 함께 관리한다.

### 11.4 주간 데이터 확충 운영 [설계 제안]

데이터 전담을 두지 않는 대신, 전원이 주 1시간을 쓴다.

| 항목 | 방식 |
| --- | --- |
| 목표 | 매주 장소 30건 검수·추가 |
| 분배 | 6명 × 5건 |
| 검수 항목 | 영업시간 · 브레이크타임 · 영어 메뉴 · 해외카드 · 혼밥 가능 · 예상 비용 |
| 기록 | `server/prisma/` 시드 스크립트에 반영, BE-E가 병합 |
| 원칙 | **확인되지 않은 정보는 채우지 않는다.** 빈 값은 "확인 필요"로 남긴다 |

---

## 12. 이 팀 구성의 전제와 한계

솔직하게 적는다.

1. **6명이 모두 이 프로젝트에 전념한다고 가정했다.** 다른 일과 병행한다면 앱 2명 체제는 3명이 필요할 수 있다.

2. **React Native 경험이 없다면 1주차 목표는 무리다.** APP-S·APP-N 중 최소 한 명은 RN 경험이 있어야 한다. 둘 다 처음이라면 1주차를 학습 주간으로 잡고 전체를 1주 미루는 편이 낫다. 무리하게 밀어붙이면 크래시가 남은 앱이 나오고, 그건 스토어 리젝 1순위 사유다.

3. **웹 1명은 최소 인원이다.** 남은 화면이 17개지만 대부분 정적이거나 기존 컴포넌트 재조합이라는 판단에 기반한다. 디자인을 크게 손보기로 하면 인원 재배치가 필요하다.

4. **데이터 전담이 없다는 것은 의도된 선택이다.** 6명 중 하나를 데이터에 쓰면 앱이나 인프라가 얇아진다. 대신 주간 확충으로 메운다. 데이터 커버리지가 데모 품질을 좌우한다고 판단되면 이 결정을 다시 봐야 한다.

5. **역할 경계는 목표지 벽이 아니다.** 병목이 생기면 백업 담당이 즉시 넘어간다. 특히 후반부에는 전원이 앱과 심사 준비에 붙는 것이 정상이다.

---

## 13. 부록

### 13.1 온보딩 체크리스트 (첫날)

```
[ ] 저장소 클론
[ ] npm install
[ ] server/.env, web/.env 생성 (.env.example 참고 · 키는 OPS에게 요청)
[ ] cd server && npx prisma migrate deploy
[ ] npm run seed --workspace server (+ seed:translations, seed:commerce, seed:v2, seed:discover-tags)
[ ] npm run doctor        ← 환경 점검. 실패 항목을 먼저 해결
[ ] npm run dev           ← 서버(:4000) + 웹(:5173) 동시 실행
[ ] http://localhost:5173 접속 확인
[ ] 본인 역할의 "담당 코드" 경로를 열어 구조 파악
[ ] LOCAL_ROUTE_기획서_v5.md 읽기 (서비스 정의 · 6대 원칙)
```

### 13.2 자주 쓰는 명령어

```bash
# 개발
npm run dev                                   # 서버 + 웹 동시
npm run dev:server / npm run dev:web          # 따로 실행
npm run doctor                                # 환경 점검

# DB
npx prisma migrate dev --name <이름>           # 개발용 (운영 금지)
npx prisma migrate deploy                     # 운영 배포용
npx prisma studio                             # 데이터 확인

# 시드
npm run seed --workspace server
npm run seed:translations --workspace server
npm run seed:commerce --workspace server
npm run seed:v2 --workspace server
npm run seed:discover-tags --workspace server
npm run import:tourapi --workspace server

# 검증
npm test --workspace server
npm run build --workspace server
npm run build --workspace web
npx tsc -b web
npm audit --audit-level=high
npm run smoke:pace                            # 페이스 학습 스모크

# 페이지 트리
node web/scripts/print-route-tree.mjs tree    # 트리
node web/scripts/print-route-tree.mjs table   # 마크다운 표
node web/scripts/print-route-tree.mjs stats   # 집계

# 배치
npm run privacy:cleanup --workspace server
npm run events:dispatch --workspace server

# 컨테이너
docker compose up --build                     # 웹 :8080, API :4000
```

### 13.3 역할 코드 요약 (채널·PR·이슈에서 사용)

| 코드 | 역할 | 담당자 |
| --- | --- | --- |
| `FE-W` | 웹 프론트엔드 & 디자인 시스템 | |
| `APP-S` | 앱 · 셸과 계획/기록 흐름 | |
| `APP-N` | 앱 · 여행 중 네이티브 기능 | |
| `BE-A` | 백엔드 코어 API | |
| `BE-E` | 추천·최적화 엔진 & 데이터 | |
| `OPS` | 인프라 · 배포 · 품질 | |

---

## 결론

세 가지만 기억하면 된다.

1. **앱이 가장 큰 미개척지다.** 백엔드 66개 API와 웹 23개 화면은 이미 있다. 앱은 0이다. 그래서 6명 중 2명을 앱에 배치했고, 그 둘은 성격이 완전히 다른 일(화면 흐름 / 네이티브 기능)을 맡는다.

2. **1주차 3일차가 이 계획의 분기점이다.** OPS의 staging과 BE-A의 `packages/shared`가 그날 나와야 앱 2명이 일할 수 있다. 이 두 개가 늦으면 나머지 계획이 전부 밀린다.

3. **웹과 앱은 같은 코드를 공유해야 한다.** 타입·API 클라이언트·다국어·디자인 토큰을 `packages/shared`에 두면, 한 곳을 고칠 때 양쪽이 같이 고쳐진다. 이것을 안 하면 6명이 아니라 사실상 두 팀이 따로 일하게 된다.

---

*LOCAL ROUTE 6인 팀 구성안 v1.0 · 2026-08-26*
