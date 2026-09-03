import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthMiddleware } from './auth/auth.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { ClerkModule } from './clerk/clerk.module';
import { AdminModule } from './admin/admin.module';
import { ConversationModule } from './conversations/conversation.module';
import { UserPreferenceModule } from './user-preference/user-preference.module';
import { SaraAiModule } from './sara-ai/sara-ai.module';
import { JenniferModule } from './jennifer/jennifer.module';
import { ChiaraModule } from './chiara/chiara.module';
import { ChiaraWhatsappModule } from './chiara-whatsapp/chiara-whatsapp.module';
import { FreapChiaraModule } from './freap-chiara/freap-chiara.module';
import { FreapJenniferModule } from './freap-jennifer/freap-jennifer.module';
import { TagsModule } from './tags/tags.module';
import { TokenUsageModule } from './token-usage/token-usage.module';
import { TokenAlertsModule } from './token-alerts/token-alerts.module';
import { MembershipModule } from './membership/membership.module';
import { PearlAdminModule } from './pearl-admin/pearl-admin.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    ClerkModule,
    AdminModule,
    ConversationModule,
    UserPreferenceModule,
    SaraAiModule,
    JenniferModule,
    ChiaraModule,
    ChiaraWhatsappModule,
    FreapChiaraModule,
    FreapJenniferModule,
    TagsModule,
    TokenUsageModule,
    TokenAlertsModule,
    MembershipModule,
    PearlAdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Every route authenticates: the development token from .env is tried
    // first (x-dev-token or Authorization: Bearer), then the Clerk JWT. Only
    // the entries in public-routes.ts opt out.
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
