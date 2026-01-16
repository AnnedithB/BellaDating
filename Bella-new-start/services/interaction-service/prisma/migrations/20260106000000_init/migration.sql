-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('INITIATED', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('OFFER_SENT', 'ANSWER_SENT', 'ICE_CANDIDATE', 'VIDEO_REQUESTED', 'VIDEO_ACCEPTED', 'VIDEO_REJECTED', 'VIDEO_ENABLED', 'CONNECTION_ESTABLISHED', 'CONNECTION_LOST', 'CALL_ENDED', 'QUALITY_REPORT');

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "status" "InteractionStatus" NOT NULL DEFAULT 'INITIATED',
    "callType" "CallType" NOT NULL DEFAULT 'VOICE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "videoRequested" BOOLEAN NOT NULL DEFAULT false,
    "videoRequestedBy" TEXT,
    "videoRequestedAt" TIMESTAMP(3),
    "videoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "videoEnabledAt" TIMESTAMP(3),
    "qualityRating" INTEGER,
    "connectionIssues" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_events" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "call_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interactions_roomId_key" ON "interactions"("roomId");

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;






