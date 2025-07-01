/*
  Warnings:

  - You are about to drop the column `actionId` on the `webcast_member_messages` table. All the data in the column will be lost.
  - You are about to drop the column `displayType` on the `webcast_member_messages` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `webcast_member_messages` table. All the data in the column will be lost.
  - You are about to drop the column `msgId` on the `webcast_member_messages` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `webcast_member_messages` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "webcast_member_messages" DROP CONSTRAINT "webcast_member_messages_userId_fkey";

-- DropIndex
DROP INDEX "webcast_member_messages_msgId_key";

-- AlterTable
ALTER TABLE "webcast_member_messages" DROP COLUMN "actionId",
DROP COLUMN "displayType",
DROP COLUMN "label",
DROP COLUMN "msgId",
DROP COLUMN "userId";
