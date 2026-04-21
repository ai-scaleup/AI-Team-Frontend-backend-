import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // <-- This decorator makes the module global
@Module({
  providers: [PrismaService],

  exports: [PrismaService],
})
export class PrismaModule {}
