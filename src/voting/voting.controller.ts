import { Controller, Param, Post, Get, Body, Headers } from '@nestjs/common';
import { VotingService } from './voting.service';
import { SubmitVotesDto } from './dto/SubmitVotesDto';

@Controller('lobbies/:code')
export class VotingController {
  constructor(private readonly votingService: VotingService) {}

  @Post('votes')
  submitVotes(
    @Param('code') code: string,
    @Headers('x-player-token') playerToken: string,
    @Body() dto: SubmitVotesDto,
  ) {
    return this.votingService.submitVotes(code, playerToken, dto);
  }

  @Get('results')
  getResults(
    @Param('code') code: string,
    @Headers('x-player-token') playerToken: string,
  ) {
    return this.votingService.getResults(code, playerToken);
  }

  @Get('participants')
  getParticipants(@Param('code') code: string) {
    return this.votingService.getParticipants(code);
  }
}
