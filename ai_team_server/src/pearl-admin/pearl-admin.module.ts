import { Module } from '@nestjs/common';
import { PearlAdminAccessGuard } from './pearl-admin-access.guard';
import { PearlAdminController } from './pearl-admin.controller';
import { PearlAdminService } from './pearl-admin.service';

@Module({
  controllers: [PearlAdminController],
  providers: [PearlAdminService, PearlAdminAccessGuard],
})
export class PearlAdminModule {}
