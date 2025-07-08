-- CreateTable
CREATE TABLE "users" (
    "userId" TEXT NOT NULL,
    "secUid" TEXT NOT NULL,
    "uniqueId" TEXT,
    "nickname" TEXT,
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
    "description" TEXT,
    "streamerUniqueId" TEXT NOT NULL,
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
CREATE TABLE "webcast_member_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT,
    "createTime" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webcast_gift_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "follow_info_userId_key" ON "follow_info"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "webcast_live_intro_messages_roomId_key" ON "webcast_live_intro_messages"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "webcast_chat_messages_msgId_key" ON "webcast_chat_messages"("msgId");

-- CreateIndex
CREATE UNIQUE INDEX "webcast_like_messages_msgId_key" ON "webcast_like_messages"("msgId");

-- CreateIndex
CREATE UNIQUE INDEX "webcast_gift_messages_msgId_key" ON "webcast_gift_messages"("msgId");

-- AddForeignKey
ALTER TABLE "follow_info" ADD CONSTRAINT "follow_info_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_chat_messages" ADD CONSTRAINT "webcast_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_chat_messages" ADD CONSTRAINT "webcast_chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_room_user_seq_messages" ADD CONSTRAINT "webcast_room_user_seq_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_member_messages" ADD CONSTRAINT "webcast_member_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_like_messages" ADD CONSTRAINT "webcast_like_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_like_messages" ADD CONSTRAINT "webcast_like_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_gift_messages" ADD CONSTRAINT "webcast_gift_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_gift_messages" ADD CONSTRAINT "webcast_gift_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;
