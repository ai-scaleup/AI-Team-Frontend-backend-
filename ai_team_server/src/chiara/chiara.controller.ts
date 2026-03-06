
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChiaraService } from './chiara.service';
import { Prisma } from '@prisma/client';

@Controller('chiara')
export class ChiaraController {
    constructor(private readonly chiaraService: ChiaraService) { }

    @Post('chat-logs')
    async createChatLog(@Body() data: Prisma.ChiaraInboundChatLogCreateInput) {
        return this.chiaraService.createChatLog(data);
    }

    @Get('chat-logs/sessions')
    async getAllSessions() {
        return this.chiaraService.getAllSessions();
    }

    @Get('chat-logs/:sessionId')
    async getChatLogs(@Param('sessionId') sessionId: string) {
        return this.chiaraService.getChatLogsBySessionId(sessionId);
    }

    @Post('leads')
    async createLead(@Body() data: Prisma.ChiaraLeadCreateInput) {
        return this.chiaraService.createLead(data);
    }

    @Get('leads')
    async getAllLeads() {
        return this.chiaraService.getAllLeads();
    }

    @Get('leads/:sessionId')
    async getLead(@Param('sessionId') sessionId: string) {
        return this.chiaraService.getLeadBySessionId(sessionId);
    }
}
