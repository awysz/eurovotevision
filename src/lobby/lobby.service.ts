import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLobbyDto } from './dto/UpdateLobbyDto';
import { StartLobbyDto } from './dto/StartLobbyDto';

const maxPlayerCount: number = 6;
const minPlayerCount: number = 2;

@Injectable()
export class LobbyService {
  constructor(private readonly prisma: PrismaService) {}

  async create() {
    const lobbyCode = makeid(5);
    const playerToken = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      const lobby = await tx.lobby.create({
        data: {
          joinCode: lobbyCode,
        },
      });
      await tx.player.create({
        data: {
          playerToken: playerToken,
          host: true,
          lobbyId: lobby.id,
        },
      });
    });
    return {
      lobbyCode,
      playerToken,
    };
  }

  async join(lobbyCode: string) {
    const playerToken = randomUUID();
    const lobby = await this.prisma.lobby.findUnique({
      where: {
        joinCode: lobbyCode,
      },
    });
    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    const playerCount = await this.prisma.player.count({
      where: {
        lobbyId: lobby.id,
      },
    });
    if (playerCount >= maxPlayerCount) {
      throw new ConflictException('Lobby is full');
    }
    if (lobby.votingEndsAt !== null) {
      throw new ConflictException('Voting has already started');
    }
    await this.prisma.player.create({
      data: {
        playerToken: playerToken,
        host: false,
        lobbyId: lobby.id,
      },
    });
    return {
      playerToken,
    };
  }

  async getLobby(lobbyCode: string) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { joinCode: lobbyCode },
      select: {
        joinCode: true,
        mode: true,
        contestId: true,
        votingEndsAt: true,
        _count: {
          select: {
            players: true,
          },
        },
      },
    });
    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    const { _count, ...rest } = lobby;
    return {
      ...rest,
      playerCount: _count.players,
      hasStarted: lobby.votingEndsAt !== null,
    };
  }

  async editLobby(
    lobbyCode: string,
    playerToken: string,
    updateLobbyDto: UpdateLobbyDto,
  ) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { joinCode: lobbyCode },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    const player = await this.prisma.player.findFirst({
      where: { playerToken, lobbyId: lobby.id },
    });

    if (!player || !player.host) {
      throw new ForbiddenException('You are not the host of this lobby');
    }

    if (lobby.votingEndsAt !== null) {
      throw new ConflictException('Voting has already started');
    }
    return this.prisma.lobby.update({
      where: { joinCode: lobbyCode },
      data: {
        mode: updateLobbyDto.mode,
        contestId: updateLobbyDto.contestId,
      },
    });
  }

  async startVoting(
    lobbyCode: string,
    playerToken: string,
    startLobbyDto: StartLobbyDto,
  ) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { joinCode: lobbyCode },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    if (lobby.votingEndsAt !== null) {
      throw new ConflictException('Voting has already started');
    }
    const player = await this.prisma.player.findFirst({
      where: { playerToken, lobbyId: lobby.id },
    });

    if (!player || !player.host) {
      throw new ForbiddenException('You are not the host of this lobby');
    }

    if (!lobby.mode || !lobby.contestId) {
      throw new ConflictException(
        'Choose a mode and contest year before starting the voting',
      );
    }

    const players = await this.prisma.player.count({
      where: { lobbyId: lobby.id },
    });

    if (players < minPlayerCount) {
      throw new ConflictException(
        `At least ${minPlayerCount} players are required to start voting`,
      );
    }

    const votingEndsAt = new Date(
      Date.now() + startLobbyDto.durationMinutes * 60 * 1000,
    );
    return this.prisma.lobby.update({
      where: { joinCode: lobbyCode },
      data: {
        votingEndsAt,
      },
    });
  }
}

function makeid(length: number) {
  let result = '';
  const characters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(randomInt(charactersLength));
  }
  return result;
}
