import { Module } from '@nestjs/common';
import { ChiaraVanessaService } from './chiara-vanessa.service';
import { ChiaraVanessaController } from './chiara-vanessa.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChiaraVanessaController],
  providers: [ChiaraVanessaService],
})
export class ChiaraVanessaModule {}
