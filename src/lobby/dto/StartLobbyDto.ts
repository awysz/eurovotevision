import { IsInt, Max, Min } from 'class-validator';

export class StartLobbyDto {
  @IsInt()
  @Min(5)
  @Max(10)
  durationMinutes: number = 5;
}
