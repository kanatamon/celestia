/*
  Warnings:

  - You are about to drop the column `giftModelId` on the `webcast_gift_messages` table. All the data in the column will be lost.
  - You are about to drop the column `gifterLevel` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `isModerator` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `isNewGifter` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `isSubscriber` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `teamMemberLevel` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `topGifterRank` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `userBadges` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `userDetails` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `userSceneTypes` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the `gifts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `top_viewers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_badges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_details` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "top_viewers" DROP CONSTRAINT "top_viewers_userId_fkey";

-- DropForeignKey
ALTER TABLE "top_viewers" DROP CONSTRAINT "top_viewers_webcastRoomUserSeqMessageId_fkey";

-- DropForeignKey
ALTER TABLE "user_badges" DROP CONSTRAINT "user_badges_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_details" DROP CONSTRAINT "user_details_userId_fkey";

-- DropForeignKey
ALTER TABLE "webcast_gift_messages" DROP CONSTRAINT "webcast_gift_messages_giftModelId_fkey";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "nickname" DROP NOT NULL;

-- AlterTable
ALTER TABLE "webcast_gift_messages" DROP COLUMN "giftModelId";

-- AlterTable
ALTER TABLE "webcast_live_intro_messages" DROP COLUMN "gifterLevel",
DROP COLUMN "isModerator",
DROP COLUMN "isNewGifter",
DROP COLUMN "isSubscriber",
DROP COLUMN "teamMemberLevel",
DROP COLUMN "topGifterRank",
DROP COLUMN "userBadges",
DROP COLUMN "userDetails",
DROP COLUMN "userSceneTypes";

-- DropTable
DROP TABLE "gifts";

-- DropTable
DROP TABLE "top_viewers";

-- DropTable
DROP TABLE "user_badges";

-- DropTable
DROP TABLE "user_details";
