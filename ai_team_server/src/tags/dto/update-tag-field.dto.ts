import { IsString, IsOptional } from 'class-validator';

export class UpdateTagFieldDto {
    @IsString()
    @IsOptional()
    tagName?: string;

    @IsString()
    @IsOptional()
    description?: string;
}
