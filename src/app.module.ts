import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LobbyModule } from './lobby/lobby.module';
import { VotingModule } from './voting/voting.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, LobbyModule, VotingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
