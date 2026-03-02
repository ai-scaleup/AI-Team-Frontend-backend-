import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTagFieldDto {
    @IsString()
    @IsNotEmpty()
    tagName: string;

    @IsString()
    @IsOptional()
    description?: string;
}
