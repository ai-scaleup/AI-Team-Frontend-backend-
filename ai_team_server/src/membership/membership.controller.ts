import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignMembershipDto, CreateMembershipDto } from './dto/membership.dto';
import { MembershipService } from './membership.service';

@ApiTags('memberships')
@Controller('admin/dashboard/memberships')
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
        includedGroupIds: [],
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
      },
    },
  })
  @ApiOkResponse({ description: 'Membership assigned' })
  assignMembership(@Body() body: AssignMembershipDto) {
    return this.membershipService.assignMembership(
      body.userId,
      body.membershipTemplateId,
      body.durationOverride,
    );
  }
}
