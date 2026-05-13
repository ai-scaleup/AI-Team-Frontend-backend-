import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AgentName } from 'src/generated/prisma/client';
import { TokenUsageService } from '../services/token-usage.service';

@ApiTags('token-usage')
@Controller('token-usage')
export class TokenUsageController {
  constructor(private readonly tokenUsageService: TokenUsageService) {}

  @Post('count')
  @HttpCode(200)
  @ApiOperation({ summary: 'Count tokens for text using Claude Sonnet 4.6' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          example: 'Count the tokens in this text.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Token count returned',
    schema: {
      type: 'object',
      properties: {
        model: { type: 'string', example: 'claude-sonnet-4-6' },
        totalUsedInputTokens: { type: 'integer', example: 9 },
        totalUsedTokens: { type: 'integer', example: 9 },
      },
    },
  })
  countTextTokens(@Body('text') text: string) {
    return this.tokenUsageService.countTextTokens(text);
  }

  @Get()
  @ApiOperation({ summary: 'List token usage for all users and agents' })
  @ApiOkResponse({ description: 'Token usage records returned' })
  getAllUsage() {
    return this.tokenUsageService.getAllUsage();
  }

  @Get(':email')
  @ApiOperation({ summary: 'Get token usage for a user' })
  @ApiParam({ name: 'email', example: 'user@example.com' })
  @ApiOkResponse({ description: 'User token usage returned' })
  getUserUsage(@Param('email') email: string) {
    return this.tokenUsageService.getUserUsage(email);
  }

  @Get(':email/:agentName')
  @ApiOperation({ summary: 'Get token usage for a user and agent' })
  @ApiParam({ name: 'email', example: 'user@example.com' })
  @ApiParam({ name: 'agentName', enum: AgentName })
  @ApiOkResponse({ description: 'Agent token usage returned' })
  getAgentUsage(
    @Param('email') email: string,
    @Param('agentName') agentName: AgentName,
  ) {
    return this.tokenUsageService.getAgentUsage(email, agentName);
  }

  @Get(':email/:agentName/daily-usage/:date')
  @ApiOperation({
    summary: 'Get daily token usage for a user and agent by date',
  })
  @ApiParam({ name: 'email', example: 'user@example.com' })
  @ApiParam({ name: 'agentName', enum: AgentName })
  @ApiParam({
    name: 'date',
    example: '2026-05-13',
    description: 'Daily usage date in YYYY-MM-DD format',
  })
  @ApiOkResponse({
    description: 'Daily token usage returned',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', nullable: true },
        oauthId: { type: 'string' },
        agentName: { enum: Object.values(AgentName) },
        date: { type: 'string', format: 'date-time' },
        inputTokens: { type: 'integer', example: 1200 },
        outputTokens: { type: 'integer', example: 1300 },
        totalTokens: { type: 'integer', example: 2500 },
        createdAt: { type: 'string', format: 'date-time', nullable: true },
        updatedAt: { type: 'string', format: 'date-time', nullable: true },
        recordExists: { type: 'boolean', example: true },
      },
    },
  })
  getDailyTokenUsage(
    @Param('email') email: string,
    @Param('agentName') agentName: AgentName,
    @Param('date') date: string,
  ) {
    return this.tokenUsageService.getDailyTokenUsage(email, agentName, date);
  }

  @Patch(':email/:agentName/limit')
  @ApiOperation({ summary: 'Set token limit for a user and agent' })
  @ApiParam({ name: 'email', example: 'user@example.com' })
  @ApiParam({ name: 'agentName', enum: AgentName })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['totalTokenLimit'],
      properties: {
        totalTokenLimit: { type: 'integer', minimum: 0, example: 100000 },
      },
    },
  })
  @ApiOkResponse({ description: 'Token limit updated' })
  setTokenLimit(
    @Param('email') email: string,
    @Param('agentName') agentName: AgentName,
    @Body('totalTokenLimit') totalTokenLimit: number,
  ) {
    return this.tokenUsageService.setTokenLimit(
      email,
      agentName,
      totalTokenLimit,
    );
  }

  @Patch(':email/:agentName/usage')
  @ApiOperation({ summary: 'Record token usage for a user and agent' })
  @ApiParam({ name: 'email', example: 'user@example.com' })
  @ApiParam({ name: 'agentName', enum: AgentName })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['totalUsedInputTokens', 'totalUsedOutputTokens'],
      properties: {
        totalUsedInputTokens: { type: 'integer', minimum: 0, example: 1200 },
        totalUsedOutputTokens: { type: 'integer', minimum: 0, example: 1300 },
      },
    },
  })
  @ApiOkResponse({ description: 'Token usage updated' })
  setTokenUsage(
    @Param('email') email: string,
    @Param('agentName') agentName: AgentName,
    @Body()
    body: {
      totalUsedInputTokens: number;
      totalUsedOutputTokens: number;
    },
  ) {
    return this.tokenUsageService.setTokenUsage(email, agentName, body);
  }

  @Patch(':email/:agentName/daily-usage/:date')
  @ApiOperation({
    summary: 'Record daily token usage for a user and agent by date',
  })
  @ApiParam({ name: 'email', example: 'user@example.com' })
  @ApiParam({ name: 'agentName', enum: AgentName })
  @ApiParam({
    name: 'date',
    example: '2026-05-13',
    description: 'Daily usage date in YYYY-MM-DD format',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['inputTokens', 'outputTokens'],
      properties: {
        inputTokens: { type: 'integer', minimum: 0, example: 1200 },
        outputTokens: { type: 'integer', minimum: 0, example: 1300 },
      },
    },
  })
  @ApiOkResponse({ description: 'Daily token usage updated' })
  setDailyTokenUsage(
    @Param('email') email: string,
    @Param('agentName') agentName: AgentName,
    @Param('date') date: string,
    @Body()
    body: {
      inputTokens: number;
      outputTokens: number;
    },
  ) {
    return this.tokenUsageService.setDailyTokenUsage(
      email,
      agentName,
      date,
      body,
    );
  }
}
