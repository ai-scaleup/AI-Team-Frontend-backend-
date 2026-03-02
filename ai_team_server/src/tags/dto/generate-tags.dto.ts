import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateTagsDto {
    @IsString()
    @IsNotEmpty()
    sessionId: string;
}
