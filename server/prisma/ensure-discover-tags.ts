import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * "액티비티"로 시드된 장소들은 사실 성격이 크게 둘로 갈린다:
 *   - 요트·케이블카·사격장·서핑·아이스링크·아쿠아리움 같은 "예약/체험형 액티비티"
 *   - 해수욕장·산책로·숲길·캠핑장 같은 "산책·자연" 스팟
 * 기존 로컬 탭은 이 둘을 "activity" 태그 하나로 묶어 보여줘서 성격이 다른 정보가 섞여 있었다.
 *
 * 기존 "activity" 태그는 일정 추천 엔진(취향 태그 매칭)이 그대로 쓰고 있으므로 건드리지 않고,
 * 로컬 탭 세부 분류에만 쓰는 태그 2개를 추가로 얹는다.
 */
const ADVENTURE_ACTIVITY = [
  "부산 아쿠아리움", "송도 해상케이블카", "요트탈래", "센텀시티 아이스링크", "미포정거장",
  "송정서핑학교", "서프마린", "삼락강변체육공원인라인스케이트장", "레이저태그스포츠 광안점",
  "광안리 SUP Zone", "삼락수상레포츠타운", "영도관광실탄사격장", "아시아드 컨트리클럽",
];

const NATURE_WALK = [
  "해운대해수욕장", "태종대", "송정해수욕장", "이기대 해안산책로", "문탠로드",
  "[부산 갈맷길] 2코스 2구간", "남파랑길(부산)", "더무빙 카라반", "제이스글램핑",
  "화명오토캠핑장", "부산항힐링야영장", "초원숲속캠핑장", "송도해안볼레길", "[해파랑길] 2코스",
  "늘푸른숲", "용호동일대 바다낚시", "구포무장애숲길", "송도 구름산책로", "지오클럽",
  "해안누리길 몰운대길", "대저캠핑장", "함지골청소년수련관", "임랑카라반파크", "장안캠프",
];

async function addTag(nameKo: string, tag: string) {
  const place = await prisma.place.findFirst({ where: { nameKo } });
  if (!place) { console.warn(`[skip] not found: ${nameKo}`); return; }
  const tags: string[] = JSON.parse(place.tasteTags);
  if (tags.includes(tag)) return;
  await prisma.place.update({ where: { id: place.id }, data: { tasteTags: JSON.stringify([...tags, tag]) } });
}

async function main() {
  for (const name of ADVENTURE_ACTIVITY) await addTag(name, "adventure_activity");
  for (const name of NATURE_WALK) await addTag(name, "nature_walk");
  console.log(JSON.stringify({ adventureActivity: ADVENTURE_ACTIVITY.length, natureWalk: NATURE_WALK.length }));
}

main().finally(() => prisma.$disconnect());
