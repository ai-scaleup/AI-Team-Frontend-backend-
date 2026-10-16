import { Module } from '@nestjs/common';
import { AgencyMembershipController } from './agency-membership.controller';
import { AgencyMembershipService } from './agency-membership.service';

// Agency memberships. PrismaModule is global, so nothing to import.
@Module({
  controllers: [AgencyMembershipController],
  providers: [AgencyMembershipService],
})
export class AgencyMembershipModule {}
