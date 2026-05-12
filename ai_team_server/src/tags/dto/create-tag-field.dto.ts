import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagFieldDto {
  @ApiProperty({ example: 'industry' })
  @IsString()
  @IsNotEmpty()
  tagName: string;

  @ApiPropertyOptional({
    example: 'Industry classification for a lead or chat session',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
