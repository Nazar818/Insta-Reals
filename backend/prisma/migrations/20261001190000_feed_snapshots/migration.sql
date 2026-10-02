CREATE TABLE "FeedSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoIds" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedSnapshot_expiresAt_idx" ON "FeedSnapshot"("expiresAt");
ALTER TABLE "FeedSnapshot" ADD CONSTRAINT "FeedSnapshot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
