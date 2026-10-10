-- DropForeignKey
ALTER TABLE "Lobby" DROP CONSTRAINT "Lobby_contestId_fkey";

-- AlterTable
ALTER TABLE "Lobby" ALTER COLUMN "mode" DROP NOT NULL,
ALTER COLUMN "contestId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
