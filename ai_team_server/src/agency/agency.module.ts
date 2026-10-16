import { Module } from '@nestjs/common';
import { AgencyPortalController } from './agency-portal.controller';
import { AgencyController } from './agency.controller';
import { AgencyService } from './agency.service';

// Agencies (superadmin) and the agency portal. PrismaModule is global.
@Module({
  controllers: [AgencyController, AgencyPortalController],
  providers: [AgencyService],
})
export class AgencyModule {}
