import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { ClerkModule } from './clerk/clerk.module';
import { AdminModule } from './admin/admin.module';
import { ConversationModule } from './conversations/conversation.module';
import { UserPreferenceModule } from './user-preference/user-preference.module';
import { SaraAiModule } from './sara-ai/sara-ai.module';
import { JenniferModule } from './jennifer/jennifer.module';
import { ChiaraModule } from './chiara/chiara.module';
import { TagsModule } from './tags/tags.module';

@Module({
  imports: [PrismaModule, UserModule, ClerkModule, AdminModule, ConversationModule, UserPreferenceModule, SaraAiModule, JenniferModule, ChiaraModule, TagsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }




