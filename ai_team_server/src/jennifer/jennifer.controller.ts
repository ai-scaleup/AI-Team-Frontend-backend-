
import { Controller, Get, Param } from '@nestjs/common';
import { JenniferService } from './jennifer.service';

@Controller('jennifer')
export class JenniferController {
    constructor(private readonly jenniferService: JenniferService) { }

    @Get('sessions')
    async getSessions() {
        return this.jenniferService.getSessions();
    }

    @Get('chat-logs/:sessionId')
    async getChatLogs(@Param('sessionId') sessionId: string) {
        return this.jenniferService.getChatLogs(sessionId);
    }
}
