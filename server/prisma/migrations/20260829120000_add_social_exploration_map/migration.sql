ALTER TABLE "Place" ADD COLUMN "dexTag" TEXT;
ALTER TABLE "Trip" ADD COLUMN "partyCode" TEXT;
CREATE UNIQUE INDEX "Trip_partyCode_key" ON "Trip"("partyCode");

ALTER TABLE "TripMember" ADD COLUMN "lastSeenGridCell" TEXT;
ALTER TABLE "TripMember" ADD COLUMN "lastSeenAt" DATETIME;

ALTER TABLE "Story" ADD COLUMN "gridCell" TEXT;
ALTER TABLE "Story" ADD COLUMN "factsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Story" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'KO';
CREATE INDEX "Story_gridCell_moderationStatus_publishAt_idx" ON "Story"("gridCell", "moderationStatus", "publishAt");

CREATE TABLE "StoryComment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storyId" TEXT NOT NULL,
  "authorSessionId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'KO',
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StoryComment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoryComment_authorSessionId_fkey" FOREIGN KEY ("authorSessionId") REFERENCES "AnonymousSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StoryComment_storyId_status_createdAt_idx" ON "StoryComment"("storyId", "status", "createdAt");
