import { Module } from '@nestjs/common';
import { ChiaraWhatsappService } from './chiara-whatsapp.service';
import { ChiaraWhatsappController } from './chiara-whatsapp.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChiaraWhatsappController],
  providers: [ChiaraWhatsappService],
})
export class ChiaraWhatsappModule {}
