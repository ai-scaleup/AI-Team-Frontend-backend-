import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateTagsDto {
  @ApiProperty({ example: 'session_123' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
