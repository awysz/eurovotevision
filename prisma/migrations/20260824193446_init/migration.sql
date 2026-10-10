-- CreateEnum
CREATE TYPE "FinalEntry" AS ENUM ('HOST', 'BIGFIVE', 'AUTOQUALIFIED', 'SEMI');

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('SEMI1', 'SEMI2', 'FINAL', 'ALL');

-- CreateTable
CREATE TABLE "Contest" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "city" TEXT NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" SERIAL NOT NULL,
    "artist" VARCHAR(100) NOT NULL,
    "song" VARCHAR(100) NOT NULL,
    "pointsFromAudienceSemi" INTEGER,
    "pointsFromJurySemi" INTEGER,
    "pointsFromAudienceFinal" INTEGER,
    "pointsFromJuryFinal" INTEGER,
    "semiNumber" INTEGER,
    "semiPlacement" INTEGER,
    "finalPlacement" INTEGER,
    "finalEntry" "FinalEntry" NOT NULL,
    "countryId" INTEGER NOT NULL,
    "contestId" INTEGER NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" SERIAL NOT NULL,
    "joinCode" VARCHAR(5) NOT NULL,
    "mode" "Mode" NOT NULL,
    "votingEndsAt" TIMESTAMP(3),
    "contestId" INTEGER NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "playerToken" VARCHAR(36) NOT NULL,
    "hasConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "host" BOOLEAN NOT NULL DEFAULT false,
    "lobbyId" INTEGER NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "points" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "participantId" INTEGER NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("playerId","participantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contest_year_key" ON "Contest"("year");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_contestId_countryId_key" ON "Participant"("contestId", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_joinCode_key" ON "Lobby"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Player_playerToken_key" ON "Player"("playerToken");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
