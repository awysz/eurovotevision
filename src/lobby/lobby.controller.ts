import {
  Body,
  Controller,
  Headers,
  Post,
  Param,
  Get,
  Patch,
} from '@nestjs/common';
import { LobbyService } from './lobby.service';
import { UpdateLobbyDto } from './dto/UpdateLobbyDto';
import { StartLobbyDto } from './dto/StartLobbyDto';

@Controller('lobbies')
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Post()
  create() {
    return this.lobbyService.create();
  }

  @Post(':code/players')
  join(@Param('code') code: string) {
    return this.lobbyService.join(code);
  }

  @Get(':code')
  getLobby(@Param('code') code: string) {
    return this.lobbyService.getLobby(code);
  }

  @Patch(':code')
  editLobby(
    @Param('code') code: string,
    @Headers('x-player-token') playerToken: string,
    @Body() updateLobbyDto: UpdateLobbyDto,
  ) {
    return this.lobbyService.editLobby(code, playerToken, updateLobbyDto);
  }

  @Post(':code/start')
  startVoting(
    @Param('code') code: string,
    @Headers('x-player-token') playerToken: string,
    @Body() startLobbyDto: StartLobbyDto,
  ) {
    return this.lobbyService.startVoting(code, playerToken, startLobbyDto);
  }
}
