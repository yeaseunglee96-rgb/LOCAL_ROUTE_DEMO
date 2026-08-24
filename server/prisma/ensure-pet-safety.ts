import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const places = [
  { id: "safety-vet-busan-station", nameKo: "부산동물메디컬센터", nameEn: "Busan Animal Medical Center", category: "VET", address: "부산광역시 동구 중앙대로", lat: 35.119, lng: 129.041 },
  { id: "safety-supply-busan-station", nameKo: "초량 반려동물용품점", nameEn: "Choryang Pet Supply", category: "PET_SUPPLY", address: "부산광역시 동구 초량동", lat: 35.122, lng: 129.038 },
  { id: "safety-vet-haeundae", nameKo: "해운대 24시 동물병원", nameEn: "Haeundae 24H Animal Hospital", category: "VET", address: "부산광역시 해운대구 해운대로", lat: 35.162, lng: 129.163 },
  { id: "safety-supply-haeundae", nameKo: "해운대 펫케어", nameEn: "Haeundae Pet Care", category: "PET_SUPPLY", address: "부산광역시 해운대구 우동", lat: 35.159, lng: 129.158 },
];
for (const place of places) await prisma.place.upsert({ where: { id: place.id }, update: place, create: { ...place, openTime: "00:00", closeTime: "23:59", closedDays: "[]", recommendedStayMin: 0, priceTier: 1, parkingAvailable: true, reservationRequired: false, localScore: 0, tasteTags: "[]", hasEnglishMenu: false, foreignCardPayment: true, dataSource: "SAFETY_SEED" } });
await prisma.$disconnect();
