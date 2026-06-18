import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CardController } from './card.controller';
import { CardService } from './card.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CardController],
  providers: [CardService],
  exports: [CardService],
})
export class CardModule {}
