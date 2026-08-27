import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  AssignMembershipDto,
  CreateMembershipDto,
  UpdateMembershipDto,
} from './dto/membership.dto';
import { MembershipService } from './membership.service';

@ApiTags('memberships')
@Controller('admin/memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Post()
  @ApiOperation({ summary: 'Create a membership template' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        name: 'Pro',
        durationDays: 30,
        monthlyTokenLimit: 100000,
        includedAgents: ['JIM'],
        includedGroupIds: ['1f0a6d4c-1c3e-4d1a-9b52-1a2b3c4d5e6f'],
      },
    },
  })
  @ApiOkResponse({ description: 'Membership created' })
  createMembership(@Body() body: CreateMembershipDto) {
    return this.membershipService.createMembership(body);
  }

  @Get()
  @ApiOperation({ summary: 'List membership templates' })
  @ApiOkResponse({ description: 'Memberships returned' })
  listMemberships() {
    return this.membershipService.listMemberships();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a membership template by id' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiOkResponse({ description: 'Membership returned' })
  getMembership(@Param('id') id: string) {
    return this.membershipService.getMembership(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a membership template' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        name: 'Pro Plus',
        durationDays: 60,
        monthlyTokenLimit: 150000,
        includedAgents: ['JIM', 'SARA_AI'],
        // Replaces the template's teams. Omit to leave them as they are; an
        // empty array unlinks them all (soft — no row is deleted).
        includedGroupIds: ['1f0a6d4c-1c3e-4d1a-9b52-1a2b3c4d5e6f'],
      },
    },
  })
  @ApiOkResponse({ description: 'Membership updated' })
  updateMembership(@Param('id') id: string, @Body() body: UpdateMembershipDto) {
    return this.membershipService.updateMembership(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a membership template' })
  @ApiParam({ name: 'id', description: 'Membership template id' })
  @ApiOkResponse({ description: 'Membership deleted' })
  deleteMembership(@Param('id') id: string) {
    return this.membershipService.deleteMembership(id);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign a membership template to a user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'membershipTemplateId'],
      properties: {
        userId: { type: 'string', format: 'uuid' },
        membershipTemplateId: { type: 'string', format: 'uuid' },
        durationOverride: { type: 'integer', example: 30 },
        monthlyTokenLimitOverride: { type: 'integer', minimum: 0, example: 80000 },
      },
    },
  })
  @ApiOkResponse({ description: 'Membership assigned' })
  assignMembership(@Body() body: AssignMembershipDto) {
    return this.membershipService.assignMembership(
      body.userId,
      body.membershipTemplateId,
      body.durationOverride,
      body.monthlyTokenLimitOverride,
    );
  }
}
