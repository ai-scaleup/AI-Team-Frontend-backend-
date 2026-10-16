import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AgencyMembershipService,
  CreateAgencyMembershipDto,
  UpdateAgencyMembershipDto,
} from './agency-membership.service';

/**
 * Agency memberships: the plans an agency can buy seat pools of. Separate
 * from /admin/memberships, so they never appear in the assign-to-user flow.
 * There is no delete: "remove" archives the row.
 */
@ApiTags('Agency memberships')
@Controller('admin/agency-memberships')
export class AgencyMembershipController {
  constructor(private readonly service: AgencyMembershipService) {}

  @Get()
  @ApiOperation({ summary: 'List agency memberships that are not archived' })
  list() {
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create an agency membership' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'monthlyTokenLimit'],
      properties: {
        name: { type: 'string', example: 'Agency Pro' },
        includedAgents: {
          type: 'array',
          items: { type: 'string' },
          example: ['TONY', 'ALEX'],
        },
        includedTeamIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
        monthlyTokenLimit: {
          type: 'integer',
          minimum: 1,
          example: 400000,
          description: 'Tokens each seat gets per 30-day cycle.',
        },
      },
    },
  })
  create(@Body() body: CreateAgencyMembershipDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an agency membership',
    description:
      'Fields left out stay as they are. includedTeamIds replaces the whole team list.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Agency Pro' },
        includedAgents: {
          type: 'array',
          items: { type: 'string' },
          example: ['TONY', 'ALEX'],
        },
        includedTeamIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
        monthlyTokenLimit: {
          type: 'integer',
          minimum: 1,
          example: 400000,
          description: 'Tokens each seat gets per 30-day cycle.',
        },
      },
    },
  })
  update(@Param('id') id: string, @Body() body: UpdateAgencyMembershipDto) {
    return this.service.update(id, body);
  }

  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archive an agency membership',
    description: 'Hides it from the list. The row is kept, never deleted.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  archive(@Param('id') id: string) {
    return this.service.archive(id);
  }
}
