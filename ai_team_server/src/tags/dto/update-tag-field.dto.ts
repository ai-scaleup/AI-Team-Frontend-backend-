import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTagFieldDto {
  @ApiPropertyOptional({ example: 'industry' })
  @IsString()
  @IsOptional()
  tagName?: string;

  @ApiPropertyOptional({
    example: 'Industry classification for a lead or chat session',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
