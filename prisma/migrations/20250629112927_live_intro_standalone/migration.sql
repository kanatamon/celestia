/*
  Warnings:

  - You are about to drop the column `userId` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - Added the required column `streamerUniqueId` to the `webcast_live_intro_messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "webcast_live_intro_messages" DROP CONSTRAINT "webcast_live_intro_messages_userId_fkey";

-- AlterTable
ALTER TABLE "webcast_live_intro_messages" DROP COLUMN "userId",
ADD COLUMN     "streamerUniqueId" TEXT NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;
