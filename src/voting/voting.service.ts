import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubmitVotesDto } from './dto/SubmitVotesDto';
import { Mode, Participant } from '../../generated/prisma/client';

const POINTS: number[] = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1];
@Injectable()
export class VotingService {
  constructor(private readonly prisma: PrismaService) {}

  async submitVotes(code: string, playerToken: string, dto: SubmitVotesDto) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { joinCode: code },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (!lobby.contestId) {
      throw new ConflictException('Lobby has no contest selected');
    }

    if (lobby.votingEndsAt === null) {
      throw new ForbiddenException('Voting hasnt started yet');
    }

    if (new Date() > lobby.votingEndsAt) {
      throw new ForbiddenException('Voting has already ended');
    }

    const player = await this.prisma.player.findFirst({
      where: { playerToken, lobbyId: lobby.id },
    });

    if (!player) {
      throw new ForbiddenException('Player not found in this lobby');
    }

    if (player.hasConfirmed === true) {
      throw new ConflictException('Player has already submitted votes');
    }

    if (dto.votes.length !== POINTS.length) {
      throw new BadRequestException(
        `You must submit all ${POINTS.length} votes`,
      );
    }

    const votesOrdered = [...dto.votes].sort((a, b) => b.points - a.points);
    for (let i = 0; i < votesOrdered.length; i++) {
      if (votesOrdered[i].points !== POINTS[i]) {
        throw new BadRequestException(
          `Invalid points. You must submit the following points: ${POINTS.join(
            ', ',
          )}`,
        );
      }
    }
    const participantIds = dto.votes.map((vote) => vote.participantId);
    if (new Set(participantIds).size !== participantIds.length) {
      throw new BadRequestException('Duplicate participantIds found');
    }
    const participants = await this.prisma.participant.findMany({
      where: { id: { in: participantIds }, contestId: lobby.contestId },
    });
    if (participants.length !== participantIds.length) {
      throw new BadRequestException('One or more participantIds are invalid');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vote.createMany({
        data: dto.votes.map((v) => ({
          participantId: v.participantId,
          points: v.points,
          playerId: player.id,
        })),
      });
      await tx.player.update({
        where: { id: player.id },
        data: { hasConfirmed: true },
      });
    });
    return { submitted: dto.votes.length };
  }

  async getResults(code: string, playerToken: string) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { joinCode: code },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    const total = await this.prisma.player.count({
      where: { lobbyId: lobby.id },
    });
    const confirmed = await this.prisma.player.count({
      where: { lobbyId: lobby.id, hasConfirmed: true },
    });
    if (lobby.votingEndsAt === null) {
      throw new ForbiddenException('Voting has not started yet');
    }

    const timeIsUp = new Date() >= lobby.votingEndsAt;
    const everyoneVoted = confirmed === total;

    if (!timeIsUp && !everyoneVoted) {
      throw new ConflictException('Voting is still in progress');
    }

    const player = await this.prisma.player.findFirst({
      where: { playerToken, lobbyId: lobby.id },
    });

    if (!player) {
      throw new ForbiddenException('Player not found in this lobby');
    }

    const summedPoints = await this.prisma.vote.groupBy({
      by: ['participantId'],
      _sum: {
        points: true,
      },
      where: {
        player: { lobbyId: lobby.id },
      },
    });

    if (lobby.contestId === null) {
      throw new BadRequestException('ContestId is wrong');
    }
    if (!lobby.mode) {
      throw new ConflictException('Incorrect contest mode');
    }

    const official = officialFor(lobby.mode);
    const participants = await this.prisma.participant.findMany({
      include: { country: true },
      where: { contestId: lobby.contestId, ...official.where },
    });

    const byId = new Map(participants.map((p) => [p.id, p]));
    const lobbyRanking = summedPoints
      .map((row) => {
        const participant = byId.get(row.participantId);
        if (!participant) {
          throw new Error(`Participant ${row.participantId} not found`);
        }
        return {
          country: participant.country.name,
          artist: participant.artist,
          points: row._sum.points ?? 0,
        };
      })
      .sort((a, b) => b.points - a.points);

    const originalRanking = participants
      .map((p) => ({
        country: p.country.name,
        artist: p.artist,
        points: official.points(p),
      }))
      .sort((a, b) => b.points - a.points);

    const lobbyPointsByIds = new Map(
      summedPoints.map((row) => [row.participantId, row._sum.points ?? 0]),
    );
    const combinedRanking = participants
      .map((p) => ({
        country: p.country.name,
        artist: p.artist,
        points: official.points(p) + (lobbyPointsByIds.get(p.id) ?? 0),
      }))
      .sort((a, b) => b.points - a.points);

    const players = await this.prisma.player.findMany({
      where: { lobbyId: lobby.id },
      include: {
        votes: {
          include: { participant: { include: { country: true } } },
          orderBy: { points: 'desc' },
        },
      },
    });

    const playerVotes = players.map((p) => ({
      isHost: p.host,
      votes: p.votes.map((v) => ({
        country: v.participant.country.name,
        points: v.points,
      })),
    }));

    return {
      lobbyRanking,
      originalRanking,
      combinedRanking,
      playerVotes,
    };
  }

  async getParticipants(code: string) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { joinCode: code },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    if (lobby.contestId === null) {
      throw new BadRequestException('ContestId is wrong');
    }
    if (!lobby.mode) {
      throw new ConflictException('Incorrect contest mode');
    }

    const official = officialFor(lobby.mode);
    const participants = await this.prisma.participant.findMany({
      where: {
        contestId: lobby.contestId,
        ...official.where,
      },
      select: {
        id: true,
        artist: true,
        song: true,
        country: { select: { name: true, code: true } },
      },
      orderBy: {
        country: { name: 'asc' },
      },
    });

    return participants.map(({ country, ...rest }) => ({
      ...rest,
      country: country.name,
      countryCode: country.code,
    }));
  }
}

function officialFor(mode: Mode) {
  switch (mode) {
    case 'FINAL':
      return {
        where: { finalPlacement: { not: null } },
        points: (p: Participant) =>
          (p.pointsFromAudienceFinal ?? 0) + (p.pointsFromJuryFinal ?? 0),
      };
    case 'SEMI1':
    case 'SEMI2':
    case 'ALL':
      throw new BadRequestException(`Mode ${mode} is not supported yet`);
  }
}
