// src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';


@Module({
  controllers: [AdminController],
  providers: [PrismaService, AdminService],
  exports: [AdminService],
})
export class AdminModule {}
