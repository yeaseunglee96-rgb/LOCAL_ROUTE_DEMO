# LOCAL ROUTE

`LOCAL_ROUTE_기획서_v2`의 핵심 가설과 추가 기능을 실행 가능한 통합 MVP로 구현한 프로젝트입니다.

## 실행

```bash
npm install
cd server
npx prisma migrate deploy
npm run seed
npm run seed:pet-safety
npm run seed:translations
npm run seed:commerce
npm run seed:v2
npm run dev

# 별도 터미널
cd web
npm run dev
```

- 웹: `http://localhost:5173`
- API: `http://localhost:4000`
- 카카오 키가 없으면 지도 대신 안내를 표시하고 일정·목록 기능은 유지합니다.
- 외부 이동시간이나 날씨 원천이 없을 때는 반드시 `추정`으로 표시합니다.

### 장소 사진 검색 설정

관광지·식당에 저장된 사진이 없으면 서버가 네이버 이미지 검색을 우선 조회하고 Google Custom Search를 보조로 사용합니다. 검색 이미지는 원본 파일을 복제하지 않고 썸네일 URL과 출처 링크만 24시간 캐시합니다. 아래 환경변수 중 사용할 제공자의 키를 서버 환경에 설정하세요.

```bash
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
GOOGLE_CUSTOM_SEARCH_KEY=
GOOGLE_CUSTOM_SEARCH_CX=
```

키가 없거나 검색 결과가 없으면 기존 카테고리 플레이스홀더를 표시합니다.

## 구현 범위

- 여행 조건·취향·예산·동행·숙소·반려동물·외국인 편의 입력
- 규칙 기반 추천, 3개 추천 모드, OR-Tools 우선 일정 최적화와 휴리스틱 폴백
- 비동기 생성 job, SSE 진행률, 부분 재최적화, 대체 장소, 되돌리기
- 카카오맵 경로, 반려동물 안전 정보, 다국어 UI와 구조화 번역 출처
- 익명 세션, GPS 방문 인증, 리뷰, 로컬 등급·점수
- 이벤트 Outbox/Kafka 선택 연동, KPI, 광고·자연 추천 분리, 예약 제휴

### 카카오 식당 리뷰 추천

- 식당 후보에만 카카오 평점, 후기 수, 긍정 후기 비율, 집계 키워드를 반영합니다.
- 후기 수 30건과 평균 4.0점을 사전값으로 둔 베이지안 보정으로 소수 후기의 극단적 평점을 완화합니다.
- 카카오 로컬 API에는 평점·후기 응답 필드가 없으므로 임의 크롤링이나 가짜 점수를 사용하지 않습니다.
- 권한이 확인된 집계 JSON만 `npm run import:kakao-reviews -- <파일.json>`으로 가져옵니다. `source`는 `LICENSED_IMPORT` 또는 `MANUAL_VERIFIED`만 허용합니다.
- 필수 필드: `placeId`, `kakaoPlaceId`, `kakaoPlaceUrl`, `rating`(0~5), `reviewCount`, `collectedAt`, `source`. 선택 필드: `positiveReviewRate`(0~1), `keywords`.

### v2 추가 기능

- 지역축제: 여행 기간과 겹치는 축제만 조회하고 사용자가 선택해 일정에 추가
- 기념품샵: 지도 레이어·마커·간단 상세·마지막 동선용 거리 정보, 광고 순위 개입 금지
- 날씨: 날짜별 온도·강수 배지, 우천·반려동물 폭염 경고, 1시간 캐시와 추정값 표시
- 공동 편집: 소유자·편집자·열람자, 7일 초대 링크, 5초 폴링, 항목 버전 낙관적 락(409), 열람자 수정 차단(403)
- 공유: 30일 읽기 전용 링크, 출발지·연락처·정확 위치 제외, 복제 후 사용자 조건으로 재최적화 job 실행
- 소셜: 장소 기반 스토리, 여행 종료 후 지연 공개 기본값, 지역 단위 위치, JPEG EXIF 제거, 팔로우·시간순 피드
- UGC 운영: 신고 즉시 검토 큐 이동, 관리자 삭제·기각 처리
- 광고: 숙박·렌터카·여행보험·택시·공항이동·반려동물 이동만 등록·노출 허용. 음식점·카페·기념품샵은 API 단계에서 거부

## 주요 API

- `GET /api/festivals?from=&to=` / `POST /api/itineraries/:id/festivals/:placeId`
- `GET /api/shops/souvenir?lat=&lng=&radius=`
- `GET /api/weather?region=BUSAN&date=`
- `POST /api/itineraries/:id/share` / `GET /api/s/:slug` / `POST /api/s/:slug/clone`
- `POST /api/trips/:tripId/members/invite` / `POST /api/collaboration/invites/:token/accept`
- `GET /api/itineraries/:id/collaboration` / `PATCH /api/itineraries/:id/items/:itemId/collaborate`
- `POST|GET /api/stories`, `POST /api/stories/:id/report`
- `POST|DELETE /api/users/:id/follow`
- `GET /api/moderation/stories` / `PATCH /api/moderation/reports/:id`

## 검증

```bash
npm test --workspace server
npm run build --workspace server
npm run build --workspace web
npm audit --audit-level=high
```

현재 날씨는 API 키 없이도 UX를 검증할 수 있는 캐시형 데모 예보이며 `isEstimate: true`로 정직하게 표시됩니다. 운영에서는 기상청 단기예보 수집 작업이 같은 응답 형식으로 캐시를 채워야 합니다. 스토리 이미지는 MVP에서 DB의 정제된 Data URL로 보관하므로, 운영 전 S3 호환 오브젝트 스토리지·리사이즈·CDN으로 교체해야 합니다.
