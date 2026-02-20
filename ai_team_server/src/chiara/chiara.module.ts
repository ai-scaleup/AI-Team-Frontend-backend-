
import { Module } from '@nestjs/common';
import { ChiaraService } from './chiara.service';
import { ChiaraController } from './chiara.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [ChiaraController],
    providers: [ChiaraService],
})
export class ChiaraModule { }
