import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JenniferService } from './jennifer.service';

@ApiTags('jennifer')
@Controller('jennifer')
export class JenniferController {
  constructor(private readonly jenniferService: JenniferService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List Jennifer chat sessions' })
  @ApiOkResponse({ description: 'Sessions returned' })
  async getSessions() {
    return this.jenniferService.getSessions();
  }

  @Get('chat-logs/:sessionId')
  @ApiOperation({ summary: 'Get Jennifer chat logs by session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Chat logs returned' })
  async getChatLogs(@Param('sessionId') sessionId: string) {
    return this.jenniferService.getChatLogs(sessionId);
  }
}
