import { Global, Module } from '@nestjs/common';
import { AgencyAuthController } from './agency-auth.controller';
import { AgencyWhiteLabelService } from './agency-white-label.service';

// Global because AuthMiddleware — applied in many modules — needs the service
// to check agency customer sessions. PrismaModule is global too.
@Global()
@Module({
  controllers: [AgencyAuthController],
  providers: [AgencyWhiteLabelService],
  exports: [AgencyWhiteLabelService],
})
export class AgencyWhiteLabelModule {}
