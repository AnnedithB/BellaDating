-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('email_verification', 'password_reset');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('male', 'female', 'admin');

-- CreateEnum
CREATE TYPE "PermissionRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('online', 'offline', 'in-call', 'queuing');

-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('casual', 'friends', 'serious', 'networking');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('voice_call', 'video_call');

-- CreateEnum
CREATE TYPE "InteractionOutcome" AS ENUM ('no_action', 'female_connected', 'both_left', 'timeout');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('chat_only', 'video_enabled');

-- CreateEnum
CREATE TYPE "VideoRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'video', 'voice', 'system');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('man', 'woman', 'nonbinary');

-- CreateEnum
CREATE TYPE "RelationshipIntent" AS ENUM ('long_term', 'casual_dates', 'marriage', 'intimacy', 'intimacy_no_commitment', 'life_partner', 'ethical_non_monogamy');

-- CreateEnum
CREATE TYPE "FamilyPlans" AS ENUM ('has_kids_wants_more', 'has_kids_doesnt_want_more', 'doesnt_have_kids_wants_kids', 'doesnt_have_kids_doesnt_want_kids', 'not_sure_yet');

-- CreateEnum
CREATE TYPE "Religion" AS ENUM ('agnostic', 'atheist', 'buddhist', 'catholic', 'christian', 'hindu', 'jewish', 'muslim', 'spiritual', 'other');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('high_school', 'in_college', 'undergraduate', 'in_grad_school', 'postgraduate');

-- CreateEnum
CREATE TYPE "PoliticalView" AS ENUM ('liberal', 'moderate', 'conservative', 'apolitical', 'other');

-- CreateEnum
CREATE TYPE "LifestyleHabit" AS ENUM ('frequently', 'socially', 'rarely', 'never');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'reviewing', 'resolved', 'rejected', 'escalated');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "SafetyStatus" AS ENUM ('good_standing', 'warning', 'restricted', 'banned');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('pending', 'reviewing', 'approved', 'denied');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "gender" "UserRole" NOT NULL DEFAULT 'male',
    "permission_role" "PermissionRole" NOT NULL DEFAULT 'user',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "short_bio" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "videos" JSONB NOT NULL DEFAULT '[]',
    "intent" "Intent" NOT NULL DEFAULT 'casual',
    "age" INTEGER,
    "location_city" VARCHAR(100),
    "location_country" VARCHAR(100),
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "gender" "Gender",
    "relationship_intents" "RelationshipIntent"[],
    "family_plans" "FamilyPlans",
    "religion" "Religion",
    "education_level" "EducationLevel",
    "political_views" "PoliticalView",
    "exercise" "LifestyleHabit",
    "smoking" "LifestyleHabit",
    "drinking" "LifestyleHabit",
    "preferred_genders" "Gender"[],
    "preferred_relationship_intents" "RelationshipIntent"[],
    "preferred_family_plans" "FamilyPlans"[],
    "preferred_religions" "Religion"[],
    "preferred_education_levels" "EducationLevel"[],
    "preferred_political_views" "PoliticalView"[],
    "preferred_exercise_habits" "LifestyleHabit"[],
    "preferred_smoking_habits" "LifestyleHabit"[],
    "preferred_drinking_habits" "LifestyleHabit"[],
    "preferred_min_age" INTEGER,
    "preferred_max_age" INTEGER,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "socket_id" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'offline',
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_logs" (
    "id" TEXT NOT NULL,
    "user1_id" TEXT NOT NULL,
    "user2_id" TEXT NOT NULL,
    "room_id" VARCHAR(255) NOT NULL,
    "interaction_type" "InteractionType" NOT NULL DEFAULT 'voice_call',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "outcome" "InteractionOutcome" NOT NULL DEFAULT 'no_action',
    "female_user_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "user1_id" TEXT NOT NULL,
    "user2_id" TEXT NOT NULL,
    "interaction_log_id" TEXT NOT NULL,
    "female_user_id" TEXT NOT NULL,
    "connection_type" "ConnectionType" NOT NULL DEFAULT 'chat_only',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_requests" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "requester_user_id" TEXT NOT NULL,
    "approver_user_id" TEXT NOT NULL,
    "status" "VideoRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "video_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "room_name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chat_room_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" "MessageType" NOT NULL DEFAULT 'text',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_status" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "type" "VerificationTokenType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reported_user_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "session_id" TEXT,
    "message_id" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "priority" "ReportPriority" NOT NULL DEFAULT 'medium',
    "admin_response" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_user_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_safety_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trust_score" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "status" "SafetyStatus" NOT NULL DEFAULT 'good_standing',
    "reports_received" INTEGER NOT NULL DEFAULT 0,
    "reports_made" INTEGER NOT NULL DEFAULT 0,
    "recent_reports" INTEGER NOT NULL DEFAULT 0,
    "restriction_reason" TEXT,
    "restricted_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_safety_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_appeals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "appeal_reason" TEXT NOT NULL,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AppealStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "admin_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "connections_user1_id_user2_id_key" ON "connections"("user1_id", "user2_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_connection_id_key" ON "chat_rooms"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_read_status_message_id_user_id_key" ON "message_read_status"("message_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_token_idx" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "verification_tokens"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_user_id_key" ON "user_blocks"("blocker_id", "blocked_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_safety_profiles_user_id_key" ON "user_safety_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_interaction_log_id_fkey" FOREIGN KEY ("interaction_log_id") REFERENCES "interaction_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_requests" ADD CONSTRAINT "video_requests_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_status" ADD CONSTRAINT "message_read_status_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_status" ADD CONSTRAINT "message_read_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_safety_profiles" ADD CONSTRAINT "user_safety_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_appeals" ADD CONSTRAINT "user_appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
