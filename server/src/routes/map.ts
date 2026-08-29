import { Router } from "express";
import { prisma } from "../db.js";
import { requireSession } from "../services/auth.js";

export const mapRouter = Router();

function splitGridCell(value: string | null) {
  if (!value) return null;
  const [lat, lng] = value.split(":").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function partySessionIds(tripId: string | undefined, requesterId: string) {
  if (!tripId) return [];
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { ownerSessionId: true, members: { where: { revokedAt: null, joinedAt: { not: null } }, select: { sessionId: true } } },
  });
  if (!trip) return [];
  const ids = [trip.ownerSessionId, ...trip.members.map((member) => member.sessionId)].filter((id): id is string => !!id);
  return ids.includes(requesterId) ? ids : [];
}

mapRouter.get("/map/fog", async (req, res, next) => {
  try {
    const session = await requireSession(req, res); if (!session) return;
    const scope = String(req.query.scope ?? "me");
    const party = scope === "party" ? await partySessionIds(typeof req.query.tripId === "string" ? req.query.tripId : undefined, session.id) : [];
    const sessionIds = scope === "party" && party.length ? party : [session.id];
    const visits = await prisma.visitVerification.findMany({
      where: { sessionId: { in: sessionIds }, status: "VERIFIED", gridCell: { not: null } },
      select: { gridCell: true, sessionId: true, createdAt: true, place: { select: { id: true, nameKo: true, dexTag: true, address: true } } },
      orderBy: { createdAt: "desc" },
    });
    const cells = [...new Set(visits.map((visit) => visit.gridCell).filter((cell): cell is string => !!cell))];
    const dex = [...new Map(visits.filter((visit) => visit.place.dexTag).map((visit) => [visit.place.dexTag!, { tag: visit.place.dexTag!, placeId: visit.place.id, placeName: visit.place.nameKo, unlockedAt: visit.createdAt }])).values()];
    const districts = new Set(visits.map((visit) => visit.place.address.split(" ")[1]).filter(Boolean));
    res.json({
      scope,
      cells: cells.map((cell) => ({ cell, ...splitGridCell(cell) })),
      progress: { clearedCellCount: cells.length, totalCellCount: 3000, percent: Number(((cells.length / 3000) * 100).toFixed(2)), districtCount: districts.size },
      dex: { unlockedCount: dex.length, totalCount: 12, entries: dex },
    });
  } catch (error) { next(error); }
});

mapRouter.get("/map/pins", async (req, res, next) => {
  try {
    const session = await requireSession(req, res); if (!session) return;
    const south = Number(req.query.south); const west = Number(req.query.west); const north = Number(req.query.north); const east = Number(req.query.east);
    if (![south, west, north, east].every(Number.isFinite) || south >= north || west >= east) {
      return res.status(400).json({ error_code: "INVALID_BBOX", message: "현재 지도 영역을 다시 불러와 주세요." });
    }
    const requestedLayers = String(req.query.layers ?? "me,party,travelers").split(",");
    const tripId = typeof req.query.tripId === "string" ? req.query.tripId : undefined;
    const party = await partySessionIds(tripId, session.id);
    const following = (await prisma.follow.findMany({ where: { followerSessionId: session.id, status: "ACTIVE" }, select: { followeeSessionId: true } })).map((row) => row.followeeSessionId);
    const visibility = [{ visibility: "PUBLIC" }, { authorSessionId: session.id }];
    if (following.length) visibility.push({ visibility: "FOLLOWERS", authorSessionId: { in: following } } as never);
    const stories = await prisma.story.findMany({
      where: { visitVerified: true, moderationStatus: "PUBLISHED", publishAt: { lte: new Date() }, place: { lat: { gte: south, lte: north }, lng: { gte: west, lte: east } }, OR: visibility },
      include: { place: { select: { nameKo: true, nameEn: true, lat: true, lng: true, category: true, imageUrl: true } }, _count: { select: { comments: true } } },
      orderBy: { publishAt: "desc" }, take: 500,
    });
    const pins = stories.map((story) => {
      const layer = story.authorSessionId === session.id ? "me" : party.includes(story.authorSessionId) ? "party" : "travelers";
      return { id: story.id, layer, authorId: story.authorSessionId, authorLabel: layer === "me" ? "나" : `여행자 ${story.authorSessionId.slice(-4)}`, placeId: story.placeId, placeName: story.place.nameKo, placeNameEn: story.place.nameEn, category: story.place.category, lat: story.place.lat, lng: story.place.lng, gridCell: story.gridCell, content: story.content, images: JSON.parse(story.imageDataJson), facts: JSON.parse(story.factsJson || "{}"), language: story.language, translatedContent: null, translationStatus: "ORIGINAL", visitVerified: story.visitVerified, areaLabel: story.areaLabel, publishedAt: story.publishAt, commentCount: story._count.comments, imageUrl: story.place.imageUrl };
    }).filter((pin) => requestedLayers.includes(pin.layer));
    res.json({ pins, count: pins.length, truncated: stories.length === 500 });
  } catch (error) { next(error); }
});
