// src/llm-model/llm-model.controller.ts
import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { AgentName } from 'src/generated/prisma/client';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LlmModelService } from './llm-model.service';

const modelSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    provider: { type: 'string', example: 'anthropic' },
    modelId: { type: 'string', example: 'claude-sonnet-5' },
    label: { type: 'string', example: 'Claude Sonnet 5' },
    isDefault: { type: 'boolean' },
    isActive: { type: 'boolean' },
  },
};

@ApiTags('Chat models')
@Controller('admin/llm-models')
export class LlmModelController {
  constructor(private readonly service: LlmModelService) {}

  @Get()
  @ApiOperation({
    summary: 'List the chat models an admin can assign',
    description:
      'Active catalog rows in display order. The row with `isDefault: true` is what a team, membership or single-agent grant without its own model runs on.',
  })
  @ApiQuery({ name: 'provider', required: false, example: 'anthropic' })
  @ApiOkResponse({
    description: 'Models returned',
    schema: { type: 'array', items: modelSchema },
  })
  findAll(@Query('provider') provider?: string) {
    return this.service.findAll({ provider: provider?.trim() || undefined });
  }

  @Get('resolve')
  @ApiOperation({
    summary: "The model a user's chat with an agent runs on",
    description:
      "Called by the chat proxy before it forwards a message to n8n. The paying grant named by the page (`singleAssignmentId`, `membershipAssignmentId` or `teamId`) decides when it is the user's live grant and reaches the agent. Otherwise the user's grants are tried in token-tier order (single agent, team, membership; newest first) and the first one found decides. A grant without its own model, or none at all, gets the catalog default.",
  })
  @ApiQuery({ name: 'email', required: true })
  @ApiQuery({ name: 'agentName', required: true, enum: AgentName })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'membershipAssignmentId', required: false })
  @ApiQuery({ name: 'singleAssignmentId', required: false })
  @ApiOkResponse({
    description: 'Model resolved',
    schema: {
      type: 'object',
      properties: {
        model: modelSchema,
        source: {
          type: 'string',
          enum: ['single-agent', 'team', 'membership', 'default'],
        },
        teamId: { type: 'string', nullable: true },
        membershipAssignmentId: { type: 'string', nullable: true },
        singleAssignmentId: { type: 'string', nullable: true },
      },
    },
  })
  resolve(
    @Query('email') email?: string,
    @Query('agentName') agentName?: string,
    @Query('teamId') teamId?: string,
    @Query('membershipAssignmentId') membershipAssignmentId?: string,
    @Query('singleAssignmentId') singleAssignmentId?: string,
  ) {
    const trimmedEmail = email?.trim();
    if (!trimmedEmail) throw new BadRequestException('email is required');
    if (!agentName || !(agentName in AgentName)) {
      throw new BadRequestException(`Unknown agentName "${agentName}"`);
    }
    return this.service.resolveForAgent({
      email: trimmedEmail,
      agentName: agentName as AgentName,
      teamId: teamId?.trim() || undefined,
      membershipAssignmentId: membershipAssignmentId?.trim() || undefined,
      singleAssignmentId: singleAssignmentId?.trim() || undefined,
    });
  }
}
