import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { AgentName } from 'src/generated/prisma/client';
import { TokenUsageService } from '../services/token-usage.service';

@Controller('token-usage')
export class TokenUsageController {
  constructor(private readonly tokenUsageService: TokenUsageService) {}

  @Get()
  getAllUsage() {
    return this.tokenUsageService.getAllUsage();
  }

  @Get(':oauthId')
  getUserUsage(@Param('oauthId') oauthId: string) {
    return this.tokenUsageService.getUserUsage(oauthId);
  }

  @Get(':oauthId/:agentName')
  getAgentUsage(
    @Param('oauthId') oauthId: string,
    @Param('agentName') agentName: AgentName,
  ) {
    return this.tokenUsageService.getAgentUsage(oauthId, agentName);
  }

  @Patch(':oauthId/:agentName/limit')
  setTokenLimit(
    @Param('oauthId') oauthId: string,
    @Param('agentName') agentName: AgentName,
    @Body('tokenLimit') tokenLimit: number,
  ) {
    return this.tokenUsageService.setTokenLimit(oauthId, agentName, tokenLimit);
  }
}
