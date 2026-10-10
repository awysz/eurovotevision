import { IsArray, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class VoteDto {
  @IsInt()
  participantId!: number;

  @IsInt()
  points!: number;
}

export class SubmitVotesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoteDto)
  votes!: VoteDto[];
}
