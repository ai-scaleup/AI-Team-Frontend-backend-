import { Module } from '@nestjs/common';
import { VanessaService } from './vanessa.service';
import { VanessaController } from './vanessa.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VanessaController],
  providers: [VanessaService],
})
export class VanessaModule {}
