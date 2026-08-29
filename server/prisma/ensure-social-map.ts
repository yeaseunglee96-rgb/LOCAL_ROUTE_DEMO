import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dexEntries = [
  ["밀면", "MILMYEON"], ["돼지국밥", "DWAeJI_GUKBAP"], ["씨앗호떡", "SSIAT_HOTTEOK"],
  ["어묵", "EOMUK"], ["회", "SASHIMI"], ["곰장어", "HAGFISH"], ["낙곱새", "NAKGOPSAE"],
  ["동래파전", "DONGNAE_PAJON"], ["복국", "BOKGUK"], ["대구탕", "DAEGUTANG"],
  ["완당", "WANDANG"], ["부산커피", "BUSAN_COFFEE"],
] as const;

async function main() {
  let tagged = 0;
  for (const [name, dexTag] of dexEntries) {
    const result = await prisma.place.updateMany({ where: { nameKo: { contains: name } }, data: { dexTag } });
    tagged += result.count;
  }
  console.log(JSON.stringify({ tagged, catalogSize: dexEntries.length }));
}

main().finally(() => prisma.$disconnect());
