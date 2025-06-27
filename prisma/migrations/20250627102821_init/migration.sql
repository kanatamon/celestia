-- CreateTable
CREATE TABLE "users" (
    "userId" TEXT NOT NULL,
    "secUid" TEXT NOT NULL,
    "uniqueId" TEXT,
    "nickname" TEXT NOT NULL,
    "profilePictureUrl" TEXT,
    "followRole" INTEGER,
    "userSceneTypes" JSONB NOT NULL,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "isNewGifter" BOOLEAN NOT NULL DEFAULT false,
    "isSubscriber" BOOLEAN NOT NULL DEFAULT false,
    "topGifterRank" INTEGER,
    "gifterLevel" INTEGER NOT NULL DEFAULT 0,
    "teamMemberLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "badgeSceneType" INTEGER,
    "displayType" INTEGER,
    "url" TEXT,
    "privilegeId" TEXT,
    "level" INTEGER,
    "name" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_details" (
    "id" TEXT NOT NULL,
    "createTime" TEXT NOT NULL,
    "bioDescription" TEXT NOT NULL,
    "profilePictureUrls" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_info" (
    "id" TEXT NOT NULL,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followStatus" INTEGER NOT NULL DEFAULT 0,
    "pushStatus" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webcast_live_intro_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secUid" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "profilePictureUrl" TEXT NOT NULL,
    "userBadges" JSONB NOT NULL,
    "userSceneTypes" JSONB NOT NULL,
    "userDetails" JSONB NOT NULL,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "isNewGifter" BOOLEAN NOT NULL DEFAULT false,
    "isSubscriber" BOOLEAN NOT NULL DEFAULT false,
    "topGifterRank" INTEGER,
    "gifterLevel" INTEGER NOT NULL DEFAULT 0,
    "teamMemberLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webcast_live_intro_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webcast_chat_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "msgId" TEXT NOT NULL,
    "comment" TEXT,
    "emotes" JSONB NOT NULL,
    "createTime" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webcast_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webcast_room_user_seq_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webcast_room_user_seq_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "top_viewers" (
    "id" TEXT NOT NULL,
    "coinCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "webcastRoomUserSeqMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "top_viewers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webcast_member_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "msgId" TEXT NOT NULL,
    "actionId" INTEGER NOT NULL,
    "createTime" TEXT NOT NULL,
    "displayType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webcast_member_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webcast_like_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "msgId" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "totalLikeCount" INTEGER NOT NULL DEFAULT 0,
    "createTime" TEXT NOT NULL,
    "displayType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webcast_like_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "gift_id" INTEGER NOT NULL,
    "repeat_count" INTEGER NOT NULL DEFAULT 0,
    "repeat_end" INTEGER NOT NULL DEFAULT 0,
    "gift_type" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webcast_gift_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "msgId" TEXT NOT NULL,
    "giftId" INTEGER NOT NULL,
    "repeatCount" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT NOT NULL,
    "createTime" TEXT NOT NULL,
    "displayType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "repeatEnd" BOOLEAN NOT NULL DEFAULT false,
    "describe" TEXT NOT NULL,
    "giftType" INTEGER NOT NULL DEFAULT 0,
    "diamondCount" INTEGER NOT NULL DEFAULT 0,
    "giftName" TEXT NOT NULL,
    "giftPictureUrl" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "giftModelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webcast_gift_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_details_userId_key" ON "user_details"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "follow_info_userId_key" ON "follow_info"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "webcast_chat_messages_msgId_key" ON "webcast_chat_messages"("msgId");

-- CreateIndex
CREATE UNIQUE INDEX "webcast_member_messages_msgId_key" ON "webcast_member_messages"("msgId");

-- CreateIndex
CREATE UNIQUE INDEX "webcast_like_messages_msgId_key" ON "webcast_like_messages"("msgId");

-- CreateIndex
CREATE UNIQUE INDEX "webcast_gift_messages_msgId_key" ON "webcast_gift_messages"("msgId");

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_details" ADD CONSTRAINT "user_details_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_info" ADD CONSTRAINT "follow_info_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_chat_messages" ADD CONSTRAINT "webcast_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_viewers" ADD CONSTRAINT "top_viewers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_viewers" ADD CONSTRAINT "top_viewers_webcastRoomUserSeqMessageId_fkey" FOREIGN KEY ("webcastRoomUserSeqMessageId") REFERENCES "webcast_room_user_seq_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_member_messages" ADD CONSTRAINT "webcast_member_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_like_messages" ADD CONSTRAINT "webcast_like_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_gift_messages" ADD CONSTRAINT "webcast_gift_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_gift_messages" ADD CONSTRAINT "webcast_gift_messages_giftModelId_fkey" FOREIGN KEY ("giftModelId") REFERENCES "gifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
