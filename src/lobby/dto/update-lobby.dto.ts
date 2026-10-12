import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { Mode } from '../../../generated/prisma/enums';

export class UpdateLobbyDto {
  @IsOptional()
  @IsEnum(Mode)
  mode?: Mode;

  @IsOptional()
  @IsInt()
  contestId?: number;
}
