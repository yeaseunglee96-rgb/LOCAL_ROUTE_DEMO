import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * "액티비티"로 시드된 장소들은 사실 성격이 여러 갈래로 갈린다:
 *   - 요트·케이블카·사격장·서핑·아이스링크·아쿠아리움 같은 "예약/체험형 액티비티"
 *   - ~길·~로드·~코스·공원 같은 "산책" 스팟
 *   - 해수욕장·산 같은 "자연" 스팟
 *   - 캠핑장·글램핑·카라반은 로컬 탭에서 아예 제외한다(장소 자체는 남기되 노출 태그만 뺀다)
 * 기존 "activity" 태그는 일정 추천 엔진(취향 태그 매칭)이 그대로 쓰고 있으므로 건드리지 않고,
 * 로컬 탭 세부 분류에만 쓰는 태그를 추가로 얹는다.
 */
const ADVENTURE_ACTIVITY = [
  "부산 아쿠아리움", "송도 해상케이블카", "요트탈래", "센텀시티 아이스링크", "미포정거장",
  "송정서핑학교", "서프마린", "삼락강변체육공원인라인스케이트장", "레이저태그스포츠 광안점",
  "광안리 SUP Zone", "삼락수상레포츠타운", "영도관광실탄사격장", "아시아드 컨트리클럽",
];

const WALK_TRAIL = [
  "이기대 해안산책로", "문탠로드", "[부산 갈맷길] 2코스 2구간", "남파랑길(부산)",
  "송도해안볼레길", "[해파랑길] 2코스", "구포무장애숲길", "송도 구름산책로",
  "해안누리길 몰운대길", "용두산공원", "동백공원", "삼익비치수변공원",
  "부산 중앙공원", "반송공원",
];

const NATURE_SPOT = [
  "해운대해수욕장", "광안리해수욕장", "송정해수욕장", "다대포해수욕장",
  "태종대", "늘푸른숲", "용호동일대 바다낚시",
  "금련산", "금정산", "땅뫼산", "백양산 웰빙숲", "송도반도 (부산 국가지질공원)",
];

const NIGHT_VIEW = ["광안리해수욕장", "용두산공원", "감천문화마을", "황령산 전망쉼터", "초량이바구길", "호천마을"];

// 야경 탭 큐레이션에서 뺀다: 다대포해수욕장/오륙도 스카이워크는 사용자 요청으로 제외,
// 청사포 카페거리/광안리 오션뷰 카페/부산바다축제는 카페·축제라 야경 "장소" 성격이 아니라서 기존에 잘못 태깅돼 있었다.
const NIGHT_VIEW_REMOVE = ["다대포해수욕장", "청사포 카페거리", "광안리 오션뷰 카페", "오륙도 스카이워크", "부산바다축제"];

// 시드 데이터에 없던 야경 명소 — 카카오 로컬 검색으로 좌표를 확인해 새로 등록한다(2026-08-26).
const NEW_PLACES: Array<{ nameKo: string; address: string; lat: number; lng: number; tags: string[] }> = [
  { nameKo: "황령산 전망쉼터", address: "부산 남구 황령산로 391-39", lat: 35.1578845362561, lng: 129.082724691796, tags: ["nightview"] },
  { nameKo: "초량이바구길", address: "부산 동구 초량동 994-12", lat: 35.116820678714, lng: 129.03669648381614, tags: ["nightview"] },
  { nameKo: "호천마을", address: "부산 부산진구 범천동", lat: 35.1432149467422, lng: 129.052026795224, tags: ["nightview"] },
];

// 기존 시드 좌표 오류 수정 — 반송공원이 부산이 아니라 남중국해 근처 좌표를 갖고 있어
// 거리 기반(haversine) 필터에서 항상 걸러지고 있었다. 카카오 로컬 검색으로 재확인한 실제 좌표로 교정(2026-08-26).
const COORDINATE_FIXES: Array<{ nameKo: string; lat: number; lng: number }> = [
  { nameKo: "반송공원", lat: 35.221441578576766, lng: 129.16162214668637 },
];

// 세분화된 walk_trail/nature_spot 로 대체하는 예전 태그 — 캠핑장류가 여기 남아있었다.
const RETIRED_TAGS = ["nature_walk"];

async function addTag(nameKo: string, tag: string) {
  const place = await prisma.place.findFirst({ where: { nameKo } });
  if (!place) { console.warn(`[skip] not found: ${nameKo}`); return; }
  const tags: string[] = JSON.parse(place.tasteTags);
  if (tags.includes(tag)) return;
  await prisma.place.update({ where: { id: place.id }, data: { tasteTags: JSON.stringify([...tags, tag]) } });
}

async function removeTag(tag: string) {
  const places = await prisma.place.findMany({ where: { tasteTags: { contains: tag } } });
  for (const place of places) {
    const tags: string[] = JSON.parse(place.tasteTags).filter((t: string) => t !== tag);
    await prisma.place.update({ where: { id: place.id }, data: { tasteTags: JSON.stringify(tags) } });
  }
  return places.length;
}

async function removeTagFromNames(names: string[], tag: string) {
  let count = 0;
  for (const nameKo of names) {
    const place = await prisma.place.findFirst({ where: { nameKo } });
    if (!place) continue;
    const tags: string[] = JSON.parse(place.tasteTags).filter((t: string) => t !== tag);
    if (tags.length === JSON.parse(place.tasteTags).length) continue;
    await prisma.place.update({ where: { id: place.id }, data: { tasteTags: JSON.stringify(tags) } });
    count++;
  }
  return count;
}

async function ensurePlace(input: { nameKo: string; address: string; lat: number; lng: number; tags: string[] }) {
  const existing = await prisma.place.findFirst({ where: { nameKo: input.nameKo } });
  if (existing) return;
  await prisma.place.create({ data: {
    nameKo: input.nameKo,
    category: "TOURIST",
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    openTime: "00:00",
    closeTime: "23:59",
    closedDays: "[]",
    recommendedStayMin: 40,
    priceTier: 1,
    localScore: 0.5,
    localScoreSource: "SEED",
    tasteTags: JSON.stringify(input.tags),
    dataSource: "MANUAL",
  } });
}

async function fixCoordinates(fixes: Array<{ nameKo: string; lat: number; lng: number }>) {
  let count = 0;
  for (const fix of fixes) {
    const place = await prisma.place.findFirst({ where: { nameKo: fix.nameKo } });
    if (!place) continue;
    await prisma.place.update({ where: { id: place.id }, data: { lat: fix.lat, lng: fix.lng } });
    count++;
  }
  return count;
}

async function main() {
  const retired: Record<string, number> = {};
  for (const tag of RETIRED_TAGS) retired[tag] = await removeTag(tag);
  for (const name of ADVENTURE_ACTIVITY) await addTag(name, "adventure_activity");
  for (const name of WALK_TRAIL) await addTag(name, "walk_trail");
  for (const name of NATURE_SPOT) await addTag(name, "nature_spot");
  for (const place of NEW_PLACES) await ensurePlace(place);
  const coordinateFixes = await fixCoordinates(COORDINATE_FIXES);
  const nightViewRemoved = await removeTagFromNames(NIGHT_VIEW_REMOVE, "nightview");
  for (const name of NIGHT_VIEW) await addTag(name, "nightview");
  console.log(JSON.stringify({ retired, adventureActivity: ADVENTURE_ACTIVITY.length, walkTrail: WALK_TRAIL.length, natureSpot: NATURE_SPOT.length, nightView: NIGHT_VIEW.length, nightViewRemoved, coordinateFixes, newPlaces: NEW_PLACES.length }));
}

main().finally(() => prisma.$disconnect());
