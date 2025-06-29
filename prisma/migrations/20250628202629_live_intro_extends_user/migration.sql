/*
  Warnings:

  - You are about to drop the column `nickname` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `profilePictureUrl` on the `webcast_live_intro_messages` table. All the data in the column will be lost.
  - You are about to drop the column `secUid` on the `webcast_live_intro_messages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "webcast_live_intro_messages" DROP COLUMN "nickname",
DROP COLUMN "profilePictureUrl",
DROP COLUMN "secUid";

-- AddForeignKey
ALTER TABLE "webcast_live_intro_messages" ADD CONSTRAINT "webcast_live_intro_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
