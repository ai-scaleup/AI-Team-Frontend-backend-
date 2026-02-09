import { Module } from '@nestjs/common';
import { UserPreferenceController } from './controllers/user-preference.controller';
import { UserPreferenceService } from './services/user-preference.service';

@Module({
    imports: [],
    controllers: [UserPreferenceController],
    providers: [UserPreferenceService],
    exports: [UserPreferenceService],
})
export class UserPreferenceModule { }
