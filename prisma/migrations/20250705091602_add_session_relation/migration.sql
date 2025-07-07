/*
  Warnings:

  - A unique constraint covering the columns `[roomId]` on the table `webcast_live_intro_messages` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "webcast_member_messages" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "webcast_live_intro_messages_roomId_key" ON "webcast_live_intro_messages"("roomId");

-- AddForeignKey
ALTER TABLE "webcast_chat_messages" ADD CONSTRAINT "webcast_chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_room_user_seq_messages" ADD CONSTRAINT "webcast_room_user_seq_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_member_messages" ADD CONSTRAINT "webcast_member_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_like_messages" ADD CONSTRAINT "webcast_like_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webcast_gift_messages" ADD CONSTRAINT "webcast_gift_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "webcast_live_intro_messages"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;
